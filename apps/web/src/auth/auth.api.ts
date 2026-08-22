// ============================================================================
// EEMS - Authentication API
// ============================================================================

import { apiClient } from "@/api/client";

import type { ApiResponse, LoginRequest, LoginResponse } from "./auth.types";

// ============================================================================
// LOGIN
// ============================================================================

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    "/auth/login",
    request,
  );

  return response.data.data;
}
