// ============================================================================
// EEMS - Application Header
// ============================================================================

import { Menu } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { getNavigationForRole, type UserRole } from "@/routes/navigation";

import type { AuthenticatedUser } from "@/auth/auth.types";

import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  role: UserRole;
  user: AuthenticatedUser | null;
}

export function AppHeader({ role, user }: AppHeaderProps) {
  const navigation = getNavigationForRole(role);

  const displayName =
    (user?.employee?.displayName ??
      [user?.employee?.firstName, user?.employee?.lastName]
        .filter(Boolean)
        .join(" ")) ||
    user?.username ||
    "User";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* ================================================================== */}
      {/* LEFT SIDE */}
      {/* ================================================================== */}

      <div className="flex items-center gap-3">
        {/* -------------------------------------------------------------- */}
        {/* MOBILE MENU */}
        {/* -------------------------------------------------------------- */}

        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            }
          />

          <SheetContent side="left" className="w-72 p-0">
            <div className="border-b p-6">
              <div className="text-lg font-semibold">EEMS</div>

              <p className="text-sm text-muted-foreground">
                Employee Management System
              </p>
            </div>

            <nav className="space-y-1 p-4">
              {navigation.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                        "hover:bg-accent hover:text-accent-foreground",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground",
                      ].join(" ")
                    }
                  >
                    <Icon className="h-4 w-4" />

                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        {/* -------------------------------------------------------------- */}
        {/* BRAND */}
        {/* -------------------------------------------------------------- */}

        <div className="font-semibold">EEMS</div>
      </div>

      {/* ================================================================== */}
      {/* USER MENU */}
      {/* ================================================================== */}

      <UserMenu name={displayName} role={role} />
    </header>
  );
}
