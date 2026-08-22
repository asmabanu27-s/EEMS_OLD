// ============================================================================
// EEMS - Authentication Storage
// ============================================================================
//
// Stores only the JWT and safe authenticated-user information.
//
// IMPORTANT:
// The backend remains the authority for authentication and authorization.
//
// ============================================================================

import type { AuthenticatedUser } from "./auth.types";

const ACCESS_TOKEN_KEY = "eems.accessToken";
const USER_KEY = "eems.user";

// ============================================================================
// ACCESS TOKEN
// ============================================================================

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function removeAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// ============================================================================
// USER
// ============================================================================

export function getStoredUser(): AuthenticatedUser | null {
  const value = localStorage.getItem(USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthenticatedUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: AuthenticatedUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

// ============================================================================
// CLEAR AUTHENTICATION
// ============================================================================

export function clearAuthStorage(): void {
  removeAccessToken();
  removeStoredUser();
}
