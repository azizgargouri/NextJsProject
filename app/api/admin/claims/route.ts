import { NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { parseQuery } from '@/server/shared/http/validate';
import { ClaimAdminQuerySchema, claimsService } from '@/server/modules/claims';

/** GET /api/admin/claims — dispute inbox with status / priority / category / search filters. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(
      await claimsService.adminList(parseQuery(request, ClaimAdminQuerySchema)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
