import { attendanceController } from '@/server/modules/attendance/attendance.controller';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return attendanceController.list(request);
}
