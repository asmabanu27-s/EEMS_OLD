// ============================================================================
// EEMS - Frontend Entry Point
// ============================================================================

import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import { BrowserRouter } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";

import { AppProviders } from "@/providers/AppProviders";

import App from "./App";

import "./index.css";

// ============================================================================
// APPLICATION
// ============================================================================

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
