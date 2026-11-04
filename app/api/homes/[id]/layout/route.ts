import { layoutController } from '@/server/modules/room-layout';

export const dynamic = 'force-dynamic';
/** Generation waits for the AI (Ollama, then Groq). */
export const maxDuration = 180;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  return layoutController.findOne(request, (await params).id);
}

export async function POST(request: Request, { params }: RouteContext) {
  return layoutController.generate(request, (await params).id);
}

/** One manual change: move, rotate or take out an item. */
export async function PATCH(request: Request, { params }: RouteContext) {
  return layoutController.updateItem(request, (await params).id);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  return layoutController.remove(request, (await params).id);
}
