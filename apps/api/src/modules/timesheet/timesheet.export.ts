// ============================================================================
// EEMS - Timesheet Export Service
// ============================================================================
//
// Supported:
//
//   XLSX
//   CSV
//
// PDF can be added later without changing the Timesheet service.
//
// The export layer consumes normalized TimesheetRow objects and therefore
// remains independent from Prisma.
// ============================================================================

import ExcelJS from "exceljs";

import type { TimesheetRow } from "./timesheet.types.js";

// ============================================================================
// XLSX EXPORT
// ============================================================================

export async function exportTimesheetXlsx(
  rows: TimesheetRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "EEMS";

  workbook.lastModifiedBy = "EEMS";

  workbook.created = new Date();

  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Timesheet");

  worksheet.columns = [
    {
      header: "Employee ID",
      key: "employeeId",
      width: 38,
    },

    {
      header: "Employee Code",
      key: "employeeCode",
      width: 18,
    },

    {
      header: "Employee Name",
      key: "employeeName",
      width: 25,
    },

    {
      header: "Department",
      key: "department",
      width: 20,
    },

    {
      header: "Team",
      key: "team",
      width: 20,
    },

    {
      header: "Date",
      key: "date",
      width: 14,
    },

    {
      header: "First Check-in",
      key: "firstCheckIn",
      width: 25,
    },

    {
      header: "Last Check-out",
      key: "lastCheckOut",
      width: 25,
    },

    {
      header: "Working Minutes",
      key: "workingMinutes",
      width: 18,
    },

    {
      header: "Working Hours",
      key: "workingHours",
      width: 18,
    },

    {
      header: "Status",
      key: "status",
      width: 15,
    },
  ];

  for (const row of rows) {
    worksheet.addRow(row);
  }

  worksheet.getRow(1).font = {
    bold: true,
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ============================================================================
// CSV ESCAPING
// ============================================================================

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

export function exportTimesheetCsv(rows: TimesheetRow[]): Buffer {
  const headers = [
    "Employee ID",
    "Employee Code",
    "Employee Name",
    "Department",
    "Team",
    "Date",
    "First Check-in",
    "Last Check-out",
    "Working Minutes",
    "Working Hours",
    "Status",
  ];

  const lines: string[] = [];

  lines.push(headers.map(escapeCsvValue).join(","));

  for (const row of rows) {
    lines.push(
      [
        row.employeeId,
        row.employeeCode,
        row.employeeName,
        row.department,
        row.team,
        row.date,
        row.firstCheckIn,
        row.lastCheckOut,
        row.workingMinutes,
        row.workingHours,
        row.status,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }

  return Buffer.from(lines.join("\r\n"), "utf8");
}
