import { api } from "@/api/api";

// ============================================================================
// EEMS - Timesheet API
// ============================================================================

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface TimesheetRecord {
  id: string;

  employeeId: string;
  employeeCode?: string | null;

  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;

  workDate: string;

  description: string | null;
  taskDescription: string | null;

  workingMinutes: number;

  status: TimesheetStatus;

  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;

  approverEmployeeId: string | null;
  approvalNote: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface TimesheetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TimesheetListResponse {
  records: TimesheetRecord[];
  pagination?: TimesheetPagination;
}

export interface CreateTimesheetRequest {
  workDate: string;
  description?: string;
  taskDescription?: string;
  workingMinutes: number;
}

export interface UpdateTimesheetRequest {
  workDate?: string;
  description?: string;
  taskDescription?: string;
  workingMinutes?: number;
}

export interface TimesheetDecisionRequest {
  approvalNote?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

// ============================================================================
// LIST
// ============================================================================

export async function getTimesheets(
  page = 1,
  limit = 20,
): Promise<TimesheetListResponse> {
  const response = await api.get<ApiResponse<TimesheetRecord[]>>(
    "/timesheets",
    {
      params: {
        page,
        limit,
      },
    },
  );

  return {
    records: response.data.data ?? [],

    pagination: response.data.meta as TimesheetPagination | undefined,
  };
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getTimesheet(id: string): Promise<TimesheetRecord> {
  const response = await api.get<ApiResponse<TimesheetRecord>>(
    `/timesheets/${id}`,
  );

  return response.data.data;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createTimesheet(
  input: CreateTimesheetRequest,
): Promise<TimesheetRecord> {
  const response = await api.post<ApiResponse<TimesheetRecord>>(
    "/timesheets",
    input,
  );

  return response.data.data;
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateTimesheet(
  id: string,
  input: UpdateTimesheetRequest,
): Promise<TimesheetRecord> {
  const response = await api.patch<ApiResponse<TimesheetRecord>>(
    `/timesheets/${id}`,
    input,
  );

  return response.data.data;
}

// ============================================================================
// SUBMIT
// ============================================================================

export async function submitTimesheet(id: string): Promise<TimesheetRecord> {
  const response = await api.post<ApiResponse<TimesheetRecord>>(
    `/timesheets/${id}/submit`,
  );

  return response.data.data;
}

// ============================================================================
// APPROVE
// ============================================================================

export async function approveTimesheet(
  id: string,
  input: TimesheetDecisionRequest = {},
): Promise<TimesheetRecord> {
  const response = await api.post<ApiResponse<TimesheetRecord>>(
    `/timesheets/${id}/approve`,
    input,
  );

  return response.data.data;
}

// ============================================================================
// REJECT
// ============================================================================

export async function rejectTimesheet(
  id: string,
  input: TimesheetDecisionRequest = {},
): Promise<TimesheetRecord> {
  const response = await api.post<ApiResponse<TimesheetRecord>>(
    `/timesheets/${id}/reject`,
    input,
  );

  return response.data.data;
}
