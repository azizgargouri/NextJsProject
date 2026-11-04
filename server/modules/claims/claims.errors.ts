import { BadRequestError, DomainError, NotFoundError } from '../../shared/database/errors';
import type { ClaimStatus } from '../../shared/database/enums';

export class ClaimNotFoundError extends NotFoundError {
  constructor() {
    super('Claim');
  }
}

export class InvalidClaimTransitionError extends DomainError {
  constructor(from: ClaimStatus, to: ClaimStatus) {
    super(`A claim cannot move from ${from} to ${to}`, 409, 'INVALID_CLAIM_TRANSITION');
  }
}

export class ClaimClosedError extends DomainError {
  constructor() {
    super('This claim is closed. Contact support to reopen it.', 409, 'CLAIM_CLOSED');
  }
}

export class DuplicateOpenClaimError extends DomainError {
  constructor(reference: string) {
    super(
      `You already have an open claim (${reference}) for this move.`,
      409,
      'CLAIM_ALREADY_OPEN',
    );
  }
}

export class ResolutionRequiredError extends BadRequestError {
  constructor() {
    super('Resolving a claim requires an outcome and an explanation');
  }
}
