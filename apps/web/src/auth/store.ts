// ============================================================================
// EEMS - Redux Store
// ============================================================================

import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./auth.store";

// ============================================================================
// STORE
// ============================================================================

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

// ============================================================================
// TYPES
// ============================================================================

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
