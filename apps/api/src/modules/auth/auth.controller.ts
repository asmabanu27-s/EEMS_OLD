// EEMS - Authentication
// Authentication HTTP Controller
// ============================================================================
//
// Endpoints handled here:
//
//   POST /api/auth/login
//
// Responsibilities:
//
// 1. Validate the HTTP request body.
// 2. Extract login credentials.
// 3. Call the authentication service.
// 4. Return a consistent API response.
//
// Business logic MUST remain inside auth.service.ts.
//
// Authentication flow:
//
//   HTTP Request
//        |
//        v
//   Controller
//        |
//        v
//   Validate Input
//        |
//        v
//   auth.service.login()
//        |
//        v
//   JWT + User
//        |
//        v
//   HTTP Response
//
// ============================================================================

import type { Request, Response } from "express";

import { AppError } from "@/middleware/app-error.js";

import { auditRequest } from "@/modules/audit/index.js";
import { AUDIT_ACTIONS } from "@/modules/audit/audit.types.js";

import { login } from "./auth.service.js";

// ============================================================================
// POST /api/auth/login
// ============================================================================
//
// Request body:
//
// {
//   "identifier": "EMP0001",
//   "password": "Admin@123"
// }
//
// `identifier` supports:
//
// - username
// - email
// - employee code
//
// Successful response:
//
// {
//   "success": true,
//   "data": {
//     "accessToken": "...",
//     "user": {
//       ...
//     }
//   }
// }
//
// ============================================================================

export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  // ==========================================================================
  // REQUEST BODY
  // ==========================================================================
  //
  // Do not trust req.body.
  //
  // Express JSON parsing ensures that the body is parsed, but it does not
  // guarantee that the expected fields exist or have the correct types.
  //
  // ==========================================================================

  const body = req.body as {
    identifier?: unknown;
    password?: unknown;
  };

  // ==========================================================================
  // VALIDATE IDENTIFIER
  // ==========================================================================

  if (
    typeof body.identifier !== "string" ||
    body.identifier.trim().length === 0
  ) {
    throw new AppError(
      "LOGIN_IDENTIFIER_REQUIRED",
      "Username, email, or employee ID is required",
      400,
    );
  }

  // ==========================================================================
  // VALIDATE PASSWORD
  // ==========================================================================

  if (typeof body.password !== "string" || body.password.length === 0) {
    throw new AppError("PASSWORD_REQUIRED", "Password is required", 400);
  }

  // ==========================================================================
  // AUTHENTICATE
  // ==========================================================================

  const result = await login({
    identifier: body.identifier.trim(),

    password: body.password,
  });

  // ==========================================================================
  // AUDIT
  // ==========================================================================
  //
  // The login audit is written only after authentication succeeds.
  // No password or token is ever stored in audit metadata.
  //
  // ==========================================================================

  await auditRequest(
    {
      userId: result.user.id,
      employeeId: result.user.employee?.id ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.LOGIN,
    "AUTH",
    {
      entityId: result.user.id,
      description: "User login successful",
      metadata: {
        identifierType: body.identifier.includes("@")
          ? "EMAIL"
          : "USERNAME_OR_EMPLOYEE_CODE",
      },
    },
  );

  // ==========================================================================
  // RESPONSE
  // ==========================================================================

  res.status(200).json({
    success: true,

    data: result,
  });
}
