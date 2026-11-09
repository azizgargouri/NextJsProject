import { homesController } from '@/server/modules/homes';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; roomId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id, roomId } = await params;
  return homesController.updateRoom(request, id, roomId);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id, roomId } = await params;
  return homesController.removeRoom(request, id, roomId);
}
