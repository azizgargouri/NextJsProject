import { contractsController } from '@/server/modules/contracts/contracts.controller';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return contractsController.one(request, id);
}
