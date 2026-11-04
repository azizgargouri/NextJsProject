import { homesController } from '@/server/modules/homes';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return homesController.list(request);
}

export function POST(request: Request) {
  return homesController.create(request);
}
