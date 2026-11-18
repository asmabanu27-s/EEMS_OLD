import { api } from "@/api/api";

// ============================================================================
// EEMS - Leave API
// ============================================================================

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isPaid?: boolean;
  isActive?: boolean;
}

export interface AvailableLeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isPaid: boolean;
  isActive: boolean;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;

  startDate: string;
  endDate: string;
  totalDays: string | number;

  reason: string | null;

  status: LeaveStatus;

  appliedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;

  approverId?: string | null;
  approvalNote?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LeaveListResponse {
  requests: LeaveRequest[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

export interface CreateLeaveRequest {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface LeaveDecisionRequest {
  approvalNote?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

// ============================================================================
// LEAVE TYPES
// ============================================================================

export async function getLeaveTypes(): Promise<AvailableLeaveType[]> {
  const response =
    await api.get<ApiResponse<AvailableLeaveType[]>>("/leave/types");

  return response.data.data;
}
// ============================================================================
// LIST
// ============================================================================

export async function getLeaveRequests(
  page = 1,
  limit = 20,
): Promise<LeaveListResponse> {
  const response = await api.get<ApiResponse<LeaveRequest[]>>("/leave", {
    params: {
      page,
      limit,
    },
  });

  return {
    requests: response.data.data ?? [],
    pagination: response.data.meta as
      LeaveListResponse["pagination"] | undefined,
  };
}

// ============================================================================
// CREATE
// ============================================================================

export async function createLeaveRequest(
  request: CreateLeaveRequest,
): Promise<LeaveRequest> {
  const response = await api.post<ApiResponse<LeaveRequest>>("/leave", request);

  return response.data.data;
}

// ============================================================================
// CANCEL
// ============================================================================

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  const response = await api.post<ApiResponse<LeaveRequest>>(
    `/leave/${id}/cancel`,
  );

  return response.data.data;
}

// ============================================================================
// APPROVE
// ============================================================================

export async function approveLeaveRequest(
  id: string,
  request: LeaveDecisionRequest = {},
): Promise<LeaveRequest> {
  const response = await api.post<ApiResponse<LeaveRequest>>(
    `/leave/${id}/approve`,
    request,
  );

  return response.data.data;
}

// ============================================================================
// REJECT
// ============================================================================

export async function rejectLeaveRequest(
  id: string,
  request: LeaveDecisionRequest = {},
): Promise<LeaveRequest> {
  const response = await api.post<ApiResponse<LeaveRequest>>(
    `/leave/${id}/reject`,
    request,
  );

  return response.data.data;
}
