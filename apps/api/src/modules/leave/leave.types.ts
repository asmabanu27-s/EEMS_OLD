// ============================================================================
// EEMS - Leave Management
// Leave Module Types
// ============================================================================
//
// This file contains request/query types used by the Leave HTTP and service
// layers.
//
// SECURITY MODEL
// ============================================================================
//
// Employee identity for self-service operations comes from:
//
//   req.user.employeeId
//
// Approver identity comes from:
//
//   req.user.sub
//
// Organizational authorization uses the authenticated actor.
//
// IMPORTANT:
//
// employeeId is intentionally NOT part of LeaveListQuery.
//
// A client must never be able to change its visibility by sending:
//
//   ?employeeId=<another-employee>
//
// Visibility is determined server-side from the authenticated role.
// ============================================================================

import type { LeaveStatus } from "@/generated/prisma/enums.js";

// ============================================================================
// CREATE LEAVE REQUEST
// ============================================================================
//
// Used when an employee creates a new leave request.
//
// employeeId is populated by the controller from:
//
//   req.user.employeeId
//
// The client must NOT be allowed to choose another employee.
// ============================================================================

export interface CreateLeaveRequestInput {
  /**
   * Authenticated employee ID.
   *
   * This value comes from req.user.employeeId.
   */
  employeeId: string;

  /**
   * Leave type UUID.
   */
  leaveTypeId: string;

  /**
   * Date-only value in YYYY-MM-DD format.
   */
  startDate: string;

  /**
   * Date-only value in YYYY-MM-DD format.
   */
  endDate: string;

  /**
   * Optional reason supplied by the employee.
   */
  reason?: string;
}

// ============================================================================
// LEAVE LIST QUERY
// ============================================================================
//
// Query parameters contain only filtering and pagination.
//
// Visibility is NOT controlled by query parameters.
//
// Role-based visibility:
//
//   EMPLOYEE
//     -> own leave requests
//
//   TEAM_LEAD
//     -> leave requests of employees in the same team
//
//   MANAGER
//     -> leave requests of employees in the same department
//
//   ADMIN
//     -> all leave requests
//
// employeeId is deliberately NOT accepted here.
// ============================================================================

export interface LeaveListQuery {
  /**
   * Optional leave status filter.
   */
  status?: LeaveStatus;

  /**
   * Optional start-date filter.
   *
   * Format:
   *
   *   YYYY-MM-DD
   */
  from?: string;

  /**
   * Optional end-date filter.
   *
   * Format:
   *
   *   YYYY-MM-DD
   */
  to?: string;

  /**
   * Page number.
   */
  page?: number;

  /**
   * Number of records per page.
   */
  limit?: number;
}

// ============================================================================
// APPROVAL / REJECTION INPUT
// ============================================================================
//
// This object is used by:
//
//   approveLeaveRequest()
//   rejectLeaveRequest()
//
// IMPORTANT:
//
// Authentication and authorization identity are NOT accepted here.
//
// They come from the authenticated actor supplied by the controller.
//
// Only the optional business note belongs here.
// ============================================================================

export interface LeaveDecisionInput {
  /**
   * Optional approval/rejection note.
   */
  approvalNote?: string;
}

// ============================================================================
// LEAVE LIST RESULT
// ============================================================================

export interface LeaveListResult {
  /**
   * Leave request records.
   *
   * The service returns Prisma result objects, therefore unknown[] is retained
   * here to avoid unnecessarily coupling this type to generated Prisma types.
   */
  requests: unknown[];

  /**
   * Pagination metadata.
   */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
