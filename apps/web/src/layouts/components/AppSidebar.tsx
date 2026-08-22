import { NavLink } from "react-router-dom";

import { getNavigationForRole, type UserRole } from "@/routes/navigation";

import { cn } from "@/lib/utils";

interface AppSidebarProps {
  role: UserRole;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const navigation = getNavigationForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
      <div className="sticky top-0 flex h-[calc(100vh-4rem)] flex-col">
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />

                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
