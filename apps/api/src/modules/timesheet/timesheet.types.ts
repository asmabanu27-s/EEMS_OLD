// ============================================================================
// EEMS - Timesheet Management
// Timesheet Module Types
// ============================================================================

import type {
  RoleCode,
  TimesheetEditRequestStatus,
  TimesheetSource,
  TimesheetStatus,
} from "@/generated/prisma/enums.js";

import type {
  TimesheetDayRequestStatus,
  TimesheetDaySource,
  TimesheetDayStatus,
} from "@/generated/prisma/enums.js";

// ============================================================================
// PAGINATION
// ============================================================================

export const DEFAULT_PAGE = 1;

export const DEFAULT_LIMIT = 20;

export const MAX_LIMIT = 100;

// ============================================================================
// CREATE TIMESHEET
// ============================================================================

export interface CreateTimesheetInput {
  workDate: string;

  description?: string;

  taskDescription?: string;

  workingMinutes: number;
}

// ============================================================================
// UPDATE TIMESHEET
// ============================================================================

export interface UpdateTimesheetInput {
  workDate?: string;

  description?: string;

  taskDescription?: string;

  workingMinutes?: number;
}

// ============================================================================
// LIST QUERY
// ============================================================================

export interface TimesheetListQuery {
  employeeId?: string | undefined;

  status?: TimesheetStatus | undefined;

  from?: string | undefined;

  to?: string | undefined;

  page?: number | undefined;

  limit?: number | undefined;
}

// ============================================================================
// APPROVAL / REJECTION
// ============================================================================

export interface TimesheetDecisionInput {
  approvalNote?: string | undefined;
}

// ============================================================================
// AUTHORIZATION SCOPE
// ============================================================================

export interface TimesheetScope {
  userId: string;

  employeeId: string | null;

  role: RoleCode;
}

// ============================================================================
// TIMESHEET RECORD
// ============================================================================

export interface TimesheetRecord {
  id: string;

  employeeId: string;

  employeeCode: string;

  firstName: string;

  lastName: string | null;

  displayName: string | null;

  attendanceId: string | null;

  workDate: string;

  description: string | null;

  taskDescription: string | null;

  workingMinutes: number;

  source: TimesheetSource;

  status: TimesheetStatus;

  submittedAt: string | null;

  approvedAt: string | null;

  rejectedAt: string | null;

  approverEmployeeId: string | null;

  approvalNote: string | null;

  createdAt: string;

  updatedAt: string;
}

// ============================================================================
// TIMESHEET EDIT REQUEST
// ============================================================================

export interface TimesheetEditRequestInput {
  requestedWorkDate?: string;
  requestedWorkingMinutes: number;
  requestedDescription?: string | null;
  requestedTaskDescription?: string | null;
  reason: string;
}

export interface TimesheetEditRequestListQuery {
  employeeId?: string | undefined;
  status?: TimesheetEditRequestStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface TimesheetEditRequestRecord {
  id: string;
  timesheetId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  currentWorkingMinutes: number;
  requestedWorkDate: string | null;
  requestedWorkingMinutes: number;
  currentDescription: string | null;
  requestedDescription: string | null;
  currentTaskDescription: string | null;
  requestedTaskDescription: string | null;
  reason: string;
  status: TimesheetEditRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  approverEmployeeId: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetEditRequestListResult {
  records: TimesheetEditRequestRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// EXPORT ROW
// ============================================================================
//
// This interface intentionally matches the existing XLSX/CSV export service.
//
// The export service expects:
//
//   Employee ID
//   Employee Code
//   Employee Name
//   Department
//   Team
//   Date
//   First Check-in
//   Last Check-out
//   Working Minutes
//   Working Hours
//   Status
//
// ============================================================================

export interface TimesheetRow {
  employeeId: string;

  employeeCode: string;

  employeeName: string;

  department: string;

  team: string;

  date: string;

  firstCheckIn: string | null;

  lastCheckOut: string | null;

  workingMinutes: number;

  workingHours: string;

  source: TimesheetSource;

  status: TimesheetStatus;
}

// ============================================================================
// LIST RESULT
// ============================================================================

export interface TimesheetListResult {
  records: TimesheetRecord[];

  pagination: {
    page: number;

    limit: number;

    total: number;

    totalPages: number;
  };
}

// ============================================================================
// TIMESHEET CALENDAR
// ============================================================================

export interface TimesheetCalendarQuery {
  month: number;
  year: number;
  employeeId?: string | undefined;
}

export interface TimesheetCalendarDay {
  date: string;

  status: TimesheetDayStatus | null;

  source: TimesheetDaySource | null;

  reason: string | null;

  workingMinutes: number;

  timesheetId: string | null;

  attendanceId: string | null;

  pendingRequest: TimesheetDayChangeRequestSummary | null;

  leaveApproved: boolean;

  leaveWorked: boolean;

  isFuture: boolean;

  isToday: boolean;
}

export interface TimesheetCalendarResult {
  year: number;

  month: number;

  employeeId: string;

  employeeCode: string;

  employeeName: string;

  days: TimesheetCalendarDay[];
}

export interface TimesheetDayChangeRequestInput {
  requestedStatus: TimesheetDayStatus;

  reason: string;
}

export interface TimesheetDayChangeRequestSummary {
  id: string;

  requestedStatus: TimesheetDayStatus;

  reason: string;

  status: TimesheetDayRequestStatus;

  requestedAt: string;

  approverEmployeeId: string | null;

  approvalNote: string | null;
}

export interface TimesheetDayDecisionInput {
  approvalNote?: string | undefined;
}

// ============================================================================
// TIMESHEET CALENDAR REQUEST LIST
// ============================================================================

export interface TimesheetDayChangeRequestListQuery {
  employeeId?: string | undefined;

  status?: TimesheetDayRequestStatus | undefined;

  page?: number | undefined;

  limit?: number | undefined;
}

export interface TimesheetDayChangeRequestRecord {
  id: string;

  employeeId: string;

  employeeCode: string;

  employeeName: string;

  workDate: string;

  currentStatus: TimesheetDayStatus;

  requestedStatus: TimesheetDayStatus;

  reason: string;

  status: TimesheetDayRequestStatus;

  requestedAt: string;

  approverEmployeeId: string | null;

  approvalNote: string | null;
}

export interface TimesheetDayChangeRequestListResult {
  records: TimesheetDayChangeRequestRecord[];

  pagination: {
    page: number;

    limit: number;

    total: number;

    totalPages: number;
  };
}
