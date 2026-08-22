// ============================================================================
// EEMS - Employee Management System
// Report Export Service
// ============================================================================
//
// Responsibilities:
//   - Export report data as CSV
//   - Export report data as XLSX
//   - Export report data as PDF
//
// Supported reports:
//   - Attendance
//   - Leave
//   - Timesheet
//   - Employee
//   - Project
//
// ============================================================================

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

// ============================================================================
// TYPES
// ============================================================================

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportColumn {
  key: string;
  header: string;
}

export interface ReportExportData {
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

// ============================================================================
// VALUE FORMATTER
// ============================================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

// ============================================================================
// CSV ESCAPE
// ============================================================================

function escapeCsvValue(value: unknown): string {
  const stringValue = formatValue(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

export function exportCsv(data: ReportExportData): Buffer {
  const header = data.columns
    .map((column) => escapeCsvValue(column.header))
    .join(",");

  const rows = data.rows.map((row) =>
    data.columns.map((column) => escapeCsvValue(row[column.key])).join(","),
  );

  const csv = [header, ...rows].join("\r\n");

  return Buffer.from(csv, "utf8");
}

// ============================================================================
// XLSX EXPORT
// ============================================================================

export async function exportXlsx(data: ReportExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "EEMS";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(data.title);

  worksheet.columns = data.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: Math.max(column.header.length + 2, 15),
  }));

  for (const row of data.rows) {
    worksheet.addRow(row);
  }

  worksheet.getRow(1).font = {
    bold: true,
  };

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export function exportPdf(data: ReportExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
    });

    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    document.on("error", reject);

    // ------------------------------------------------------------------------
    // TITLE
    // ------------------------------------------------------------------------

    document.fontSize(18).font("Helvetica-Bold").text(data.title, {
      align: "center",
    });

    document.moveDown();

    document
      .fontSize(9)
      .font("Helvetica")
      .text(`Generated: ${new Date().toISOString()}`, {
        align: "right",
      });

    document.moveDown();

    // ------------------------------------------------------------------------
    // SIMPLE TABLE
    // ------------------------------------------------------------------------

    const pageWidth =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    const columnWidth = pageWidth / data.columns.length;

    const rowHeight = 22;

    let y = document.y;

    // Header
    document.font("Helvetica-Bold").fontSize(8);

    data.columns.forEach((column, index) => {
      const x = document.page.margins.left + index * columnWidth;

      document.rect(x, y, columnWidth, rowHeight).stroke();

      document.text(column.header, x + 3, y + 6, {
        width: columnWidth - 6,
        height: rowHeight,
      });
    });

    y += rowHeight;

    // Rows
    document.font("Helvetica").fontSize(7);

    for (const row of data.rows) {
      if (y + rowHeight > document.page.height - document.page.margins.bottom) {
        document.addPage();

        y = document.page.margins.top;

        document.font("Helvetica-Bold").fontSize(8);

        data.columns.forEach((column, index) => {
          const x = document.page.margins.left + index * columnWidth;

          document.rect(x, y, columnWidth, rowHeight).stroke();

          document.text(column.header, x + 3, y + 6, {
            width: columnWidth - 6,
            height: rowHeight,
          });
        });

        y += rowHeight;

        document.font("Helvetica").fontSize(7);
      }

      data.columns.forEach((column, index) => {
        const x = document.page.margins.left + index * columnWidth;

        const value = formatValue(row[column.key]);

        document.rect(x, y, columnWidth, rowHeight).stroke();

        document.text(value, x + 3, y + 6, {
          width: columnWidth - 6,
          height: rowHeight,
          ellipsis: true,
        });
      });

      y += rowHeight;
    }

    document.end();
  });
}

// ============================================================================
// GENERIC EXPORT
// ============================================================================

export async function exportReport(
  data: ReportExportData,
  format: ExportFormat,
): Promise<Buffer> {
  switch (format) {
    case "csv":
      return exportCsv(data);

    case "xlsx":
      return exportXlsx(data);

    case "pdf":
      return exportPdf(data);

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
