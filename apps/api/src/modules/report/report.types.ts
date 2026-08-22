// ============================================================================
// EEMS - Reports
// Report Types
// ============================================================================

export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export interface ReportQuery {
  from?: string;
  to?: string;
  employeeId?: string;
  departmentId?: string;
  teamId?: string;
  status?: string;
}

export interface ReportScope {
  userId: string;
  employeeId: string | null;
  role: string;
}

export interface ReportPagination {
  page: number;
  limit: number;
}

export interface ReportResult<T> {
  records: T[];
  total: number;
}

export interface ReportExportOptions extends ReportQuery {
  format: Exclude<ReportFormat, "json">;
}
