import { jwtVerify, SignJWT } from 'jose';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/database/errors';
import type { ContractDocumentDto, ContractSalaryDto } from '../../../types';

/**
 * Everything the server needs to persist the contract after MetaMask signs it.
 * The payload is signed into a short-lived JWT so the client cannot swap the
 * salary, hash or employee wallet between `prepare` and `record`.
 */
export interface PreparedContractPayload {
  organizationId: string;
  organizationHash: string;
  employeeId: string;
  employeeRef: string;
  employeeName: string;
  employeeEmail: string;
  employeeWallet: string;
  employerWallet: string;
  jobTitle: string;
  salary: ContractSalaryDto | null;
  startDate: string;
  startTimestamp: number;
  endDate: string | null;
  endTimestamp: number;
  documentUri: string;
  documentHash: string;
  employeeRefHash: string;
  chainId: number;
  contractAddress: string;
  version: number;
  previousContractId: string;
  nonce: string;
  deadline: number;
  document: ContractDocumentDto;
}

const ISSUER = 'moveup';
const AUDIENCE = 'employment-contract';

const secret = () => new TextEncoder().encode(env().JWT_SECRET);

export async function signContractPreparation(payload: PreparedContractPayload): Promise<string> {
  return new SignJWT({ prepared: payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret());
}

export async function verifyContractPreparation(token: string): Promise<PreparedContractPayload> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const prepared = payload.prepared as PreparedContractPayload | undefined;
    if (!prepared?.organizationId || !prepared.documentHash || !prepared.contractAddress) {
      throw new Error('Incomplete preparation token');
    }

    return prepared;
  } catch {
    throw new BadRequestError(
      'This contract preparation expired or is invalid. Prepare the contract again.',
    );
  }
}
