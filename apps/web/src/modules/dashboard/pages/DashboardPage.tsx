// ============================================================================
// EEMS - Dashboard
// ============================================================================

import { useEffect, useMemo, useState } from "react";

import { CalendarCheck, Clock, FolderKanban, Users } from "lucide-react";

import { useSelector } from "react-redux";

import { PageHeader, StatCard } from "@/components";

import {
  getReportSummary,
  getTodayAttendance,
  type AttendanceRecord,
  type ReportSummary,
} from "@/api/dashboard.api";

import type { RootState } from "@/auth/store";

// ============================================================================
// COMPONENT
// ============================================================================

export function DashboardPage() {
  // ==========================================================================
  // AUTHENTICATED USER
  // ==========================================================================

  const user = useSelector((state: RootState) => state.auth.user);

  const permissions = user?.role.permissions ?? [];

  const canViewReports = permissions.includes("REPORT_VIEW");

  // ==========================================================================
  // STATE
  // ==========================================================================

  const [summary, setSummary] = useState<ReportSummary | null>(null);

  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceRecord | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // LOAD DASHBOARD
  // ==========================================================================

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        // --------------------------------------------------------------------
        // Attendance is available to the employee.
        // --------------------------------------------------------------------

        const attendancePromise = getTodayAttendance();

        // --------------------------------------------------------------------
        // Report summary is requested ONLY when the authenticated user
        // actually has REPORT_VIEW.
        // --------------------------------------------------------------------

        const summaryPromise = canViewReports
          ? getReportSummary()
          : Promise.resolve(null);

        const [attendanceResult, summaryResult] = await Promise.all([
          attendancePromise,
          summaryPromise,
        ]);

        if (!mounted) {
          return;
        }

        setTodayAttendance(attendanceResult);

        setSummary(summaryResult);
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error("Failed to load dashboard", err);

        setError("Unable to load dashboard data. Please try again.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [canViewReports]);

  // ==========================================================================
  // WORKING HOURS
  // ==========================================================================

  const workingHours = useMemo(() => {
    if (!todayAttendance) {
      return "0h";
    }

    const minutes = todayAttendance.workingMinutes ?? 0;

    const hours = Math.floor(minutes / 60);

    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }, [todayAttendance]);

  // ==========================================================================
  // EMPLOYEE ATTENDANCE STATUS
  // ==========================================================================

  const attendanceStatus = todayAttendance?.status ?? "NOT MARKED";

  // ==========================================================================
  // ORGANIZATION DATA
  // ==========================================================================

  const employees = summary?.employees.total ?? 0;

  const activeProjects = summary?.projects.active ?? 0;

  const pendingLeaves = summary?.leave.pending ?? 0;

  const submittedTimesheets = summary?.timesheets.submitted ?? 0;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          canViewReports
            ? "Overview of employee activity and organizational data."
            : "Overview of your attendance and employee activity."
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ================================================================== */}
      {/* ADMIN / MANAGER / TEAM LEAD */}
      {/* ================================================================== */}

      {canViewReports ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Employees"
            value={loading ? "..." : String(employees)}
            description="Total employees"
            icon={<Users className="h-4 w-4" />}
          />

          <StatCard
            title="My Attendance"
            value={loading ? "..." : attendanceStatus}
            description="Today's attendance status"
            icon={<CalendarCheck className="h-4 w-4" />}
          />

          <StatCard
            title="Working Hours"
            value={loading ? "..." : workingHours}
            description="Today's working time"
            icon={<Clock className="h-4 w-4" />}
          />

          <StatCard
            title="Pending Leave"
            value={loading ? "..." : String(pendingLeaves)}
            description="Leave requests awaiting approval"
            icon={<CalendarCheck className="h-4 w-4" />}
          />

          <StatCard
            title="Submitted Timesheets"
            value={loading ? "..." : String(submittedTimesheets)}
            description="Timesheets awaiting processing"
            icon={<Clock className="h-4 w-4" />}
          />

          <StatCard
            title="Active Projects"
            value={loading ? "..." : String(activeProjects)}
            description="Currently active projects"
            icon={<FolderKanban className="h-4 w-4" />}
          />
        </div>
      ) : (
        /* ================================================================== */
        /* EMPLOYEE */
        /* ================================================================== */

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Attendance"
            value={loading ? "..." : attendanceStatus}
            description="Today's attendance status"
            icon={<CalendarCheck className="h-4 w-4" />}
          />

          <StatCard
            title="Working Hours"
            value={loading ? "..." : workingHours}
            description="Today's working time"
            icon={<Clock className="h-4 w-4" />}
          />

          <StatCard
            title="Employee"
            value={user?.employee?.employeeCode ?? user?.username ?? "-"}
            description="Your employee ID"
            icon={<Users className="h-4 w-4" />}
          />
        </div>
      )}
    </div>
  );
}
