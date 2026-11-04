import { AlreadyExistsError, DomainError, NotFoundError } from '../../shared/database/errors';

export class ReviewNotFoundError extends NotFoundError {
  constructor() {
    super('Review');
  }
}

export class DuplicateReviewError extends AlreadyExistsError {
  constructor() {
    super('Review', 'you already reviewed this mover for this move');
  }
}

export class ReviewNotPublicError extends DomainError {
  constructor() {
    super('You can only reply to a published review', 409, 'REVIEW_NOT_PUBLIC');
  }
}

export class ReplyRejectedError extends DomainError {
  constructor(reason: string) {
    super(`Reply not posted: ${reason}`, 422, 'REPLY_REJECTED');
  }
}
