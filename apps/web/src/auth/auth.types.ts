// ============================================================================
// EEMS - Frontend Authentication Types
// ============================================================================

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TERMINATED";

export type UserRole = "ADMIN" | "MANAGER" | "TEAM_LEAD" | "EMPLOYEE";

export interface AuthenticatedEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  displayName: string | null;
}

export interface AuthenticatedRole {
  code: UserRole;
  name: string;
  permissions: string[];
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  status: UserStatus;

  employee: AuthenticatedEmployee | null;

  role: AuthenticatedRole;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
