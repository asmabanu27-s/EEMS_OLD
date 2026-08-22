// ============================================================================
// EEMS - Authentication Store
// ============================================================================
//
// Redux Toolkit authentication state.
//
// ============================================================================

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AuthenticatedUser } from "./auth.types";

import {
  clearAuthStorage,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser,
} from "./auth.storage";

// ============================================================================
// STATE
// ============================================================================

interface AuthState {
  accessToken: string | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}

const initialToken = getAccessToken();

const initialUser = getStoredUser();

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AuthState = {
  accessToken: initialToken,

  user: initialUser,

  isAuthenticated: Boolean(initialToken && initialUser),
};

// ============================================================================
// SLICE
// ============================================================================

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    // ----------------------------------------------------------------------
    // LOGIN SUCCESS
    // ----------------------------------------------------------------------

    setCredentials: (
      state,
      action: PayloadAction<{
        accessToken: string;
        user: AuthenticatedUser;
      }>,
    ) => {
      const { accessToken, user } = action.payload;

      state.accessToken = accessToken;

      state.user = user;

      state.isAuthenticated = true;

      setAccessToken(accessToken);

      setStoredUser(user);
    },

    // ----------------------------------------------------------------------
    // LOGOUT
    // ----------------------------------------------------------------------

    logout: (state) => {
      state.accessToken = null;

      state.user = null;

      state.isAuthenticated = false;

      clearAuthStorage();
    },
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const { setCredentials, logout } = authSlice.actions;

export default authSlice.reducer;
