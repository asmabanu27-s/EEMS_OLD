// ============================================================================
// EEMS - Application Layout
// ============================================================================

import type { ReactNode } from "react";
import { useSelector } from "react-redux";

import type { RootState } from "@/auth/store";
import type { UserRole } from "@/auth/auth.types";

import { AppHeader } from "./components/AppHeader";
import { AppSidebar } from "./components/AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const user = useSelector((state: RootState) => state.auth.user);

  // --------------------------------------------------------------------------
  // Determine role from the authenticated user.
  //
  // ADMIN is used only as a fallback while the authentication state is
  // unavailable. Normal authenticated users will always use their real role.
  // --------------------------------------------------------------------------

  const role: UserRole = user?.role.code ?? "EMPLOYEE";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader role={role} user={user} />

      <div className="flex">
        <AppSidebar role={role} />

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
