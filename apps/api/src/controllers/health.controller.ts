// ============================================================================
// EEMS API - Health Controllers
// ============================================================================
//
// Health endpoints:
//
//   GET /api/health
//       Liveness check.
//
//   GET /api/health/ready
//       Readiness check.
//
// LIVENESS
// ---------
// Confirms that the API process is running and responding.
//
// READINESS
// ---------
// Confirms that required infrastructure, currently PostgreSQL, is reachable.
//
// IMPORTANT:
// Health endpoints do not expose database credentials, connection strings,
// internal errors, or other sensitive configuration.
// ============================================================================

import type { RequestHandler } from "express";

import { env } from "@/config/env.js";
import { prisma } from "@/lib/prisma.js";

// ============================================================================
// LIVENESS
// ============================================================================
//
// GET /api/health
//
// This endpoint intentionally does NOT query the database.
//
// A container/orchestrator can use this endpoint to determine whether the
// application process itself is alive.
// ============================================================================

export const healthCheck: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,

    data: {
      status: "ok",

      service: "eems-api",

      environment: env.NODE_ENV,

      timestamp: new Date().toISOString(),
    },
  });
};

// ============================================================================
// READINESS
// ============================================================================
//
// GET /api/health/ready
//
// PostgreSQL connectivity is checked using Prisma.
//
// HTTP status:
//
//   200 -> application is ready
//   503 -> application is not ready
//
// ============================================================================

export const readinessCheck: RequestHandler = async (_req, res) => {
  try {
    // ----------------------------------------------------------------------
    // Verify database connectivity.
    // ----------------------------------------------------------------------

    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,

      data: {
        status: "ready",

        service: "eems-api",

        environment: env.NODE_ENV,

        dependencies: {
          database: "ok",
        },

        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // ----------------------------------------------------------------------
    // Do not expose the underlying database error to the client.
    // ----------------------------------------------------------------------

    return res.status(503).json({
      success: false,

      error: {
        code: "SERVICE_NOT_READY",

        message: "EEMS API is not ready",
      },

      data: {
        status: "not_ready",

        service: "eems-api",

        environment: env.NODE_ENV,

        dependencies: {
          database: "unavailable",
        },

        timestamp: new Date().toISOString(),
      },
    });
  }
};
