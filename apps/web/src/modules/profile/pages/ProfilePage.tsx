import { useSelector } from "react-redux";

import { Mail, Shield, User, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PageHeader } from "@/components";

import type { RootState } from "@/auth/store";

// ============================================================================
// EEMS - Profile Page
// ============================================================================

export function ProfilePage() {
  const user = useSelector((state: RootState) => state.auth.user);

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profile"
          description="View your account and employee information."
        />

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              User information is not available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employee = user.employee;

  const displayName =
    (employee?.displayName ??
      [employee?.firstName, employee?.lastName].filter(Boolean).join(" ")) ||
    user.username;

  const roleName = user.role.name || user.role.code.replace("_", " ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View your account and employee information."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ================================================================= */}
        {/* PERSONAL INFORMATION */}
        {/* ================================================================= */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <ProfileRow
              icon={<User className="h-4 w-4" />}
              label="Name"
              value={displayName}
            />

            <ProfileRow
              icon={<User className="h-4 w-4" />}
              label="Username"
              value={user.username}
            />

            <ProfileRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={user.email}
            />

            <ProfileRow
              icon={<Shield className="h-4 w-4" />}
              label="Role"
              value={roleName}
            />
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* EMPLOYEE INFORMATION */}
        {/* ================================================================= */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Employee Information
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <ProfileRow
              icon={<User className="h-4 w-4" />}
              label="Employee ID"
              value={employee?.id ?? "Not available"}
            />

            <ProfileRow
              icon={<User className="h-4 w-4" />}
              label="Employee Code"
              value={employee?.employeeCode ?? "Not available"}
            />

            <ProfileRow
              icon={<Shield className="h-4 w-4" />}
              label="Account Status"
              value={user.status}
            />

            <ProfileRow
              icon={<Shield className="h-4 w-4" />}
              label="Role Code"
              value={user.role.code}
            />
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* PERMISSIONS */}
        {/* ================================================================= */}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
          </CardHeader>

          <CardContent>
            {user.role.permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No permissions assigned.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-md border bg-muted px-2.5 py-1 text-xs font-medium"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE ROW
// ============================================================================

interface ProfileRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ProfileRow({ icon, label, value }: ProfileRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2">{icon}</div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>

        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
