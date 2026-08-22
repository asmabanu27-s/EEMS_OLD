// ============================================================================
// EEMS API - Health Routes
// ============================================================================
//
// Base path:
//
//   /api/health
//
// Endpoints:
//
//   GET /api/health
//       Liveness.
//
//   GET /api/health/ready
//       Readiness + database connectivity.
//
// These endpoints are intentionally public so infrastructure monitoring,
// load balancers and container orchestration can check application health
// without requiring a JWT.
// ============================================================================

import { Router } from "express";

import {
  healthCheck,
  readinessCheck,
} from "@/controllers/health.controller.js";

// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// ============================================================================
// LIVENESS
// ============================================================================
//
// GET /api/health
//
// Does not access the database.
// ============================================================================

router.get("/", healthCheck);

// ============================================================================
// READINESS
// ============================================================================
//
// GET /api/health/ready
//
// Verifies PostgreSQL connectivity.
// ============================================================================

router.get("/ready", readinessCheck);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
