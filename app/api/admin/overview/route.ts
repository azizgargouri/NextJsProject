export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminService } from '@/server/modules/admin';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await adminService.getOverview());
  } catch (error) {
    return errorResponse(error);
  }
}
