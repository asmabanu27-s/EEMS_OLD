// ============================================================================
// EEMS - Protected Route
// ============================================================================

import type { ReactNode } from "react";

import { Navigate, useLocation } from "react-router-dom";

import { useSelector } from "react-redux";

import type { RootState } from "@/auth/store";

// ============================================================================
// PROPS
// ============================================================================

interface ProtectedRouteProps {
  children: ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return <>{children}</>;
}
