import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getCurrentUser } from '@/server/shared/auth/guards';
import { usersService } from '@/server/modules/users/users.service';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me — current session probe (validated access token required). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await usersService.findOneByIdSerialized(tokenUser.sub);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
