// ============================================================================
// EEMS - Timesheet Management
// Timesheet Module Types
// ============================================================================

import type { RoleCode, TimesheetStatus } from "@/generated/prisma/enums.js";

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

  workDate: string;

  description: string | null;

  taskDescription: string | null;

  workingMinutes: number;

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
