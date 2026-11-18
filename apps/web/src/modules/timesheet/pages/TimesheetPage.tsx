import { useEffect, useMemo, useState } from "react";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  RefreshCw,
  X,
} from "lucide-react";

import { useSelector } from "react-redux";

import type { RootState } from "@/auth/store";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import {
  approveTimesheetDayChange,
  exportTimesheets,
  getTimesheetCalendar,
  listTimesheetDayChangeRequests,
  rejectTimesheetDayChange,
  requestTimesheetDayChange,
  type CalendarChangeRequest,
  type CalendarDay,
  type TimesheetDayStatus,
} from "../api/timesheet.calendar.api";

// ============================================================================
// CONSTANTS
// ============================================================================

type ViewMode = "calendar" | "summary" | "requests";

const STATUS_LABELS: Record<TimesheetDayStatus, string> = {
  MISSED: "Missed",
  PRESENT: "Present",
  WEEK_OFF: "Week Off",
  ABSENT: "Absent",
  COMPOFF: "Comp Off",
  LEAVE: "Leave",
};

const STATUS_CLASSES: Record<TimesheetDayStatus, string> = {
  MISSED: "border-red-200 bg-red-50 text-red-700",
  PRESENT: "border-green-200 bg-green-50 text-green-700",
  WEEK_OFF: "border-purple-200 bg-purple-50 text-purple-700",
  ABSENT: "border-slate-200 bg-slate-100 text-slate-700",
  COMPOFF: "border-orange-200 bg-orange-50 text-orange-700",
  LEAVE: "border-blue-200 bg-blue-50 text-blue-700",
};

const STATUS_OPTIONS: TimesheetDayStatus[] = [
  "MISSED",
  "PRESENT",
  "WEEK_OFF",
  "ABSENT",
  "COMPOFF",
  "LEAVE",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ============================================================================
// HELPERS
// ============================================================================

function formatMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remaining = safeMinutes % 60;

  return `${hours}h ${String(remaining).padStart(2, "0")}m`;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ============================================================================
// PAGE
// ============================================================================

export function TimesheetPage() {
  const user = useSelector((state: RootState) => state.auth.user);

  const isEmployee = user?.role.code === "EMPLOYEE";

  const canApprove =
    user?.role.permissions.includes("TIMESHEET_APPROVE") ?? false;

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());

  const [month, setMonth] = useState(now.getMonth() + 1);

  const [view, setView] = useState<ViewMode>("calendar");

  const [days, setDays] = useState<CalendarDay[]>([]);

  const [requests, setRequests] = useState<CalendarChangeRequest[]>([]);

  const [loading, setLoading] = useState(true);

  const [requestsLoading, setRequestsLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [exportLoading, setExportLoading] = useState<"xlsx" | "csv" | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Modify dialog
  // --------------------------------------------------------------------------

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const [selectedStatus, setSelectedStatus] =
    useState<TimesheetDayStatus>("PRESENT");

  const [reason, setReason] = useState("");

  // ==========================================================================
  // LOAD CALENDAR
  // ==========================================================================

  async function loadCalendar() {
    try {
      setLoading(true);
      setError(null);

      const result = await getTimesheetCalendar(year, month);

      setDays(result.days);
    } catch (requestError) {
      console.error("Failed to load Timesheet calendar", requestError);

      setError("Unable to load Timesheet calendar.");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
  // LOAD REQUESTS
  // ==========================================================================

  async function loadRequests() {
    try {
      setRequestsLoading(true);
      setError(null);

      const result = await listTimesheetDayChangeRequests(
        canApprove ? "PENDING" : undefined,
      );

      setRequests(result);
    } catch (requestError) {
      console.error("Failed to load Timesheet requests", requestError);

      setError("Unable to load Timesheet requests.");
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => {
    void loadCalendar();
  }, [year, month]);

  useEffect(() => {
    if (view === "requests") {
      void loadRequests();
    }
  }, [view]);

  // ==========================================================================
  // MONTH NAVIGATION
  // ==========================================================================

  function previousMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((value) => value - 1);
      return;
    }

    setMonth((value) => value - 1);
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((value) => value + 1);
      return;
    }

    setMonth((value) => value + 1);
  }

  // ==========================================================================
  // CALENDAR CELLS
  // ==========================================================================

  const calendarCells = useMemo(() => {
    if (days.length === 0) {
      return [];
    }

    const firstDate = new Date(`${days[0].date}T00:00:00Z`);

    const firstDay = firstDate.getUTCDay();

    const mondayIndex = firstDay === 0 ? 6 : firstDay - 1;

    const emptyCells = Array.from({
      length: mondayIndex,
    }).map((_, index) => `empty-${index}`);

    return [...emptyCells, ...days];
  }, [days]);

  // ==========================================================================
  // SUMMARY
  // ==========================================================================

  const summary = useMemo(() => {
    const values = days.filter((day) => !day.isFuture && day.status);

    const count = (status: TimesheetDayStatus) =>
      values.filter((day) => day.status === status).length;

    const workingMinutes = values.reduce(
      (total, day) => total + day.workingMinutes,
      0,
    );

    return {
      totalDays: values.length,

      present: count("PRESENT"),

      absent: count("ABSENT"),

      missed: count("MISSED"),

      leave: count("LEAVE"),

      compOff: count("COMPOFF"),

      weekOff: count("WEEK_OFF"),

      effectiveDays: count("PRESENT") + count("COMPOFF"),

      workingMinutes,
    };
  }, [days]);

  // ==========================================================================
  // MODIFY
  // ==========================================================================

  function openModify(day: CalendarDay) {
    if (day.isFuture || !day.status) {
      return;
    }

    setSelectedDay(day);

    setSelectedStatus(day.status);

    setReason("");

    setError(null);
    setSuccess(null);
  }

  function closeModify() {
    setSelectedDay(null);

    setReason("");
  }

  async function submitChangeRequest() {
    if (!selectedDay) {
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason.");
      return;
    }

    if (selectedStatus === selectedDay.status) {
      setError("Please select a different status.");
      return;
    }

    try {
      setActionLoading(selectedDay.date);

      setError(null);
      setSuccess(null);

      await requestTimesheetDayChange(
        selectedDay.date,
        selectedStatus,
        reason.trim(),
      );

      closeModify();

      setSuccess("Timesheet change request submitted successfully.");

      await loadCalendar();

      if (view === "requests") {
        await loadRequests();
      }
    } catch (requestError) {
      console.error("Failed to submit Timesheet change request", requestError);

      setError("Unable to submit Timesheet change request.");
    } finally {
      setActionLoading(null);
    }
  }

  // ==========================================================================
  // APPROVE / REJECT
  // ==========================================================================

  async function approveRequest(requestId: string) {
    try {
      setActionLoading(requestId);

      setError(null);
      setSuccess(null);

      await approveTimesheetDayChange(requestId);

      setSuccess("Timesheet change request approved.");

      await loadRequests();
      await loadCalendar();
    } catch (requestError) {
      console.error("Failed to approve Timesheet request", requestError);

      setError("Unable to approve the request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectRequest(requestId: string) {
    try {
      setActionLoading(requestId);

      setError(null);
      setSuccess(null);

      await rejectTimesheetDayChange(requestId);

      setSuccess("Timesheet change request rejected.");

      await loadRequests();
      await loadCalendar();
    } catch (requestError) {
      console.error("Failed to reject Timesheet request", requestError);

      setError("Unable to reject the request.");
    } finally {
      setActionLoading(null);
    }
  }

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  async function handleExport(format: "xlsx" | "csv") {
    try {
      setExportLoading(format);

      setError(null);
      setSuccess(null);

      await exportTimesheets(format);

      setSuccess(`Timesheet ${format.toUpperCase()} downloaded successfully.`);
    } catch (requestError) {
      console.error("Timesheet export failed", requestError);

      setError("Unable to export Timesheet data.");
    } finally {
      setExportLoading(null);
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Timesheet</h1>

          <p className="text-sm text-muted-foreground">
            Attendance-based timesheet calendar, summary and approvals.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={exportLoading !== null}
            onClick={() => void handleExport("xlsx")}
          >
            <Download className="mr-2 h-4 w-4" />

            {exportLoading === "xlsx" ? "Exporting..." : "XLSX"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={exportLoading !== null}
            onClick={() => void handleExport("csv")}
          >
            <Download className="mr-2 h-4 w-4" />

            {exportLoading === "csv" ? "Exporting..." : "CSV"}
          </Button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ALERTS */}
      {/* ================================================================== */}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ================================================================== */}
      {/* VIEW TABS */}
      {/* ================================================================== */}

      <div className="flex flex-wrap gap-2 border-b pb-2">
        <Button
          type="button"
          variant={view === "calendar" ? "default" : "outline"}
          onClick={() => setView("calendar")}
        >
          Calendar
        </Button>

        <Button
          type="button"
          variant={view === "summary" ? "default" : "outline"}
          onClick={() => setView("summary")}
        >
          Summary
        </Button>

        <Button
          type="button"
          variant={view === "requests" ? "default" : "outline"}
          onClick={() => setView("requests")}
        >
          {isEmployee ? "My Requests" : "Attendance Approval"}
        </Button>
      </div>

      {/* ================================================================== */}
      {/* CALENDAR */}
      {/* ================================================================== */}

      {view === "calendar" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle>{formatMonth(year, month)}</CardTitle>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={previousMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={nextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  onClick={() => void loadCalendar()}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-7 gap-2">
                    {WEEKDAYS.map((weekday) => (
                      <div
                        key={weekday}
                        className="py-2 text-center text-sm font-medium text-muted-foreground"
                      >
                        {weekday}
                      </div>
                    ))}

                    {calendarCells.map((item) => {
                      if (typeof item === "string") {
                        return (
                          <div
                            key={item}
                            className="min-h-32 rounded-lg border border-transparent"
                          />
                        );
                      }

                      const day = item;

                      const pending = Boolean(day.pendingRequest);

                      return (
                        <div
                          key={day.date}
                          className={`min-h-32 rounded-lg border p-3 ${
                            day.isToday
                              ? "border-primary ring-2 ring-primary/30"
                              : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-semibold">
                              {Number(day.date.slice(8))}
                            </span>

                            {day.isToday && <Badge>Today</Badge>}
                            {day.leaveWorked && (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                Leave Worked
                              </div>
                            )}
                          </div>

                          {!day.isFuture && day.status && (
                            <div className="mt-4 space-y-2">
                              <Badge
                                variant="outline"
                                className={STATUS_CLASSES[day.status]}
                              >
                                {STATUS_LABELS[day.status]}
                              </Badge>

                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3 className="h-3 w-3" />
                                {formatMinutes(day.workingMinutes)}
                              </div>

                              {pending && (
                                <div className="text-xs font-medium text-amber-600">
                                  Request pending
                                </div>
                              )}

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                disabled={pending}
                                onClick={() => openModify(day)}
                              >
                                {pending ? "Pending" : "Modify"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* SUMMARY */}
      {/* ================================================================== */}

      {view === "summary" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle>
                  Timesheet Summary — {formatMonth(year, month)}
                </CardTitle>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={previousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={nextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Total Days" value={summary.totalDays} />

                <SummaryCard
                  label="Effective Working Days"
                  value={summary.effectiveDays}
                />

                <SummaryCard
                  label="Present"
                  value={summary.present}
                  className="text-green-700"
                />

                <SummaryCard label="Absent" value={summary.absent} />

                <SummaryCard
                  label="Missed"
                  value={summary.missed}
                  className="text-red-700"
                />

                <SummaryCard
                  label="Leave"
                  value={summary.leave}
                  className="text-blue-700"
                />

                <SummaryCard
                  label="Comp Off"
                  value={summary.compOff}
                  className="text-orange-700"
                />

                <SummaryCard
                  label="Week Off"
                  value={summary.weekOff}
                  className="text-purple-700"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Working Hours</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="text-3xl font-semibold">
                {formatMinutes(summary.workingMinutes)}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Total attendance working time for the selected month.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================== */}
      {/* REQUESTS */}
      {/* ================================================================== */}

      {view === "requests" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {isEmployee ? "My Timesheet Requests" : "Attendance Approval"}
              </CardTitle>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={requestsLoading}
                onClick={() => void loadRequests()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${requestsLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {requestsLoading ? (
              <div className="flex justify-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading requests...
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b text-left text-sm">
                      <th className="p-3">Employee ID</th>

                      <th className="p-3">Name</th>

                      <th className="p-3">Requested Date</th>

                      <th className="p-3">Current</th>

                      <th className="p-3">Requested</th>

                      <th className="p-3">Remarks</th>

                      <th className="p-3">Status</th>

                      {!isEmployee && canApprove && (
                        <th className="p-3">Action</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {requests.map((request) => {
                      const busy = actionLoading === request.id;

                      return (
                        <tr key={request.id} className="border-b last:border-0">
                          <td className="p-3 text-sm">
                            {request.employeeCode}
                          </td>

                          <td className="p-3 text-sm font-medium">
                            {request.employeeName}

                            {request.employeeId === user?.employee?.id && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (My Request)
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-sm">
                            {formatDate(request.workDate)}
                          </td>

                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={STATUS_CLASSES[request.currentStatus]}
                            >
                              {STATUS_LABELS[request.currentStatus]}
                            </Badge>
                          </td>

                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                STATUS_CLASSES[request.requestedStatus]
                              }
                            >
                              {STATUS_LABELS[request.requestedStatus]}
                            </Badge>
                          </td>

                          <td className="max-w-[300px] p-3 text-sm">
                            {request.reason}
                          </td>

                          <td className="p-3">
                            <Badge
                              variant={
                                request.status === "PENDING"
                                  ? "secondary"
                                  : request.status === "APPROVED"
                                    ? "default"
                                    : "outline"
                              }
                            >
                              {request.status}
                            </Badge>
                          </td>

                          {!isEmployee && canApprove && (
                            <td className="p-3">
                              {request.status === "PENDING" ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() =>
                                      void approveRequest(request.id)
                                    }
                                  >
                                    <Check className="mr-1 h-4 w-4" />
                                    {busy ? "..." : "Approve"}
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={busy}
                                    onClick={() =>
                                      void rejectRequest(request.id)
                                    }
                                  >
                                    <X className="mr-1 h-4 w-4" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Completed
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* MODIFY DIALOG */}
      {/* ================================================================== */}

      {selectedDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Modify Attendance Status
                </h2>

                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedDay.date)}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeModify}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>

                <Badge
                  variant="outline"
                  className={`mt-2 ${
                    selectedDay.status ? STATUS_CLASSES[selectedDay.status] : ""
                  }`}
                >
                  {selectedDay.status
                    ? STATUS_LABELS[selectedDay.status]
                    : "Not Available"}
                </Badge>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="calendar-status"
                  className="text-sm font-medium"
                >
                  Change Status
                </label>

                <select
                  id="calendar-status"
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(event.target.value as TimesheetDayStatus)
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="calendar-reason"
                  className="text-sm font-medium"
                >
                  Reason
                </label>

                <textarea
                  id="calendar-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Enter the reason for this correction"
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeModify}
                disabled={actionLoading !== null}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => void submitChangeRequest()}
                disabled={actionLoading !== null}
              >
                {actionLoading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUMMARY CARD
// ============================================================================

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className={`mt-1 text-2xl font-semibold ${className ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
