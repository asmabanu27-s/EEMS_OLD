// EEMS - Employee Management System
// Reports Controller
// ============================================================================
//
// Responsibilities:
//   - Receive authenticated report requests
//   - Parse and validate report filters
//   - Delegate business logic to report.service.ts
//   - Generate CSV / XLSX / PDF exports
//   - Return downloadable report files
//
// IMPORTANT:
//   Authorization is handled by the route middleware:
//
//     authenticate()
//     authorize("REPORT_VIEW")
//     authorize("REPORT_EXPORT")
//
//   Organizational scope is enforced by report.service.ts.
//
// Supported reports:
//   - Attendance
//   - Leave
//   - Timesheet
//   - Employee
//   - Project
//   - Summary
//
// Supported export formats:
//   - CSV
//   - XLSX
//   - PDF
//
// ============================================================================

import type { Request, Response } from "express";

import { auditRequest } from "@/modules/audit/index.js";
import { AUDIT_ACTIONS } from "@/modules/audit/audit.types.js";

import {
  getAttendanceReport,
  getEmployeeReport,
  getLeaveReport,
  getProjectReport,
  getReportSummary,
  getTimesheetReport,
} from "./report.service.js";

import {
  exportReport,
  type ExportFormat,
  type ReportExportData,
} from "./report.export.js";

import type { ReportQuery } from "./report.types.js";

// ============================================================================
// AUTHENTICATED USER
// ============================================================================
//
// Keep this compatible with the authentication object attached by the
// existing EEMS authentication middleware.
//
// ============================================================================

function getReportScope(req: Request) {
  const user = (
    req as Request & {
      user?: {
        id?: string;
        employeeId?: string | null;
        role?: string;
        roleCode?: string;
      };
    }
  ).user;

  if (!user?.id) {
    throw new Error("Authenticated user context is missing");
  }

  return {
    userId: user.id,
    employeeId: user.employeeId ?? null,
    role: user.roleCode ?? user.role ?? "",
  };
}

// ============================================================================
// QUERY PARSER
// ============================================================================

function getReportQuery(req: Request): ReportQuery {
  const query: ReportQuery = {};

  if (typeof req.query.from === "string") {
    query.from = req.query.from;
  }

  if (typeof req.query.to === "string") {
    query.to = req.query.to;
  }

  if (typeof req.query.employeeId === "string") {
    query.employeeId = req.query.employeeId;
  }

  if (typeof req.query.departmentId === "string") {
    query.departmentId = req.query.departmentId;
  }

  if (typeof req.query.teamId === "string") {
    query.teamId = req.query.teamId;
  }

  if (typeof req.query.status === "string") {
    query.status = req.query.status;
  }

  return query;
}

// ============================================================================
// EXPORT FORMAT
// ============================================================================

function parseExportFormat(value: unknown): ExportFormat {
  const format = String(value ?? "xlsx").toLowerCase();

  if (format !== "csv" && format !== "xlsx" && format !== "pdf") {
    throw new Error(
      'Invalid export format. Supported formats are "csv", "xlsx", and "pdf".',
    );
  }

  return format;
}

// ============================================================================
// EXPORT CONTENT TYPE
// ============================================================================

function getExportContentType(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";

    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    case "pdf":
      return "application/pdf";
  }
}

// ============================================================================
// EXPORT FILENAME
// ============================================================================

function createExportFilename(title: string, format: ExportFormat): string {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const date = new Date().toISOString().slice(0, 10);

  return `${safeTitle}-${date}.${format}`;
}

// ============================================================================
// SEND EXPORT RESPONSE
// ============================================================================

async function sendReportExport(
  req: Request,
  res: Response,
  report: ReportExportData,
  format: ExportFormat,
): Promise<void> {
  const buffer = await exportReport(report, format);

  const contentType = getExportContentType(format);

  const filename = createExportFilename(report.title, format);

  const user = (
    req as Request & {
      user?: {
        id?: string;
        employeeId?: string | null;
      };
    }
  ).user;

  await auditRequest(
    {
      userId: user?.id ?? "",
      employeeId: user?.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.REPORT_EXPORT,
    "REPORT",
    {
      description: `${report.title} exported`,
      metadata: {
        report: report.title,
        format,
        filename,
      },
    },
  );

  res.setHeader("Content-Type", contentType);

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.setHeader("Content-Length", buffer.length);

  res.status(200).send(buffer);
}

// ============================================================================
// ATTENDANCE REPORT
// ============================================================================

export async function attendanceReport(req: Request, res: Response) {
  const result = await getAttendanceReport(
    getReportScope(req),
    getReportQuery(req),
  );

  return res.status(200).json({
    success: true,
    data: result,
    meta: {
      total: result.length,
    },
  });
}

// ============================================================================
// LEAVE REPORT
// ============================================================================

export async function leaveReport(req: Request, res: Response) {
  const result = await getLeaveReport(getReportScope(req), getReportQuery(req));

  return res.status(200).json({
    success: true,
    data: result,
    meta: {
      total: result.length,
    },
  });
}

// ============================================================================
// TIMESHEET REPORT
// ============================================================================

export async function timesheetReport(req: Request, res: Response) {
  const result = await getTimesheetReport(
    getReportScope(req),
    getReportQuery(req),
  );

  return res.status(200).json({
    success: true,
    data: result,
    meta: {
      total: result.length,
    },
  });
}

// ============================================================================
// EMPLOYEE REPORT
// ============================================================================

export async function employeeReport(req: Request, res: Response) {
  const result = await getEmployeeReport(
    getReportScope(req),
    getReportQuery(req),
  );

  return res.status(200).json({
    success: true,
    data: result,
    meta: {
      total: result.length,
    },
  });
}

// ============================================================================
// PROJECT REPORT
// ============================================================================

export async function projectReport(req: Request, res: Response) {
  const result = await getProjectReport(
    getReportScope(req),
    getReportQuery(req),
  );

  return res.status(200).json({
    success: true,
    data: result,
    meta: {
      total: result.length,
    },
  });
}

// ============================================================================
// REPORT SUMMARY
// ============================================================================

export async function reportSummary(req: Request, res: Response) {
  const result = await getReportSummary(getReportScope(req));

  return res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// ATTENDANCE EXPORT
// ============================================================================
//
// GET /api/reports/attendance/export?format=xlsx
//
// Supported:
//   csv
//   xlsx
//   pdf
//
// ============================================================================

export async function attendanceReportExport(req: Request, res: Response) {
  const format = parseExportFormat(req.query.format);

  const result = await getAttendanceReport(
    getReportScope(req),
    getReportQuery(req),
  );

  const report: ReportExportData = {
    title: "Attendance Report",

    columns: [
      {
        key: "employeeCode",
        header: "Employee Code",
      },
      {
        key: "employeeName",
        header: "Employee Name",
      },
      {
        key: "attendanceDate",
        header: "Attendance Date",
      },
      {
        key: "status",
        header: "Status",
      },
      {
        key: "workingMinutes",
        header: "Working Minutes",
      },
      {
        key: "sessions",
        header: "Sessions",
      },
    ],

    rows: result.map((item) => ({
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      attendanceDate: item.attendanceDate,
      status: item.status,
      workingMinutes: item.workingMinutes,
      sessions: item.sessions
        .map(
          (session) =>
            `${session.checkInAt ?? ""} -> ${session.checkOutAt ?? ""} (${session.workingMinutes} min)`,
        )
        .join(" | "),
    })),
  };

  return sendReportExport(req, res, report, format);
}

// ============================================================================
// LEAVE EXPORT
// ============================================================================

export async function leaveReportExport(req: Request, res: Response) {
  const format = parseExportFormat(req.query.format);

  const result = await getLeaveReport(getReportScope(req), getReportQuery(req));

  const report: ReportExportData = {
    title: "Leave Report",

    columns: [
      {
        key: "employeeCode",
        header: "Employee Code",
      },
      {
        key: "employeeName",
        header: "Employee Name",
      },
      {
        key: "leaveType",
        header: "Leave Type",
      },
      {
        key: "startDate",
        header: "Start Date",
      },
      {
        key: "endDate",
        header: "End Date",
      },
      {
        key: "totalDays",
        header: "Total Days",
      },
      {
        key: "status",
        header: "Status",
      },
      {
        key: "reason",
        header: "Reason",
      },
      {
        key: "appliedAt",
        header: "Applied At",
      },
      {
        key: "approvedAt",
        header: "Approved At",
      },
      {
        key: "rejectedAt",
        header: "Rejected At",
      },
      {
        key: "approvalNote",
        header: "Approval Note",
      },
    ],

    rows: result.map((item) => ({
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,

      leaveType: `${item.leaveType.code} - ${item.leaveType.name}`,

      startDate: item.startDate,
      endDate: item.endDate,
      totalDays: item.totalDays,
      status: item.status,
      reason: item.reason,
      appliedAt: item.appliedAt,
      approvedAt: item.approvedAt,
      rejectedAt: item.rejectedAt,
      approvalNote: item.approvalNote,
    })),
  };

  return sendReportExport(req, res, report, format);
}

// ============================================================================
// TIMESHEET EXPORT
// ============================================================================

export async function timesheetReportExport(req: Request, res: Response) {
  const format = parseExportFormat(req.query.format);

  const result = await getTimesheetReport(
    getReportScope(req),
    getReportQuery(req),
  );

  const report: ReportExportData = {
    title: "Timesheet Report",

    columns: [
      {
        key: "employeeCode",
        header: "Employee Code",
      },
      {
        key: "employeeName",
        header: "Employee Name",
      },
      {
        key: "workDate",
        header: "Work Date",
      },
      {
        key: "description",
        header: "Description",
      },
      {
        key: "taskDescription",
        header: "Task Description",
      },
      {
        key: "workingMinutes",
        header: "Working Minutes",
      },
      {
        key: "status",
        header: "Status",
      },
      {
        key: "submittedAt",
        header: "Submitted At",
      },
      {
        key: "approvedAt",
        header: "Approved At",
      },
      {
        key: "rejectedAt",
        header: "Rejected At",
      },
      {
        key: "approvalNote",
        header: "Approval Note",
      },
    ],

    rows: result.map((item) => ({
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      workDate: item.workDate,
      description: item.description,
      taskDescription: item.taskDescription,
      workingMinutes: item.workingMinutes,
      status: item.status,
      submittedAt: item.submittedAt,
      approvedAt: item.approvedAt,
      rejectedAt: item.rejectedAt,
      approvalNote: item.approvalNote,
    })),
  };

  return sendReportExport(req, res, report, format);
}

// ============================================================================
// EMPLOYEE EXPORT
// ============================================================================

export async function employeeReportExport(req: Request, res: Response) {
  const format = parseExportFormat(req.query.format);

  const result = await getEmployeeReport(
    getReportScope(req),
    getReportQuery(req),
  );

  const report: ReportExportData = {
    title: "Employee Report",

    columns: [
      {
        key: "employeeCode",
        header: "Employee Code",
      },
      {
        key: "displayName",
        header: "Display Name",
      },
      {
        key: "firstName",
        header: "First Name",
      },
      {
        key: "lastName",
        header: "Last Name",
      },
      {
        key: "email",
        header: "Email",
      },
      {
        key: "phone",
        header: "Phone",
      },
      {
        key: "department",
        header: "Department",
      },
      {
        key: "team",
        header: "Team",
      },
      {
        key: "position",
        header: "Position",
      },
      {
        key: "status",
        header: "Status",
      },
      {
        key: "joiningDate",
        header: "Joining Date",
      },
    ],

    rows: result.map((item) => ({
      employeeCode: item.employeeCode,
      displayName: item.displayName,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone,

      department: item.department
        ? `${item.department.code} - ${item.department.name}`
        : "",

      team: item.team ? `${item.team.code} - ${item.team.name}` : "",

      position: item.position
        ? `${item.position.code} - ${item.position.title}`
        : "",

      status: item.status,
      joiningDate: item.joiningDate,
    })),
  };

  return sendReportExport(req, res, report, format);
}

// ============================================================================
// PROJECT EXPORT
// ============================================================================

export async function projectReportExport(req: Request, res: Response) {
  const format = parseExportFormat(req.query.format);

  const result = await getProjectReport(
    getReportScope(req),
    getReportQuery(req),
  );

  const report: ReportExportData = {
    title: "Project Report",

    columns: [
      {
        key: "code",
        header: "Project Code",
      },
      {
        key: "name",
        header: "Project Name",
      },
      {
        key: "description",
        header: "Description",
      },
      {
        key: "status",
        header: "Status",
      },
      {
        key: "department",
        header: "Department",
      },
      {
        key: "owner",
        header: "Owner",
      },
      {
        key: "startDate",
        header: "Start Date",
      },
      {
        key: "endDate",
        header: "End Date",
      },
      {
        key: "memberCount",
        header: "Member Count",
      },
      {
        key: "members",
        header: "Members",
      },
    ],

    rows: result.map((item) => ({
      code: item.code,
      name: item.name,
      description: item.description,
      status: item.status,

      department: item.department
        ? `${item.department.code} - ${item.department.name}`
        : "",

      owner: item.owner
        ? `${item.owner.employeeCode} - ${item.owner.displayName ?? `${item.owner.firstName} ${item.owner.lastName}`}`
        : "",

      startDate: item.startDate,
      endDate: item.endDate,
      memberCount: item.memberCount,

      members: item.members
        .map(
          (member) =>
            `${member.employee.employeeCode} - ${member.employee.displayName ?? `${member.employee.firstName} ${member.employee.lastName}`} (${member.role})`,
        )
        .join(" | "),
    })),
  };

  return sendReportExport(req, res, report, format);
}
// ============================================================================
