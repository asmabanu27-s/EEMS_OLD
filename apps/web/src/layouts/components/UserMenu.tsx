import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";

import type { UserRole } from "@/routes/navigation";

import { logout } from "@/auth/auth.store";

interface UserMenuProps {
  name: string;
  role: UserRole;
}

export function UserMenu({ name, role }: UserMenuProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  function handleProfile() {
    navigate("/profile");
  }

  function handleLogout() {
    dispatch(logout());

    window.location.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium">{name}</p>

              <p className="text-xs text-muted-foreground">
                {role.replace("_", " ")}
              </p>
            </div>
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-2">
          <p className="text-sm font-medium">{name}</p>

          <p className="text-xs text-muted-foreground">
            Role: {role.replace("_", " ")}
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleProfile}>Profile</DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate("/settings")}>
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
