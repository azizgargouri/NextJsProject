import { NextResponse } from 'next/server';
import { connectMongo } from '@/server/shared/database/mongoose';
import { UserModel } from '@/server/shared/database/models/user.model';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';

/** GET /api/movers — active movers (id + name) for claim / review pickers. */
export async function GET(request: Request) {
  try {
    await requireAuth(request);
    await connectMongo();
    const movers = await UserModel.find({ role: 'MOVER', status: 'ACTIVE', deletedAt: null })
      .select('name')
      .sort({ name: 1 })
      .limit(200)
      .lean<{ _id: unknown; name: string }[]>();
    return NextResponse.json({
      movers: movers.map((mover) => ({ id: String(mover._id), name: mover.name })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
