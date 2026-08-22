import { useSelector } from "react-redux";

import { Bell, Info, Shield, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PageHeader } from "@/components";

import type { RootState } from "@/auth/store";

// ============================================================================
// EEMS - Settings Page
// ============================================================================

export function SettingsPage() {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your EEMS account and application preferences."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ================================================================= */}
        {/* ACCOUNT */}
        {/* ================================================================= */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Account
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <SettingRow
              label="Username"
              value={user?.username ?? "Not available"}
            />

            <SettingRow label="Email" value={user?.email ?? "Not available"} />

            <SettingRow
              label="Account Status"
              value={user?.status ?? "Not available"}
            />
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* SECURITY */}
        {/* ================================================================= */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium">Authentication</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Your account is protected by JWT-based authentication.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* NOTIFICATIONS */}
        {/* ================================================================= */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium">Notification preferences</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Notification preference controls will be available when
                notification preference persistence is implemented.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* APPLICATION */}
        {/* ================================================================= */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Application
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium">Employee Management System</p>

              <p className="mt-1 text-sm text-muted-foreground">
                EEMS application settings and preferences.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// SETTING ROW
// ============================================================================

interface SettingRowProps {
  label: string;
  value: string;
}

function SettingRow({ label, value }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>

      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
