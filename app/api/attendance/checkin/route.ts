import { attendanceController } from '@/server/modules/attendance/attendance.controller';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return attendanceController.checkIn(request);
}
