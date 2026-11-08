import { isUserRejection } from './metamask';

interface ErrorLike {
  code?: number | string;
  message?: string;
  shortMessage?: string;
  reason?: string;
  revert?: { name?: string; signature?: string };
  info?: { error?: { message?: string; data?: { message?: string } } };
}

const REVERT_MESSAGES: Record<string, string> = {
  NotHrAdmin:
    'This wallet is not authorized as an HR admin for your organisation on-chain. Run the grant script or switch to the registered wallet.',
  OrganizationMismatch: 'This contract belongs to another organisation.',
  ContractNotFound: 'This contract does not exist on-chain.',
  InvalidContractState: 'The contract is not in a state that allows this action.',
  NotEmployee: 'Only the wallet assigned to the contract can sign it.',
  NotAuthorized: 'Connected wallet is not allowed to perform this action.',
  InvalidAddress: 'A zero wallet address was provided.',
  InvalidDocumentHash: 'The document hash is invalid.',
  InvalidEmployeeRefHash: 'The employee reference hash is invalid.',
  InvalidDates: 'The contract dates are invalid (end must be after start).',
  InvalidOrganization: 'The organisation identifier is invalid.',
  EmptyDocumentUri: 'The document URI cannot be empty.',
  EmptyDocument: 'The contract document cannot be empty.',
  DocumentTooLarge: 'The contract document is too large (16 KB maximum).',
  DocumentHashMismatch: 'The document does not match the hash both parties signed.',
  InvalidEmployerSignature: 'The HR wallet signature does not match the contract.',
  InvalidEmployeeSignature: 'The employee wallet signature does not match the contract.',
  SignatureExpired: 'This proposal has expired. Ask HR to issue it again.',
  InvalidNonce: 'The contract nonce is invalid. Prepare the contract again.',
  InvalidVersion: 'The contract version is invalid.',
  InvalidPreviousContract: 'The previous contract reference is invalid.',
  ContractAlreadyExists: 'This signed contract has already been recorded on-chain.',
  ECDSAInvalidSignature: 'One of the wallet signatures is malformed.',
  EnforcedPause: 'The contract registry is paused.',
  nonce: 'A transaction with this nonce is already pending.',
};

/** Turns MetaMask/ethers errors into an actionable sentence for the UI. */
export function describeWalletError(error: unknown): string {
  if (isUserRejection(error)) return 'Transaction rejected in MetaMask.';

  const candidate = error as ErrorLike;
  const revertName = candidate?.revert?.name;
  if (revertName && REVERT_MESSAGES[revertName]) return REVERT_MESSAGES[revertName];

  const raw =
    candidate?.shortMessage ??
    candidate?.info?.error?.data?.message ??
    candidate?.info?.error?.message ??
    candidate?.reason ??
    candidate?.message ??
    '';

  for (const [name, message] of Object.entries(REVERT_MESSAGES)) {
    if (raw.includes(name)) return message;
  }

  if (candidate?.code === -32002) {
    return 'MetaMask already has a pending request. Open MetaMask and finish it first.';
  }
  if (candidate?.code === 'ACTION_REJECTED') return 'Transaction rejected in MetaMask.';
  if (raw.includes('insufficient funds')) {
    return 'This wallet has no test gas tokens for the configured network. Fund it from a faucet first.';
  }
  if (raw.includes('network changed') || raw.includes('chainId')) {
    return 'The wallet network changed. Switch to the configured network and retry.';
  }

  return raw || 'The wallet transaction failed.';
}
