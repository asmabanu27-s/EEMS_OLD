import { api } from "@/api/api";

export type TimesheetDayStatus =
  "MISSED" | "PRESENT" | "WEEK_OFF" | "ABSENT" | "COMPOFF" | "LEAVE";

export type TimesheetDaySource =
  "ATTENDANCE" | "MANUAL" | "LEAVE" | "WEEK_OFF" | "COMPOFF";

export type TimesheetDayRequestStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface CalendarRequest {
  id: string;
  requestedStatus: TimesheetDayStatus;
  reason: string;
  status: TimesheetDayRequestStatus;
  requestedAt: string;
  approverEmployeeId: string | null;
  approvalNote: string | null;
}

export interface CalendarDay {
  date: string;
  status: TimesheetDayStatus | null;
  source: TimesheetDaySource | null;
  reason: string | null;
  workingMinutes: number;
  timesheetId: string | null;
  attendanceId: string | null;
  pendingRequest: CalendarRequest | null;
  isFuture: boolean;
  isToday: boolean;
  leaveApproved: boolean;
  leaveWorked: boolean;
}

export interface CalendarResult {
  year: number;
  month: number;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  days: CalendarDay[];
}

export interface CalendarChangeRequest {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  currentStatus: TimesheetDayStatus;
  requestedStatus: TimesheetDayStatus;
  reason: string;
  status: TimesheetDayRequestStatus;
  requestedAt: string;
  approverEmployeeId: string | null;
  approvalNote: string | null;
}

export async function getTimesheetCalendar(
  year: number,
  month: number,
  employeeId?: string,
): Promise<CalendarResult> {
  const response = await api.get<{
    success: boolean;
    data: CalendarResult;
  }>("/timesheets/calendar", {
    params: {
      year,
      month,
      ...(employeeId ? { employeeId } : {}),
    },
  });

  return response.data.data;
}

export async function requestTimesheetDayChange(
  date: string,
  requestedStatus: TimesheetDayStatus,
  reason: string,
): Promise<CalendarRequest> {
  const response = await api.post<{
    success: boolean;
    data: CalendarRequest;
  }>(`/timesheets/calendar/${date}/request`, {
    requestedStatus,
    reason,
  });

  return response.data.data;
}

export async function listTimesheetDayChangeRequests(
  status?: TimesheetDayRequestStatus,
): Promise<CalendarChangeRequest[]> {
  const response = await api.get<{
    success: boolean;
    data: CalendarChangeRequest[];
  }>("/timesheets/calendar/requests", {
    params: status ? { status } : {},
  });

  return response.data.data;
}

export async function approveTimesheetDayChange(
  requestId: string,
  approvalNote?: string,
): Promise<void> {
  await api.post(
    `/timesheets/calendar/requests/${requestId}/approve`,
    approvalNote ? { approvalNote } : {},
  );
}

export async function rejectTimesheetDayChange(
  requestId: string,
  approvalNote?: string,
): Promise<void> {
  await api.post(
    `/timesheets/calendar/requests/${requestId}/reject`,
    approvalNote ? { approvalNote } : {},
  );
}

export type TimesheetExportFormat = "xlsx" | "csv";

export async function exportTimesheets(
  format: TimesheetExportFormat,
): Promise<void> {
  const response = await api.get<Blob>(`/timesheets/export?format=${format}`, {
    responseType: "blob",
  });

  const blobUrl = URL.createObjectURL(response.data);

  const link = window.document.createElement("a");

  link.href = blobUrl;
  link.download = format === "xlsx" ? "timesheets.xlsx" : "timesheets.csv";

  window.document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(blobUrl);
}
