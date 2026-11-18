// ============================================================================
// EEMS - Timesheet Calendar Service
// ============================================================================
//
// Calendar/status workflow:
//
//   ATTENDANCE
//        |
//        v
//   TimesheetDay
//        |
//        +---- Employee requests correction
//        |
//        v
//   TimesheetDayChangeRequest
//        |
//        +---- APPROVED
//        |
//        v
//   TimesheetDay status changed
//
// Supported statuses:
//
//   MISSED
//   PRESENT
//   WEEK_OFF
//   ABSENT
//   COMPOFF
//   LEAVE
//
// Future dates cannot be changed.
//
// ============================================================================

import {
  EmployeeStatus,
  LeaveStatus,
  RoleCode,
  TimesheetDayRequestStatus,
  TimesheetDaySource,
  TimesheetDayStatus,
} from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";

import { AppError } from "@/middleware/app-error.js";

import type {
  TimesheetCalendarDay,
  TimesheetCalendarQuery,
  TimesheetCalendarResult,
  TimesheetDayChangeRequestInput,
  TimesheetDayChangeRequestSummary,
  TimesheetDayDecisionInput,
  TimesheetScope,
  TimesheetDayChangeRequestListQuery,
  TimesheetDayChangeRequestListResult,
  TimesheetDayChangeRequestRecord,
} from "./timesheet.types.js";

// ============================================================================
// DATE HELPERS
// ============================================================================

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(
      "INVALID_DATE_FORMAT",
      "Date must be in YYYY-MM-DD format",
      400,
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("INVALID_DATE", "Invalid date", 400);
  }

  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function getTodayUtc(): Date {
  const now = new Date();

  return startOfUtcDay(now);
}

function isFutureDate(date: Date): boolean {
  return startOfUtcDay(date).getTime() > getTodayUtc().getTime();
}

function isTodayDate(date: Date): boolean {
  return startOfUtcDay(date).getTime() === getTodayUtc().getTime();
}

// ============================================================================
// EMPLOYEE
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

async function assertCalendarScope(scope: TimesheetScope, employeeId: string) {
  const employee = await getActiveEmployee(employeeId);

  if (scope.role === RoleCode.ADMIN) {
    return employee;
  }

  if (!scope.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  const requester = await getActiveEmployee(scope.employeeId);

  if (scope.role === RoleCode.EMPLOYEE) {
    if (requester.id !== employee.id) {
      throw new AppError(
        "TIMESHEET_ACCESS_DENIED",
        "You can only access your own timesheet calendar",
        403,
      );
    }

    return employee;
  }

  if (scope.role === RoleCode.MANAGER) {
    if (requester.departmentId !== employee.departmentId) {
      throw new AppError(
        "TIMESHEET_ACCESS_DENIED",
        "You can only access calendar entries within your department",
        403,
      );
    }

    return employee;
  }

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId || requester.teamId !== employee.teamId) {
      throw new AppError(
        "TIMESHEET_ACCESS_DENIED",
        "You can only access calendar entries within your team",
        403,
      );
    }

    return employee;
  }

  throw new AppError(
    "TIMESHEET_ACCESS_DENIED",
    "You do not have permission to access this calendar",
    403,
  );
}

// ============================================================================
// APPROVAL SCOPE
// ============================================================================

async function assertApprovalScope(
  scope: TimesheetScope,
  targetEmployeeId: string,
): Promise<void> {
  if (scope.role === RoleCode.ADMIN) {
    return;
  }

  if (scope.role !== RoleCode.MANAGER && scope.role !== RoleCode.TEAM_LEAD) {
    throw new AppError(
      "TIMESHEET_APPROVAL_DENIED",
      "Only Admin, Manager or Team Lead can approve calendar changes",
      403,
    );
  }

  await assertCalendarScope(scope, targetEmployeeId);
}

// ============================================================================
// REQUEST MAPPER
// ============================================================================

function mapRequest(request: any): TimesheetDayChangeRequestSummary {
  return {
    id: request.id,

    requestedStatus: request.requestedStatus,

    reason: request.reason,

    status: request.status,

    requestedAt: request.requestedAt.toISOString(),

    approverEmployeeId: request.approverEmployeeId ?? null,

    approvalNote: request.approvalNote ?? null,
  };
}

// ============================================================================
// DERIVE STATUS
// ============================================================================

function deriveStatus(input: {
  attendance: {
    id: string;
    status: string;
    workingMinutes: number;
  } | null;

  leaveApproved: boolean;

  existingDay: {
    status: TimesheetDayStatus;
    source: TimesheetDaySource;
    reason: string | null;
  } | null;

  isFuture: boolean;
}): {
  status: TimesheetDayStatus;
  source: TimesheetDaySource;
  reason: string | null;
  workingMinutes: number;
} | null {
  // ==========================================================================
  // FUTURE DATE
  // ==========================================================================

  if (input.isFuture) {
    return null;
  }

  // ==========================================================================
  // APPROVED MANUAL CALENDAR OVERRIDE
  // ==========================================================================
  //
  // An approved manual calendar correction remains authoritative.
  //
  // ==========================================================================

  if (
    input.existingDay &&
    input.existingDay.source !== TimesheetDaySource.ATTENDANCE
  ) {
    return {
      status: input.existingDay.status,

      source: input.existingDay.source,

      reason: input.existingDay.reason,

      workingMinutes: input.attendance?.workingMinutes ?? 0,
    };
  }

  // ==========================================================================
  // ATTENDANCE TAKES PRIORITY OVER LEAVE
  // ==========================================================================
  //
  // If the employee actually checked in, the real Attendance record is the
  // day's working-status source.
  //
  // Approved leave remains stored separately and is exposed through:
  //
  //   leaveApproved = true
  //   leaveWorked   = true
  //
  // ==========================================================================

  if (input.attendance) {
    switch (input.attendance.status) {
      case "PRESENT":
        return {
          status: TimesheetDayStatus.PRESENT,

          source: TimesheetDaySource.ATTENDANCE,

          reason: null,

          workingMinutes: input.attendance.workingMinutes,
        };

      case "WEEK_OFF":
        return {
          status: TimesheetDayStatus.WEEK_OFF,

          source: TimesheetDaySource.WEEK_OFF,

          reason: "Attendance marked as week off",

          workingMinutes: input.attendance.workingMinutes,
        };

      case "LEAVE":
        return {
          status: TimesheetDayStatus.LEAVE,

          source: TimesheetDaySource.LEAVE,

          reason: "Attendance marked as leave",

          workingMinutes: input.attendance.workingMinutes,
        };

      case "ABSENT":
      default:
        return {
          status: TimesheetDayStatus.ABSENT,

          source: TimesheetDaySource.ATTENDANCE,

          reason: null,

          workingMinutes: input.attendance.workingMinutes,
        };
    }
  }

  // ==========================================================================
  // NO ATTENDANCE + APPROVED LEAVE
  // ==========================================================================

  if (input.leaveApproved) {
    return {
      status: TimesheetDayStatus.LEAVE,

      source: TimesheetDaySource.LEAVE,

      reason: "Approved leave",

      workingMinutes: 0,
    };
  }

  // ==========================================================================
  // NO ATTENDANCE / NO LEAVE
  // ==========================================================================

  return {
    status: TimesheetDayStatus.MISSED,

    source: TimesheetDaySource.ATTENDANCE,

    reason: "No attendance record",

    workingMinutes: 0,
  };
}

// ============================================================================
// CALENDAR
// ============================================================================

export async function getTimesheetCalendar(
  scope: TimesheetScope,
  query: TimesheetCalendarQuery,
): Promise<TimesheetCalendarResult> {
  if (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2100) {
    throw new AppError("INVALID_CALENDAR_YEAR", "Invalid calendar year", 400);
  }

  if (!Number.isInteger(query.month) || query.month < 1 || query.month > 12) {
    throw new AppError(
      "INVALID_CALENDAR_MONTH",
      "Calendar month must be between 1 and 12",
      400,
    );
  }

  const employeeId = query.employeeId ?? scope.employeeId;

  if (!employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Employee profile is required",
      403,
    );
  }

  const employee = await assertCalendarScope(scope, employeeId);

  const monthStart = new Date(Date.UTC(query.year, query.month - 1, 1));

  const monthEnd = new Date(Date.UTC(query.year, query.month, 0));

  // --------------------------------------------------------------------------
  // Attendance
  // --------------------------------------------------------------------------

  const attendance = await prisma.attendance.findMany({
    where: {
      employeeId,

      attendanceDate: {
        gte: monthStart,

        lte: monthEnd,
      },
    },

    select: {
      id: true,

      attendanceDate: true,

      status: true,

      workingMinutes: true,
    },

    orderBy: {
      attendanceDate: "asc",
    },
  });

  const attendanceMap = new Map(
    attendance.map((record) => [formatDate(record.attendanceDate), record]),
  );

  // --------------------------------------------------------------------------
  // Existing TimesheetDay values.
  // --------------------------------------------------------------------------

  const existingDays = await prisma.timesheetDay.findMany({
    where: {
      employeeId,

      workDate: {
        gte: monthStart,

        lte: monthEnd,
      },
    },

    select: {
      workDate: true,

      status: true,

      source: true,

      reason: true,
    },
  });

  const existingDayMap = new Map(
    existingDays.map((day) => [formatDate(day.workDate), day]),
  );

  // --------------------------------------------------------------------------
  // Approved leaves.
  // --------------------------------------------------------------------------

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,

      status: LeaveStatus.APPROVED,

      startDate: {
        lte: monthEnd,
      },

      endDate: {
        gte: monthStart,
      },
    },

    select: {
      startDate: true,

      endDate: true,
    },
  });

  const approvedLeaveDates = new Set<string>();

  for (const leave of approvedLeaves) {
    let cursor = startOfUtcDay(leave.startDate);

    const end = startOfUtcDay(leave.endDate);

    while (cursor.getTime() <= end.getTime()) {
      approvedLeaveDates.add(formatDate(cursor));

      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // --------------------------------------------------------------------------
  // Pending change requests.
  // --------------------------------------------------------------------------

  const requests = await prisma.timesheetDayChangeRequest.findMany({
    where: {
      employeeId,

      status: TimesheetDayRequestStatus.PENDING,

      timesheetDay: {
        workDate: {
          gte: monthStart,

          lte: monthEnd,
        },
      },
    },

    include: {
      timesheetDay: {
        select: {
          workDate: true,
        },
      },
    },

    orderBy: {
      requestedAt: "desc",
    },
  });

  const requestMap = new Map<string, TimesheetDayChangeRequestSummary>();

  for (const request of requests) {
    const date = formatDate(request.timesheetDay.workDate);

    if (!requestMap.has(date)) {
      requestMap.set(date, mapRequest(request));
    }
  }

  // --------------------------------------------------------------------------
  // Timesheets.
  // --------------------------------------------------------------------------

  const timesheets = await prisma.timesheet.findMany({
    where: {
      employeeId,

      workDate: {
        gte: monthStart,

        lte: monthEnd,
      },
    },

    select: {
      id: true,

      workDate: true,
    },
  });

  const timesheetMap = new Map(
    timesheets.map((timesheet) => [
      formatDate(timesheet.workDate),
      timesheet.id,
    ]),
  );

  // --------------------------------------------------------------------------
  // Build every calendar day.
  // --------------------------------------------------------------------------

  const days: TimesheetCalendarDay[] = [];

  const cursor = new Date(monthStart);

  while (cursor.getTime() <= monthEnd.getTime()) {
    const date = formatDate(cursor);

    const attendanceRecord = attendanceMap.get(date) ?? null;

    const existingDay = existingDayMap.get(date) ?? null;

    const leaveApproved = approvedLeaveDates.has(date);

    const future = isFutureDate(cursor);

    const today = isTodayDate(cursor);

    const derived = deriveStatus({
      attendance: attendanceRecord,

      leaveApproved,

      existingDay,

      isFuture: future,
    });

    const leaveWorked = !future && leaveApproved && attendanceRecord !== null;

    days.push({
      date,

      status: derived?.status ?? null,

      source: derived?.source ?? null,

      reason: derived?.reason ?? null,

      workingMinutes: derived?.workingMinutes ?? 0,

      timesheetId: future ? null : (timesheetMap.get(date) ?? null),

      attendanceId: future ? null : (attendanceRecord?.id ?? null),

      pendingRequest: future ? null : (requestMap.get(date) ?? null),

      leaveApproved: future ? false : leaveApproved,

      leaveWorked,

      isFuture: future,

      isToday: today,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    year: query.year,

    month: query.month,

    employeeId: employee.id,

    employeeCode: employee.employeeCode,

    employeeName:
      employee.displayName ??
      [employee.firstName, employee.lastName].filter(Boolean).join(" "),

    days,
  };
}

// ============================================================================
// REQUEST STATUS CHANGE
// ============================================================================

export async function requestTimesheetDayChange(
  scope: TimesheetScope,
  employeeId: string,
  dateValue: string,
  input: TimesheetDayChangeRequestInput,
) {
  const employee = await assertCalendarScope(scope, employeeId);

  // --------------------------------------------------------------------------
  // Employee can only create correction requests for their own calendar.
  // Managers/Admins should use the approval endpoint for requests.
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.EMPLOYEE) {
    if (scope.employeeId !== employeeId) {
      throw new AppError(
        "TIMESHEET_ACCESS_DENIED",
        "You can only request changes for your own calendar",
        403,
      );
    }
  }

  const workDate = parseCalendarDate(dateValue);

  // --------------------------------------------------------------------------
  // Future date protection.
  // --------------------------------------------------------------------------

  if (isFutureDate(workDate)) {
    throw new AppError(
      "FUTURE_DATE_NOT_ALLOWED",
      "Future dates cannot be changed",
      400,
    );
  }

  if (!input.reason || !input.reason.trim()) {
    throw new AppError(
      "CHANGE_REASON_REQUIRED",
      "A reason is required for a status change",
      400,
    );
  }

  if (input.reason.trim().length > 1000) {
    throw new AppError(
      "CHANGE_REASON_TOO_LONG",
      "Reason cannot exceed 1000 characters",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Only the allowed calendar statuses.
  // --------------------------------------------------------------------------

  if (!Object.values(TimesheetDayStatus).includes(input.requestedStatus)) {
    throw new AppError(
      "INVALID_CALENDAR_STATUS",
      "Invalid Timesheet calendar status",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Existing day.
  // --------------------------------------------------------------------------

  const day = await prisma.timesheetDay.upsert({
    where: {
      employeeId_workDate: {
        employeeId,

        workDate,
      },
    },

    create: {
      employeeId,

      workDate,

      status: TimesheetDayStatus.MISSED,

      source: TimesheetDaySource.ATTENDANCE,
    },

    update: {},
  });

  // --------------------------------------------------------------------------
  // Prevent duplicate pending requests.
  // --------------------------------------------------------------------------

  const existingRequest = await prisma.timesheetDayChangeRequest.findFirst({
    where: {
      timesheetDayId: day.id,

      employeeId,

      status: TimesheetDayRequestStatus.PENDING,
    },
  });

  if (existingRequest) {
    throw new AppError(
      "CHANGE_REQUEST_EXISTS",
      "A pending status-change request already exists for this date",
      409,
    );
  }

  // --------------------------------------------------------------------------
  // If management is explicitly making the request, we still create the
  // request. The approval endpoint remains the single status-transition path.
  // --------------------------------------------------------------------------

  const request = await prisma.timesheetDayChangeRequest.create({
    data: {
      timesheetDayId: day.id,

      employeeId,

      requestedStatus: input.requestedStatus,

      reason: input.reason.trim(),

      status: TimesheetDayRequestStatus.PENDING,
    },
  });

  return mapRequest(request);
}

// ============================================================================
// APPROVE
// ============================================================================

export async function approveTimesheetDayChange(
  scope: TimesheetScope,
  requestId: string,
  input: TimesheetDayDecisionInput = {},
) {
  if (!scope.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Approver employee profile is required",
      403,
    );
  }

  const request = await prisma.timesheetDayChangeRequest.findUnique({
    where: {
      id: requestId,
    },

    include: {
      timesheetDay: {
        select: {
          id: true,

          employeeId: true,

          workDate: true,

          status: true,

          source: true,
        },
      },
    },
  });

  if (!request) {
    throw new AppError(
      "CHANGE_REQUEST_NOT_FOUND",
      "Calendar change request not found",
      404,
    );
  }

  if (request.status !== TimesheetDayRequestStatus.PENDING) {
    throw new AppError(
      "INVALID_CHANGE_REQUEST_STATUS",
      `Only PENDING requests can be approved. Current status: ${request.status}`,
      400,
    );
  }

  await assertApprovalScope(scope, request.employeeId);

  const workDate = startOfUtcDay(request.timesheetDay.workDate);

  if (isFutureDate(workDate)) {
    throw new AppError(
      "FUTURE_DATE_NOT_ALLOWED",
      "Future dates cannot be approved",
      400,
    );
  }

  const approvalNote = input.approvalNote?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.timesheetDayChangeRequest.update({
      where: {
        id: request.id,
      },

      data: {
        status: TimesheetDayRequestStatus.APPROVED,

        approvedAt: new Date(),

        approverEmployeeId: scope.employeeId!,

        approvalNote,
      },
    });

    const updatedDay = await tx.timesheetDay.update({
      where: {
        id: request.timesheetDay.id,
      },

      data: {
        status: request.requestedStatus,

        source:
          request.requestedStatus === TimesheetDayStatus.LEAVE
            ? TimesheetDaySource.LEAVE
            : request.requestedStatus === TimesheetDayStatus.WEEK_OFF
              ? TimesheetDaySource.WEEK_OFF
              : request.requestedStatus === TimesheetDayStatus.COMPOFF
                ? TimesheetDaySource.COMPOFF
                : TimesheetDaySource.MANUAL,

        reason: request.reason,
      },
    });

    return {
      updatedRequest,

      updatedDay,
    };
  });

  return {
    request: mapRequest(result.updatedRequest),

    day: {
      date: formatDate(result.updatedDay.workDate),

      status: result.updatedDay.status,

      source: result.updatedDay.source,

      reason: result.updatedDay.reason,
    },
  };
}

// ============================================================================
// REJECT
// ============================================================================

export async function rejectTimesheetDayChange(
  scope: TimesheetScope,
  requestId: string,
  input: TimesheetDayDecisionInput = {},
) {
  if (!scope.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Approver employee profile is required",
      403,
    );
  }

  const request = await prisma.timesheetDayChangeRequest.findUnique({
    where: {
      id: requestId,
    },

    include: {
      timesheetDay: {
        select: {
          employeeId: true,

          workDate: true,
        },
      },
    },
  });

  if (!request) {
    throw new AppError(
      "CHANGE_REQUEST_NOT_FOUND",
      "Calendar change request not found",
      404,
    );
  }

  if (request.status !== TimesheetDayRequestStatus.PENDING) {
    throw new AppError(
      "INVALID_CHANGE_REQUEST_STATUS",
      `Only PENDING requests can be rejected. Current status: ${request.status}`,
      400,
    );
  }

  await assertApprovalScope(scope, request.employeeId);

  const approvalNote = input.approvalNote?.trim() || null;

  const updated = await prisma.timesheetDayChangeRequest.update({
    where: {
      id: request.id,
    },

    data: {
      status: TimesheetDayRequestStatus.REJECTED,

      rejectedAt: new Date(),

      approverEmployeeId: scope.employeeId,

      approvalNote,
    },
  });

  return mapRequest(updated);
}
// ============================================================================
// LIST CALENDAR CHANGE REQUESTS
// ============================================================================
//
// Employee:
//   Own requests.
//
// Manager:
//   Employees in own department.
//
// Team Lead:
//   Employees in own team.
//
// Admin:
//   All employees.
//
// Default status:
//   PENDING
//
// ============================================================================

export async function listTimesheetDayChangeRequests(
  scope: TimesheetScope,
  query: TimesheetDayChangeRequestListQuery = {},
): Promise<TimesheetDayChangeRequestListResult> {
  const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), 100)
      : 20;

  const skip = (page - 1) * limit;

  // --------------------------------------------------------------------------
  // Build employee scope.
  // --------------------------------------------------------------------------

  let employeeWhere:
    | { id: string }
    | {
        departmentId: string;
      }
    | {
        teamId: string;
      }
    | undefined;

  if (scope.role === RoleCode.ADMIN) {
    if (query.employeeId) {
      await getActiveEmployee(query.employeeId);

      employeeWhere = {
        id: query.employeeId,
      };
    }
  } else {
    const requester = await getActiveEmployee(scope.employeeId!);

    if (scope.role === RoleCode.EMPLOYEE) {
      if (query.employeeId && query.employeeId !== requester.id) {
        throw new AppError(
          "TIMESHEET_ACCESS_DENIED",
          "You can only access your own calendar requests",
          403,
        );
      }

      employeeWhere = {
        id: requester.id,
      };
    } else if (scope.role === RoleCode.MANAGER) {
      if (query.employeeId) {
        const target = await getActiveEmployee(query.employeeId);

        if (target.departmentId !== requester.departmentId) {
          throw new AppError(
            "TIMESHEET_ACCESS_DENIED",
            "You can only access calendar requests within your department",
            403,
          );
        }

        employeeWhere = {
          id: target.id,
        };
      } else {
        employeeWhere = {
          departmentId: requester.departmentId,
        };
      }
    } else if (scope.role === RoleCode.TEAM_LEAD) {
      if (!requester.teamId) {
        throw new AppError(
          "TEAM_REQUIRED",
          "Team Lead is not assigned to a team",
          403,
        );
      }

      if (query.employeeId) {
        const target = await getActiveEmployee(query.employeeId);

        if (target.teamId !== requester.teamId) {
          throw new AppError(
            "TIMESHEET_ACCESS_DENIED",
            "You can only access calendar requests within your team",
            403,
          );
        }

        employeeWhere = {
          id: target.id,
        };
      } else {
        employeeWhere = {
          teamId: requester.teamId,
        };
      }
    } else {
      throw new AppError(
        "TIMESHEET_ACCESS_DENIED",
        "You do not have permission to view calendar requests",
        403,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Status filter.
  //
  // Management defaults to pending.
  // Employee sees all requests by default.
  // --------------------------------------------------------------------------

  const status =
    query.status ??
    (scope.role === RoleCode.EMPLOYEE
      ? undefined
      : TimesheetDayRequestStatus.PENDING);

  // --------------------------------------------------------------------------
  // Prisma where object is assembled separately because department/team
  // conditions need relation filtering.
  // --------------------------------------------------------------------------

  const requestWhere: {
    employeeId?:
      | string
      | {
          in: string[];
        };

    status?: TimesheetDayRequestStatus;
  } = {};

  if (employeeWhere && "id" in employeeWhere) {
    requestWhere.employeeId = employeeWhere.id;
  } else if (employeeWhere) {
    const employees = await prisma.employee.findMany({
      where: employeeWhere,

      select: {
        id: true,
      },
    });

    requestWhere.employeeId = {
      in: employees.map((employee) => employee.id),
    };
  }

  if (status) {
    requestWhere.status = status;
  }

  const [requests, total] = await prisma.$transaction([
    prisma.timesheetDayChangeRequest.findMany({
      where: requestWhere,

      orderBy: {
        requestedAt: "desc",
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
          },
        },

        timesheetDay: {
          select: {
            workDate: true,

            status: true,
          },
        },
      },
    }),

    prisma.timesheetDayChangeRequest.count({
      where: requestWhere,
    }),
  ]);

  const records: TimesheetDayChangeRequestRecord[] = requests.map(
    (request) => ({
      id: request.id,

      employeeId: request.employeeId,

      employeeCode: request.employee.employeeCode,

      employeeName:
        request.employee.displayName ??
        [request.employee.firstName, request.employee.lastName]
          .filter(Boolean)
          .join(" "),

      workDate: formatDate(request.timesheetDay.workDate),

      currentStatus: request.timesheetDay.status,

      requestedStatus: request.requestedStatus,

      reason: request.reason,

      status: request.status,

      requestedAt: request.requestedAt.toISOString(),

      approverEmployeeId: request.approverEmployeeId ?? null,

      approvalNote: request.approvalNote ?? null,
    }),
  );

  return {
    records,

    pagination: {
      page,

      limit,

      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
