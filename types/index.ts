/** Base fields replicated from the instanct DatabaseEntity. */
export interface DatabaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'CLIENT' | 'MOVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';

export interface ResponseUserDto extends DatabaseEntity {
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  locale: string;
  status: UserStatus;
}

export interface ApiUserResponse {
  user: ResponseUserDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ServerResponse<T> {
  data?: T;
  result?: T;
  user?: T;
  message?: string;
}

export interface ServerErrorResponse {
  message: string;
  code: string;
  details?: unknown;
}

export interface PageMetaDto {
  page: number;
  take: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PageDto<T> {
  data: T[];
  meta: PageMetaDto;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  filter?: string;
}

/* --- RH / employee-tracking DTOs (mirror the server serializers) --- */

export type EmployeeRole = 'hr' | 'manager' | 'employee';
export type EmployeeStatus = 'active' | 'inactive' | 'pending';
export type AttendanceStatus = 'present' | 'late' | 'leave' | 'halfDay' | 'absent';
export type LeaveType = 'annual' | 'sick' | 'personal' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type CrewStatus = 'active' | 'inactive';
export type TrackingSessionStatus = 'active' | 'ended';
export type LocationPingSource = 'checkin' | 'interval' | 'manual';

/** Compact employee reference embedded in attendance / leave rows. */
export interface EmployeeRefDto {
  id: string;
  employeeRef: string;
  fullName: string;
}

export interface EmployeeDto extends DatabaseEntity {
  employeeRef: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  hireDate: string | null;
  organization: string | null;
  /** MetaMask address assigned to this employee (lowercase, or null). */
  walletAddress: string | null;
}

/* --- Employee contracts (on-chain registry) --- */

export type ContractStatus = 'pending' | 'active' | 'terminated' | 'superseded';
export type ContractProposalStatus = 'awaiting_employee' | 'completed' | 'expired' | 'cancelled';
export type SalaryPeriod = 'month' | 'year' | 'hour';

/** Exactly what both wallets sign with EIP-712. */
export interface ContractIntentMessage {
  organizationId: string;
  employer: string;
  employee: string;
  employeeRefHash: string;
  documentHash: string;
  startDate: number;
  endDate: number;
  previousContractId: string;
  version: number;
  nonce: string;
  deadline: number;
}

export interface ContractIntentTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    ContractIntent: Array<{ name: string; type: string }>;
  };
  primaryType: 'ContractIntent';
  message: ContractIntentMessage;
}

/** What HR (dismissal) or the employee (resignation) signs to end a contract. */
export interface ContractTerminationMessage {
  contractId: string;
  reasonHash: string;
  deadline: number;
}

export interface ContractTerminationTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    Termination: Array<{ name: string; type: string }>;
  };
  primaryType: 'Termination';
  message: ContractTerminationMessage;
}

export interface ContractSalaryDto {
  amount: number;
  currency: string;
  period: SalaryPeriod;
}

/** Canonical document stored on-chain; its keccak256 hash is signed by both parties. */
export interface ContractDocumentDto {
  schema: 'moveup.employment-contract.v1';
  employee: {
    ref: string;
    name: string;
    email: string;
    wallet: string;
  };
  employer: {
    organizationIdHash: string;
    wallet: string;
  };
  terms: {
    jobTitle: string;
    salary: ContractSalaryDto | null;
    startDate: string;
    endDate: string | null;
  };
  issuedAt: string;
}

export interface EmployeeContractDto extends DatabaseEntity {
  /** bytes32 on-chain id (or null while preparing — never persisted as null). */
  contractId: string;
  chainId: number;
  contractAddress: string;
  employee: {
    id: string;
    employeeRef: string;
    fullName: string;
    email: string;
    walletAddress: string;
  } | null;
  employerWallet: string;
  status: ContractStatus;
  jobTitle: string;
  salary: ContractSalaryDto | null;
  startDate: string;
  endDate: string | null;
  documentHash: string;
  employeeRefHash: string;
  organizationHash: string;
  documentUri: string;
  document: ContractDocumentDto;
  version: number;
  previousContractId: string | null;
  supersededBy: string | null;
  nonce: string;
  employerSignature: string;
  employeeSignature: string;
  createdTxHash: string;
  acceptedTxHash: string | null;
  terminatedTxHash: string | null;
  acceptedAt: string | null;
  terminatedAt: string | null;
  terminatedByWallet: string | null;
  terminationReasonHash: string | null;
}

/** Payload returned by the server before either wallet signs. */
export interface PreparedContractDto {
  /** Short-lived HMAC token binding the prepared document to the HR signature. */
  token: string;
  chainId: number;
  contractAddress: string;
  organizationHash: string;
  employeeRefHash: string;
  documentHash: string;
  employeeWallet: string;
  employerWallet: string;
  startTimestamp: number;
  endTimestamp: number;
  documentUri: string;
  version: number;
  previousContractId: string;
  nonce: string;
  deadline: number;
  typedData: ContractIntentTypedData;
  document: ContractDocumentDto;
}

/** A proposal waiting for the employee's free signature, then HR's anchor transaction. */
export interface ContractProposalDto extends DatabaseEntity {
  chainId: number;
  contractAddress: string;
  organizationHash: string;
  employee: {
    id: string;
    employeeRef: string;
    fullName: string;
    email: string;
    walletAddress: string;
  } | null;
  employerWallet: string;
  jobTitle: string;
  salary: ContractSalaryDto | null;
  startDate: string;
  endDate: string | null;
  startTimestamp: number;
  endTimestamp: number;
  documentHash: string;
  employeeRefHash: string;
  documentUri: string;
  document: ContractDocumentDto;
  version: number;
  previousContractId: string;
  nonce: string;
  deadline: number;
  status: ContractProposalStatus;
  employerSignature: string;
  /** Employee's gasless EIP-712 signature, collected before HR anchors. */
  employeeSignature: string | null;
  employeeSignedAt: string | null;
  typedData: ContractIntentTypedData;
  contractId: string | null;
  createdTxHash: string | null;
}

export interface AttendanceLocationDto {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface AttendancePunchDto {
  at: string;
  location: AttendanceLocationDto | null;
}

export interface AttendanceDto extends DatabaseEntity {
  employee: EmployeeRefDto | null;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  breakDuration: number;
  location: AttendanceLocationDto | null;
  /** Every check-in registration of the day, oldest first. */
  punches: AttendancePunchDto[];
}

export interface LeaveRequestDto extends DatabaseEntity {
  employee: EmployeeRefDto | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: LeaveStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface DashboardStatsDto {
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

/** Payload posted by the geolocated check-in card. */
export interface CheckInPayload {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface CheckInResponse {
  success: boolean;
  alreadyCheckedIn?: boolean;
  attendance: AttendanceDto;
  tracking: TrackingSessionDto;
}

/* --- Crews --- */

export interface CrewWritePayload {
  name: string;
  code?: string | null;
  leaderEmployeeId?: string | null;
  employeeIds?: string[];
  status?: CrewStatus;
  notes?: string | null;
}

export type CrewUpdatePayload = Partial<CrewWritePayload>;

export interface CrewMemberDto extends EmployeeRefDto {
  role: EmployeeRole;
  status: EmployeeStatus;
  isLeader: boolean;
}

export interface CrewDto extends DatabaseEntity {
  name: string;
  code: string | null;
  status: CrewStatus;
  leader: CrewMemberDto | null;
  members: CrewMemberDto[];
  memberCount: number;
  notes: string | null;
}

/* --- Location tracking / heatmap --- */

export interface TrackingCrewRefDto {
  id: string;
  name: string;
}

export interface TrackingSessionDto {
  id: string;
  employeeId: string;
  attendanceId: string;
  crew: TrackingCrewRefDto | null;
  workDate: string;
  startedAt: string;
  endedAt: string | null;
  lastPingAt: string | null;
  pingCount: number;
  intervalMinutes: number;
  nextPingAt: string | null;
  status: TrackingSessionStatus;
  active: boolean;
}

export interface LocationPingDto {
  id: string;
  sessionId: string;
  at: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  source: LocationPingSource;
  crew: TrackingCrewRefDto | null;
}

export interface TrackingPingPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface TrackingPingResult {
  accepted: boolean;
  reason?: 'too_soon';
  nextPingAt: string | null;
  ping?: LocationPingDto;
  session: TrackingSessionDto;
}

export interface TrackingStopResult {
  stopped: boolean;
  session: TrackingSessionDto | null;
}

export interface TrackingHeatmapCellDto {
  id: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  durationMinutes: number;
  /** Share of tracked time in this cell (0..1). */
  relativeTime: number;
  /** Normalized to the busiest cell (0..1). */
  weight: number;
  samples: number;
  firstAt: string;
  lastAt: string;
}

export interface TrackingHistoryDto {
  employee: EmployeeRefDto;
  from: string;
  to: string;
  intervalMinutes: number;
  sessions: TrackingSessionDto[];
  pings: LocationPingDto[];
  heatmap: TrackingHeatmapCellDto[];
  summary: {
    totalPings: number;
    trackedSeconds: number;
    trackedMinutes: number;
    distanceMeters: number;
    sessions: number;
    topLocation: TrackingHeatmapCellDto | null;
  };
  filters: {
    cellMeters: number;
    maxAccuracyM: number | null;
  };
}
