import { addDays, endOfDay, startOfDay, toIsoDate } from '../../shared/date';
import { reportsRepository, type ReportRepository } from './reports.repository';

export interface ReportFilters {
  /** Organisation (platform user id) every count is scoped to. */
  organization: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
}

export interface DashboardStats {
  rangeFrom: string;
  rangeTo: string;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  employeesScheduledToday: number;
  employeesPresentToday: number;
  employeesLateToday: number;
  confirmedAbsencesToday: number;
  employeesNotCheckedIn: number;
  pendingLeaveRequests: number;
  upcomingWorkdays: { date: string; scheduledEmployees: number }[];
}

/**
 * Dashboard statistics — ported from the local module's report.service and
 * scoped to one organisation. Schedules drive "planned vs. actually here".
 */
export class ReportService {
  constructor(private readonly repository: ReportRepository = reportsRepository) {}

  async getDashboardStats(filters: ReportFilters): Promise<DashboardStats> {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const rangeFrom = filters.dateFrom ? startOfDay(filters.dateFrom) : today;
    const rangeTo = filters.dateTo ? endOfDay(filters.dateTo) : endOfDay(today);

    const employeeWhere: Record<string, unknown> = { organization: filters.organization };
    if (filters.status) employeeWhere.status = filters.status;

    const employeeIds = await this.repository.findEmployeeIds(employeeWhere);
    const scope = { employee: { $in: employeeIds } };

    const [totalEmployees, activeEmployees, inactiveEmployees] = await Promise.all([
      this.repository.countEmployees(employeeWhere),
      this.repository.countEmployees({ ...employeeWhere, status: 'active' }),
      this.repository.countEmployees({ ...employeeWhere, status: 'inactive' }),
    ]);

    const [scheduledToday, presentToday, lateToday, approvedLeaveToday, pendingLeaveRequests] =
      await Promise.all([
        this.repository.findScheduledEmployeeIds(today, tomorrow, employeeIds),
        this.repository.countAttendance({
          ...scope,
          workDate: { $gte: rangeFrom, $lte: rangeTo },
          status: 'present',
        }),
        this.repository.countAttendance({
          ...scope,
          workDate: { $gte: rangeFrom, $lte: rangeTo },
          status: 'late',
        }),
        this.repository.countLeaveRequests({
          ...scope,
          status: 'approved',
          startDate: { $lte: tomorrow },
          endDate: { $gte: today },
        }),
        this.repository.countLeaveRequests({ ...scope, status: 'pending' }),
      ]);

    const accountedFor = new Set(
      await this.repository.findAttendanceEmployeeIds({
        ...scope,
        workDate: { $gte: rangeFrom, $lte: rangeTo },
        status: { $in: ['present', 'late', 'leave', 'halfDay'] },
      }),
    );

    const upcomingWorkdays: { date: string; scheduledEmployees: number }[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const dayStart = addDays(today, offset);
      const dayEnd = addDays(dayStart, 1);
      const scheduled = await this.repository.findScheduledEmployeeIds(
        dayStart,
        dayEnd,
        employeeIds,
      );
      upcomingWorkdays.push({ date: toIsoDate(dayStart), scheduledEmployees: scheduled.length });
    }

    return {
      rangeFrom: toIsoDate(rangeFrom),
      rangeTo: toIsoDate(rangeTo),
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      employeesScheduledToday: scheduledToday.length,
      employeesPresentToday: presentToday,
      employeesLateToday: lateToday,
      confirmedAbsencesToday: approvedLeaveToday,
      employeesNotCheckedIn: scheduledToday.filter((id) => !accountedFor.has(id)).length,
      pendingLeaveRequests,
      upcomingWorkdays,
    };
  }
}

export const reportsService = new ReportService();
