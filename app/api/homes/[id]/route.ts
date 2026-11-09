import { homesController } from '@/server/modules/homes';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  return homesController.findOne(request, (await params).id);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  return homesController.update(request, (await params).id);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  return homesController.remove(request, (await params).id);
}
