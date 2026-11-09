import type { MoveRequestDoc } from '../../shared/database/models';
import { DEFAULT_COMMISSION_RATE } from './mover.constants';
import { notify } from './mover.notifications';
import { moverRepository as repo } from './mover.repository';
import { computeEarning } from './mover.rules';

/**
 * DELIVERED to COMPLETED (client confirmation, or the 48 h rule), which also
 * books the earning. Returns null when another request completed it first.
 */
export async function completeMove(
  move: MoveRequestDoc,
  actorId: string | null,
  note: string,
  now: Date,
): Promise<MoveRequestDoc | null> {
  const moveId = String(move._id);
  const completed = await repo.transitionMove(moveId, 'DELIVERED', 'COMPLETED', {
    completedAt: now,
  });
  if (!completed) return null;

  await repo.addStatusEvent({
    moveId,
    fromStatus: 'DELIVERED',
    toStatus: 'COMPLETED',
    note,
    actorId,
  });

  if (completed.assignedMoverId) {
    const rule = await repo.activePricingRule();
    const earning = computeEarning(
      completed.finalPrice ?? 0,
      rule?.commissionRate ?? DEFAULT_COMMISSION_RATE,
    );
    await repo.createEarningOnce({
      moveId,
      moverId: completed.assignedMoverId,
      reference: completed.reference,
      ...earning,
    });
    await notify(completed.assignedMoverId, {
      type: 'JOB_COMPLETED',
      title: `Job ${completed.reference} completed`,
      body: `${earning.net} TND added to your earnings after commission.`,
      link: `/mover/jobs/${moveId}`,
    });
  }
  return completed;
}
