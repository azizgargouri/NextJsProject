import { randomBytes } from 'node:crypto';
import { ZeroHash } from 'ethers';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/database/errors';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import {
  buildContractDocument,
  hashContractDocument,
  hashText,
  stableStringify,
  terminationReasonHash,
  toDateOnly,
  toUnixSeconds,
} from '../../../lib/contracts/document';
import {
  buildContractIntent,
  computeContractId,
  contractIntentTypedData,
  contractTerminationTypedData,
} from '../../../lib/contracts/eip712';
import type {
  ContractProposalDto,
  ContractSalaryDto,
  EmployeeContractDto,
  PreparedContractDto,
} from '../../../types';
import { employeesService } from '../employees/employees.service';
import { ensureUserWalletById, ensureEmployeeWalletById } from '../../shared/wallet/provisioning';
import { signTypedDataWithEncryptedKey } from '../../shared/wallet/custodial';
import {
  ensureHrAdminOnChain,
  getChainConfig,
  isHrAdminOnChain,
  sendCreateContractTransaction,
  sendTerminateContractTransaction,
  verifyCreateTransaction,
} from './contracts.chain';
import { contractDocumentsService } from './contracts-documents.service';
import { ContractsRepository } from './contracts.repository';
import { ContractProposalsRepository } from './contracts-proposals.repository';
import {
  serializeContract,
  serializePreparedContract,
  serializeProposal,
} from './contracts.serializer';
import type {
  ContractAnchorProposalInput,
  ContractPrepareInput,
  ContractProposeInput,
  ContractRecordInput,
  ContractSignProposalInput,
  ContractTerminateInput,
} from './contracts.schema';
import {
  signContractPreparation,
  verifyContractPreparation,
  type PreparedContractPayload,
} from './contracts.token';

const PROPOSAL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Employment contract orchestration.
 *
 * Flow:
 *  1. `prepare` builds the canonical document, hashes it and signs a
 *     short-lived preparation token. Nothing is persisted.
 *  2. HR signs the EIP-712 intent with MetaMask and `propose` stores the
 *     proposal. Nothing is on-chain yet.
 *  3. The employee reviews the proposal and signs the same intent with their
 *     wallet. This is a signature only: no transaction, no gas, no funds.
 *  4. A backend system wallet (CONTRACT_ADMIN_PRIVATE_KEY, not an app user)
 *     sends the anchor transaction and pays the gas, so neither the employee
 *     nor the HR user spends anything. The registry verifies both signatures
 *     before it stores the contract and the full document.
 *  5. `record` re-reads the receipt and the on-chain record, then mirrors the
 *     contract in Mongo.
 *
 * The database is never trusted for on-chain facts: contract ids, wallets,
 * hashes and the document itself are read back from the chain.
 */
export class ContractsService {
  private readonly repository = new ContractsRepository();
  private readonly proposals = new ContractProposalsRepository();

  /** Contracts visible to the session: whole organisation for admins, own rows otherwise. */
  async listForSession(user: AccessTokenPayload): Promise<EmployeeContractDto[]> {
    if (user.role === 'ADMIN') {
      const rows = await this.repository.findForOrganization(user.sub);
      return rows.map(serializeContract);
    }

    const profile = await employeesService.findMyProfile(user.email);
    if (!profile) return [];

    const rows = await this.repository.findForEmployee(profile.id);
    return rows.map(serializeContract);
  }

  /** Dual-signed proposals that are still waiting for the employee. */
  async listProposals(user: AccessTokenPayload): Promise<ContractProposalDto[]> {
    await this.proposals.expireOld();

    if (user.role === 'ADMIN') {
      const rows = await this.proposals.listForOrganization(user.sub);
      return rows.map(serializeProposal);
    }

    const profile = await employeesService.findMyProfile(user.email);
    if (!profile) return [];

    const rows = await this.proposals.listForEmployee(profile.id);
    return rows.map(serializeProposal);
  }

  async findOne(id: string, user: AccessTokenPayload): Promise<EmployeeContractDto> {
    const row = await this.repository.findOneById(id);
    if (!row) throw new NotFoundError('Contract');

    const isAdmin = user.role === 'ADMIN' && row.organization === user.sub;
    const profile = isAdmin ? null : await employeesService.findMyProfile(user.email);
    if (!isAdmin && profile?.id !== row.employee) {
      throw new ForbiddenError('Contract is not in your organisation');
    }

    return serializeContract(row);
  }

  /** Builds the canonical document + typed data; no DB write, no transaction. */
  async prepare(
    user: AccessTokenPayload,
    input: ContractPrepareInput,
  ): Promise<PreparedContractDto> {
    if (user.role !== 'ADMIN') throw new ForbiddenError('Admin access required');

    const chain = getChainConfig();
    const employee = await employeesService.findOneInOrganization(input.employeeId, user.sub);

    if (employee.status !== 'active') {
      throw new BadRequestError('Only active employees can receive a new contract.');
    }

    // Both wallets are app-managed: derive them from the authenticated HR
    // account and the directory record. The client never supplies addresses.
    const employerWallet = await ensureUserWalletById(user.sub);
    const employeeWallet = await ensureEmployeeWalletById(employee.id);

    const current = await this.repository.findCurrentForEmployee(employee.id);
    if (current) {
      throw new BadRequestError(
        `${employee.employeeRef} already has a ${current.status} contract (${current.contractId}). Terminate it before issuing a new one.`,
      );
    }

    const openProposal = await this.proposals.findOpenForEmployee(employee.id);
    if (openProposal) {
      throw new BadRequestError(
        `${employee.employeeRef} already has a proposal waiting for their signature (${openProposal.id}).`,
      );
    }

    // The HR-uploaded PDF is required. Its hash and URL become part of the
    // canonical document, so the on-chain signature commits to the exact file.
    const attachment = await contractDocumentsService.findForOrganization(
      input.documentId,
      user.sub,
    );

    const startDate = toDateOnly(input.startDate);
    const endDate = input.endDate ? toDateOnly(input.endDate) : null;
    const startTimestamp = toUnixSeconds(startDate);
    const endTimestamp = endDate ? toUnixSeconds(endDate) : 0;

    if (endTimestamp !== 0 && endTimestamp <= startTimestamp) {
      throw new BadRequestError('End date must be after the start date.');
    }

    const salary: ContractSalaryDto | null =
      input.salaryAmount === undefined
        ? null
        : {
            amount: input.salaryAmount,
            currency: input.salaryCurrency.toUpperCase(),
            period: input.salaryPeriod,
          };

    const organizationHash = hashText(user.sub);
    const issuedAt = new Date().toISOString();

    const document = buildContractDocument({
      employeeRef: employee.employeeRef,
      employeeName: employee.fullName,
      employeeEmail: employee.email,
      employeeWallet: employeeWallet.address,
      organizationHash,
      employerWallet: employerWallet.address,
      jobTitle: input.jobTitle,
      salary,
      startDate,
      endDate,
      attachment: {
        kind: 'pdf',
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        hash: attachment.hash,
        uri: attachment.uri,
      },
      issuedAt,
    });

    const documentHash = hashContractDocument(document);
    // Namespaced with the private organisation id so the low-entropy EMP001
    // cannot be brute-forced from the public chain alone.
    const employeeRefHash = hashText(`moveup:employee:${user.sub}:${employee.employeeRef}`);
    const documentUri = attachment.uri;
    const nonce = `0x${randomBytes(32).toString('hex')}`;
    const deadline = Math.floor(Date.now() / 1000) + PROPOSAL_TTL_SECONDS;

    const payload: PreparedContractPayload = {
      organizationId: user.sub,
      organizationHash,
      employeeId: employee.id,
      employeeRef: employee.employeeRef,
      employeeName: employee.fullName,
      employeeEmail: employee.email,
      employeeWallet: employeeWallet.address,
      employerWallet: employerWallet.address,
      jobTitle: input.jobTitle,
      salary,
      startDate,
      startTimestamp,
      endDate,
      endTimestamp,
      documentUri,
      documentHash,
      employeeRefHash,
      chainId: chain.chainId,
      contractAddress: chain.contractAddress,
      version: 1,
      previousContractId: ZeroHash,
      nonce,
      deadline,
      document,
    };

    const token = await signContractPreparation(payload);
    return serializePreparedContract(payload, token);
  }

  /** Stores the HR co-signature. The contract is still off-chain at this point. */
  async propose(
    user: AccessTokenPayload,
    input: ContractProposeInput,
  ): Promise<ContractProposalDto> {
    if (user.role !== 'ADMIN') throw new ForbiddenError('Admin access required');

    const prepared = await verifyContractPreparation(input.token);
    if (prepared.organizationId !== user.sub) {
      throw new ForbiddenError('Contract preparation belongs to another organisation.');
    }

    const chain = getChainConfig();
    if (
      prepared.contractAddress.toLowerCase() !== chain.contractAddress.toLowerCase() ||
      prepared.chainId !== chain.chainId
    ) {
      throw new BadRequestError('The contract was prepared for a different network.');
    }

    const employee = await employeesService.findOneInOrganization(prepared.employeeId, user.sub);
    if (employee.status !== 'active') {
      throw new BadRequestError('Only active employees can sign a contract.');
    }
    if (
      employee.walletAddress &&
      employee.walletAddress.toLowerCase() !== prepared.employeeWallet.toLowerCase()
    ) {
      throw new BadRequestError(
        'The employee wallet changed while the contract was being prepared.',
      );
    }

    const current = await this.repository.findCurrentForEmployee(employee.id);
    if (current) {
      throw new BadRequestError(
        `${employee.employeeRef} already has a ${current.status} contract (${current.contractId}).`,
      );
    }

    const openProposal = await this.proposals.findOpenForEmployee(employee.id);
    if (openProposal) {
      throw new BadRequestError(
        `${employee.employeeRef} already has a proposal waiting for their signature (${openProposal.id}).`,
      );
    }

    const intent = buildContractIntent({
      organizationHash: prepared.organizationHash,
      employerWallet: prepared.employerWallet,
      employeeWallet: prepared.employeeWallet,
      employeeRefHash: prepared.employeeRefHash,
      documentHash: prepared.documentHash,
      startTimestamp: prepared.startTimestamp,
      endTimestamp: prepared.endTimestamp,
      previousContractId: prepared.previousContractId,
      version: prepared.version,
      nonce: prepared.nonce,
      deadline: prepared.deadline,
    });
    const typedData = contractIntentTypedData(prepared.chainId, prepared.contractAddress, intent);

    // Sign with the HR account's custodial wallet. The system wallet (registry
    // owner) authorises that wallet for this organisation if needed.
    const hrWallet = await ensureUserWalletById(user.sub);
    if (hrWallet.address.toLowerCase() !== prepared.employerWallet.toLowerCase()) {
      throw new BadRequestError(
        'The HR app wallet changed while the contract was being prepared. Prepare it again.',
      );
    }

    await ensureHrAdminOnChain(hrWallet.address, prepared.organizationHash);
    if (!(await isHrAdminOnChain(hrWallet.address, prepared.organizationHash))) {
      throw new BadRequestError(
        'The HR app wallet could not be authorised on-chain. Make CONTRACT_ADMIN_PRIVATE_KEY the registry owner or grant it manually.',
      );
    }

    const signature = await signTypedDataWithEncryptedKey(
      hrWallet.encryptedPrivateKey,
      typedData.domain,
      typedData.types,
      typedData.message,
    );

    const created = await this.proposals.create({
      organization: user.sub,
      employee: employee.id,
      employeeRef: prepared.employeeRef,
      employeeName: prepared.employeeName,
      employeeEmail: prepared.employeeEmail,
      employeeWallet: prepared.employeeWallet,
      employerWallet: prepared.employerWallet,
      chainId: prepared.chainId,
      contractAddress: prepared.contractAddress,
      organizationHash: prepared.organizationHash,
      employeeRefHash: prepared.employeeRefHash,
      jobTitle: prepared.jobTitle,
      salary: prepared.salary,
      startDate: new Date(prepared.startTimestamp * 1000),
      endDate: prepared.endTimestamp ? new Date(prepared.endTimestamp * 1000) : null,
      documentHash: prepared.documentHash,
      documentUri: prepared.documentUri,
      document: prepared.document as unknown as Record<string, unknown>,
      version: prepared.version,
      previousContractId: prepared.previousContractId,
      nonce: prepared.nonce,
      deadline: prepared.deadline,
      status: 'awaiting_employee',
      employerSignature: signature.toLowerCase(),
      contractId: null,
      createdTxHash: null,
      expiresAt: new Date(prepared.deadline * 1000),
    });

    return serializeProposal(created);
  }

  /**
   * Stores the employee's gasless EIP-712 co-signature. Nothing is sent to the
   * chain here; an HR admin anchors the dual-signed intent afterwards.
   */
  async signProposal(
    user: AccessTokenPayload,
    input: ContractSignProposalInput,
  ): Promise<ContractProposalDto> {
    const proposal = await this.proposals.findOneById(input.proposalId);
    if (!proposal) throw new NotFoundError('Contract proposal');

    const profile = await employeesService.findMyProfile(user.email);
    if (!profile || profile.id !== proposal.employee) {
      throw new ForbiddenError('Only the assigned employee can sign this proposal.');
    }

    if (proposal.status === 'completed' || proposal.contractId) {
      throw new BadRequestError('This proposal is already on-chain.');
    }
    if (proposal.status !== 'awaiting_employee' || proposal.deadline * 1000 <= Date.now()) {
      throw new BadRequestError('This proposal has expired. Ask HR to issue a new one.');
    }
    if (proposal.employeeSignature) {
      throw new BadRequestError('This proposal is already signed. HR will anchor it on-chain.');
    }

    const chain = getChainConfig();
    if (
      proposal.contractAddress.toLowerCase() !== chain.contractAddress.toLowerCase() ||
      proposal.chainId !== chain.chainId
    ) {
      throw new BadRequestError('The proposal was created for a different network.');
    }

    const startTimestamp = Math.floor(proposal.startDate.getTime() / 1000);
    const endTimestamp = proposal.endDate ? Math.floor(proposal.endDate.getTime() / 1000) : 0;

    const intent = buildContractIntent({
      organizationHash: proposal.organizationHash,
      employerWallet: proposal.employerWallet,
      employeeWallet: proposal.employeeWallet,
      employeeRefHash: proposal.employeeRefHash,
      documentHash: proposal.documentHash,
      startTimestamp,
      endTimestamp,
      previousContractId: proposal.previousContractId,
      version: proposal.version,
      nonce: proposal.nonce,
      deadline: proposal.deadline,
    });
    const typedData = contractIntentTypedData(proposal.chainId, proposal.contractAddress, intent);

    // The employee's app wallet signs on their behalf. The proposal is still
    // off-chain; HR anchors the dual-signed intent afterwards.
    const employeeWallet = await ensureEmployeeWalletById(proposal.employee);
    if (employeeWallet.address.toLowerCase() !== proposal.employeeWallet.toLowerCase()) {
      throw new BadRequestError(
        'The employee app wallet changed while the proposal was pending. Ask HR to issue a new proposal.',
      );
    }

    const signature = await signTypedDataWithEncryptedKey(
      employeeWallet.encryptedPrivateKey,
      typedData.domain,
      typedData.types,
      typedData.message,
    );

    const updated = await this.proposals.update(proposal.id, {
      employeeSignature: signature.toLowerCase(),
      employeeSignedAt: new Date(),
    });

    return serializeProposal(updated);
  }

  /**
   * Admin step: publishes a dual-signed proposal. The transaction is sent by
   * the backend system wallet, which pays the gas; the HR user and the
   * employee only ever produce free EIP-712 signatures.
   */
  async anchor(
    user: AccessTokenPayload,
    input: ContractAnchorProposalInput,
  ): Promise<EmployeeContractDto> {
    if (user.role !== 'ADMIN') throw new ForbiddenError('Admin access required');

    const proposal = await this.proposals.findOneById(input.proposalId);
    if (!proposal) throw new NotFoundError('Contract proposal');
    if (proposal.organization !== user.sub) {
      throw new ForbiddenError('This proposal belongs to another organisation.');
    }

    if (proposal.status === 'completed' && proposal.contractId) {
      const existing = await this.repository.findByContractId(proposal.contractId);
      if (existing) return serializeContract(existing);
    }
    if (proposal.status !== 'awaiting_employee') {
      throw new BadRequestError(`A ${proposal.status} proposal cannot be published on-chain.`);
    }
    if (proposal.deadline * 1000 <= Date.now()) {
      throw new BadRequestError('The signing window has expired. Issue a new proposal.');
    }
    if (!proposal.employeeSignature) {
      throw new BadRequestError('The employee has not signed this proposal yet.');
    }

    const chain = getChainConfig();
    if (
      proposal.contractAddress.toLowerCase() !== chain.contractAddress.toLowerCase() ||
      proposal.chainId !== chain.chainId
    ) {
      throw new BadRequestError('The proposal was created for a different network.');
    }

    const startTimestamp = Math.floor(proposal.startDate.getTime() / 1000);
    const endTimestamp = proposal.endDate ? Math.floor(proposal.endDate.getTime() / 1000) : 0;

    const intent = buildContractIntent({
      organizationHash: proposal.organizationHash,
      employerWallet: proposal.employerWallet,
      employeeWallet: proposal.employeeWallet,
      employeeRefHash: proposal.employeeRefHash,
      documentHash: proposal.documentHash,
      startTimestamp,
      endTimestamp,
      previousContractId: proposal.previousContractId,
      version: proposal.version,
      nonce: proposal.nonce,
      deadline: proposal.deadline,
    });

    const contractId = computeContractId(intent).toLowerCase();

    // A previous attempt may have mined the transaction and failed while
    // mirroring it. Reuse that hash instead of paying gas for a revert.
    let txHash = proposal.createdTxHash;
    if (!txHash) {
      const anchored = await sendCreateContractTransaction({
        intent,
        document: stableStringify(proposal.document),
        documentUri: proposal.documentUri,
        employerSignature: proposal.employerSignature,
        employeeSignature: proposal.employeeSignature,
        contractId,
      });
      txHash = anchored.txHash;
      await this.proposals.update(proposal.id, { createdTxHash: txHash });
    }

    return this.record(user, {
      proposalId: proposal.id,
      contractId,
      txHash,
    });
  }

  /** Verifies the anchor transaction receipt and mirrors the chain record in MongoDB. */
  async record(user: AccessTokenPayload, input: ContractRecordInput): Promise<EmployeeContractDto> {
    const proposal = await this.proposals.findOneById(input.proposalId);
    if (!proposal) throw new NotFoundError('Contract proposal');

    const isAdmin = user.role === 'ADMIN' && proposal.organization === user.sub;
    const profile = isAdmin ? null : await employeesService.findMyProfile(user.email);
    const isEmployee = profile?.id === proposal.employee;

    if (!isAdmin && !isEmployee) {
      throw new ForbiddenError('This proposal is not assigned to you.');
    }

    if (proposal.status === 'completed') {
      const existing = await this.repository.findByContractId(input.contractId);
      if (existing && existing.contractId === proposal.contractId)
        return serializeContract(existing);
      throw new BadRequestError('This proposal was already anchored with another contract.');
    }
    if (proposal.status !== 'awaiting_employee' && proposal.status !== 'expired') {
      throw new BadRequestError(`A ${proposal.status} proposal cannot be anchored.`);
    }

    const chain = getChainConfig();
    if (
      proposal.contractAddress.toLowerCase() !== chain.contractAddress.toLowerCase() ||
      proposal.chainId !== chain.chainId
    ) {
      throw new BadRequestError('The proposal was created for a different network.');
    }

    const startTimestamp = Math.floor(proposal.startDate.getTime() / 1000);
    const endTimestamp = proposal.endDate ? Math.floor(proposal.endDate.getTime() / 1000) : 0;

    const intent = buildContractIntent({
      organizationHash: proposal.organizationHash,
      employerWallet: proposal.employerWallet,
      employeeWallet: proposal.employeeWallet,
      employeeRefHash: proposal.employeeRefHash,
      documentHash: proposal.documentHash,
      startTimestamp,
      endTimestamp,
      previousContractId: proposal.previousContractId,
      version: proposal.version,
      nonce: proposal.nonce,
      deadline: proposal.deadline,
    });

    if (computeContractId(intent).toLowerCase() !== input.contractId.toLowerCase()) {
      throw new BadRequestError('The contract id does not match the signed proposal.');
    }

    const document = stableStringify(proposal.document);

    const verified = await verifyCreateTransaction({
      txHash: input.txHash,
      contractId: input.contractId,
      organizationHash: proposal.organizationHash,
      employerWallet: proposal.employerWallet,
      employeeWallet: proposal.employeeWallet,
      employeeRefHash: proposal.employeeRefHash,
      documentHash: proposal.documentHash,
      startTimestamp,
      endTimestamp,
      documentUri: proposal.documentUri,
      version: proposal.version,
      previousContractId: proposal.previousContractId,
      nonce: proposal.nonce,
      deadline: proposal.deadline,
      document,
      employerSignature: proposal.employerSignature,
    });

    const existing = await this.repository.findByContractId(input.contractId);
    if (existing) {
      await this.proposals.update(proposal.id, {
        status: 'completed',
        contractId: input.contractId,
        createdTxHash: input.txHash,
      });
      return serializeContract(existing);
    }

    const created = await this.repository.create({
      contractId: input.contractId,
      chainId: chain.chainId,
      contractAddress: chain.contractAddress,
      organization: proposal.organization,
      employee: proposal.employee,
      employeeRef: proposal.employeeRef,
      employeeName: proposal.employeeName,
      employeeEmail: proposal.employeeEmail,
      employeeWallet: proposal.employeeWallet,
      employerWallet: proposal.employerWallet,
      status: 'active',
      jobTitle: proposal.jobTitle,
      salary: proposal.salary,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      documentHash: proposal.documentHash,
      employeeRefHash: proposal.employeeRefHash,
      organizationHash: proposal.organizationHash,
      documentUri: proposal.documentUri,
      document: proposal.document,
      version: proposal.version,
      previousContractId: proposal.previousContractId,
      supersededBy: null,
      nonce: verified.nonce,
      employerSignature: verified.employerSignature,
      employeeSignature: verified.employeeSignature,
      createdTxHash: input.txHash,
      acceptedTxHash: input.txHash,
      terminatedTxHash: null,
      acceptedAt: verified.acceptedAt,
      terminatedAt: null,
      terminatedByWallet: null,
      terminationReasonHash: null,
    });

    await this.proposals.update(proposal.id, {
      status: 'completed',
      contractId: input.contractId,
      createdTxHash: input.txHash,
    });

    const employee = await employeesService.findOneInOrganization(
      proposal.employee,
      proposal.organization,
    );
    if (!employee.walletAddress) {
      await employeesService.updateEmployee(
        proposal.employee,
        { walletAddress: proposal.employeeWallet },
        proposal.organization,
      );
    }

    return serializeContract(created);
  }

  /** Employer (admin) or employee (resignation) ends an active contract. */
  async terminate(
    user: AccessTokenPayload,
    input: ContractTerminateInput,
  ): Promise<EmployeeContractDto> {
    const contract = await this.repository.findByContractId(input.contractId);
    if (!contract) throw new NotFoundError('Contract');

    const isAdmin = user.role === 'ADMIN' && contract.organization === user.sub;
    const profile = isAdmin ? null : await employeesService.findMyProfile(user.email);
    const isEmployee = profile?.id === contract.employee;

    if (!isAdmin && !isEmployee) {
      throw new ForbiddenError(
        'Only the employer or the assigned employee can terminate this contract.',
      );
    }

    if (contract.status === 'terminated') return serializeContract(contract);
    if (contract.status !== 'active') {
      throw new BadRequestError(`A ${contract.status} contract cannot be terminated.`);
    }

    const actorWallet = (isAdmin ? contract.employerWallet : contract.employeeWallet).toLowerCase();
    const reasonHash = terminationReasonHash(input.reason);

    // Resolve the app wallet that must authorise this termination.
    const actor = isAdmin
      ? await ensureUserWalletById(user.sub)
      : await ensureEmployeeWalletById(contract.employee);
    if (actor.address.toLowerCase() !== actorWallet) {
      throw new BadRequestError(
        isAdmin
          ? 'This contract was issued by a different HR app wallet. Only that wallet can terminate it.'
          : 'This contract belongs to a different employee app wallet. Only that wallet can resign it.',
      );
    }

    const deadline = input.deadline ?? Math.floor(Date.now() / 1000) + 15 * 60;
    if (deadline * 1000 <= Date.now()) {
      throw new BadRequestError('The termination signature expired. Try again.');
    }

    const { chainId, contractAddress } = getChainConfig();
    const typedData = contractTerminationTypedData(chainId, contractAddress, {
      contractId: contract.contractId,
      reasonHash,
      deadline,
    });

    const signature = await signTypedDataWithEncryptedKey(
      actor.encryptedPrivateKey,
      typedData.domain,
      typedData.types,
      typedData.message,
    );

    const verified = await sendTerminateContractTransaction({
      contractId: contract.contractId,
      reasonHash,
      deadline,
      signature,
      expectedSigner: actorWallet,
    });

    if (verified.reasonHash.toLowerCase() !== reasonHash.toLowerCase()) {
      throw new BadRequestError('The on-chain termination reason does not match the request.');
    }

    const updated = await this.repository.update(contract.id, {
      status: 'terminated',
      terminatedAt: verified.terminatedAt,
      terminatedByWallet: verified.terminatedBy,
      terminatedTxHash: verified.txHash,
      terminationReasonHash: reasonHash,
    });

    return serializeContract(updated);
  }
}

export const contractsService = new ContractsService();
