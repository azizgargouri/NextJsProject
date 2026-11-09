import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';

const ORGANIZATION_ID = ethers.id('org-moveup');
const OTHER_ORGANIZATION_ID = ethers.id('org-other');
const EMPLOYEE_REF_HASH = ethers.id('EMP001');
const DOCUMENT = JSON.stringify({
  schema: 'moveup.employment-contract.v1',
  employee: { ref: 'EMP001', name: 'Alice Example', email: 'alice@moveup.tn' },
  terms: { jobTitle: 'Senior mover', salary: { amount: 1200, currency: 'TND', period: 'month' } },
});
const NEXT_DOCUMENT = JSON.stringify({
  schema: 'moveup.employment-contract.v1',
  employee: { ref: 'EMP001', name: 'Alice Example', email: 'alice@moveup.tn' },
  terms: { jobTitle: 'Team lead', salary: { amount: 1600, currency: 'TND', period: 'month' } },
});
const DOCUMENT_HASH = ethers.id(DOCUMENT);
const NEXT_DOCUMENT_HASH = ethers.id(NEXT_DOCUMENT);
const DOCUMENT_URI = 'urn:moveup:employment-contract:EMP001:v1';
const NEXT_DOCUMENT_URI = 'urn:moveup:employment-contract:EMP001:v2';

const ONE_YEAR = 365 * 24 * 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;

const INTENT_TYPES = {
  ContractIntent: [
    { name: 'organizationId', type: 'bytes32' },
    { name: 'employer', type: 'address' },
    { name: 'employee', type: 'address' },
    { name: 'employeeRefHash', type: 'bytes32' },
    { name: 'documentHash', type: 'bytes32' },
    { name: 'startDate', type: 'uint64' },
    { name: 'endDate', type: 'uint64' },
    { name: 'previousContractId', type: 'bytes32' },
    { name: 'version', type: 'uint32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
};

const TERMINATION_TYPES = {
  Termination: [
    { name: 'contractId', type: 'bytes32' },
    { name: 'reasonHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
};

async function eip712Domain(registry: { getAddress(): Promise<string> }) {
  const { chainId } = await ethers.provider.getNetwork();
  return {
    name: 'MoveUp Employment Contract Registry',
    version: '2',
    chainId,
    verifyingContract: await registry.getAddress(),
  };
}

async function deployFixture() {
  const [owner, hr, otherHr, employee, outsider] = await ethers.getSigners();

  const Registry = await ethers.getContractFactory('EmploymentContractRegistry');
  const registry = await Registry.deploy(owner.address);
  await registry.waitForDeployment();

  await registry.connect(owner).setHrAdmin(hr.address, ORGANIZATION_ID);
  await registry.connect(owner).setHrAdmin(otherHr.address, OTHER_ORGANIZATION_ID);

  return { registry, owner, hr, otherHr, employee, outsider };
}

type IntentContext = Pick<
  Awaited<ReturnType<typeof deployFixture>>,
  'registry' | 'hr' | 'employee'
>;

async function buildIntent(
  context: IntentContext,
  overrides: Partial<{
    organizationId: string;
    employer: string;
    employee: string;
    employeeRefHash: string;
    documentHash: string;
    startDate: number;
    endDate: number;
    previousContractId: string;
    version: number;
    nonce: bigint;
    deadline: number;
  }> = {},
) {
  const latest = await time.latest();
  return {
    organizationId: ORGANIZATION_ID,
    employer: context.hr.address,
    employee: context.employee.address,
    employeeRefHash: EMPLOYEE_REF_HASH,
    documentHash: DOCUMENT_HASH,
    startDate: latest + 86_400,
    endDate: latest + 86_400 + ONE_YEAR,
    previousContractId: ethers.ZeroHash,
    version: 1,
    nonce: 1n,
    deadline: latest + SEVEN_DAYS,
    ...overrides,
  };
}

async function signIntent(
  registry: { getAddress(): Promise<string> },
  signer: { signTypedData(domain: object, types: object, value: object): Promise<string> },
  intent: object,
) {
  return signer.signTypedData(await eip712Domain(registry), INTENT_TYPES, intent);
}

async function signTermination(
  registry: { getAddress(): Promise<string> },
  signer: { signTypedData(domain: object, types: object, value: object): Promise<string> },
  contractId: string,
  reasonHash: string,
  deadline: number,
) {
  return signer.signTypedData(await eip712Domain(registry), TERMINATION_TYPES, {
    contractId,
    reasonHash,
    deadline,
  });
}

async function signedCreate(
  context: Awaited<ReturnType<typeof deployFixture>>,
  overrides: {
    intent?: Parameters<typeof buildIntent>[1];
    document?: string;
    documentUri?: string;
    employerSignature?: string;
    employeeSignature?: string;
    sender?: Awaited<ReturnType<typeof ethers.getSigners>>[number];
  } = {},
) {
  const intent = await buildIntent(context, overrides.intent);
  const document = overrides.document ?? DOCUMENT;
  const documentUri = overrides.documentUri ?? DOCUMENT_URI;

  const employerSignature =
    overrides.employerSignature ?? (await signIntent(context.registry, context.hr, intent));
  const employeeSignature =
    overrides.employeeSignature ?? (await signIntent(context.registry, context.employee, intent));

  const tx = await context.registry
    .connect(overrides.sender ?? context.employee)
    .createContract(intent, document, documentUri, employerSignature, employeeSignature);
  const receipt = await tx.wait();

  const event = receipt?.logs
    .map((log) => {
      try {
        return context.registry.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === 'ContractCreated');

  if (!event) throw new Error('ContractCreated event missing');

  return {
    intent,
    document,
    documentUri,
    employerSignature,
    employeeSignature,
    tx,
    receipt,
    contractId: event.args.id as string,
    event,
  };
}

async function createContractFixture() {
  const context = await deployFixture();
  const created = await signedCreate(context);
  return { ...context, ...created };
}

describe('EmploymentContractRegistry (dual-signed)', () => {
  describe('HR administration', () => {
    it('lets the owner authorize and revoke HR wallets', async () => {
      const { registry, owner, hr, outsider } = await loadFixture(deployFixture);

      expect(await registry.hrOrganization(hr.address)).to.equal(ORGANIZATION_ID);
      expect(await registry.isHrAdminFor(hr.address, ORGANIZATION_ID)).to.equal(true);
      expect(await registry.isHrAdminFor(outsider.address, ORGANIZATION_ID)).to.equal(false);

      await expect(registry.connect(owner).removeHrAdmin(hr.address))
        .to.emit(registry, 'HrAdminUpdated')
        .withArgs(hr.address, ORGANIZATION_ID, false);
      expect(await registry.hrOrganization(hr.address)).to.equal(ethers.ZeroHash);
    });

    it('rejects HR administration from non-owners', async () => {
      const { registry, hr, outsider } = await loadFixture(deployFixture);
      await expect(
        registry.connect(outsider).setHrAdmin(outsider.address, ORGANIZATION_ID),
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');
      await expect(
        registry.connect(hr).setHrAdmin(outsider.address, ORGANIZATION_ID),
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Dual-signed creation', () => {
    it('creates an active contract and stores the full document and both signatures', async () => {
      const {
        registry,
        hr,
        employee,
        contractId,
        document,
        employerSignature,
        employeeSignature,
        intent,
        event,
      } = await loadFixture(createContractFixture);

      const contract = await registry.getContract(contractId);
      expect(contract.id).to.equal(contractId);
      expect(contract.organizationId).to.equal(ORGANIZATION_ID);
      expect(contract.employer).to.equal(hr.address);
      expect(contract.employee).to.equal(employee.address);
      expect(contract.employeeRefHash).to.equal(EMPLOYEE_REF_HASH);
      expect(contract.documentHash).to.equal(DOCUMENT_HASH);
      expect(contract.document).to.equal(document);
      expect(contract.documentUri).to.equal(DOCUMENT_URI);
      expect(contract.employerSignature).to.equal(employerSignature);
      expect(contract.employeeSignature).to.equal(employeeSignature);
      expect(contract.version).to.equal(1);
      expect(contract.deadline).to.equal(intent.deadline);
      expect(event?.args.deadline).to.equal(intent.deadline);
      expect(contract.status).to.equal(1); // Active
      expect(contract.acceptedAt).to.be.greaterThan(0);
      expect(contract.createdAt).to.equal(contract.acceptedAt);
      expect(await registry.contractExists(contractId)).to.equal(true);
    });

    it('lets a relayer submit as long as both signatures are valid', async () => {
      const context = await deployFixture();
      const created = await signedCreate(context, { sender: context.outsider });

      expect(await context.registry.contractExists(created.contractId)).to.equal(true);
      const contract = await context.registry.getContract(created.contractId);
      expect(contract.status).to.equal(1);
      expect(contract.employee).to.equal(context.employee.address);
    });

    it('rejects a missing or wrong employee signature', async () => {
      const context = await deployFixture();
      const intent = await buildIntent(context);
      const employerSignature = await signIntent(context.registry, context.hr, intent);
      const wrongEmployeeSignature = await signIntent(context.registry, context.outsider, intent);

      await expect(
        context.registry
          .connect(context.employee)
          .createContract(
            intent,
            DOCUMENT,
            DOCUMENT_URI,
            employerSignature,
            wrongEmployeeSignature,
          ),
      ).to.be.revertedWithCustomError(context.registry, 'InvalidEmployeeSignature');
    });

    it('rejects a missing or wrong employer signature', async () => {
      const context = await deployFixture();
      const intent = await buildIntent(context);
      const wrongEmployerSignature = await signIntent(context.registry, context.outsider, intent);
      const employeeSignature = await signIntent(context.registry, context.employee, intent);

      await expect(
        context.registry
          .connect(context.employee)
          .createContract(
            intent,
            DOCUMENT,
            DOCUMENT_URI,
            wrongEmployerSignature,
            employeeSignature,
          ),
      ).to.be.revertedWithCustomError(context.registry, 'InvalidEmployerSignature');
    });

    it('rejects an HR wallet that is not authorized for the organisation', async () => {
      const context = await deployFixture();
      const intent = await buildIntent(context, {
        employer: context.otherHr.address,
      });
      const employerSignature = await signIntent(context.registry, context.otherHr, intent);
      const employeeSignature = await signIntent(context.registry, context.employee, intent);

      await expect(
        context.registry
          .connect(context.employee)
          .createContract(
            intent,
            DOCUMENT,
            DOCUMENT_URI,
            employerSignature,
            employeeSignature,
          ),
      ).to.be.revertedWithCustomError(context.registry, 'NotHrAdmin');
    });

    it('rejects a document that does not match the signed hash', async () => {
      const context = await deployFixture();
      await expect(
        signedCreate(context, { document: `${DOCUMENT} tampered` }),
      ).to.be.revertedWithCustomError(context.registry, 'DocumentHashMismatch');
    });

    it('rejects an expired signature deadline', async () => {
      const context = await deployFixture();
      const intent = await buildIntent(context, { deadline: (await time.latest()) + 100 });
      const employerSignature = await signIntent(context.registry, context.hr, intent);
      const employeeSignature = await signIntent(context.registry, context.employee, intent);

      await time.increaseTo(intent.deadline + 1);

      await expect(
        context.registry
          .connect(context.employee)
          .createContract(
            intent,
            DOCUMENT,
            DOCUMENT_URI,
            employerSignature,
            employeeSignature,
          ),
      ).to.be.revertedWithCustomError(context.registry, 'SignatureExpired');
    });

    it('rejects replaying the same signed intent', async () => {
      const context = await deployFixture();
      const created = await signedCreate(context);

      await expect(
        context.registry
          .connect(context.employee)
          .createContract(
            created.intent,
            created.document,
            created.documentUri,
            created.employerSignature,
            created.employeeSignature,
          ),
      ).to.be.revertedWithCustomError(context.registry, 'ContractAlreadyExists');
    });

    it('generates unique ids for different nonces and increments the organisation count', async () => {
      const { registry, hr, employee, contractId } = await loadFixture(createContractFixture);

      const intent = await buildIntent(
        { registry, hr, employee },
        { nonce: 2n },
      );
      const employerSignature = await signIntent(registry, hr, intent);
      const employeeSignature = await signIntent(registry, employee, intent);

      const tx = await registry
        .connect(employee)
        .createContract(intent, DOCUMENT, DOCUMENT_URI, employerSignature, employeeSignature);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === 'ContractCreated');

      expect(event?.args.id).to.not.equal(contractId);
      expect(await registry.organizationContractCount(ORGANIZATION_ID)).to.equal(2);
    });

    it('accepts an open-ended contract (endDate = 0)', async () => {
      const context = await deployFixture();
      const created = await signedCreate(context, { intent: { endDate: 0 } });
      const contract = await context.registry.getContract(created.contractId);
      expect(contract.endDate).to.equal(0);
    });

    it('rejects invalid dates, hashes and documents', async () => {
      const context = await deployFixture();

      await expect(
        signedCreate(context, {
          intent: {
            startDate: (await time.latest()) + 100,
            endDate: (await time.latest()) + 100,
          },
        }),
      ).to.be.revertedWithCustomError(context.registry, 'InvalidDates');

      await expect(
        signedCreate(context, { intent: { employeeRefHash: ethers.ZeroHash } }),
      ).to.be.revertedWithCustomError(context.registry, 'InvalidEmployeeRefHash');

      await expect(
        signedCreate(context, { intent: { documentHash: ethers.ZeroHash } }),
      ).to.be.revertedWithCustomError(context.registry, 'InvalidDocumentHash');

      await expect(
        signedCreate(context, { document: '', documentUri: DOCUMENT_URI }),
      ).to.be.revertedWithCustomError(context.registry, 'EmptyDocument');

      await expect(
        signedCreate(context, { documentUri: '' }),
      ).to.be.revertedWithCustomError(context.registry, 'EmptyDocumentUri');

      const oversized = 'x'.repeat(16_385);
      await expect(
        signedCreate(context, {
          document: oversized,
          intent: { documentHash: ethers.id(oversized) },
        }),
      ).to.be.revertedWithCustomError(context.registry, 'DocumentTooLarge');
    });

    it('rejects a version that is not the first one', async () => {
      const context = await deployFixture();
      await expect(
        signedCreate(context, { intent: { version: 2 } }),
      ).to.be.revertedWithCustomError(context.registry, 'InvalidVersion');
    });
  });

  describe('Amendments', () => {
    it('supersedes the old version with a fresh dual-signed version', async () => {
      const { registry, hr, employee, contractId } = await loadFixture(createContractFixture);

      const intent = await buildIntent(
        { registry, hr, employee },
        {
          documentHash: NEXT_DOCUMENT_HASH,
          previousContractId: contractId,
          version: 2,
          nonce: 2n,
          startDate: (await time.latest()) + 2 * 86_400,
        },
      );
      const employerSignature = await signIntent(registry, hr, intent);
      const employeeSignature = await signIntent(registry, employee, intent);

      const tx = await registry
        .connect(employee)
        .amendContract(
          contractId,
          intent,
          NEXT_DOCUMENT,
          NEXT_DOCUMENT_URI,
          employerSignature,
          employeeSignature,
        );
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      const oldContract = await registry.getContract(contractId);
      expect(oldContract.status).to.equal(3); // Superseded
      const newContractId = oldContract.supersededBy;
      const newContract = await registry.getContract(newContractId);

      expect(newContract.previousContractId).to.equal(contractId);
      expect(newContract.version).to.equal(2);
      expect(newContract.deadline).to.equal(intent.deadline);
      expect(newContract.documentHash).to.equal(NEXT_DOCUMENT_HASH);
      expect(newContract.document).to.equal(NEXT_DOCUMENT);
      expect(newContract.status).to.equal(1); // Active
      expect(newContract.employee).to.equal(employee.address);
      expect(newContract.employerSignature).to.equal(employerSignature);
      expect(newContract.employeeSignature).to.equal(employeeSignature);
    });

    it('rejects amendments from another organisation', async () => {
      const { registry, otherHr, employee, contractId } = await loadFixture(createContractFixture);

      const intent = await buildIntent(
        { registry, hr: otherHr, employee },
        {
          organizationId: OTHER_ORGANIZATION_ID,
          employer: otherHr.address,
          documentHash: NEXT_DOCUMENT_HASH,
          previousContractId: contractId,
          version: 2,
          nonce: 2n,
        },
      );
      const employerSignature = await signIntent(registry, otherHr, intent);
      const employeeSignature = await signIntent(registry, employee, intent);

      await expect(
        registry
          .connect(employee)
          .amendContract(
            contractId,
            intent,
            NEXT_DOCUMENT,
            NEXT_DOCUMENT_URI,
            employerSignature,
            employeeSignature,
          ),
      ).to.be.revertedWithCustomError(registry, 'OrganizationMismatch');
    });

    it('rejects an amendment with the wrong version', async () => {
      const { registry, hr, employee, contractId } = await loadFixture(createContractFixture);

      const intent = await buildIntent(
        { registry, hr, employee },
        {
          documentHash: NEXT_DOCUMENT_HASH,
          previousContractId: contractId,
          version: 1,
          nonce: 2n,
        },
      );
      const employerSignature = await signIntent(registry, hr, intent);
      const employeeSignature = await signIntent(registry, employee, intent);

      await expect(
        registry
          .connect(employee)
          .amendContract(
            contractId,
            intent,
            NEXT_DOCUMENT,
            NEXT_DOCUMENT_URI,
            employerSignature,
            employeeSignature,
          ),
      ).to.be.revertedWithCustomError(registry, 'InvalidVersion');
    });
  });

  describe('Termination', () => {
    it('lets the employer sign a termination that any relayer can submit', async () => {
      const reasonHash = ethers.id('end-of-mission');
      const { registry, hr, outsider, contractId } = await loadFixture(createContractFixture);
      const deadline = (await time.latest()) + 900;
      const signature = await signTermination(registry, hr, contractId, reasonHash, deadline);

      await expect(
        registry.connect(outsider).terminateContract(contractId, reasonHash, deadline, signature),
      )
        .to.emit(registry, 'ContractTerminated')
        .withArgs(contractId, hr.address, reasonHash, await time.latest().then((t) => t + 1));

      const contract = await registry.getContract(contractId);
      expect(contract.status).to.equal(2); // Terminated
      expect(contract.terminatedBy).to.equal(hr.address);
      expect(contract.terminationReasonHash).to.equal(reasonHash);
      expect(contract.terminatedAt).to.be.greaterThan(0);
    });

    it('lets the employee resign without sending the transaction themselves', async () => {
      const { registry, employee, outsider, contractId } = await loadFixture(createContractFixture);
      const deadline = (await time.latest()) + 900;
      const signature = await signTermination(
        registry,
        employee,
        contractId,
        ethers.ZeroHash,
        deadline,
      );

      await expect(
        registry.connect(outsider).terminateContract(contractId, ethers.ZeroHash, deadline, signature),
      )
        .to.emit(registry, 'ContractTerminated')
        .withArgs(
          contractId,
          employee.address,
          ethers.ZeroHash,
          await time.latest().then((t) => t + 1),
        );

      const contract = await registry.getContract(contractId);
      expect(contract.status).to.equal(2);
      expect(contract.terminatedBy).to.equal(employee.address);
    });

    it('rejects signatures from unrelated wallets', async () => {
      const { registry, outsider, contractId } = await loadFixture(createContractFixture);
      const deadline = (await time.latest()) + 900;
      const signature = await signTermination(
        registry,
        outsider,
        contractId,
        ethers.ZeroHash,
        deadline,
      );

      await expect(
        registry.connect(outsider).terminateContract(contractId, ethers.ZeroHash, deadline, signature),
      ).to.be.revertedWithCustomError(registry, 'NotAuthorized');
    });

    it('rejects an expired termination signature', async () => {
      const { registry, hr, contractId } = await loadFixture(createContractFixture);
      const deadline = (await time.latest()) - 1;
      const signature = await signTermination(
        registry,
        hr,
        contractId,
        ethers.ZeroHash,
        deadline,
      );

      await expect(
        registry.connect(hr).terminateContract(contractId, ethers.ZeroHash, deadline, signature),
      ).to.be.revertedWithCustomError(registry, 'SignatureExpired');
    });

    it('does not terminate twice', async () => {
      const { registry, hr, outsider, contractId } = await loadFixture(createContractFixture);
      const deadline = (await time.latest()) + 900;
      const first = await signTermination(registry, hr, contractId, ethers.ZeroHash, deadline);
      await registry.connect(outsider).terminateContract(contractId, ethers.ZeroHash, deadline, first);

      await expect(
        registry.connect(outsider).terminateContract(contractId, ethers.ZeroHash, deadline, first),
      ).to.be.revertedWithCustomError(registry, 'InvalidContractState');
    });
  });

  describe('Pausing and authorization', () => {
    it('blocks contract creation while paused and resumes after unpause', async () => {
      const { registry, owner, hr, employee } = await loadFixture(deployFixture);
      const intent = await buildIntent({ registry, hr, employee });
      const employerSignature = await signIntent(registry, hr, intent);
      const employeeSignature = await signIntent(registry, employee, intent);

      await registry.connect(owner).pause();
      await expect(
        registry
          .connect(employee)
          .createContract(intent, DOCUMENT, DOCUMENT_URI, employerSignature, employeeSignature),
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');

      await registry.connect(owner).unpause();
      await expect(
        registry
          .connect(employee)
          .createContract(intent, DOCUMENT, DOCUMENT_URI, employerSignature, employeeSignature),
      ).to.emit(registry, 'ContractCreated');
    });

    it('blocks signing after the HR wallet is revoked', async () => {
      const context = await deployFixture();
      const intent = await buildIntent(context);
      const employerSignature = await signIntent(context.registry, context.hr, intent);
      const employeeSignature = await signIntent(context.registry, context.employee, intent);

      await context.registry.connect(context.owner).removeHrAdmin(context.hr.address);

      await expect(
        context.registry
          .connect(context.employee)
          .createContract(
            intent,
            DOCUMENT,
            DOCUMENT_URI,
            employerSignature,
            employeeSignature,
          ),
      ).to.be.revertedWithCustomError(context.registry, 'NotHrAdmin');
    });
  });

  describe('Views', () => {
    it('reverts when reading an unknown contract', async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.getContract(ethers.id('missing'))).to.be.revertedWithCustomError(
        registry,
        'ContractNotFound',
      );
      expect(await registry.contractExists(ethers.id('missing'))).to.equal(false);
    });

    it('exposes the same EIP-712 digest the signatures commit to', async () => {
      const context = await deployFixture();
      const intent = await buildIntent(context);
      const digest = await context.registry.hashContractIntent(intent);
      const expected = ethers.TypedDataEncoder.hash(
        await eip712Domain(context.registry),
        INTENT_TYPES,
        intent,
      );
      expect(digest).to.equal(expected);
    });
  });
});
