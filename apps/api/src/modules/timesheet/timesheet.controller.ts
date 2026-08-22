// ============================================================================
// EEMS - Timesheet Management
// Timesheet HTTP Controllers
// ============================================================================
//
// Responsibilities:
//
// 1. Validate HTTP request parameters.
// 2. Extract authenticated employee/user information.
// 3. Call Timesheet service methods.
// 4. Record successful timesheet mutations in the audit log.
// 5. Return consistent HTTP responses.
//
// Business logic remains inside:
//
//   timesheet.service.ts
//
// AUDIT
// ============================================================================
//
// Audited operations:
//
//   TIMESHEET_CREATE
//   TIMESHEET_UPDATE
//   TIMESHEET_SUBMIT
//   TIMESHEET_APPROVE
//   TIMESHEET_REJECT
//
// Read-only operations and exports are not audited.
//
// IMPORTANT:
//
// Audit records are created only AFTER the underlying service operation
// succeeds. Failed operations therefore do not create successful mutation
// audit entries.
// ============================================================================

import type { Request, Response } from "express";

import {
  createTimesheet,
  getTimesheetById,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  listTimesheets,
} from "./timesheet.service.js";

import { TimesheetStatus } from "@/generated/prisma/enums.js";

import { AppError } from "@/middleware/app-error.js";

import type {
  CreateTimesheetInput,
  TimesheetDecisionInput,
  TimesheetListQuery,
  TimesheetScope,
  UpdateTimesheetInput,
} from "./timesheet.types.js";

import { exportTimesheetCsv, exportTimesheetXlsx } from "./timesheet.export.js";

import { prisma } from "@/lib/prisma.js";

import type { TimesheetRow } from "./timesheet.types.js";

// ============================================================================
// AUDIT
// ============================================================================

import { auditRequest } from "@/modules/audit/index.js";

import { AUDIT_ACTIONS } from "@/modules/audit/audit.types.js";

// ============================================================================
// AUTHENTICATED EMPLOYEE
// ============================================================================

function getEmployeeId(req: Request): string {
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
// SCOPE
// ============================================================================

function getScope(req: Request): TimesheetScope {
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
// Express req.ip may be undefined.
//
// AuditRequestContext expects null instead of undefined.
//
// Therefore:
//
//   req.ip ?? null
//
// is intentionally used here.
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
// CREATE
// ============================================================================
//
// POST /api/timesheets
//
// Employee identity is taken from the authenticated JWT.
//
// Audit:
//
//   TIMESHEET_CREATE
// ============================================================================

export async function createTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getEmployeeId(req);

  const input = req.body as CreateTimesheetInput;

  const result = await createTimesheet(employeeId, input);

  // --------------------------------------------------------------------------
  // Audit successful creation.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.TIMESHEET_CREATE,
    "TIMESHEET",
    {
      entityId: result.id,

      description: "Timesheet created",

      metadata: {
        employeeId: result.employeeId,
        workDate: result.workDate,
        workingMinutes: result.workingMinutes,
        status: result.status,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// LIST
// ============================================================================
//
// GET /api/timesheets
//
// Read-only operation.
// No audit record.
// ============================================================================

export async function listTimesheetsController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const query = parseListQuery(req);

  const result = await listTimesheets(scope, query);

  res.status(200).json({
    success: true,
    data: result.records,
    meta: result.pagination,
  });
}

// ============================================================================
// GET BY ID
// ============================================================================
//
// GET /api/timesheets/:id
//
// Read-only operation.
// No audit record.
// ============================================================================

export async function getTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getPathId(req);

  const scope = getScope(req);

  const result = await getTimesheetById(id, scope);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// UPDATE
// ============================================================================
//
// PATCH /api/timesheets/:id
//
// Only the owner can update the timesheet.
//
// Service permits updates for:
//
//   DRAFT
//   REJECTED
//
// Audit:
//
//   TIMESHEET_UPDATE
// ============================================================================

export async function updateTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getPathId(req);

  const employeeId = getEmployeeId(req);

  const input = req.body as UpdateTimesheetInput;

  const result = await updateTimesheet(id, employeeId, input);

  // --------------------------------------------------------------------------
  // Audit successful update.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.TIMESHEET_UPDATE,
    "TIMESHEET",
    {
      entityId: result.id,

      description: "Timesheet updated",

      metadata: {
        employeeId: result.employeeId,

        workDate: result.workDate,

        status: result.status,

        updatedFields: Object.keys(req.body ?? {}),
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// SUBMIT
// ============================================================================
//
// POST /api/timesheets/:id/submit
//
// Employee submits their own DRAFT or REJECTED timesheet.
//
// Audit:
//
//   TIMESHEET_SUBMIT
// ============================================================================

export async function submitTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getPathId(req);

  const employeeId = getEmployeeId(req);

  const result = await submitTimesheet(id, employeeId);

  // --------------------------------------------------------------------------
  // Audit successful submission.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.TIMESHEET_SUBMIT,
    "TIMESHEET",
    {
      entityId: result.id,

      description: "Timesheet submitted",

      metadata: {
        employeeId: result.employeeId,

        workDate: result.workDate,

        status: result.status,

        submittedAt: result.submittedAt,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// APPROVE
// ============================================================================
//
// POST /api/timesheets/:id/approve
//
// Approver identity comes from the authenticated JWT.
//
// The service performs:
//
//   - active employee validation
//   - self-approval prevention
//   - department/team approval scope
//   - atomic status transition
//
// Audit:
//
//   TIMESHEET_APPROVE
// ============================================================================

export async function approveTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getPathId(req);

  const employeeId = getEmployeeId(req);

  const body = parseDecisionBody(req.body);

  const result = await approveTimesheet(id, employeeId, body.approvalNote);

  // --------------------------------------------------------------------------
  // Audit successful approval.
  //
  // Do not store the complete approval note in audit metadata. The note can
  // contain business-sensitive information.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.TIMESHEET_APPROVE,
    "TIMESHEET",
    {
      entityId: result.id,

      description: "Timesheet approved",

      metadata: {
        employeeId: result.employeeId,

        approverEmployeeId: employeeId,

        workDate: result.workDate,

        status: result.status,

        approvedAt: result.approvedAt,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// REJECT
// ============================================================================
//
// POST /api/timesheets/:id/reject
//
// Approver identity comes from the authenticated JWT.
//
// Audit:
//
//   TIMESHEET_REJECT
// ============================================================================

export async function rejectTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getPathId(req);

  const employeeId = getEmployeeId(req);

  const body = parseDecisionBody(req.body);

  const result = await rejectTimesheet(id, employeeId, body.approvalNote);

  // --------------------------------------------------------------------------
  // Audit successful rejection.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.TIMESHEET_REJECT,
    "TIMESHEET",
    {
      entityId: result.id,

      description: "Timesheet rejected",

      metadata: {
        employeeId: result.employeeId,

        approverEmployeeId: employeeId,

        workDate: result.workDate,

        status: result.status,

        rejectedAt: result.rejectedAt,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// DECISION BODY
// ============================================================================

function parseDecisionBody(body: unknown): TimesheetDecisionInput {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(
      "INVALID_REQUEST_BODY",
      "Request body must be a JSON object",
      400,
    );
  }

  const candidate = body as Record<string, unknown>;

  if (
    candidate.approvalNote !== undefined &&
    candidate.approvalNote !== null &&
    typeof candidate.approvalNote !== "string"
  ) {
    throw new AppError(
      "INVALID_APPROVAL_NOTE",
      "approvalNote must be a string",
      400,
    );
  }

  const approvalNote =
    typeof candidate.approvalNote === "string"
      ? candidate.approvalNote.trim()
      : undefined;

  return approvalNote ? { approvalNote } : {};
}

// ============================================================================
// QUERY PARSER
// ============================================================================

function parseListQuery(req: Request): TimesheetListQuery {
  const employeeId =
    typeof req.query.employeeId === "string"
      ? req.query.employeeId.trim()
      : undefined;

  const status =
    typeof req.query.status === "string"
      ? parseStatus(req.query.status)
      : undefined;

  const from =
    typeof req.query.from === "string" ? req.query.from.trim() : undefined;

  const to = typeof req.query.to === "string" ? req.query.to.trim() : undefined;

  const page = parseInteger(req.query.page, "page");

  const limit = parseInteger(req.query.limit, "limit");

  return {
    ...(employeeId
      ? {
          employeeId,
        }
      : {}),

    ...(status
      ? {
          status,
        }
      : {}),

    ...(from
      ? {
          from,
        }
      : {}),

    ...(to
      ? {
          to,
        }
      : {}),

    ...(page !== undefined
      ? {
          page,
        }
      : {}),

    ...(limit !== undefined
      ? {
          limit,
        }
      : {}),
  };
}

// ============================================================================
// STATUS
// ============================================================================

function parseStatus(value: string): TimesheetStatus {
  const normalized = value.trim().toUpperCase();

  if (!Object.values(TimesheetStatus).includes(normalized as TimesheetStatus)) {
    throw new AppError(
      "INVALID_TIMESHEET_STATUS",
      `Invalid timesheet status: ${value}`,
      400,
    );
  }

  return normalized as TimesheetStatus;
}

// ============================================================================
// INTEGER
// ============================================================================

function parseInteger(value: unknown, fieldName: string): number | undefined {
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

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new AppError(
      "INVALID_QUERY_PARAMETER",
      `${fieldName} must be a positive integer`,
      400,
    );
  }

  return number;
}

// ============================================================================
// PATH ID
// ============================================================================

function getPathId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError(
      "TIMESHEET_ID_REQUIRED",
      "Timesheet ID is required",
      400,
    );
  }

  return id.trim();
}

// ============================================================================
// EXPORT
// ============================================================================
//
// Export is intentionally NOT audited because your existing audit action
// definitions do not contain TIMESHEET_EXPORT.
//
// The report/export activity can be audited separately later if required.
// ============================================================================

export async function exportTimesheetController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const query = parseListQuery(req);

  const result = await listTimesheets(scope, {
    ...query,

    page: 1,

    limit: 100,
  });

  const employeeIds = [
    ...new Set(result.records.map((record) => record.employeeId)),
  ];

  const employees =
    employeeIds.length > 0
      ? await prisma.employee.findMany({
          where: {
            id: {
              in: employeeIds,
            },
          },

          select: {
            id: true,

            department: {
              select: {
                name: true,
              },
            },

            team: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

  const employeeMap = new Map(
    employees.map((employee) => [employee.id, employee]),
  );

  const rows: TimesheetRow[] = result.records.map((record) => {
    const employee = employeeMap.get(record.employeeId);

    const workingHours = formatWorkingHours(record.workingMinutes);

    return {
      employeeId: record.employeeId,

      employeeCode: record.employeeCode,

      employeeName:
        record.displayName ??
        [record.firstName, record.lastName].filter(Boolean).join(" "),

      department: employee?.department?.name ?? "",

      team: employee?.team?.name ?? "",

      date: record.workDate,

      firstCheckIn: null,

      lastCheckOut: null,

      workingMinutes: record.workingMinutes,

      workingHours,

      status: record.status,
    };
  });

  const format =
    typeof req.query.format === "string"
      ? req.query.format.trim().toLowerCase()
      : "xlsx";

  if (format === "csv") {
    const buffer = exportTimesheetCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="timesheets.csv"',
    );

    res.status(200).send(buffer);

    return;
  }

  if (format === "xlsx") {
    const buffer = await exportTimesheetXlsx(rows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="timesheets.xlsx"',
    );

    res.status(200).send(buffer);

    return;
  }

  throw new AppError(
    "INVALID_EXPORT_FORMAT",
    "Supported export formats are xlsx and csv",
    400,
  );
}

// ============================================================================
// WORKING HOURS FORMATTER
// ============================================================================

function formatWorkingHours(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remainingMinutes = safeMinutes % 60;

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}
