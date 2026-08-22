// ============================================================================
// EEMS - Attendance Management
// Attendance Module Types
// ============================================================================

import type {
  AttendanceSessionStatus,
  AttendanceStatus,
  RoleCode,
} from "@/generated/prisma/enums.js";

// ============================================================================
// CONSTANTS
// ============================================================================

export const REQUIRED_WORKING_MINUTES = 480;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// ============================================================================
// CHECK-IN RESULT
// ============================================================================

export interface CheckInResult {
  attendanceId: string;
  sessionId: string;
  employeeId: string;
  attendanceDate: string;
  checkInAt: string;
  sessionStatus: AttendanceSessionStatus;
  attendanceStatus: AttendanceStatus;
  workingMinutes: number;
}

// ============================================================================
// CHECK-OUT RESULT
// ============================================================================

export interface CheckOutResult {
  attendanceId: string;
  sessionId: string;
  employeeId: string;
  attendanceDate: string;
  checkInAt: string;
  checkOutAt: string;
  sessionWorkingMinutes: number;
  totalWorkingMinutes: number;
  attendanceStatus: AttendanceStatus;
}

// ============================================================================
// ATTENDANCE SESSION VIEW
// ============================================================================

export interface AttendanceSessionView {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  workingMinutes: number;
  status: AttendanceSessionStatus;
}

// ============================================================================
// TODAY ATTENDANCE VIEW
// ============================================================================

export interface TodayAttendanceView {
  attendanceId: string;
  employeeId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  workingMinutes: number;
  requiredWorkingMinutes: number;
  remainingWorkingMinutes: number;
  sessions: AttendanceSessionView[];
}

// ============================================================================
// ATTENDANCE LIST QUERY
// ============================================================================

export interface AttendanceListQuery {
  employeeId?: string | undefined;
  status?: AttendanceStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ============================================================================
// AUTHORIZATION SCOPE
// ============================================================================

export interface AttendanceScope {
  userId: string;
  employeeId: string | null;
  role: RoleCode;
}

// ============================================================================
// ATTENDANCE LIST RESULT
// ============================================================================

export interface AttendanceListItem {
  id: string;
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  displayName: string | null;
  attendanceDate: string;
  status: AttendanceStatus;
  workingMinutes: number;
  requiredWorkingMinutes: number;
  remainingWorkingMinutes: number;
  sessions: AttendanceSessionView[];
}

export interface AttendanceListResult {
  records: AttendanceListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
