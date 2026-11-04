import { homesController } from '@/server/modules/homes';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  return homesController.addRoom(request, (await params).id);
}
