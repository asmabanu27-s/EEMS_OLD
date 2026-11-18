// ============================================================================
// EEMS - Attendance Service
// ============================================================================
//
// Core attendance business rules.
//
// Important rules:
//   1. One Attendance record per employee per IST calendar day.
//   2. Employees may have multiple sessions on the same day.
//   3. Attendance.workingMinutes is a cached aggregate.
//   4. Session rows are the source of truth for working minutes.
//   5. A forgotten OPEN session is automatically closed exactly 24 hours
//      after its own check-in timestamp.
//   6. The automatic checkout timestamp is checkInAt + 24 hours; it is not
//      midnight and is not based on the server's local timezone.
//   7. Manual checkout after the 24-hour boundary is also capped at exactly
//      24 hours and is marked AUTO_COMPLETED.
//   8. Timesheet synchronization remains Attendance-driven.
// ============================================================================

import { prisma } from "@/lib/prisma.js";

import {
  AttendanceSessionStatus,
  AttendanceStatus,
  EmployeeStatus,
  RoleCode,
  TimesheetEditRequestStatus,
  TimesheetSource,
  TimesheetStatus,
} from "@/generated/prisma/enums.js";

import {
  REQUIRED_WORKING_MINUTES,
  type AttendanceListQuery,
  type AttendanceScope,
  type CheckInResult,
  type CheckOutResult,
  type TodayAttendanceView,
} from "./attendance.types.js";

import { syncTimesheetFromAttendance } from "@/modules/timesheet/timesheet.service.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";

const AUTO_CHECKOUT_AFTER_MS =
  24 * 60 * 60 * 1000;

const AUTO_CHECKOUT_WORKING_MINUTES =
  24 * 60;

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Return today's IST calendar date as a UTC-midnight Date.
 *
 * PostgreSQL DATE fields are date-only values. Keeping them normalized at
 * UTC midnight prevents the Node server timezone from changing the stored
 * calendar date.
 */
function getTodayDate(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Unable to determine today's attendance date",
    );
  }

  return new Date(
    `${year}-${month}-${day}T00:00:00.000Z`,
  );
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateOnly(
  value: string,
  fieldName: string,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `${fieldName} must be in YYYY-MM-DD format`,
    );
  }

  const date = new Date(
    `${value}T00:00:00.000Z`,
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return date;
}

// ============================================================================
// WORKING-MINUTE HELPERS
// ============================================================================

function calculateWorkingMinutes(
  checkInAt: Date,
  checkOutAt: Date,
): number {
  const differenceMs =
    checkOutAt.getTime() -
    checkInAt.getTime();

  if (differenceMs < 0) {
    throw new Error(
      "Check-out time cannot be before check-in time",
    );
  }

  return Math.floor(
    differenceMs / (1000 * 60),
  );
}

function calculateAttendanceStatus(
  workingMinutes: number,
): AttendanceStatus {
  if (
    workingMinutes >=
    REQUIRED_WORKING_MINUTES
  ) {
    return AttendanceStatus.PRESENT;
  }

  return AttendanceStatus.ABSENT;
}

function sumSessionWorkingMinutes(
  sessions: Array<{
    workingMinutes: number;
  }>,
): number {
  return sessions.reduce(
    (total, session) =>
      total +
      Math.max(
        0,
        session.workingMinutes,
      ),
    0,
  );
}

// ============================================================================
// EMPLOYEE VALIDATION
// ============================================================================

async function validateEmployee(
  employeeId: string,
): Promise<void> {
  const employee =
    await prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
      select: {
        id: true,
        status: true,
      },
    });

  if (!employee) {
    throw new Error("Employee not found");
  }

  if (
    employee.status !==
    EmployeeStatus.ACTIVE
  ) {
    throw new Error(
      "Only active employees can record attendance",
    );
  }
}

// ============================================================================
// CHECK-IN
// ============================================================================

export async function checkIn(
  employeeId: string,
): Promise<CheckInResult> {
  await validateEmployee(employeeId);

  const now = new Date();
  const attendanceDate = getTodayDate();

  const result =
    await prisma.$transaction(
      async (tx) => {
        const attendance =
          await tx.attendance.upsert({
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
              status:
                AttendanceStatus.ABSENT,
              workingMinutes: 0,
            },
          });

        const existingOpenSession =
          await tx.attendanceSession.findFirst(
            {
              where: {
                attendanceId:
                  attendance.id,
                status:
                  AttendanceSessionStatus.OPEN,
              },
              select: {
                id: true,
              },
            },
          );

        if (existingOpenSession) {
          throw new Error(
            "Employee already has an active check-in session",
          );
        }

        // Rebuild the cached daily total from actual completed sessions.
        const completedSessions =
          await tx.attendanceSession.findMany({
            where: {
              attendanceId:
                attendance.id,
              status: {
                in: [
                  AttendanceSessionStatus.COMPLETED,
                  AttendanceSessionStatus.AUTO_COMPLETED,
                ],
              },
            },
            select: {
              workingMinutes: true,
            },
          });

        const completedMinutes =
          sumSessionWorkingMinutes(
            completedSessions,
          );

        const session =
          await tx.attendanceSession.create({
            data: {
              attendanceId:
                attendance.id,
              checkInAt: now,
              status:
                AttendanceSessionStatus.OPEN,
              workingMinutes: 0,
            },
          });

        const correctedStatus =
          calculateAttendanceStatus(
            completedMinutes,
          );

        const correctedAttendance =
          await tx.attendance.update({
            where: {
              id: attendance.id,
            },
            data: {
              workingMinutes:
                completedMinutes,
              status:
                correctedStatus,
            },
          });

        // ---------------------------------------------------------------
        // Keep the Attendance-derived Timesheet aligned with today's
        // completed session total. Manual/corrected records are preserved.
        // ---------------------------------------------------------------
        const existingTimesheet =
          await tx.timesheet.findUnique({
            where: {
              employeeId_workDate: {
                employeeId,
                workDate: attendanceDate,
              },
            },
            select: {
              id: true,
              source: true,
            },
          });

        if (!existingTimesheet) {
          await tx.timesheet.create({
            data: {
              employeeId,
              attendanceId:
                attendance.id,
              workDate: attendanceDate,
              workingMinutes:
                completedMinutes,
              description: null,
              taskDescription: null,
              source:
                TimesheetSource.ATTENDANCE,
              status:
                TimesheetStatus.AUTOMATIC,
            },
          });
        } else if (
          existingTimesheet.source ===
          TimesheetSource.ATTENDANCE
        ) {
          await tx.timesheet.update({
            where: {
              id: existingTimesheet.id,
            },
            data: {
              attendanceId:
                attendance.id,
              workingMinutes:
                completedMinutes,
              status:
                TimesheetStatus.AUTOMATIC,
            },
          });
        }

        return {
          attendance:
            correctedAttendance,
          session,
        };
      },
    );

  return {
    attendanceId:
      result.attendance.id,
    sessionId:
      result.session.id,
    employeeId,
    attendanceDate:
      formatDate(
        result.attendance
          .attendanceDate,
      ),
    checkInAt:
      result.session.checkInAt.toISOString(),
    sessionStatus:
      result.session.status,
    attendanceStatus:
      result.attendance.status,
    workingMinutes:
      result.attendance
        .workingMinutes,
  };
}

// ============================================================================
// CHECK-OUT
// ============================================================================

export async function checkOut(
  employeeId: string,
): Promise<CheckOutResult> {
  await validateEmployee(employeeId);

  const now = new Date();
  const attendanceDate = getTodayDate();

  const result =
    await prisma.$transaction(
      async (tx) => {
        const attendance =
          await tx.attendance.findUnique({
            where: {
              employeeId_attendanceDate: {
                employeeId,
                attendanceDate,
              },
            },
          });

        if (!attendance) {
          throw new Error(
            "No attendance record found for today",
          );
        }

        const session =
          await tx.attendanceSession.findFirst(
            {
              where: {
                attendanceId:
                  attendance.id,
                status:
                  AttendanceSessionStatus.OPEN,
              },
              orderBy: {
                checkInAt: "desc",
              },
            },
          );

        if (!session) {
          throw new Error(
            "No active check-in session found",
          );
        }

        // ---------------------------------------------------------------
        // The 24-hour cutoff is relative to THIS session's check-in.
        // Example: 18:00 check-in -> next-day 18:00 cutoff.
        // ---------------------------------------------------------------
        const automaticCheckOutAt =
          new Date(
            session.checkInAt.getTime() +
              AUTO_CHECKOUT_AFTER_MS,
          );

        const hasReachedAutoCutoff =
          now.getTime() >=
          automaticCheckOutAt.getTime();

        const effectiveCheckOutAt =
          hasReachedAutoCutoff
            ? automaticCheckOutAt
            : now;

        const sessionWorkingMinutes =
          Math.min(
            AUTO_CHECKOUT_WORKING_MINUTES,
            calculateWorkingMinutes(
              session.checkInAt,
              effectiveCheckOutAt,
            ),
          );

        const sessionStatus =
          hasReachedAutoCutoff
            ? AttendanceSessionStatus.AUTO_COMPLETED
            : AttendanceSessionStatus.COMPLETED;

        // Rebuild the daily total from every other completed session plus
        // this session. Never trust the cached Attendance aggregate.
        const previousSessions =
          await tx.attendanceSession.findMany({
            where: {
              attendanceId:
                attendance.id,
              id: {
                not: session.id,
              },
              status: {
                in: [
                  AttendanceSessionStatus.COMPLETED,
                  AttendanceSessionStatus.AUTO_COMPLETED,
                ],
              },
            },
            select: {
              workingMinutes: true,
            },
          });

        const previousWorkingMinutes =
          sumSessionWorkingMinutes(
            previousSessions,
          );

        const totalWorkingMinutes =
          previousWorkingMinutes +
          sessionWorkingMinutes;

        const attendanceStatus =
          calculateAttendanceStatus(
            totalWorkingMinutes,
          );

        const updatedSession =
          await tx.attendanceSession.update({
            where: {
              id: session.id,
            },
            data: {
              checkOutAt:
                effectiveCheckOutAt,
              workingMinutes:
                sessionWorkingMinutes,
              status: sessionStatus,
            },
          });

        const updatedAttendance =
          await tx.attendance.update({
            where: {
              id: attendance.id,
            },
            data: {
              workingMinutes:
                totalWorkingMinutes,
              status:
                attendanceStatus,
            },
          });

        const existingTimesheet =
          await tx.timesheet.findUnique({
            where: {
              employeeId_workDate: {
                employeeId,
                workDate: attendanceDate,
              },
            },
            select: {
              id: true,
              source: true,
            },
          });

        if (!existingTimesheet) {
          await tx.timesheet.create({
            data: {
              employeeId,
              attendanceId:
                attendance.id,
              workDate: attendanceDate,
              workingMinutes:
                totalWorkingMinutes,
              description: null,
              taskDescription: null,
              source:
                TimesheetSource.ATTENDANCE,
              status:
                TimesheetStatus.AUTOMATIC,
            },
          });
        } else if (
          existingTimesheet.source ===
          TimesheetSource.ATTENDANCE
        ) {
          const pendingEdit =
            await tx.timesheetEditRequest.findFirst(
              {
                where: {
                  timesheetId:
                    existingTimesheet.id,
                  status:
                    TimesheetEditRequestStatus.PENDING,
                },
                select: {
                  id: true,
                },
              },
            );

          if (!pendingEdit) {
            await tx.timesheet.update({
              where: {
                id: existingTimesheet.id,
              },
              data: {
                attendanceId:
                  attendance.id,
                workingMinutes:
                  totalWorkingMinutes,
                status:
                  TimesheetStatus.AUTOMATIC,
                source:
                  TimesheetSource.ATTENDANCE,
              },
            });
          }
        }

        return {
          attendance:
            updatedAttendance,
          session:
            updatedSession,
          sessionWorkingMinutes,
          totalWorkingMinutes,
          attendanceStatus,
        };
      },
    );

  return {
    attendanceId:
      result.attendance.id,
    sessionId:
      result.session.id,
    employeeId,
    attendanceDate:
      formatDate(
        result.attendance
          .attendanceDate,
      ),
    checkInAt:
      result.session.checkInAt.toISOString(),
    checkOutAt:
      result.session.checkOutAt!
        .toISOString(),
    sessionWorkingMinutes:
      result.sessionWorkingMinutes,
    totalWorkingMinutes:
      result.totalWorkingMinutes,
    attendanceStatus:
      result.attendanceStatus,
  };
}

// ============================================================================
// AUTOMATIC CHECK-OUT
// ============================================================================
//
// Every OPEN session is eligible after exactly 24 hours from its own check-in.
//
// Example:
//   Check-in  : 2026-08-24 18:00 IST
//   Auto-close: 2026-08-25 18:00 IST
//
// The scheduler may execute later than the exact boundary, but the stored
// checkOutAt is always the exact checkInAt + 24 hours timestamp.
// ============================================================================

export async function autoCloseExpiredAttendanceSessions(
  now = new Date(),
): Promise<{
  closedCount: number;
  attendanceIds: string[];
}> {
  const cutoff =
    new Date(
      now.getTime() -
        AUTO_CHECKOUT_AFTER_MS,
    );

  const expiredSessions =
    await prisma.attendanceSession.findMany({
      where: {
        status:
          AttendanceSessionStatus.OPEN,
        checkInAt: {
          lte: cutoff,
        },
      },
      select: {
        id: true,
        attendanceId: true,
        checkInAt: true,
      },
      orderBy: {
        checkInAt: "asc",
      },
    });

  if (expiredSessions.length === 0) {
    return {
      closedCount: 0,
      attendanceIds: [],
    };
  }

  let closedCount = 0;
  const closedAttendanceIds =
    new Set<string>();

  for (const session of expiredSessions) {
    const result =
      await prisma.$transaction(
        async (tx) => {
          const current =
            await tx.attendanceSession.findUnique(
              {
                where: {
                  id: session.id,
                },
              },
            );

          if (
            !current ||
            current.status !==
              AttendanceSessionStatus.OPEN
          ) {
            return null;
          }

          const attendance =
            await tx.attendance.findUnique({
              where: {
                id: current.attendanceId,
              },
            });

          if (!attendance) {
            return null;
          }

          const automaticCheckOutAt =
            new Date(
              current.checkInAt.getTime() +
                AUTO_CHECKOUT_AFTER_MS,
            );

          const previousSessions =
            await tx.attendanceSession.findMany({
              where: {
                attendanceId:
                  attendance.id,
                id: {
                  not: current.id,
                },
                status: {
                  in: [
                    AttendanceSessionStatus.COMPLETED,
                    AttendanceSessionStatus.AUTO_COMPLETED,
                  ],
                },
              },
              select: {
                workingMinutes: true,
              },
            });

          const previousWorkingMinutes =
            sumSessionWorkingMinutes(
              previousSessions,
            );

          const sessionWorkingMinutes =
            AUTO_CHECKOUT_WORKING_MINUTES;

          const totalWorkingMinutes =
            previousWorkingMinutes +
            sessionWorkingMinutes;

          const attendanceStatus =
            calculateAttendanceStatus(
              totalWorkingMinutes,
            );

          const updatedSession =
            await tx.attendanceSession.updateMany(
              {
                where: {
                  id: current.id,
                  status:
                    AttendanceSessionStatus.OPEN,
                },
                data: {
                  checkOutAt:
                    automaticCheckOutAt,
                  workingMinutes:
                    sessionWorkingMinutes,
                  status:
                    AttendanceSessionStatus.AUTO_COMPLETED,
                },
              },
            );

          if (
            updatedSession.count !== 1
          ) {
            return null;
          }

          const updatedAttendance =
            await tx.attendance.update({
              where: {
                id: attendance.id,
              },
              data: {
                workingMinutes:
                  totalWorkingMinutes,
                status:
                  attendanceStatus,
              },
              select: {
                id: true,
                employeeId: true,
                attendanceDate: true,
                workingMinutes: true,
              },
            });

          return {
            attendance:
              updatedAttendance,
          };
        },
      );

    if (!result) {
      continue;
    }

    closedCount += 1;
    closedAttendanceIds.add(
      session.attendanceId,
    );

    try {
      await syncTimesheetFromAttendance(
        result.attendance.employeeId,
        session.attendanceId,
        formatDate(
          result.attendance
            .attendanceDate,
        ),
        result.attendance
          .workingMinutes,
      );
    } catch (error) {
      console.error(
        "[Attendance] Failed to synchronize Timesheet after automatic checkout",
        {
          sessionId:
            session.id,
          attendanceId:
            session.attendanceId,
          error,
        },
      );
    }
  }

  return {
    closedCount,
    attendanceIds: [
      ...closedAttendanceIds,
    ],
  };
}

// ============================================================================
// GET ACTIVE EMPLOYEE
// ============================================================================

async function getActiveEmployee(
  employeeId: string,
) {
  const employee =
    await prisma.employee.findUnique({
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
    throw new Error("Employee not found");
  }

  if (
    employee.status !==
    EmployeeStatus.ACTIVE
  ) {
    throw new Error("Employee is not active");
  }

  return employee;
}

// ============================================================================
// BUILD ATTENDANCE SCOPE
// ============================================================================

async function buildAttendanceScopeWhere(
  scope: AttendanceScope,
  requestedEmployeeId?: string,
) {
  if (scope.role === RoleCode.ADMIN) {
    if (requestedEmployeeId) {
      return {
        employeeId:
          requestedEmployeeId,
      };
    }

    return {};
  }

  const requester =
    await getActiveEmployee(
      scope.employeeId ?? "",
    );

  if (scope.role === RoleCode.EMPLOYEE) {
    if (
      requestedEmployeeId &&
      requestedEmployeeId !==
        requester.id
    ) {
      throw new Error(
        "You can only access your own attendance",
      );
    }

    return {
      employeeId: requester.id,
    };
  }

  if (scope.role === RoleCode.MANAGER) {
    if (requestedEmployeeId) {
      const target =
        await getActiveEmployee(
          requestedEmployeeId,
        );

      if (
        target.departmentId !==
        requester.departmentId
      ) {
        throw new Error(
          "You can only access attendance within your department",
        );
      }

      return {
        employeeId: target.id,
      };
    }

    return {
      employee: {
        departmentId:
          requester.departmentId,
      },
    };
  }

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new Error(
        "Team Lead is not assigned to a team",
      );
    }

    if (requestedEmployeeId) {
      const target =
        await getActiveEmployee(
          requestedEmployeeId,
        );

      if (
        target.teamId !==
        requester.teamId
      ) {
        throw new Error(
          "You can only access attendance within your team",
        );
      }

      return {
        employeeId: target.id,
      };
    }

    return {
      employee: {
        teamId:
          requester.teamId,
      },
    };
  }

  throw new Error(
    "You do not have permission to access attendance",
  );
}

// ============================================================================
// ATTENDANCE RECORD MAPPER
// ============================================================================

type AttendanceSessionRecord = {
  id: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  workingMinutes: number;
  status: AttendanceSessionStatus;
};

function mapAttendanceRecord(record: any) {
  const sessions =
    record.sessions as AttendanceSessionRecord[];

  const sessionTotal =
    sumSessionWorkingMinutes(
      sessions.filter(
        (session) =>
          session.status ===
            AttendanceSessionStatus.COMPLETED ||
          session.status ===
            AttendanceSessionStatus.AUTO_COMPLETED,
      ),
    );

  return {
    id: record.id,
    employeeId:
      record.employee.id,
    employeeCode:
      record.employee.employeeCode,
    employeeName:
      record.employee.displayName ??
      [
        record.employee.firstName,
        record.employee.lastName,
      ]
        .filter(Boolean)
        .join(" "),
    departmentId:
      record.employee.departmentId,
    teamId:
      record.employee.teamId,
    attendanceDate:
      formatDate(record.attendanceDate),
    status: record.status,
    // Session rows are the source of truth.
    workingMinutes:
      sessionTotal,
    sessions: sessions.map(
      (session) => ({
        id: session.id,
        checkInAt:
          session.checkInAt.toISOString(),
        checkOutAt:
          session.checkOutAt?.toISOString() ??
          null,
        workingMinutes:
          session.workingMinutes,
        status: session.status,
      }),
    ),
  };
}

// ============================================================================
// LIST ATTENDANCE
// ============================================================================

export async function listAttendance(
  scope: AttendanceScope,
  query: AttendanceListQuery = {},
) {
  const page =
    query.page && query.page > 0
      ? Math.floor(query.page)
      : 1;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(
          Math.floor(query.limit),
          100,
        )
      : 20;

  const skip =
    (page - 1) * limit;

  const scopeWhere =
    await buildAttendanceScopeWhere(
      scope,
      query.employeeId,
    );

  const where = {
    ...scopeWhere,
    ...(query.status
      ? {
          status:
            query.status,
        }
      : {}),
    ...(query.from || query.to
      ? {
          attendanceDate: {
            ...(query.from
              ? {
                  gte: parseDateOnly(
                    query.from,
                    "from",
                  ),
                }
              : {}),
            ...(query.to
              ? {
                  lte: parseDateOnly(
                    query.to,
                    "to",
                  ),
                }
              : {}),
          },
        }
      : {}),
  };

  const [records, total] =
    await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        orderBy: {
          attendanceDate:
            "desc",
        },
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
      }),
      prisma.attendance.count({
        where,
      }),
    ]);

  return {
    records: records.map(
      mapAttendanceRecord,
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages:
        total === 0
          ? 0
          : Math.ceil(
              total / limit,
            ),
    },
  };
}

// ============================================================================
// GET ATTENDANCE BY ID
// ============================================================================

export async function getAttendanceById(
  id: string,
  scope: AttendanceScope,
) {
  const record =
    await prisma.attendance.findUnique({
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

  if (!record) {
    throw new Error(
      "Attendance record not found",
    );
  }

  await assertAttendanceRecordScope(
    record.employee,
    scope,
  );

  return mapAttendanceRecord(
    record,
  );
}

// ============================================================================
// ASSERT RECORD SCOPE
// ============================================================================

async function assertAttendanceRecordScope(
  target: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
  scope: AttendanceScope,
): Promise<void> {
  if (scope.role === RoleCode.ADMIN) {
    return;
  }

  const requester =
    await getActiveEmployee(
      scope.employeeId ?? "",
    );

  if (scope.role === RoleCode.EMPLOYEE) {
    if (target.id !== requester.id) {
      throw new Error(
        "Attendance record not found",
      );
    }

    return;
  }

  if (scope.role === RoleCode.MANAGER) {
    if (
      target.departmentId !==
      requester.departmentId
    ) {
      throw new Error(
        "Attendance record not found",
      );
    }

    return;
  }

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (
      !requester.teamId ||
      target.teamId !==
        requester.teamId
    ) {
      throw new Error(
        "Attendance record not found",
      );
    }

    return;
  }

  throw new Error(
    "You do not have permission to access attendance",
  );
}

// ============================================================================
// GET TODAY'S ATTENDANCE
// ============================================================================

export async function getTodayAttendance(
  employeeId: string,
): Promise<TodayAttendanceView | null> {
  await validateEmployee(employeeId);

  const attendanceDate =
    getTodayDate();

  const attendance =
    await prisma.attendance.findUnique({
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

  if (!attendance) {
    return null;
  }

  const completedSessions =
    attendance.sessions.filter(
      (session) =>
        session.status ===
          AttendanceSessionStatus.COMPLETED ||
        session.status ===
          AttendanceSessionStatus.AUTO_COMPLETED,
    );

  const completedMinutes =
    sumSessionWorkingMinutes(
      completedSessions,
    );

  const remainingWorkingMinutes =
    Math.max(
      REQUIRED_WORKING_MINUTES -
        completedMinutes,
      0,
    );

  return {
    attendanceId:
      attendance.id,
    employeeId:
      attendance.employeeId,
    attendanceDate:
      formatDate(
        attendance.attendanceDate,
      ),
    status:
      attendance.status,
    // Completed-session aggregate only. The frontend adds any OPEN session
    // elapsed time for the live timer.
    workingMinutes:
      completedMinutes,
    requiredWorkingMinutes:
      REQUIRED_WORKING_MINUTES,
    remainingWorkingMinutes,
    sessions:
      attendance.sessions.map(
        (session) => ({
          id: session.id,
          checkInAt:
            session.checkInAt.toISOString(),
          checkOutAt:
            session.checkOutAt
              ?.toISOString() ??
            null,
          workingMinutes:
            session.workingMinutes,
          status:
            session.status,
        }),
      ),
  };
}