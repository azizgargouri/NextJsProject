import { contractsController } from '@/server/modules/contracts/contracts.controller';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return contractsController.list(request);
}
