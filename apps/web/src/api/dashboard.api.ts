import { api } from "./api";

export interface ReportSummary {
  attendance: {
    total: number;
    present: number;
    absent: number;
  };
  leave: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  timesheets: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  employees: {
    total: number;
  };
  projects: {
    total: number;
    active: number;
    planned: number;
    completed: number;
    cancelled: number;
  };
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId: string | null;
  teamId: string | null;
  attendanceDate: string | null;
  status: string;
  workingMinutes: number;
  sessions: Array<{
    id: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    workingMinutes: number;
    status: string;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getReportSummary(): Promise<ReportSummary> {
  const response = await api.get<ApiResponse<ReportSummary>>(
    "/reports/summary",
  );

  return response.data.data;
}

export async function getTodayAttendance(): Promise<AttendanceRecord> {
  const response = await api.get<ApiResponse<AttendanceRecord>>(
    "/attendance/today",
  );

  return response.data.data;
}
