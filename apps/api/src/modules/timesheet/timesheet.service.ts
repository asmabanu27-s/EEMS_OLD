// ============================================================================
// EEMS - Timesheet Service
// ============================================================================

import {
  EmployeeStatus,
  RoleCode,
  TimesheetStatus,
} from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";

import { AppError } from "@/middleware/app-error.js";

import type {
  CreateTimesheetInput,
  TimesheetDecisionInput,
  TimesheetListQuery,
  TimesheetListResult,
  TimesheetRecord,
  TimesheetScope,
  UpdateTimesheetInput,
} from "./timesheet.types.js";

import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "./timesheet.types.js";

// ============================================================================
// DATE HELPERS
// ============================================================================

function parseDateOnly(value: string, fieldName: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(
      "INVALID_DATE_FORMAT",
      `${fieldName} must be in YYYY-MM-DD format`,
      400,
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("INVALID_DATE", `${fieldName} is invalid`, 400);
  }

  return date;
}

// ============================================================================
// DATE FORMAT
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ============================================================================
// EMPLOYEE VALIDATION
// ============================================================================

async function getActiveEmployee(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },

    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      displayName: true,
      departmentId: true,
      teamId: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
  }

  if (employee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError("EMPLOYEE_NOT_ACTIVE", "Employee is not active", 403);
  }

  return employee;
}

// ============================================================================
// AUTHENTICATED EMPLOYEE
// ============================================================================

async function getScopeEmployee(scope: TimesheetScope) {
  if (!scope.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  return getActiveEmployee(scope.employeeId);
}

// ============================================================================
// RECORD MAPPER
// ============================================================================

function mapRecord(record: any): TimesheetRecord {
  return {
    id: record.id,

    employeeId: record.employee.id,

    employeeCode: record.employee.employeeCode,

    firstName: record.employee.firstName,

    lastName: record.employee.lastName,

    displayName: record.employee.displayName,

    workDate: formatDate(record.workDate),

    description: record.description,

    taskDescription: record.taskDescription,

    workingMinutes: record.workingMinutes,

    status: record.status,

    submittedAt: record.submittedAt?.toISOString() ?? null,

    approvedAt: record.approvedAt?.toISOString() ?? null,

    rejectedAt: record.rejectedAt?.toISOString() ?? null,

    approverEmployeeId: record.approverEmployeeId,

    approvalNote: record.approvalNote,

    createdAt: record.createdAt.toISOString(),

    updatedAt: record.updatedAt.toISOString(),
  };
}

// ============================================================================
// CREATE
// ============================================================================

export async function createTimesheet(
  employeeId: string,
  input: CreateTimesheetInput,
): Promise<TimesheetRecord> {
  await getActiveEmployee(employeeId);

  const workDate = parseDateOnly(input.workDate, "workDate");

  if (!Number.isInteger(input.workingMinutes) || input.workingMinutes < 0) {
    throw new AppError(
      "INVALID_WORKING_MINUTES",
      "workingMinutes must be a non-negative integer",
      400,
    );
  }

  const existing = await prisma.timesheet.findUnique({
    where: {
      employeeId_workDate: {
        employeeId,
        workDate,
      },
    },
  });

  if (existing) {
    throw new AppError(
      "TIMESHEET_EXISTS",
      "A timesheet already exists for this employee and work date",
      409,
    );
  }

  const record = await prisma.timesheet.create({
    data: {
      employeeId,

      workDate,

      description: input.description?.trim() || null,

      taskDescription: input.taskDescription?.trim() || null,

      workingMinutes: input.workingMinutes,

      status: TimesheetStatus.DRAFT,
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
    },
  });

  return mapRecord(record);
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getTimesheetById(
  id: string,
  scope: TimesheetScope,
): Promise<TimesheetRecord> {
  const record = await prisma.timesheet.findUnique({
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
          departmentId: true,
          teamId: true,
        },
      },
    },
  });

  if (!record) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  await assertScope(record.employee, scope);

  return mapRecord(record);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateTimesheet(
  id: string,
  employeeId: string,
  input: UpdateTimesheetInput,
): Promise<TimesheetRecord> {
  const record = await prisma.timesheet.findUnique({
    where: {
      id,
    },
  });

  if (!record) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  if (record.employeeId !== employeeId) {
    throw new AppError(
      "TIMESHEET_ACCESS_DENIED",
      "You can only modify your own timesheets",
      403,
    );
  }

  if (
    record.status !== TimesheetStatus.DRAFT &&
    record.status !== TimesheetStatus.REJECTED
  ) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      "Only DRAFT or REJECTED timesheets can be modified",
      400,
    );
  }

  const data: {
    workDate?: Date;
    description?: string | null;
    taskDescription?: string | null;
    workingMinutes?: number;
    status?: TimesheetStatus;
    rejectedAt?: Date | null;
    approvalNote?: string | null;
  } = {};

  if (input.workDate !== undefined) {
    data.workDate = parseDateOnly(input.workDate, "workDate");
  }

  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }

  if (input.taskDescription !== undefined) {
    data.taskDescription = input.taskDescription.trim() || null;
  }

  if (input.workingMinutes !== undefined) {
    if (!Number.isInteger(input.workingMinutes) || input.workingMinutes < 0) {
      throw new AppError(
        "INVALID_WORKING_MINUTES",
        "workingMinutes must be a non-negative integer",
        400,
      );
    }

    data.workingMinutes = input.workingMinutes;
  }

  if (record.status === TimesheetStatus.REJECTED) {
    data.status = TimesheetStatus.DRAFT;

    data.rejectedAt = null;

    data.approvalNote = null;
  }

  const updated = await prisma.timesheet.update({
    where: {
      id,
    },

    data,

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
    },
  });

  return mapRecord(updated);
}

// ============================================================================
// SUBMIT
// ============================================================================

export async function submitTimesheet(
  id: string,
  employeeId: string,
): Promise<TimesheetRecord> {
  const record = await prisma.timesheet.findUnique({
    where: {
      id,
    },
  });

  if (!record) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  if (record.employeeId !== employeeId) {
    throw new AppError(
      "TIMESHEET_ACCESS_DENIED",
      "You can only submit your own timesheets",
      403,
    );
  }

  if (
    record.status !== TimesheetStatus.DRAFT &&
    record.status !== TimesheetStatus.REJECTED
  ) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      "Only DRAFT or REJECTED timesheets can be submitted",
      400,
    );
  }

  const updated = await prisma.timesheet.update({
    where: {
      id,
    },

    data: {
      status: TimesheetStatus.SUBMITTED,

      submittedAt: new Date(),

      rejectedAt: null,

      approvalNote: null,
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
    },
  });

  return mapRecord(updated);
}

// ============================================================================
// APPROVE
// ============================================================================

export async function approveTimesheet(
  id: string,
  approverEmployeeId: string,
  note?: string,
): Promise<TimesheetRecord> {
  const record = await prisma.timesheet.findUnique({
    where: {
      id,
    },

    include: {
      employee: {
        select: {
          id: true,
          departmentId: true,
          teamId: true,
          status: true,
        },
      },
    },
  });

  if (!record) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  if (record.status !== TimesheetStatus.SUBMITTED) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      `Only SUBMITTED timesheets can be approved. Current status: ${record.status}`,
      400,
    );
  }

  const approver = await getActiveEmployee(approverEmployeeId);

  await assertApprovalScope(approver, record.employee);

  // Use an atomic status guard so two concurrent approval requests
  // cannot both transition the same SUBMITTED record.
  const updatedResult = await prisma.timesheet.updateMany({
    where: {
      id,
      status: TimesheetStatus.SUBMITTED,
    },

    data: {
      status: TimesheetStatus.APPROVED,

      approvedAt: new Date(),

      rejectedAt: null,

      approverEmployeeId,

      approvalNote: note?.trim() || null,
    },
  });

  if (updatedResult.count !== 1) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      "Only SUBMITTED timesheets can be approved",
      400,
    );
  }

  const updated = await prisma.timesheet.findUnique({
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
    },
  });

  if (!updated) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  return mapRecord(updated);
}

// ============================================================================
// REJECT
// ============================================================================

export async function rejectTimesheet(
  id: string,
  approverEmployeeId: string,
  note?: string,
): Promise<TimesheetRecord> {
  const record = await prisma.timesheet.findUnique({
    where: {
      id,
    },

    include: {
      employee: {
        select: {
          id: true,
          departmentId: true,
          teamId: true,
          status: true,
        },
      },
    },
  });

  if (!record) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  if (record.status !== TimesheetStatus.SUBMITTED) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      `Only SUBMITTED timesheets can be rejected. Current status: ${record.status}`,
      400,
    );
  }

  const approver = await getActiveEmployee(approverEmployeeId);

  await assertApprovalScope(approver, record.employee);

  // Use an atomic status guard so concurrent approve/reject requests
  // cannot both transition the same SUBMITTED record.
  const updatedResult = await prisma.timesheet.updateMany({
    where: {
      id,
      status: TimesheetStatus.SUBMITTED,
    },

    data: {
      status: TimesheetStatus.REJECTED,

      rejectedAt: new Date(),

      approvedAt: null,

      approverEmployeeId,

      approvalNote: note?.trim() || null,
    },
  });

  if (updatedResult.count !== 1) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      "Only SUBMITTED timesheets can be rejected",
      400,
    );
  }

  const updated = await prisma.timesheet.findUnique({
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
    },
  });

  if (!updated) {
    throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
  }

  return mapRecord(updated);
}

// ============================================================================
// LIST
// ============================================================================

export async function listTimesheets(
  scope: TimesheetScope,
  query: TimesheetListQuery = {},
): Promise<TimesheetListResult> {
  const page =
    query.page && query.page > 0 ? Math.floor(query.page) : DEFAULT_PAGE;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  const scopeWhere = await buildScopeWhere(scope, query.employeeId);

  const where = {
    ...scopeWhere,

    ...(query.status
      ? {
          status: query.status,
        }
      : {}),

    ...(query.from || query.to
      ? {
          workDate: {
            ...(query.from
              ? {
                  gte: parseDateOnly(query.from, "from"),
                }
              : {}),

            ...(query.to
              ? {
                  lte: parseDateOnly(query.to, "to"),
                }
              : {}),
          },
        }
      : {}),
  };

  const [records, total] = await prisma.$transaction([
    prisma.timesheet.findMany({
      where,

      orderBy: [
        {
          workDate: "desc",
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
          },
        },
      },
    }),

    prisma.timesheet.count({
      where,
    }),
  ]);

  return {
    records: records.map(mapRecord),

    pagination: {
      page,

      limit,

      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// SCOPE
// ============================================================================

async function buildScopeWhere(
  scope: TimesheetScope,
  requestedEmployeeId?: string,
) {
  if (scope.role === RoleCode.ADMIN) {
    if (requestedEmployeeId) {
      return {
        employeeId: requestedEmployeeId,
      };
    }

    return {};
  }

  const requester = await getScopeEmployee(scope);

  if (scope.role === RoleCode.EMPLOYEE) {
    if (requestedEmployeeId && requestedEmployeeId !== requester.id) {
      throw new AppError(
        "TIMESHEET_ACCESS_DENIED",
        "You can only access your own timesheets",
        403,
      );
    }

    return {
      employeeId: requester.id,
    };
  }

  if (scope.role === RoleCode.MANAGER) {
    if (requestedEmployeeId) {
      const target = await getActiveEmployee(requestedEmployeeId);

      if (target.departmentId !== requester.departmentId) {
        throw new AppError(
          "TIMESHEET_ACCESS_DENIED",
          "You can only access timesheets within your department",
          403,
        );
      }

      return {
        employeeId: target.id,
      };
    }

    return {
      employee: {
        departmentId: requester.departmentId,
      },
    };
  }

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    if (requestedEmployeeId) {
      const target = await getActiveEmployee(requestedEmployeeId);

      if (target.teamId !== requester.teamId) {
        throw new AppError(
          "TIMESHEET_ACCESS_DENIED",
          "You can only access timesheets within your team",
          403,
        );
      }

      return {
        employeeId: target.id,
      };
    }

    return {
      employee: {
        teamId: requester.teamId,
      },
    };
  }

  throw new AppError(
    "TIMESHEET_ACCESS_DENIED",
    "You do not have permission to access timesheets",
    403,
  );
}

// ============================================================================
// RECORD SCOPE
// ============================================================================

async function assertScope(
  target: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
  scope: TimesheetScope,
): Promise<void> {
  if (scope.role === RoleCode.ADMIN) {
    return;
  }

  const requester = await getScopeEmployee(scope);

  if (scope.role === RoleCode.EMPLOYEE) {
    if (target.id !== requester.id) {
      throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
    }

    return;
  }

  if (scope.role === RoleCode.MANAGER) {
    if (target.departmentId !== requester.departmentId) {
      throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
    }

    return;
  }

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId || target.teamId !== requester.teamId) {
      throw new AppError("TIMESHEET_NOT_FOUND", "Timesheet not found", 404);
    }

    return;
  }

  throw new AppError(
    "TIMESHEET_ACCESS_DENIED",
    "You do not have permission to access this timesheet",
    403,
  );
}

// ============================================================================
// APPROVAL SCOPE
// ============================================================================

async function assertApprovalScope(
  approver: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
  target: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
): Promise<void> {
  const user = await prisma.employee.findUnique({
    where: {
      id: approver.id,
    },

    select: {
      id: true,

      departmentId: true,

      teamId: true,

      user: {
        select: {
          role: {
            select: {
              code: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(
      "EMPLOYEE_NOT_FOUND",
      "Approver employee not found",
      404,
    );
  }

  const role = user.user?.role.code;

  // A user must never approve or reject their own timesheet.
  // This applies to ADMIN as well; administrative scope does not bypass
  // the fundamental self-approval control.
  if (approver.id === target.id) {
    throw new AppError(
      "TIMESHEET_SELF_APPROVAL_DENIED",
      "You cannot approve or reject your own timesheet",
      403,
    );
  }

  if (role === RoleCode.ADMIN) {
    return;
  }

  if (role === RoleCode.MANAGER) {
    if (approver.departmentId !== target.departmentId) {
      throw new AppError(
        "TIMESHEET_APPROVAL_SCOPE_DENIED",
        "You can only approve or reject timesheets within your department",
        403,
      );
    }

    return;
  }

  if (role === RoleCode.TEAM_LEAD) {
    if (!approver.teamId || approver.teamId !== target.teamId) {
      throw new AppError(
        "TIMESHEET_APPROVAL_SCOPE_DENIED",
        "You can only approve or reject timesheets within your team",
        403,
      );
    }

    return;
  }

  throw new AppError(
    "TIMESHEET_APPROVAL_DENIED",
    "You do not have permission to approve or reject timesheets",
    403,
  );
}
