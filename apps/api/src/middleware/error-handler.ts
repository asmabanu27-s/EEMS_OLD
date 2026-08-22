// ============================================================================
// EEMS - Global Error Handler
// ============================================================================
//
// Central error handling middleware.
//
// Responsibilities:
//
// 1. Handle known application/business errors.
// 2. Return the correct HTTP status code.
// 3. Return a consistent API error response.
// 4. Prevent internal implementation details from leaking to clients.
// 5. Log unexpected errors for debugging/production monitoring.
//
// Expected response format:
//
// {
//   "success": false,
//   "error": {
//     "code": "LEAVE_OVERLAP",
//     "message": "Leave request overlaps with an existing pending or approved leave"
//   }
// }
//
// ============================================================================

import type { ErrorRequestHandler } from "express";

import { AppError } from "./app-error.js";

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // --------------------------------------------------------------------------
  // Always log the original error.
  //
  // Pino HTTP is already installed in the application, so this console log
  // can later be replaced with structured application logging if required.
  // --------------------------------------------------------------------------

  console.error("EEMS API Error:", {
    method: req.method,
    url: req.originalUrl,
    error,
  });

  // --------------------------------------------------------------------------
  // KNOWN APPLICATION ERROR
  //
  // These are expected business/application failures.
  //
  // Example:
  //   Leave overlap -> 409
  //   Employee not found -> 404
  //   Invalid input -> 400
  // --------------------------------------------------------------------------

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // --------------------------------------------------------------------------
  // UNEXPECTED ERROR
  //
  // Do NOT expose the original error message to the client.
  //
  // This prevents sensitive information such as:
  //
  // - database details
  // - filesystem paths
  // - SQL errors
  // - stack traces
  // - internal implementation details
  //
  // from being exposed in production.
  // --------------------------------------------------------------------------

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
