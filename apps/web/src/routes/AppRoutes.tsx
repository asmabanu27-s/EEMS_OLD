import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/layouts/AppLayout";

import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { ProfilePage } from "@/modules/profile/pages/ProfilePage";
import { SettingsPage } from "@/modules/settings/pages/SettingsPage";
import { AttendancePage } from "@/modules/attendance/pages/AttendancePage";
import { LeavePage } from "@/modules/leave/pages/LeavePage";
import { TimesheetPage } from "@/modules/timesheet/pages/TimesheetPage";
import { ProtectedRoute } from "./ProtectedRoute";

// ============================================================================
// EEMS - Application Routes
// ============================================================================

export function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}

      <Route path="/login" element={<LoginPage />} />

      {/* DASHBOARD */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* PROFILE */}

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* SETTINGS */}

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* ATTENDANCE */}

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AttendancePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/leave"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LeavePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/timesheets"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TimesheetPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* DEFAULT */}

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* UNKNOWN */}

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
