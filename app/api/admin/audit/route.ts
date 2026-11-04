import { NextResponse } from 'next/server';
import { adminService } from '@/server/modules/admin';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';

/** GET /api/admin/audit — paginated audit trail of recorded platform events. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    return NextResponse.json(await adminService.listAuditEvents(url.searchParams));
  } catch (error) {
    return errorResponse(error);
  }
}
