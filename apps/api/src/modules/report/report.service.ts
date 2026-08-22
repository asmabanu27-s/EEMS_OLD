// ============================================================================
// EEMS - Employee Management System
// Reports Service
// ============================================================================
//
// Responsibilities:
//   - Attendance reporting
//   - Leave reporting
//   - Timesheet reporting
//   - Employee reporting
//   - Project reporting
//   - Organizational scope enforcement
//
// SECURITY:
//   ADMIN      -> organization-wide access
//   MANAGER    -> department-level access
//   TEAM_LEAD  -> team-level access
//   EMPLOYEE   -> own records only
//
// Client-supplied employeeId / departmentId / teamId values are NEVER trusted
// for authorization. They are validated against the authenticated user's scope.
// ============================================================================

import {
  EmployeeStatus,
  LeaveStatus,
  ProjectStatus,
  RoleCode,
  TimesheetStatus,
  AttendanceStatus,
} from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";
import { AppError } from "@/middleware/app-error.js";

import type { ReportQuery, ReportScope } from "./report.types.js";

// ============================================================================
// HELPERS
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

function validateDateRange(query: ReportQuery): {
  from?: Date;
  to?: Date;
} {
  const from =
    query.from !== undefined ? parseDateOnly(query.from, "from") : undefined;

  const to = query.to !== undefined ? parseDateOnly(query.to, "to") : undefined;

  if (from && to && from > to) {
    throw new AppError(
      "INVALID_DATE_RANGE",
      "from cannot be later than to",
      400,
    );
  }

  const result: {
    from?: Date;
    to?: Date;
  } = {};

  if (from !== undefined) {
    result.from = from;
  }

  if (to !== undefined) {
    result.to = to;
  }

  return result;
}

function formatDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function formatDateTime(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

// ============================================================================
// REQUESTER
// ============================================================================

async function getRequester(scope: ReportScope) {
  if (!scope.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: scope.employeeId,
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
    throw new AppError(
      "EMPLOYEE_NOT_FOUND",
      "Authenticated employee profile was not found",
      403,
    );
  }

  if (employee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError(
      "EMPLOYEE_NOT_ACTIVE",
      "Authenticated employee is not active",
      403,
    );
  }

  return employee;
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
// SCOPE
// ============================================================================
//
// Returns a Prisma-compatible Employee filter.
//
// ADMIN:
//   {}
//
// MANAGER:
//   employee.departmentId = requester.departmentId
//
// TEAM LEAD:
//   employee.teamId = requester.teamId
//
// EMPLOYEE:
//   employee.id = requester.id
// ============================================================================

async function buildEmployeeScope(
  scope: ReportScope,
  requestedEmployeeId?: string,
) {
  if (scope.role === RoleCode.ADMIN) {
    if (requestedEmployeeId) {
      await getActiveEmployee(requestedEmployeeId);

      return {
        employeeId: requestedEmployeeId,
      };
    }

    return {};
  }

  const requester = await getRequester(scope);

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.EMPLOYEE) {
    if (requestedEmployeeId && requestedEmployeeId !== requester.id) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "You can only access your own reports",
        403,
      );
    }

    return {
      employeeId: requester.id,
    };
  }

  // --------------------------------------------------------------------------
  // MANAGER
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.MANAGER) {
    if (requestedEmployeeId) {
      const target = await getActiveEmployee(requestedEmployeeId);

      if (target.departmentId !== requester.departmentId) {
        throw new AppError(
          "REPORT_ACCESS_DENIED",
          "You can only access reports within your department",
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

  // --------------------------------------------------------------------------
  // TEAM LEAD
  // --------------------------------------------------------------------------

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
          "REPORT_ACCESS_DENIED",
          "You can only access reports within your team",
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
    "REPORT_ACCESS_DENIED",
    "You do not have permission to access reports",
    403,
  );
}

// ============================================================================
// ATTENDANCE REPORT
// ============================================================================

export async function getAttendanceReport(
  scope: ReportScope,
  query: ReportQuery = {},
) {
  const { from, to } = validateDateRange(query);

  const employeeScope = await buildEmployeeScope(scope, query.employeeId);

  const where = {
    ...employeeScope,

    ...(query.status
      ? {
          status: query.status as AttendanceStatus,
        }
      : {}),

    ...(from || to
      ? {
          attendanceDate: {
            ...(from
              ? {
                  gte: from,
                }
              : {}),

            ...(to
              ? {
                  lte: to,
                }
              : {}),
          },
        }
      : {}),
  };

  const records = await prisma.attendance.findMany({
    where,

    orderBy: {
      attendanceDate: "desc",
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

      sessions: {
        orderBy: {
          checkInAt: "asc",
        },

        select: {
          id: true,
          checkInAt: true,
          checkOutAt: true,
          workingMinutes: true,
          status: true,
        },
      },
    },
  });

  return records.map((record) => ({
    id: record.id,

    employeeId: record.employee.id,

    employeeCode: record.employee.employeeCode,

    employeeName:
      record.employee.displayName ??
      `${record.employee.firstName} ${record.employee.lastName}`,

    departmentId: record.employee.departmentId,

    teamId: record.employee.teamId,

    attendanceDate: formatDate(record.attendanceDate),

    status: record.status,

    workingMinutes: record.workingMinutes,

    sessions: record.sessions.map((session) => ({
      id: session.id,
      checkInAt: formatDateTime(session.checkInAt),
      checkOutAt: formatDateTime(session.checkOutAt),
      workingMinutes: session.workingMinutes,
      status: session.status,
    })),

    createdAt: formatDateTime(record.createdAt),

    updatedAt: formatDateTime(record.updatedAt),
  }));
}

// ============================================================================
// LEAVE REPORT
// ============================================================================

export async function getLeaveReport(
  scope: ReportScope,
  query: ReportQuery = {},
) {
  const { from, to } = validateDateRange(query);

  const employeeScope = await buildEmployeeScope(scope, query.employeeId);

  const where = {
    ...employeeScope,

    ...(query.status
      ? {
          status: query.status as LeaveStatus,
        }
      : {}),

    ...(from || to
      ? {
          startDate: {
            ...(from
              ? {
                  gte: from,
                }
              : {}),

            ...(to
              ? {
                  lte: to,
                }
              : {}),
          },
        }
      : {}),
  };

  const records = await prisma.leaveRequest.findMany({
    where,

    orderBy: {
      startDate: "desc",
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

  return records.map((record) => ({
    id: record.id,

    employeeId: record.employee.id,

    employeeCode: record.employee.employeeCode,

    employeeName:
      record.employee.displayName ??
      `${record.employee.firstName} ${record.employee.lastName}`,

    departmentId: record.employee.departmentId,

    teamId: record.employee.teamId,

    leaveType: {
      id: record.leaveType.id,
      code: record.leaveType.code,
      name: record.leaveType.name,
      isPaid: record.leaveType.isPaid,
    },

    startDate: formatDate(record.startDate),

    endDate: formatDate(record.endDate),

    totalDays: record.totalDays.toString(),

    reason: record.reason,

    status: record.status,

    appliedAt: formatDateTime(record.appliedAt),

    approvedAt: formatDateTime(record.approvedAt),

    rejectedAt: formatDateTime(record.rejectedAt),

    approverId: record.approverId,

    approvalNote: record.approvalNote,

    createdAt: formatDateTime(record.createdAt),

    updatedAt: formatDateTime(record.updatedAt),
  }));
}

// ============================================================================
// TIMESHEET REPORT
// ============================================================================

export async function getTimesheetReport(
  scope: ReportScope,
  query: ReportQuery = {},
) {
  const { from, to } = validateDateRange(query);

  const employeeScope = await buildEmployeeScope(scope, query.employeeId);

  const where = {
    ...employeeScope,

    ...(query.status
      ? {
          status: query.status as TimesheetStatus,
        }
      : {}),

    ...(from || to
      ? {
          workDate: {
            ...(from
              ? {
                  gte: from,
                }
              : {}),

            ...(to
              ? {
                  lte: to,
                }
              : {}),
          },
        }
      : {}),
  };

  const records = await prisma.timesheet.findMany({
    where,

    orderBy: {
      workDate: "desc",
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

  return records.map((record) => ({
    id: record.id,

    employeeId: record.employee.id,

    employeeCode: record.employee.employeeCode,

    employeeName:
      record.employee.displayName ??
      `${record.employee.firstName} ${record.employee.lastName}`,

    departmentId: record.employee.departmentId,

    teamId: record.employee.teamId,

    workDate: formatDate(record.workDate),

    description: record.description,

    taskDescription: record.taskDescription,

    workingMinutes: record.workingMinutes,

    status: record.status,

    submittedAt: formatDateTime(record.submittedAt),

    approvedAt: formatDateTime(record.approvedAt),

    rejectedAt: formatDateTime(record.rejectedAt),

    approverEmployeeId: record.approverEmployeeId,

    approvalNote: record.approvalNote,

    createdAt: formatDateTime(record.createdAt),

    updatedAt: formatDateTime(record.updatedAt),
  }));
}

// ============================================================================
// EMPLOYEE REPORT
// ============================================================================

export async function getEmployeeReport(
  scope: ReportScope,
  query: ReportQuery = {},
) {
  const requester = await getRequester(scope);

  const where: Record<string, unknown> = {};

  // --------------------------------------------------------------------------
  // ORGANIZATIONAL SCOPE
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.ADMIN) {
    // Organization-wide.
  } else if (scope.role === RoleCode.MANAGER) {
    where.departmentId = requester.departmentId;
  } else if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    where.teamId = requester.teamId;
  } else if (scope.role === RoleCode.EMPLOYEE) {
    where.id = requester.id;
  } else {
    throw new AppError(
      "REPORT_ACCESS_DENIED",
      "You do not have permission to access employee reports",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // Requested employee
  // --------------------------------------------------------------------------

  if (query.employeeId) {
    const employee = await getActiveEmployee(query.employeeId);

    if (
      scope.role === RoleCode.MANAGER &&
      employee.departmentId !== requester.departmentId
    ) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "Employee is outside your department",
        403,
      );
    }

    if (
      scope.role === RoleCode.TEAM_LEAD &&
      employee.teamId !== requester.teamId
    ) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "Employee is outside your team",
        403,
      );
    }

    if (scope.role === RoleCode.EMPLOYEE && employee.id !== requester.id) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "You can only access your own employee report",
        403,
      );
    }

    where.id = employee.id;
  }

  if (query.departmentId) {
    if (
      scope.role === RoleCode.MANAGER &&
      query.departmentId !== requester.departmentId
    ) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "You can only access your department",
        403,
      );
    }

    where.departmentId = query.departmentId;
  }

  if (query.teamId) {
    if (
      scope.role === RoleCode.TEAM_LEAD &&
      query.teamId !== requester.teamId
    ) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "You can only access your team",
        403,
      );
    }

    where.teamId = query.teamId;
  }

  if (query.status) {
    where.status = query.status as EmployeeStatus;
  }

  const records = await prisma.employee.findMany({
    where,

    orderBy: {
      employeeCode: "asc",
    },

    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      departmentId: true,
      teamId: true,
      positionId: true,
      status: true,
      joiningDate: true,
      createdAt: true,
      updatedAt: true,

      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      team: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      position: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
    },
  });

  return records.map((employee) => ({
    id: employee.id,

    employeeCode: employee.employeeCode,

    firstName: employee.firstName,

    lastName: employee.lastName,

    displayName: employee.displayName,

    email: employee.email,

    phone: employee.phone,

    department: employee.department,

    team: employee.team,

    position: employee.position,

    status: employee.status,

    joiningDate: formatDate(employee.joiningDate),

    createdAt: formatDateTime(employee.createdAt),

    updatedAt: formatDateTime(employee.updatedAt),
  }));
}

// ============================================================================
// PROJECT REPORT
// ============================================================================

export async function getProjectReport(
  scope: ReportScope,
  query: ReportQuery = {},
) {
  const requester = await getRequester(scope);

  const where: Record<string, unknown> = {};

  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.ADMIN) {
    // Organization-wide.
  }

  // --------------------------------------------------------------------------
  // MANAGER
  // --------------------------------------------------------------------------
  else if (scope.role === RoleCode.MANAGER) {
    where.departmentId = requester.departmentId;
  }

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------
  else if (scope.role === RoleCode.EMPLOYEE) {
    where.members = {
      some: {
        employeeId: requester.id,
        isActive: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // TEAM LEAD
  // --------------------------------------------------------------------------
  else if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    where.members = {
      some: {
        isActive: true,

        employee: {
          teamId: requester.teamId,
        },
      },
    };
  } else {
    throw new AppError(
      "REPORT_ACCESS_DENIED",
      "You do not have permission to access project reports",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // Filters
  // --------------------------------------------------------------------------

  if (query.departmentId) {
    if (
      scope.role === RoleCode.MANAGER &&
      query.departmentId !== requester.departmentId
    ) {
      throw new AppError(
        "REPORT_ACCESS_DENIED",
        "You can only access projects in your department",
        403,
      );
    }

    where.departmentId = query.departmentId;
  }

  if (query.status) {
    if (!Object.values(ProjectStatus).includes(query.status as ProjectStatus)) {
      throw new AppError(
        "PROJECT_STATUS_INVALID",
        "Invalid project status",
        400,
      );
    }

    where.status = query.status as ProjectStatus;
  }

  const records = await prisma.project.findMany({
    where,

    orderBy: {
      updatedAt: "desc",
    },

    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      ownerEmployee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          status: true,
        },
      },

      members: {
        where: {
          isActive: true,
        },

        select: {
          id: true,
          role: true,
          assignedAt: true,

          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              status: true,
              teamId: true,
            },
          },
        },
      },

      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  return records.map((project) => ({
    id: project.id,

    code: project.code,

    name: project.name,

    description: project.description,

    status: project.status,

    department: project.department,

    owner: project.ownerEmployee,

    startDate: formatDate(project.startDate),

    endDate: formatDate(project.endDate),

    memberCount: project.members.length,

    members: project.members,

    createdAt: formatDateTime(project.createdAt),

    updatedAt: formatDateTime(project.updatedAt),
  }));
}

// ============================================================================
// SUMMARY
// ============================================================================

export async function getReportSummary(scope: ReportScope) {
  const [attendance, leave, timesheets, employees, projects] =
    await Promise.all([
      getAttendanceReport(scope),

      getLeaveReport(scope),

      getTimesheetReport(scope),

      getEmployeeReport(scope),

      getProjectReport(scope),
    ]);

  return {
    attendance: {
      total: attendance.length,

      present: attendance.filter(
        (item) => item.status === AttendanceStatus.PRESENT,
      ).length,

      absent: attendance.filter(
        (item) => item.status === AttendanceStatus.ABSENT,
      ).length,
    },

    leave: {
      total: leave.length,

      pending: leave.filter((item) => item.status === LeaveStatus.PENDING)
        .length,

      approved: leave.filter((item) => item.status === LeaveStatus.APPROVED)
        .length,

      rejected: leave.filter((item) => item.status === LeaveStatus.REJECTED)
        .length,
    },

    timesheets: {
      total: timesheets.length,

      draft: timesheets.filter((item) => item.status === TimesheetStatus.DRAFT)
        .length,

      submitted: timesheets.filter(
        (item) => item.status === TimesheetStatus.SUBMITTED,
      ).length,

      approved: timesheets.filter(
        (item) => item.status === TimesheetStatus.APPROVED,
      ).length,

      rejected: timesheets.filter(
        (item) => item.status === TimesheetStatus.REJECTED,
      ).length,
    },

    employees: {
      total: employees.length,
    },

    projects: {
      total: projects.length,

      active: projects.filter((item) => item.status === ProjectStatus.ACTIVE)
        .length,

      planned: projects.filter((item) => item.status === ProjectStatus.PLANNED)
        .length,

      completed: projects.filter(
        (item) => item.status === ProjectStatus.COMPLETED,
      ).length,

      cancelled: projects.filter(
        (item) => item.status === ProjectStatus.CANCELLED,
      ).length,
    },
  };
}
