// ============================================================================
// EEMS - Employee Management
// Request / Response Types
// ============================================================================

import type { EmployeeStatus } from "@/generated/prisma/enums.js";

// ============================================================================
// AUTHORIZATION ACTOR
// ============================================================================
//
// This represents the authenticated user performing the operation.
//
// The JWT contains:
//   sub         -> user ID
//   employeeId  -> employee ID
//   role        -> role code
//
// ============================================================================

export interface EmployeeActor {
  userId: string;
  employeeId: string | null;
  role: string;
}

// ============================================================================
// CREATE EMPLOYEE
// ============================================================================

export interface CreateEmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  dateOfJoining?: string;
  dateOfBirth?: string;

  /**
   * Every employee must belong to a department.
   */
  departmentId: string;

  /**
   * Team and position are optional.
   */
  teamId?: string;
  positionId?: string;
}

// ============================================================================
// UPDATE EMPLOYEE
// ============================================================================

export interface UpdateEmployeeInput {
  employeeCode?: string;
  firstName?: string;
  lastName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  dateOfJoining?: string | null;
  dateOfBirth?: string | null;

  departmentId?: string;
  teamId?: string | null;
  positionId?: string | null;

  status?: EmployeeStatus;
}

// ============================================================================
// EMPLOYEE LIST QUERY
// ============================================================================

export interface EmployeeListQuery {
  search?: string;
  departmentId?: string;
  teamId?: string;
  status?: EmployeeStatus;
  page?: number;
  limit?: number;
}

// ============================================================================
// PAGINATED RESULT
// ============================================================================

export interface EmployeeListResult {
  employees: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
