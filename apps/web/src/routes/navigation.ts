import {
  CalendarCheck,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
  BarChart3,
} from "lucide-react";

export type UserRole = "ADMIN" | "MANAGER" | "TEAM_LEAD" | "EMPLOYEE";

export interface NavigationItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

export const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD", "EMPLOYEE"],
  },

  {
    label: "Employees",
    path: "/employees",
    icon: Users,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD"],
  },

  {
    label: "Attendance",
    path: "/attendance",
    icon: CalendarCheck,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD", "EMPLOYEE"],
  },

  {
    label: "Leave",
    path: "/leave",
    icon: ClipboardList,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD", "EMPLOYEE"],
  },

  {
    label: "Documents",
    path: "/documents",
    icon: FileText,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD", "EMPLOYEE"],
  },

  {
    label: "Timesheets",
    path: "/timesheets",
    icon: ClipboardList,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD", "EMPLOYEE"],
  },

  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER", "TEAM_LEAD"],
  },

  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

export function getNavigationForRole(role: UserRole): NavigationItem[] {
  return navigationItems.filter((item) => item.roles.includes(role));
}
