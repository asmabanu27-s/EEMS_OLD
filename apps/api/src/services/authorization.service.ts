// ============================================================================
// EEMS - Authorization Service
// Leave Organizational Authorization
// ============================================================================
//
// This service performs resource-level authorization after JWT authentication
// and RBAC permission checks have already succeeded.
//
// Rules:
//   ADMIN     -> unrestricted by department/team
//   MANAGER   -> same department as leave owner
//   TEAM_LEAD -> same team as leave owner
//   EMPLOYEE  -> cannot approve/reject
//
// Security:
//   - actor identity comes from the verified JWT
//   - actor.employeeId is never accepted from request body
//   - self approval/rejection is always blocked when the actor is linked to
//     an employee record
// ============================================================================

import { EmployeeStatus, RoleCode } from "@/generated/prisma/enums.js";

import { AppError } from "@/middleware/app-error.js";
import { prisma } from "@/lib/prisma.js";

export interface AuthenticatedActor {
  /** User ID from JWT `sub`. */
  userId: string;

  /** Employee ID from JWT, or null for users without an employee profile. */
  employeeId: string | null;

  /** Role from the verified JWT. */
  role: RoleCode;
}

export async function authorizeLeaveDecision(
  actor: AuthenticatedActor,
  leaveEmployeeId: string,
): Promise<void> {
  if (!actor.userId) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!leaveEmployeeId) {
    throw new AppError(
      "LEAVE_EMPLOYEE_REQUIRED",
      "Leave request employee is required",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Load target employee first. This also prevents authorization decisions
  // from being made against a non-existent employee.
  // --------------------------------------------------------------------------

  const targetEmployee = await prisma.employee.findUnique({
    where: { id: leaveEmployeeId },
    select: {
      id: true,
      departmentId: true,
      teamId: true,
    },
  });

  if (!targetEmployee) {
    throw new AppError(
      "EMPLOYEE_NOT_FOUND",
      "Leave request employee was not found",
      404,
    );
  }

  // --------------------------------------------------------------------------
  // Self approval/rejection is never permitted when the authenticated user is
  // linked to the same employee record.
  // --------------------------------------------------------------------------

  if (actor.employeeId && actor.employeeId === targetEmployee.id) {
    throw new AppError(
      "SELF_APPROVAL_NOT_ALLOWED",
      "You cannot approve or reject your own leave request",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------

  if (actor.role === RoleCode.ADMIN) {
    return;
  }

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------

  if (actor.role === RoleCode.EMPLOYEE) {
    throw new AppError(
      "FORBIDDEN",
      "Employees cannot approve or reject leave requests",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // Manager and Team Lead require an active employee profile.
  // --------------------------------------------------------------------------

  if (!actor.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  const actorEmployee = await prisma.employee.findUnique({
    where: { id: actor.employeeId },
    select: {
      id: true,
      status: true,
      departmentId: true,
      teamId: true,
    },
  });

  if (!actorEmployee) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated employee profile was not found",
      403,
    );
  }

  if (actorEmployee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError(
      "EMPLOYEE_NOT_ACTIVE",
      "Only active employees can approve or reject leave requests",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // MANAGER
  // --------------------------------------------------------------------------

  if (actor.role === RoleCode.MANAGER) {
    if (actorEmployee.departmentId !== targetEmployee.departmentId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only approve or reject leave requests within your department",
        403,
      );
    }

    return;
  }

  // --------------------------------------------------------------------------
  // TEAM LEAD
  // --------------------------------------------------------------------------

  if (actor.role === RoleCode.TEAM_LEAD) {
    if (!actorEmployee.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    if (!targetEmployee.teamId) {
      throw new AppError(
        "FORBIDDEN",
        "The employee is not assigned to a team",
        403,
      );
    }

    if (actorEmployee.teamId !== targetEmployee.teamId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only approve or reject leave requests within your team",
        403,
      );
    }

    return;
  }

  throw new AppError(
    "FORBIDDEN",
    "You do not have permission to approve or reject leave requests",
    403,
  );
}
