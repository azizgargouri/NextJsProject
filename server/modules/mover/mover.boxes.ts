import { BadRequestError, DomainError, NotFoundError } from '../../shared/database/errors';
import type { JobDetailDto } from '../../../types/mover';
import { parseBoxCode } from '../../../lib/box-label';
import { MAX_BOXES_PER_MOVE } from './mover.constants';
import { getJob, ownedMove } from './mover.jobs';
import { moverRepository as repo } from './mover.repository';
import { boxScanOpen } from './mover.rules';

class BoxAlreadyScannedError extends DomainError {
  constructor(label: string) {
    super(`${label} is already scanned`, 409, 'BOX_ALREADY_SCANNED');
  }
}

const SCAN_CLOSED = 'Boxes can only be scanned at pickup, while loading.';

/** One box going into the vehicle. A confirmed load count has to be confirmed again. */
export async function scanBox(
  moverId: string,
  moveId: string,
  rawCode: string,
): Promise<JobDetailDto> {
  const move = await ownedMove(moverId, moveId);
  if (!boxScanOpen(move)) throw new BadRequestError(SCAN_CLOSED);

  const parsed = parseBoxCode(rawCode, move.reference);
  if (!parsed.ok) throw new BadRequestError(parsed.message);
  if ((await repo.countBoxScans(moveId)) >= MAX_BOXES_PER_MOVE) {
    throw new BadRequestError(`A job can hold ${MAX_BOXES_PER_MOVE} boxes`);
  }

  const scan = await repo.createBoxScan({
    moveId,
    moverId,
    code: parsed.code,
    label: parsed.label,
  });
  if (!scan) throw new BoxAlreadyScannedError(parsed.label);
  await repo.clearLoadCheck(moveId, moverId);
  return getJob(moverId, moveId);
}

/** Undoes a scan made by mistake, for as long as loading lasts. */
export async function removeBoxScan(
  moverId: string,
  moveId: string,
  scanId: string,
): Promise<JobDetailDto> {
  const move = await ownedMove(moverId, moveId);
  if (!boxScanOpen(move)) throw new BadRequestError(SCAN_CLOSED);
  if (!(await repo.deleteBoxScan(moveId, scanId))) throw new NotFoundError('Box');
  await repo.clearLoadCheck(moveId, moverId);
  return getJob(moverId, moveId);
}
