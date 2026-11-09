import { NextResponse } from 'next/server';
import { storageService } from '@/server/modules/storage';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';

/** GET /api/admin/storage — bucket reachability and usage by folder. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await storageService.status());
  } catch (error) {
    return errorResponse(error);
  }
}
