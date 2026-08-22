import { api } from "@/api/api";

// ============================================================================
// EEMS - Attendance API
// ============================================================================

export interface AttendanceSession {
  id: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workingMinutes: number;
  status: string;
}

export interface TodayAttendance {
  id: string;
  employeeId: string;
  attendanceDate: string | null;
  status: string;
  workingMinutes: number;
  sessions: AttendanceSession[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  departmentId?: string | null;
  teamId?: string | null;
  attendanceDate: string | null;
  status: string;
  workingMinutes: number;
  sessions: AttendanceSession[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AttendanceListResponse {
  records: AttendanceRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

// ============================================================================
// TODAY
// ============================================================================

export async function getTodayAttendance(): Promise<TodayAttendance> {
  const response =
    await api.get<ApiResponse<TodayAttendance>>("/attendance/today");

  return response.data.data;
}

// ============================================================================
// CHECK IN
// ============================================================================

export async function checkIn(): Promise<TodayAttendance> {
  const response = await api.post<ApiResponse<TodayAttendance>>(
    "/attendance/check-in",
  );

  return response.data.data;
}

// ============================================================================
// CHECK OUT
// ============================================================================

export async function checkOut(): Promise<TodayAttendance> {
  const response = await api.post<ApiResponse<TodayAttendance>>(
    "/attendance/check-out",
  );

  return response.data.data;
}

// ============================================================================
// HISTORY
// ============================================================================

export async function getAttendanceHistory(
  page = 1,
  limit = 20,
): Promise<AttendanceListResponse> {
  const response = await api.get<ApiResponse<AttendanceRecord[]>>(
    "/attendance",
    {
      params: {
        page,
        limit,
      },
    },
  );

  return {
    records: response.data.data ?? [],

    pagination: response.data.meta as
      AttendanceListResponse["pagination"] | undefined,
  };
}
