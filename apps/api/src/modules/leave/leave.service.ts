// ============================================================================
// EEMS - Leave Management
// Leave Service
// ============================================================================
//
// Responsibilities:
//
// 1. Validate employee.
// 2. Validate leave type.
// 3. Validate leave dates.
// 4. Calculate inclusive leave duration.
// 5. Detect overlapping leave.
// 6. Create leave requests.
// 7. Retrieve leave requests.
// 8. Paginate leave requests.
// 9. Approve leave requests.
// 10. Reject leave requests.
// 11. Cancel leave requests.
// 12. Enforce employee ownership for self-service operations.
// 13. Enforce organizational authorization for leave approval/rejection.
//
// Authentication itself is handled by middleware.
//
// The service receives trusted employeeId values from the controller.
//
// Approval authorization:
//
//   ADMIN
//     -> unrestricted
//
//   MANAGER
//     -> same department
//
//   TEAM_LEAD
//     -> same team
//
//   EMPLOYEE
//     -> cannot approve/reject
//
// Additional security rule:
//
//   An employee cannot approve or reject their own leave request.
// ============================================================================

import { EmployeeStatus, LeaveStatus } from "@/generated/prisma/enums.js";

import { AppError } from "@/middleware/app-error.js";
import { prisma } from "@/lib/prisma.js";
import {
  authorizeLeaveDecision,
  type AuthenticatedActor,
} from "@/services/authorization.service.js";

import type {
  CreateLeaveRequestInput,
  LeaveDecisionInput,
  LeaveListQuery,
  LeaveListResult,
} from "./leave.types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Validate a date-only value in YYYY-MM-DD format.
 *
 * The application deliberately uses date-only values for leave dates.
 *
 * This avoids timezone-related problems when comparing leave periods.
 */
function parseDateOnly(value: string, fieldName: string): Date {
  // --------------------------------------------------------------------------
  // Format validation.
  // --------------------------------------------------------------------------

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(
      "INVALID_DATE_FORMAT",
      `${fieldName} must be in YYYY-MM-DD format`,
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Convert to UTC midnight.
  // --------------------------------------------------------------------------

  const date = new Date(`${value}T00:00:00.000Z`);

  // --------------------------------------------------------------------------
  // Protect against invalid JavaScript dates.
  // --------------------------------------------------------------------------

  if (Number.isNaN(date.getTime())) {
    throw new AppError("INVALID_DATE", `${fieldName} is invalid`, 400);
  }

  // --------------------------------------------------------------------------
  // Prevent JavaScript date normalization.
  //
  // Example:
  //
  // 2026-02-31
  //
  // must not silently become another date.
  // --------------------------------------------------------------------------

  const normalized = date.toISOString().slice(0, 10);

  if (normalized !== value) {
    throw new AppError("INVALID_DATE", `${fieldName} is invalid`, 400);
  }

  return date;
}

/**
 * Calculate inclusive leave days.
 *
 * Examples:
 *
 * 2026-08-15 -> 2026-08-15 = 1 day
 * 2026-08-15 -> 2026-08-17 = 3 days
 */
function calculateTotalDays(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  const difference = endDate.getTime() - startDate.getTime();

  return Math.floor(difference / millisecondsPerDay) + 1;
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Trim optional strings.
 *
 * Empty strings become undefined.
 */
function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

// ============================================================================
// CREATE LEAVE REQUEST
// ============================================================================

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  // --------------------------------------------------------------------------
  // Normalize required identifiers.
  // --------------------------------------------------------------------------

  const employeeId = input.employeeId.trim();

  const leaveTypeId = input.leaveTypeId.trim();

  // --------------------------------------------------------------------------
  // Validate employee ID.
  // --------------------------------------------------------------------------

  if (!employeeId) {
    throw new AppError("EMPLOYEE_ID_REQUIRED", "employeeId is required", 400);
  }

  // --------------------------------------------------------------------------
  // Validate leave type ID.
  // --------------------------------------------------------------------------

  if (!leaveTypeId) {
    throw new AppError(
      "LEAVE_TYPE_ID_REQUIRED",
      "leaveTypeId is required",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Parse dates.
  // --------------------------------------------------------------------------

  const startDate = parseDateOnly(input.startDate, "startDate");

  const endDate = parseDateOnly(input.endDate, "endDate");

  // ==========================================================================
// VALIDATE LEAVE DATE IS TODAY OR FUTURE
// ==========================================================================

const today = new Date();

today.setUTCHours(
  0,
  0,
  0,
  0,
);

if (startDate < today) {
  throw new AppError(
    "LEAVE_DATE_IN_PAST",
    "Leave start date cannot be before today",
    400,
  );
}

  // --------------------------------------------------------------------------
  // Validate date range.
  // --------------------------------------------------------------------------

  if (startDate > endDate) {
    throw new AppError(
      "INVALID_LEAVE_DATE_RANGE",
      "startDate cannot be after endDate",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Calculate inclusive duration.
  // --------------------------------------------------------------------------

  const totalDays = calculateTotalDays(startDate, endDate);

  // ==========================================================================
  // VALIDATE EMPLOYEE
  // ==========================================================================

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },

    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
  }

  // --------------------------------------------------------------------------
  // Employee must be active.
  // --------------------------------------------------------------------------

  if (employee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError(
      "EMPLOYEE_NOT_ACTIVE",
      "Leave can only be applied by an active employee",
      409,
    );
  }

  // ==========================================================================
  // VALIDATE LEAVE TYPE
  // ==========================================================================

  const leaveType = await prisma.leaveType.findUnique({
    where: {
      id: leaveTypeId,
    },

    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      isPaid: true,
    },
  });

  if (!leaveType) {
    throw new AppError("LEAVE_TYPE_NOT_FOUND", "Leave type not found", 404);
  }

  if (!leaveType.isActive) {
    throw new AppError(
      "LEAVE_TYPE_INACTIVE",
      "Selected leave type is inactive",
      409,
    );
  }

  // ==========================================================================
  // CHECK OVERLAPPING LEAVE
  // ==========================================================================
  //
  // PENDING and APPROVED leave blocks a new request.
  //
  // REJECTED and CANCELLED leave does not.
  // ==========================================================================

  const overlappingRequest = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,

      status: {
        in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      },

      startDate: {
        lte: endDate,
      },

      endDate: {
        gte: startDate,
      },
    },

    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (overlappingRequest) {
    throw new AppError(
      "LEAVE_OVERLAP",
      "Leave request overlaps with an existing pending or approved leave",
      409,
    );
  }

  // ==========================================================================
  // CREATE REQUEST
  // ==========================================================================

  const reason = normalizeOptionalString(input.reason);

  const request = await prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveTypeId,

      startDate,
      endDate,

      totalDays,

      ...(reason !== undefined
        ? {
            reason,
          }
        : {}),

      status: LeaveStatus.PENDING,
    },

    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },

      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
          isPaid: true,
        },
      },
    },
  });

  return request;
}

// ============================================================================
// LIST ACTIVE LEAVE TYPES
// ============================================================================

export async function listActiveLeaveTypes() {
  return prisma.leaveType.findMany({
    where: {
      isActive: true,
    },

    orderBy: {
      name: "asc",
    },

    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isPaid: true,
      isActive: true,
    },
  });
}

// ============================================================================
// GET LEAVE REQUEST BY ID
// ============================================================================
//
// employeeId is optional because management-level access can eventually need
// to retrieve requests outside the authenticated employee's own records.
//
// For employee self-service, the controller supplies the authenticated
// employeeId and ownership is enforced here.
// ============================================================================

export async function getLeaveRequestById(id: string, employeeId?: string) {
  const request = await prisma.leaveRequest.findUnique({
    where: {
      id,
    },

    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },

      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isPaid: true,
          isActive: true,
        },
      },
    },
  });

  if (!request) {
    return null;
  }

  // --------------------------------------------------------------------------
  // Ownership enforcement.
  //
  // If employeeId is supplied, the requested leave must belong to that
  // employee.
  //
  // Returning null instead of "FORBIDDEN" also prevents exposing whether a
  // particular leave request ID exists for another employee.
  // --------------------------------------------------------------------------

  if (employeeId !== undefined && request.employeeId !== employeeId) {
    return null;
  }

  return request;
}

// ============================================================================
// LIST LEAVE REQUESTS
// ============================================================================
//
// Role-based visibility:
//
//   EMPLOYEE
//     -> own requests
//
//   TEAM_LEAD
//     -> employees belonging to the same team
//
//   MANAGER
//     -> employees belonging to the same department
//
//   ADMIN
//     -> all requests
//
// SECURITY:
//
// Scope is derived from the authenticated actor.
//
// Query parameters can filter the already-authorized dataset, but they cannot
// change the organizational scope.
// ============================================================================

export async function listLeaveRequests(
  query: LeaveListQuery = {},
  actor: AuthenticatedActor,
): Promise<LeaveListResult> {
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  if (!actor.userId) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authenticated user ID is required",
      401,
    );
  }

  // ==========================================================================
  // PAGINATION
  // ==========================================================================

  const page =
    query.page && query.page > 0 ? Math.floor(query.page) : DEFAULT_PAGE;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  // ==========================================================================
  // ORGANIZATIONAL SCOPE
  // ==========================================================================

  let employeeScope:
    | {
        employeeId: string;
      }
    | {
        employee: {
          teamId: string;
        };
      }
    | {
        employee: {
          departmentId: string;
        };
      }
    | undefined;

  // ==========================================================================
  // ADMIN
  // ==========================================================================

  if (actor.role === "ADMIN") {
    // No employee scope.
    //
    // ADMIN can see all leave requests.
    employeeScope = undefined;
  }

  // ==========================================================================
  // EMPLOYEE
  // ==========================================================================
  else if (actor.role === "EMPLOYEE") {
    if (!actor.employeeId) {
      throw new AppError(
        "EMPLOYEE_PROFILE_REQUIRED",
        "Authenticated employee profile is required",
        403,
      );
    }

    employeeScope = {
      employeeId: actor.employeeId,
    };
  }

  // ==========================================================================
  // TEAM LEAD
  // ==========================================================================
  else if (actor.role === "TEAM_LEAD") {
    if (!actor.employeeId) {
      throw new AppError(
        "EMPLOYEE_PROFILE_REQUIRED",
        "Authenticated employee profile is required",
        403,
      );
    }

    const teamLead = await prisma.employee.findUnique({
      where: {
        id: actor.employeeId,
      },

      select: {
        teamId: true,
      },
    });

    if (!teamLead) {
      throw new AppError(
        "EMPLOYEE_PROFILE_REQUIRED",
        "Authenticated employee profile was not found",
        403,
      );
    }

    if (!teamLead.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    employeeScope = {
      employee: {
        teamId: teamLead.teamId,
      },
    };
  }

  // ==========================================================================
  // MANAGER
  // ==========================================================================
  else if (actor.role === "MANAGER") {
    if (!actor.employeeId) {
      throw new AppError(
        "EMPLOYEE_PROFILE_REQUIRED",
        "Authenticated employee profile is required",
        403,
      );
    }

    const manager = await prisma.employee.findUnique({
      where: {
        id: actor.employeeId,
      },

      select: {
        departmentId: true,
      },
    });

    if (!manager) {
      throw new AppError(
        "EMPLOYEE_PROFILE_REQUIRED",
        "Authenticated employee profile was not found",
        403,
      );
    }

    if (!manager.departmentId) {
      throw new AppError(
        "DEPARTMENT_REQUIRED",
        "Manager is not assigned to a department",
        403,
      );
    }

    employeeScope = {
      employee: {
        departmentId: manager.departmentId,
      },
    };
  }

  // ==========================================================================
  // UNKNOWN ROLE
  // ==========================================================================
  else {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to view leave requests",
      403,
    );
  }

  // ==========================================================================
  // DATE / STATUS FILTERS
  // ==========================================================================
  //
  // These filters are applied AFTER the authorization scope.
  //
  // Therefore:
  //
  //   ?status=PENDING
  //
  // is safe.
  //
  // But:
  //
  //   ?employeeId=<someone-else>
  //
  // is not even accepted by LeaveListQuery.
  // ==========================================================================

  const where = {
    ...(employeeScope ?? {}),

    ...(query.status
      ? {
          status: query.status,
        }
      : {}),

    ...(query.from
      ? {
          endDate: {
            gte: parseDateOnly(query.from, "from"),
          },
        }
      : {}),

    ...(query.to
      ? {
          startDate: {
            lte: parseDateOnly(query.to, "to"),
          },
        }
      : {}),
  };

  // ==========================================================================
  // FETCH + COUNT
  // ==========================================================================

  const [requests, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,

      orderBy: [
        {
          appliedAt: "desc",
        },
        {
          startDate: "desc",
        },
      ],

      skip,
      take: limit,

      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            departmentId: true,
            teamId: true,
          },
        },

        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
            isPaid: true,
          },
        },
      },
    }),

    prisma.leaveRequest.count({
      where,
    }),
  ]);

  // ==========================================================================
  // RESULT
  // ==========================================================================

  return {
    requests,

    pagination: {
      page,
      limit,
      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
// ============================================================================
// APPROVE LEAVE REQUEST
// ============================================================================

export async function approveLeaveRequest(
  id: string,
  actor: AuthenticatedActor,
  input: LeaveDecisionInput = {},
) {
  // ========================================================================
  // FIND REQUEST
  // ========================================================================

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      status: true,
    },
  });

  if (!request) {
    throw new AppError("LEAVE_NOT_FOUND", "Leave request not found", 404);
  }

  // ========================================================================
  // STATUS CHECK
  // ========================================================================

  if (request.status !== LeaveStatus.PENDING) {
    throw new AppError(
      "INVALID_LEAVE_STATUS",
      `Only PENDING leave requests can be approved. Current status: ${request.status}`,
      409,
    );
  }

  // ========================================================================
  // ORGANIZATIONAL AUTHORIZATION
  // ========================================================================

  await authorizeLeaveDecision(actor, request.employeeId);

  const approvalNote = normalizeOptionalString(input.approvalNote);

  // ========================================================================
  // ATOMIC STATE TRANSITION
  // ========================================================================
  //
  // updateMany with status=PENDING prevents two concurrent approvers from
  // both successfully approving the same request.
  // ========================================================================

  const result = await prisma.leaveRequest.updateMany({
    where: {
      id,
      status: LeaveStatus.PENDING,
    },
    data: {
      status: LeaveStatus.APPROVED,
      approvedAt: new Date(),
      approverId: actor.userId,
      ...(approvalNote !== undefined ? { approvalNote } : {}),
    },
  });

  if (result.count !== 1) {
    throw new AppError(
      "INVALID_LEAVE_STATUS",
      "Leave request is no longer pending",
      409,
    );
  }

  const updated = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
          isPaid: true,
        },
      },
    },
  });

  if (!updated) {
    throw new AppError(
      "LEAVE_NOT_FOUND",
      "Leave request was not found after approval",
      404,
    );
  }

  return updated;
}

// ============================================================================
// REJECT LEAVE REQUEST
// ============================================================================

export async function rejectLeaveRequest(
  id: string,
  actor: AuthenticatedActor,
  input: LeaveDecisionInput = {},
) {
  // ========================================================================
  // FIND REQUEST
  // ========================================================================

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      status: true,
    },
  });

  if (!request) {
    throw new AppError("LEAVE_NOT_FOUND", "Leave request not found", 404);
  }

  // ========================================================================
  // STATUS CHECK
  // ========================================================================

  if (request.status !== LeaveStatus.PENDING) {
    throw new AppError(
      "INVALID_LEAVE_STATUS",
      `Only PENDING leave requests can be rejected. Current status: ${request.status}`,
      409,
    );
  }

  // ========================================================================
  // ORGANIZATIONAL AUTHORIZATION
  // ========================================================================

  await authorizeLeaveDecision(actor, request.employeeId);

  const approvalNote = normalizeOptionalString(input.approvalNote);

  // ========================================================================
  // ATOMIC STATE TRANSITION
  // ========================================================================

  const result = await prisma.leaveRequest.updateMany({
    where: {
      id,
      status: LeaveStatus.PENDING,
    },
    data: {
      status: LeaveStatus.REJECTED,
      rejectedAt: new Date(),
      approverId: actor.userId,
      ...(approvalNote !== undefined ? { approvalNote } : {}),
    },
  });

  if (result.count !== 1) {
    throw new AppError(
      "INVALID_LEAVE_STATUS",
      "Leave request is no longer pending",
      409,
    );
  }

  const updated = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
          isPaid: true,
        },
      },
    },
  });

  if (!updated) {
    throw new AppError(
      "LEAVE_NOT_FOUND",
      "Leave request was not found after rejection",
      404,
    );
  }

  return updated;
}

// ============================================================================
// CANCEL LEAVE REQUEST
// ============================================================================
//
// employeeId is the authenticated employee.
//
// The request can only be cancelled if:
//
//   1. It exists.
//   2. It belongs to the authenticated employee.
//   3. It is PENDING.
// ============================================================================

export async function cancelLeaveRequest(id: string, employeeId: string) {
  const request = await prisma.leaveRequest.findUnique({
    where: {
      id,
    },
  });

  if (!request) {
    throw new AppError("LEAVE_NOT_FOUND", "Leave request not found", 404);
  }

  // --------------------------------------------------------------------------
  // Ownership check.
  //
  // Do not allow Employee A to cancel Employee B's request.
  // --------------------------------------------------------------------------

  if (request.employeeId !== employeeId) {
    throw new AppError("LEAVE_NOT_FOUND", "Leave request not found", 404);
  }

  // --------------------------------------------------------------------------
  // Only PENDING requests can be cancelled.
  // --------------------------------------------------------------------------

  if (request.status !== LeaveStatus.PENDING) {
    throw new AppError(
      "INVALID_LEAVE_STATUS",
      `Only PENDING leave requests can be cancelled. Current status: ${request.status}`,
      409,
    );
  }

  // --------------------------------------------------------------------------
  // Cancel request.
  // --------------------------------------------------------------------------

  const updated = await prisma.leaveRequest.update({
    where: {
      id,
    },

    data: {
      status: LeaveStatus.CANCELLED,
    },

    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },

      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
          isPaid: true,
        },
      },
    },
  });

  return updated;
}
