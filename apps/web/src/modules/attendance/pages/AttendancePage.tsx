import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
} from "lucide-react";

import { WorkingTimer } from "@/modules/attendance/components/WorkingTimer";

import {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getTodayAttendance,
  type AttendanceRecord,
  type TodayAttendance,
} from "@/modules/attendance/api/attendance.api";

import { PageHeader, StatCard } from "@/components";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

// ============================================================================
// HELPERS
// ============================================================================

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remaining = safeMinutes % 60;

  if (hours === 0) {
    return `${remaining}m`;
  }

  return `${hours}h ${String(remaining).padStart(2, "0")}m`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function statusLabel(status: string): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ============================================================================
// PAGE
// ============================================================================

export function AttendancePage() {
  const [today, setToday] = useState<TodayAttendance | null>(null);

  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState<
    "check-in" | "check-out" | null
  >(null);

  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // LOAD
  // ==========================================================================

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [todayResult, historyResult] = await Promise.all([
        getTodayAttendance(),
        getAttendanceHistory(),
      ]);

      setToday(todayResult);

      setHistory(historyResult.records);
    } catch (err) {
      console.error("Failed to load attendance", err);

      setError("Unable to load attendance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  // ==========================================================================
  // CHECK IN
  // ==========================================================================

  async function handleCheckIn() {
    try {
      setActionLoading("check-in");

      setError(null);

      await checkIn();

      // Always reload from the server after a mutation.
      await loadAttendance();
    } catch (error) {
      console.error("Check-in failed", error);

      const message =
        (
          error as {
            response?: {
              data?: {
                error?: {
                  message?: string;
                };
              };
            };
          }
        ).response?.data?.error?.message ??
        "Unable to check in. Please try again.";

      setError(message);

      // Refresh current state even after a failed mutation,
      // because the server remains the source of truth.
      try {
        await loadAttendance();
      } catch {
        // Preserve the original error message.
      }
    } finally {
      setActionLoading(null);
    }
  }

  // ==========================================================================
  // CHECK OUT
  // ==========================================================================

  async function handleCheckOut() {
    try {
      setActionLoading("check-out");

      setError(null);

      await checkOut();

      // The checkout API updates the database first.
      // Reload the complete server state immediately afterward.
      await loadAttendance();
    } catch (error) {
      console.error("Check-out failed", error);

      const message =
        (
          error as {
            response?: {
              data?: {
                error?: {
                  message?: string;
                };
              };
            };
          }
        ).response?.data?.error?.message ??
        "Unable to check out. Please try again.";

      setError(message);

      try {
        await loadAttendance();
      } catch {
        // Preserve the original error message.
      }
    } finally {
      setActionLoading(null);
    }
  }

  // ==========================================================================
  // VALUES
  // ==========================================================================

  const workingHours = useMemo(
    () => formatMinutes(today?.workingMinutes ?? 0),
    [today],
  );

  const sessions = today?.sessions ?? [];

  const completedTodayMinutes = useMemo(() => {
  return sessions
    .filter(
      (session) =>
        session.status === "COMPLETED" ||
        session.status === "AUTO_COMPLETED",
    )
    .reduce(
      (total, session) =>
        total + Math.max(0, session.workingMinutes),
      0,
    );
}, [sessions]);

  // --------------------------------------------------------------------------
  // Active session
  // --------------------------------------------------------------------------

  const openSession = sessions.find(
    (session) => session.status === "OPEN" && Boolean(session.checkInAt),
  );

  const hasActiveSession = Boolean(openSession);

  const canCheckIn = !hasActiveSession;

  const canCheckOut = hasActiveSession;

  // --------------------------------------------------------------------------
  // Latest completed session
  // --------------------------------------------------------------------------
  //
  // After checkout there is no OPEN session anymore.
  // The latest completed session is therefore used by WorkingTimer so the
  // circular timer displays the actual completed duration instead of 00:00:00.
  //
  // --------------------------------------------------------------------------

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Manage your daily attendance and view attendance history."
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ================================================================== */}
      {/* SUMMARY */}
      {/* ================================================================== */}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Today's Status"
          value={loading ? "..." : statusLabel(today?.status ?? "NOT_MARKED")}
          description="Current attendance status"
          icon={<CalendarCheck className="h-4 w-4" />}
        />

        <StatCard
          title="Working Hours"
          value={loading ? "..." : workingHours}
          description="Today's working time"
          icon={<Clock className="h-4 w-4" />}
        />

        <StatCard
          title="Sessions"
          value={loading ? "..." : String(sessions.length)}
          description="Attendance sessions today"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* ================================================================== */}
      {/* ACTIONS */}
      {/* ================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
        </CardHeader>

        <CardContent>
          <WorkingTimer
  checkInAt={openSession?.checkInAt ?? null}
  isRunning={Boolean(openSession)}
  todayWorkedMinutes={completedTodayMinutes}
/>

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={handleCheckIn}
              disabled={loading || actionLoading !== null || !canCheckIn}
            >
              <LogIn className="mr-2 h-4 w-4" />

              {actionLoading === "check-in" ? "Checking in..." : "Check In"}
            </Button>

            <Button
              variant="outline"
              onClick={handleCheckOut}
              disabled={loading || actionLoading !== null || !canCheckOut}
            >
              <LogOut className="mr-2 h-4 w-4" />

              {actionLoading === "check-out" ? "Checking out..." : "Check Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* TODAY'S SESSIONS */}
      {/* ================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Today's Sessions</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No attendance session has been recorded today.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Session</p>

                      <p className="text-xs text-muted-foreground">
                        Check in: {formatDateTime(session.checkInAt)}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Check out: {formatDateTime(session.checkOutAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <Badge>{statusLabel(session.status)}</Badge>

                      <p className="mt-1 text-sm font-medium">
                        {formatMinutes(session.workingMinutes)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* HISTORY */}
      {/* ================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>

        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No attendance records found.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {record.attendanceDate ?? "-"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {record.employeeCode ??
                        record.employeeName ??
                        "Attendance"}
                    </p>
                  </div>

                  <div className="text-right">
                    <Badge>{statusLabel(record.status)}</Badge>

                    <p className="mt-1 text-sm">
                      {formatMinutes(record.workingMinutes)}
                    </p>
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
