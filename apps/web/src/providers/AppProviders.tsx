// ============================================================================
// EEMS - Application Providers
// ============================================================================

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Provider as ReduxProvider } from "react-redux";

import { store } from "@/auth/store";

// ============================================================================
// QUERY CLIENT
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,

      retry: 1,

      refetchOnWindowFocus: false,
    },

    mutations: {
      retry: 0,
    },
  },
});

// ============================================================================
// PROPS
// ============================================================================

interface AppProvidersProps {
  children: ReactNode;
}

// ============================================================================
// PROVIDERS
// ============================================================================

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ReduxProvider>
  );
}
