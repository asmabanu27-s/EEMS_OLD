// ============================================================================
// EEMS - Authentication
// Authentication Types
// ============================================================================

import type { RoleCode, UserStatus } from "@/generated/prisma/enums.js";

// ============================================================================
// LOGIN INPUT
// ============================================================================

/**
 * Credentials accepted by the login endpoint.
 *
 * The user can log in using:
 *
 * - username
 * - email
 * - employee code
 */
export interface LoginInput {
  identifier: string;
  password: string;
}

// ============================================================================
// JWT PAYLOAD
// ============================================================================

/**
 * Data stored inside the JWT.
 *
 * `sub` is the authenticated User ID.
 */
export interface JwtPayload {
  sub: string;
  employeeId: string | null;
  role: RoleCode;
}

// ============================================================================
// AUTHENTICATED USER
// ============================================================================

/**
 * Safe user information returned after successful authentication.
 *
 * Password hashes must NEVER be returned to the client.
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  status: UserStatus;

  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
    displayName: string | null;
  } | null;

  role: {
    code: RoleCode;
    name: string;
    permissions: string[];
  };
}

// ============================================================================
// LOGIN RESPONSE
// ============================================================================

export interface LoginResult {
  accessToken: string;
  user: AuthenticatedUser;
}
