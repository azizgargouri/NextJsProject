import { connectMongo } from '../../shared/database/mongoose';
import { EmployeeModel } from '../../shared/database/models/employee.model';
import { AttendanceModel } from '../../shared/database/models/attendance.model';
import { LeaveRequestModel } from '../../shared/database/models/leave-request.model';
import { WorkScheduleModel } from '../../shared/database/models/work-schedule.model';

/**
 * Reports data access — read-only aggregates behind the dashboard stats.
 * Every query awaits the shared connection and works on plain ids.
 */
export class ReportRepository {
  async findEmployeeIds(where: Record<string, unknown>): Promise<string[]> {
    await connectMongo();
    const docs = await EmployeeModel.find(where).select('_id').lean();
    return docs.map((doc) => String(doc._id));
  }

  async countEmployees(where: Record<string, unknown>): Promise<number> {
    await connectMongo();
    return EmployeeModel.countDocuments(where);
  }

  async countAttendance(where: Record<string, unknown>): Promise<number> {
    await connectMongo();
    return AttendanceModel.countDocuments(where);
  }

  /** Distinct employees holding at least one attendance row matching `where`. */
  async findAttendanceEmployeeIds(where: Record<string, unknown>): Promise<string[]> {
    await connectMongo();
    const ids = await AttendanceModel.distinct('employee', where);
    return ids.map((id) => String(id));
  }

  async countLeaveRequests(where: Record<string, unknown>): Promise<number> {
    await connectMongo();
    return LeaveRequestModel.countDocuments(where);
  }

  /** Distinct employees scheduled (planned/confirmed) inside a work-date range. */
  async findScheduledEmployeeIds(from: Date, to: Date, employeeIds: string[]): Promise<string[]> {
    await connectMongo();
    const ids = await WorkScheduleModel.distinct('employee', {
      employee: { $in: employeeIds },
      workDate: { $gte: from, $lt: to },
      status: { $in: ['planned', 'confirmed'] },
    });
    return ids.map((id) => String(id));
  }
}

export const reportsRepository = new ReportRepository();
