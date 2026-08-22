// ============================================================================
// EEMS - API Client
// ============================================================================
//
// Central Axios client for the entire frontend.
//
// Responsibilities:
//
// 1. Central API base URL.
// 2. Attach JWT automatically.
// 3. Handle authentication expiration.
// 4. Keep API configuration in one place.
//
// ============================================================================

import axios from "axios";

import { clearAuthStorage, getAccessToken } from "@/auth/auth.storage";

// ============================================================================
// API BASE URL
// ============================================================================
//
// Vite exposes client-side environment variables through VITE_*.
//
// Development default:
//     http://localhost:4000/api
//
// Production:
//     Configure VITE_API_BASE_URL.
//
// ============================================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

// ============================================================================
// AXIOS INSTANCE
// ============================================================================

export const apiClient = axios.create({
  baseURL: API_BASE_URL,

  headers: {
    "Content-Type": "application/json",
  },

  timeout: 30_000,
});

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================
//
// Automatically attaches:
//
//     Authorization: Bearer <JWT>
//
// to authenticated requests.
//
// ============================================================================

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// ============================================================================
// RESPONSE INTERCEPTOR
// ============================================================================
//
// A 401 means the current authentication is no longer valid.
//
// Clear local authentication state and redirect to login.
//
// ============================================================================

apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      clearAuthStorage();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);
