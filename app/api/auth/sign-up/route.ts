import { authController } from '@/server/modules/auth/auth.controller';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return authController.signUp(request);
}
