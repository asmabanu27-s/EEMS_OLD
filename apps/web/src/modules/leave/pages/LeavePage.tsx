import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  XCircle,
} from "lucide-react";

import { useSelector } from "react-redux";

import { PageHeader, StatCard } from "@/components";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import type { RootState } from "@/auth/store";

import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequests,
  getLeaveTypes,
  rejectLeaveRequest,
  type AvailableLeaveType,
  type LeaveRequest,
  type LeaveStatus,
} from "@/modules/leave/api/leave.api";

// ============================================================================
// HELPERS
// ============================================================================

function statusLabel(status: LeaveStatus): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(status: LeaveStatus): string {
  switch (status) {
    case "APPROVED":
      return "bg-green-100 text-green-700";

    case "REJECTED":
      return "bg-red-100 text-red-700";

    case "CANCELLED":
      return "bg-muted text-muted-foreground";

    case "PENDING":
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const value = error as {
    response?: {
      data?: {
        error?: {
          message?: string;
        };
      };
    };
  };

  return value.response?.data?.error?.message ?? fallback;
}

function datesOverlap(
  startDate: string,
  endDate: string,
  existingStartDate: string,
  existingEndDate: string,
): boolean {
  return startDate <= existingEndDate && endDate >= existingStartDate;
}

function getTodayDate(): string {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================================
// PAGE
// ============================================================================

export function LeavePage() {
  const user = useSelector((state: RootState) => state.auth.user);

  const permissions = user?.role.permissions ?? [];

  const canApprove = permissions.includes("LEAVE_APPROVE");

  // ==========================================================================
  // DATA STATE
  // ==========================================================================

  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const [leaveTypes, setLeaveTypes] = useState<AvailableLeaveType[]>([]);

  const [loading, setLoading] = useState(true);

  const [leaveTypesLoading, setLeaveTypesLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ==========================================================================
  // FORM
  // ==========================================================================

  const [leaveTypeId, setLeaveTypeId] = useState("");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const [reason, setReason] = useState("");

  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>(
    {},
  );

  // ==========================================================================
  // LOAD LEAVE DATA
  // ==========================================================================

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setLeaveTypesLoading(true);
      setError(null);

      const [requestResult, leaveTypeResult] = await Promise.all([
        getLeaveRequests(),
        getLeaveTypes(),
      ]);

      setRequests(requestResult.requests);

      setLeaveTypes(leaveTypeResult);
    } catch (requestError) {
      console.error("Failed to load leave data", requestError);

      setError(
        getApiErrorMessage(requestError, "Unable to load leave information."),
      );
    } finally {
      setLoading(false);
      setLeaveTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // ==========================================================================
  // SUMMARY
  // ==========================================================================

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING").length,
    [requests],
  );

  const approvedCount = useMemo(
    () => requests.filter((request) => request.status === "APPROVED").length,
    [requests],
  );

  const rejectedCount = useMemo(
    () => requests.filter((request) => request.status === "REJECTED").length,
    [requests],
  );

  // ==========================================================================
  // APPLY LEAVE
  // ==========================================================================

  async function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      const overlappingRequest = requests.find(
        (request) =>
          (request.status === "PENDING" || request.status === "APPROVED") &&
          datesOverlap(startDate, endDate, request.startDate, request.endDate),
      );

      if (overlappingRequest) {
        setError(
          `Your leave dates overlap with an existing ${overlappingRequest.status.toLowerCase()} leave request from ${overlappingRequest.startDate} to ${overlappingRequest.endDate}.`,
        );

        setSubmitting(false);

        return;
      }

      if (startDate > endDate) {
        setError("End date cannot be before the start date.");

        setSubmitting(false);

        return;
      }

      await createLeaveRequest({
        leaveTypeId: leaveTypeId.trim(),

        startDate,

        endDate,

        ...(reason.trim()
          ? {
              reason: reason.trim(),
            }
          : {}),
      });

      setLeaveTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");

      setSuccessMessage("Leave request submitted successfully.");

      await loadRequests();
    } catch (requestError) {
      console.error("Leave application failed", requestError);

      setError(
        getApiErrorMessage(requestError, "Unable to submit leave request."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================================
  // CANCEL
  // ==========================================================================

  async function handleCancel(id: string) {
    try {
      setActionId(id);
      setError(null);
      setSuccessMessage(null);

      await cancelLeaveRequest(id);

      setSuccessMessage("Leave request cancelled successfully.");

      await loadRequests();
    } catch (requestError) {
      console.error("Leave cancellation failed", requestError);

      setError(
        getApiErrorMessage(requestError, "Unable to cancel leave request."),
      );
    } finally {
      setActionId(null);
    }
  }

  // ==========================================================================
  // APPROVE
  // ==========================================================================

  async function handleApprove(id: string) {
    try {
      setActionId(id);
      setError(null);
      setSuccessMessage(null);

      await approveLeaveRequest(id, {
        approvalNote: approvalNotes[id]?.trim() || undefined,
      });

      setSuccessMessage("Leave request approved successfully.");

      await loadRequests();
    } catch (requestError) {
      console.error("Leave approval failed", requestError);

      setError(
        getApiErrorMessage(requestError, "Unable to approve leave request."),
      );
    } finally {
      setActionId(null);
    }
  }

  // ==========================================================================
  // REJECT
  // ==========================================================================

  async function handleReject(id: string) {
    try {
      setActionId(id);
      setError(null);
      setSuccessMessage(null);

      await rejectLeaveRequest(id, {
        approvalNote: approvalNotes[id]?.trim() || undefined,
      });

      setSuccessMessage("Leave request rejected successfully.");

      await loadRequests();
    } catch (requestError) {
      console.error("Leave rejection failed", requestError);

      setError(
        getApiErrorMessage(requestError, "Unable to reject leave request."),
      );
    } finally {
      setActionId(null);
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        description="Apply for leave and manage your leave requests."
      />

      {/* ================================================================== */}
      {/* ERROR */}
      {/* ================================================================== */}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ================================================================== */}
      {/* SUCCESS */}
      {/* ================================================================== */}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* ================================================================== */}
      {/* SUMMARY */}
      {/* ================================================================== */}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pending"
          value={loading ? "..." : String(pendingCount)}
          description="Awaiting approval"
          icon={<Clock3 className="h-4 w-4" />}
        />

        <StatCard
          title="Approved"
          value={loading ? "..." : String(approvedCount)}
          description="Approved requests"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />

        <StatCard
          title="Rejected"
          value={loading ? "..." : String(rejectedCount)}
          description="Rejected requests"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {/* ================================================================== */}
      {/* APPLY FOR LEAVE */}
      {/* ================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Apply for Leave</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleApply} className="grid gap-4 md:grid-cols-2">
            {/* ============================================================ */}
            {/* LEAVE TYPE */}
            {/* ============================================================ */}

            <div className="space-y-2">
              <label htmlFor="leaveTypeId" className="text-sm font-medium">
                Leave Type
              </label>

              <select
                id="leaveTypeId"
                value={leaveTypeId}
                onChange={(event) => setLeaveTypeId(event.target.value)}
                required
                disabled={leaveTypesLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {leaveTypesLoading
                    ? "Loading leave types..."
                    : "Select leave type"}
                </option>

                {leaveTypes.map((leaveType) => (
                  <option key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                    {leaveType.isPaid ? " (Paid)" : " (Unpaid)"}
                  </option>
                ))}
              </select>

              {!leaveTypesLoading && leaveTypes.length === 0 && (
                <p className="text-xs text-destructive">
                  No active leave types are available. Please contact the
                  administrator.
                </p>
              )}
            </div>

            {/* ============================================================ */}
            {/* REASON */}
            {/* ============================================================ */}

            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason
              </label>

              <input
                id="reason"
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for leave"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* ============================================================ */}
            {/* START DATE */}
            {/* ============================================================ */}

            <div className="space-y-2">
              <label htmlFor="startDate" className="text-sm font-medium">
                Start Date
              </label>

              <input
                id="startDate"
                type="date"
                min={getTodayDate()}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* ============================================================ */}
            {/* END DATE */}
            {/* ============================================================ */}

            <div className="space-y-2">
              <label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </label>

              <input
                id="endDate"
                type="date"
                min={startDate || getTodayDate()}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* ============================================================ */}
            {/* SUBMIT */}
            {/* ============================================================ */}

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={
                  submitting || leaveTypesLoading || leaveTypes.length === 0
                }
              >
                <CalendarDays className="mr-2 h-4 w-4" />

                {submitting ? "Submitting..." : "Submit Leave Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* LEAVE REQUESTS */}
      {/* ================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading leave requests...
            </p>
          ) : requests.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No leave requests found.
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* ================================================== */}
                    {/* REQUEST INFORMATION */}
                    {/* ================================================== */}

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4" />

                        <p className="text-sm font-semibold">
                          {request.leaveType?.name ?? request.leaveTypeId}
                        </p>

                        <Badge className={statusClass(request.status)}>
                          {statusLabel(request.status)}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {request.startDate} → {request.endDate}
                      </p>

                      <p className="text-sm">{request.totalDays} day(s)</p>

                      {request.reason && (
                        <p className="text-sm text-muted-foreground">
                          {request.reason}
                        </p>
                      )}

                      {request.approvalNote && (
                        <p className="text-sm text-muted-foreground">
                          Note: {request.approvalNote}
                        </p>
                      )}
                    </div>

                    {/* ================================================== */}
                    {/* ACTIONS */}
                    {/* ================================================== */}

                    <div className="flex flex-wrap gap-2">
                      {/* ================================================== */}
                      {/* EMPLOYEE CANCEL */}
                      {/* ================================================== */}

                      {request.status === "PENDING" && !canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionId === request.id}
                          onClick={() => handleCancel(request.id)}
                        >
                          Cancel
                        </Button>
                      )}

                      {/* ================================================== */}
                      {/* APPROVAL ACTIONS */}
                      {/* ================================================== */}

                      {canApprove && request.status === "PENDING" && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={approvalNotes[request.id] ?? ""}
                            onChange={(event) =>
                              setApprovalNotes((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))
                            }
                            placeholder="Approval note (optional)"
                            className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none"
                          />

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={actionId === request.id}
                              onClick={() => handleApprove(request.id)}
                            >
                              Approve
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionId === request.id}
                              onClick={() => handleReject(request.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
