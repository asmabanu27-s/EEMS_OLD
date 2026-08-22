// ============================================================================
// EEMS - Attendance Controller
// ============================================================================
//
// Responsibilities:
//
// 1. Extract authenticated employee identity.
// 2. Call Attendance service methods.
// 3. Create audit records for successful attendance mutations.
// 4. Return consistent HTTP responses.
//
// Security:
//
// Employee identity is NEVER accepted from the request body.
// It always comes from req.user.employeeId.
//
// Audit:
//
//   ATTENDANCE_CHECK_IN
//   ATTENDANCE_CHECK_OUT
//
// Audit failures are handled by auditRequest() and must never break the
// attendance business transaction.
// ============================================================================

import type { Request, Response } from "express";

import { AppError } from "@/middleware/app-error.js";

import { auditRequest, AUDIT_ACTIONS } from "@/modules/audit/index.js";

import {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceById,
  listAttendance,
} from "./attendance.service.js";

import type {
  AttendanceListQuery,
  AttendanceScope,
} from "./attendance.types.js";

import { AttendanceStatus } from "@/generated/prisma/enums.js";

// ============================================================================
// AUTHENTICATED EMPLOYEE ID
// ============================================================================

function getAuthenticatedEmployeeId(req: Request): string {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!req.user.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  return req.user.employeeId;
}

// ============================================================================
// ATTENDANCE SCOPE
// ============================================================================

function getAttendanceScope(req: Request): AttendanceScope {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  return {
    userId: req.user.sub,
    employeeId: req.user.employeeId,
    role: req.user.role,
  };
}

// ============================================================================
// AUDIT CONTEXT
// ============================================================================
//
// Normalize req.ip to null because Express types it as string | undefined,
// while AuditRequestContext expects string | null.
//
// ============================================================================

function getAuditContext(req: Request) {
  return {
    userId: req.user?.sub ?? null,
    employeeId: req.user?.employeeId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

// ============================================================================
// CHECK-IN
// ============================================================================
//
// POST /api/attendance/check-in
//
// The request body is intentionally ignored.
//
// Employee identity comes exclusively from:
//   req.user.employeeId
//
// Audit:
//   ATTENDANCE_CHECK_IN
//
// ============================================================================

export async function checkInController(
  req: Request,
  res: Response,
): Promise<void> {
  // --------------------------------------------------------------------------
  // Request body is intentionally ignored.
  //
  // This prevents a client from submitting another employee's ID.
  // --------------------------------------------------------------------------

  const employeeId = getAuthenticatedEmployeeId(req);

  // --------------------------------------------------------------------------
  // Execute attendance operation.
  // --------------------------------------------------------------------------

  const result = await checkIn(employeeId);

  // --------------------------------------------------------------------------
  // Audit only after successful check-in.
  //
  // Do not place the audit before checkIn().
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.ATTENDANCE_CHECK_IN,
    "ATTENDANCE",
    {
      entityId: result.employeeId,
      description: "Employee checked in",
      metadata: {
        employeeId,
        attendanceDate: result.attendanceDate,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// CHECK-OUT
// ============================================================================
//
// POST /api/attendance/check-out
//
// Employee identity comes exclusively from:
//   req.user.employeeId
//
// Audit:
//   ATTENDANCE_CHECK_OUT
//
// ============================================================================

export async function checkOutController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  // --------------------------------------------------------------------------
  // Execute attendance operation.
  // --------------------------------------------------------------------------

  const result = await checkOut(employeeId);

  // --------------------------------------------------------------------------
  // Audit only after successful check-out.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.ATTENDANCE_CHECK_OUT,
    "ATTENDANCE",
    {
      entityId: result.employeeId,
      description: "Employee checked out",
      metadata: {
        employeeId,
        attendanceDate: result.attendanceDate,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// TODAY
// ============================================================================
//
// GET /api/attendance/today
//
// No audit is required because this is a read-only operation.
// ============================================================================

export async function getTodayAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const result = await getTodayAttendance(employeeId);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// ATTENDANCE LIST
// ============================================================================
//
// GET /api/attendance
//
// No audit is required because this is a read-only operation.
// ============================================================================

export async function listAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getAttendanceScope(req);

  const query = parseAttendanceListQuery(req);

  const result = await listAttendance(scope, query);

  res.status(200).json({
    success: true,
    data: result.records,
    meta: result.pagination,
  });
}

// ============================================================================
// ATTENDANCE BY ID
// ============================================================================
//
// GET /api/attendance/:id
//
// No audit is required because this is a read-only operation.
// ============================================================================

export async function getAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new AppError(
      "ATTENDANCE_ID_REQUIRED",
      "Attendance ID is required",
      400,
    );
  }

  const scope = getAttendanceScope(req);

  const result = await getAttendanceById(id.trim(), scope);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// QUERY PARSER
// ============================================================================

function parseAttendanceListQuery(req: Request): AttendanceListQuery {
  const employeeId =
    typeof req.query.employeeId === "string"
      ? req.query.employeeId.trim()
      : undefined;

  const status =
    typeof req.query.status === "string"
      ? parseAttendanceStatus(req.query.status)
      : undefined;

  const from =
    typeof req.query.from === "string" ? req.query.from.trim() : undefined;

  const to = typeof req.query.to === "string" ? req.query.to.trim() : undefined;

  const page = parsePositiveInteger(req.query.page, "page");

  const limit = parsePositiveInteger(req.query.limit, "limit");

  return {
    employeeId: employeeId || undefined,

    status,

    from: from || undefined,

    to: to || undefined,

    page,

    limit,
  };
}

// ============================================================================
// STATUS PARSER
// ============================================================================

function parseAttendanceStatus(value: string): AttendanceStatus {
  const normalized = value.trim().toUpperCase();

  if (
    !Object.values(AttendanceStatus).includes(normalized as AttendanceStatus)
  ) {
    throw new AppError(
      "INVALID_ATTENDANCE_STATUS",
      `Invalid attendance status: ${value}`,
      400,
    );
  }

  return normalized as AttendanceStatus;
}

// ============================================================================
// INTEGER PARSER
// ============================================================================

function parsePositiveInteger(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new AppError(
      "INVALID_QUERY_PARAMETER",
      `${fieldName} must be a positive integer`,
      400,
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError(
      "INVALID_QUERY_PARAMETER",
      `${fieldName} must be a positive integer`,
      400,
    );
  }

  return parsed;
}
