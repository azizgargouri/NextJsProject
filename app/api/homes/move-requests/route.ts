import { homesController } from '@/server/modules/homes';

export const dynamic = 'force-dynamic';

/** The signed-in client's move requests (their real Moves). */
export function GET(request: Request) {
  return homesController.listMoveRequests(request);
}
