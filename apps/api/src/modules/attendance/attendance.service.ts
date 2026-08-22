// ============================================================================
// EEMS - Attendance Service
// ============================================================================
//
// Responsibilities:
//
// 1. Validate employee eligibility.
// 2. Check-in.
// 3. Check-out.
// 4. Calculate working minutes.
// 5. Determine PRESENT / ABSENT.
// 6. Prevent multiple OPEN sessions.
// 7. Retrieve today's attendance.
// 8. Retrieve attendance history.
// 9. Retrieve individual attendance.
// 10. Enforce organizational visibility.
//
// Security:
//
// Employee identity must come from the authenticated JWT.
// Controllers must never trust employeeId supplied by the client.
//
// ============================================================================

import {
  AttendanceSessionStatus,
  AttendanceStatus,
  EmployeeStatus,
  RoleCode,
} from "@/generated/prisma/enums.js";

import { AppError } from "@/middleware/app-error.js";
import { prisma } from "@/lib/prisma.js";

import type {
  AttendanceListItem,
  AttendanceListQuery,
  AttendanceListResult,
  AttendanceScope,
  AttendanceSessionView,
  CheckInResult,
  CheckOutResult,
  TodayAttendanceView,
} from "./attendance.types.js";

import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  REQUIRED_WORKING_MINUTES,
} from "./attendance.types.js";

// ============================================================================
// DATE HELPERS
// ============================================================================

function getTodayDate(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ============================================================================
// DATE-ONLY PARSER
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

  if (date.toISOString().slice(0, 10) !== value) {
    throw new AppError("INVALID_DATE", `${fieldName} is invalid`, 400);
  }

  return date;
}

// ============================================================================
// DATE FORMATTER
// ============================================================================

function formatDate(date: Date): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================================
// WORKING MINUTES
// ============================================================================

function calculateWorkingMinutes(checkInAt: Date, checkOutAt: Date): number {
  const differenceMs = checkOutAt.getTime() - checkInAt.getTime();

  if (differenceMs < 0) {
    throw new AppError(
      "INVALID_ATTENDANCE_TIME",
      "Check-out time cannot be before check-in time",
      400,
    );
  }

  return Math.floor(differenceMs / (1000 * 60));
}

// ============================================================================
// ATTENDANCE STATUS
// ============================================================================

function calculateAttendanceStatus(workingMinutes: number): AttendanceStatus {
  if (workingMinutes >= REQUIRED_WORKING_MINUTES) {
    return AttendanceStatus.PRESENT;
  }

  return AttendanceStatus.ABSENT;
}

// ============================================================================
// EMPLOYEE VALIDATION
// ============================================================================

async function validateEmployee(employeeId: string): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },

    select: {
      id: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
  }

  if (employee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError(
      "EMPLOYEE_NOT_ACTIVE",
      "Only active employees can record attendance",
      403,
    );
  }
}

// ============================================================================
// CHECK-IN
// ============================================================================

export async function checkIn(employeeId: string): Promise<CheckInResult> {
  await validateEmployee(employeeId);

  const now = new Date();
  const attendanceDate = getTodayDate();

  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate,
        },
      },

      update: {},

      create: {
        employeeId,
        attendanceDate,
        status: AttendanceStatus.ABSENT,
        workingMinutes: 0,
      },
    });

    const existingOpenSession = await tx.attendanceSession.findFirst({
      where: {
        attendanceId: attendance.id,

        status: AttendanceSessionStatus.OPEN,
      },

      select: {
        id: true,
      },
    });

    if (existingOpenSession) {
      throw new AppError(
        "ATTENDANCE_SESSION_ACTIVE",
        "Employee already has an active check-in session",
        409,
      );
    }

    const session = await tx.attendanceSession.create({
      data: {
        attendanceId: attendance.id,

        checkInAt: now,

        status: AttendanceSessionStatus.OPEN,

        workingMinutes: 0,
      },
    });

    return {
      attendance,
      session,
    };
  });

  return {
    attendanceId: result.attendance.id,

    sessionId: result.session.id,

    employeeId,

    attendanceDate: formatDate(result.attendance.attendanceDate),

    checkInAt: result.session.checkInAt.toISOString(),

    sessionStatus: result.session.status,

    attendanceStatus: result.attendance.status,

    workingMinutes: result.attendance.workingMinutes,
  };
}

// ============================================================================
// CHECK-OUT
// ============================================================================

export async function checkOut(employeeId: string): Promise<CheckOutResult> {
  await validateEmployee(employeeId);

  const now = new Date();

  const attendanceDate = getTodayDate();

  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate,
        },
      },
    });

    if (!attendance) {
      throw new AppError(
        "ATTENDANCE_NOT_FOUND",
        "No attendance record found for today",
        404,
      );
    }

    const session = await tx.attendanceSession.findFirst({
      where: {
        attendanceId: attendance.id,

        status: AttendanceSessionStatus.OPEN,
      },

      orderBy: {
        checkInAt: "desc",
      },
    });

    if (!session) {
      throw new AppError(
        "NO_ACTIVE_ATTENDANCE_SESSION",
        "No active check-in session found",
        409,
      );
    }

    const sessionWorkingMinutes = calculateWorkingMinutes(
      session.checkInAt,
      now,
    );

    const totalWorkingMinutes =
      attendance.workingMinutes + sessionWorkingMinutes;

    const attendanceStatus = calculateAttendanceStatus(totalWorkingMinutes);

    const updatedSession = await tx.attendanceSession.update({
      where: {
        id: session.id,
      },

      data: {
        checkOutAt: now,

        workingMinutes: sessionWorkingMinutes,

        status: AttendanceSessionStatus.COMPLETED,
      },
    });

    const updatedAttendance = await tx.attendance.update({
      where: {
        id: attendance.id,
      },

      data: {
        workingMinutes: totalWorkingMinutes,

        status: attendanceStatus,
      },
    });

    return {
      attendance: updatedAttendance,

      session: updatedSession,

      sessionWorkingMinutes,

      totalWorkingMinutes,

      attendanceStatus,
    };
  });

  return {
    attendanceId: result.attendance.id,

    sessionId: result.session.id,

    employeeId,

    attendanceDate: formatDate(result.attendance.attendanceDate),

    checkInAt: result.session.checkInAt.toISOString(),

    checkOutAt: result.session.checkOutAt!.toISOString(),

    sessionWorkingMinutes: result.sessionWorkingMinutes,

    totalWorkingMinutes: result.totalWorkingMinutes,

    attendanceStatus: result.attendanceStatus,
  };
}

// ============================================================================
// SESSION MAPPER
// ============================================================================

function mapSession(session: {
  id: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  workingMinutes: number;
  status: AttendanceSessionStatus;
}): AttendanceSessionView {
  return {
    id: session.id,

    checkInAt: session.checkInAt.toISOString(),

    checkOutAt: session.checkOutAt?.toISOString() ?? null,

    workingMinutes: session.workingMinutes,

    status: session.status,
  };
}

// ============================================================================
// TODAY ATTENDANCE
// ============================================================================

export async function getTodayAttendance(
  employeeId: string,
): Promise<TodayAttendanceView | null> {
  await validateEmployee(employeeId);

  const attendanceDate = getTodayDate();

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_attendanceDate: {
        employeeId,
        attendanceDate,
      },
    },

    include: {
      sessions: {
        orderBy: {
          checkInAt: "asc",
        },
      },
    },
  });

  if (!attendance) {
    return null;
  }

  const remainingWorkingMinutes = Math.max(
    REQUIRED_WORKING_MINUTES - attendance.workingMinutes,
    0,
  );

  return {
    attendanceId: attendance.id,

    employeeId: attendance.employeeId,

    attendanceDate: formatDate(attendance.attendanceDate),

    status: attendance.status,

    workingMinutes: attendance.workingMinutes,

    requiredWorkingMinutes: REQUIRED_WORKING_MINUTES,

    remainingWorkingMinutes,

    sessions: attendance.sessions.map(mapSession),
  };
}

// ============================================================================
// REQUESTER SCOPE
// ============================================================================

async function validateScopeEmployee(scope: AttendanceScope): Promise<{
  id: string;
  departmentId: string;
  teamId: string | null;
}> {
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
      departmentId: true,
      teamId: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError(
      "EMPLOYEE_NOT_FOUND",
      "Authenticated employee profile was not found",
      404,
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
// BUILD ATTENDANCE WHERE CLAUSE
// ============================================================================

async function buildScopeWhere(
  scope: AttendanceScope,
  requestedEmployeeId?: string,
) {
  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.ADMIN) {
    if (requestedEmployeeId) {
      return {
        employeeId: requestedEmployeeId,
      };
    }

    return {};
  }

  const employee = await validateScopeEmployee(scope);

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.EMPLOYEE) {
    if (requestedEmployeeId && requestedEmployeeId !== employee.id) {
      throw new AppError(
        "ATTENDANCE_ACCESS_DENIED",
        "You can only access your own attendance",
        403,
      );
    }

    return {
      employeeId: employee.id,
    };
  }

  // --------------------------------------------------------------------------
  // MANAGER
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.MANAGER) {
    if (requestedEmployeeId) {
      const target = await prisma.employee.findUnique({
        where: {
          id: requestedEmployeeId,
        },

        select: {
          id: true,
          departmentId: true,
        },
      });

      if (!target) {
        throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
      }

      if (target.departmentId !== employee.departmentId) {
        throw new AppError(
          "ATTENDANCE_ACCESS_DENIED",
          "You can only access attendance within your department",
          403,
        );
      }

      return {
        employeeId: target.id,
      };
    }

    return {
      employee: {
        departmentId: employee.departmentId,
      },
    };
  }

  // --------------------------------------------------------------------------
  // TEAM LEAD
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!employee.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    if (requestedEmployeeId) {
      const target = await prisma.employee.findUnique({
        where: {
          id: requestedEmployeeId,
        },

        select: {
          id: true,
          teamId: true,
        },
      });

      if (!target) {
        throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
      }

      if (target.teamId !== employee.teamId) {
        throw new AppError(
          "ATTENDANCE_ACCESS_DENIED",
          "You can only access attendance within your team",
          403,
        );
      }

      return {
        employeeId: target.id,
      };
    }

    return {
      employee: {
        teamId: employee.teamId,
      },
    };
  }

  throw new AppError(
    "ATTENDANCE_ACCESS_DENIED",
    "You do not have permission to access attendance",
    403,
  );
}

// ============================================================================
// ATTENDANCE LIST
// ============================================================================

export async function listAttendance(
  scope: AttendanceScope,
  query: AttendanceListQuery = {},
): Promise<AttendanceListResult> {
  const page =
    query.page && query.page > 0 ? Math.floor(query.page) : DEFAULT_PAGE;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  const requestedEmployeeId = query.employeeId?.trim();

  const scopeWhere = await buildScopeWhere(scope, requestedEmployeeId);

  const where = {
    ...scopeWhere,

    ...(query.status
      ? {
          status: query.status,
        }
      : {}),

    ...(query.from
      ? {
          attendanceDate: {
            gte: parseDateOnly(query.from, "from"),
          },
        }
      : {}),

    ...(query.to
      ? {
          attendanceDate: {
            ...(query.from
              ? {
                  gte: parseDateOnly(query.from, "from"),
                }
              : {}),
            lte: parseDateOnly(query.to, "to"),
          },
        }
      : {}),
  };

  const [records, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,

      orderBy: [
        {
          attendanceDate: "desc",
        },
        {
          employeeId: "asc",
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

        sessions: {
          orderBy: {
            checkInAt: "asc",
          },
        },
      },
    }),

    prisma.attendance.count({
      where,
    }),
  ]);

  return {
    records: records.map((attendance) => ({
      id: attendance.id,

      employeeId: attendance.employee.id,

      employeeCode: attendance.employee.employeeCode,

      firstName: attendance.employee.firstName,

      lastName: attendance.employee.lastName,

      displayName: attendance.employee.displayName,

      attendanceDate: formatDate(attendance.attendanceDate),

      status: attendance.status,

      workingMinutes: attendance.workingMinutes,

      requiredWorkingMinutes: REQUIRED_WORKING_MINUTES,

      remainingWorkingMinutes: Math.max(
        REQUIRED_WORKING_MINUTES - attendance.workingMinutes,
        0,
      ),

      sessions: attendance.sessions.map(mapSession),
    })),

    pagination: {
      page,
      limit,
      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// GET ATTENDANCE BY ID
// ============================================================================

export async function getAttendanceById(
  id: string,
  scope: AttendanceScope,
): Promise<AttendanceListItem> {
  const attendance = await prisma.attendance.findUnique({
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

      sessions: {
        orderBy: {
          checkInAt: "asc",
        },
      },
    },
  });

  if (!attendance) {
    throw new AppError(
      "ATTENDANCE_NOT_FOUND",
      "Attendance record not found",
      404,
    );
  }

  // --------------------------------------------------------------------------
  // Scope validation
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.ADMIN) {
    // unrestricted
  } else {
    const employee = await validateScopeEmployee(scope);

    if (scope.role === RoleCode.EMPLOYEE) {
      if (attendance.employeeId !== employee.id) {
        throw new AppError(
          "ATTENDANCE_NOT_FOUND",
          "Attendance record not found",
          404,
        );
      }
    }

    if (scope.role === RoleCode.MANAGER) {
      if (attendance.employee.departmentId !== employee.departmentId) {
        throw new AppError(
          "ATTENDANCE_NOT_FOUND",
          "Attendance record not found",
          404,
        );
      }
    }

    if (scope.role === RoleCode.TEAM_LEAD) {
      if (!employee.teamId || attendance.employee.teamId !== employee.teamId) {
        throw new AppError(
          "ATTENDANCE_NOT_FOUND",
          "Attendance record not found",
          404,
        );
      }
    }
  }

  return {
    id: attendance.id,

    employeeId: attendance.employee.id,

    employeeCode: attendance.employee.employeeCode,

    firstName: attendance.employee.firstName,

    lastName: attendance.employee.lastName,

    displayName: attendance.employee.displayName,

    attendanceDate: formatDate(attendance.attendanceDate),

    status: attendance.status,

    workingMinutes: attendance.workingMinutes,

    requiredWorkingMinutes: REQUIRED_WORKING_MINUTES,

    remainingWorkingMinutes: Math.max(
      REQUIRED_WORKING_MINUTES - attendance.workingMinutes,
      0,
    ),

    sessions: attendance.sessions.map(mapSession),
  };
}
