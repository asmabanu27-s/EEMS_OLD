// ============================================================================
// EEMS - Authentication Middleware
// JWT Authentication
// ============================================================================
//
// Responsibilities:
//
// 1. Read the Authorization header.
// 2. Validate Bearer token format.
// 3. Verify JWT signature.
// 4. Validate JWT payload.
// 5. Attach authenticated user information to req.user.
// 6. Reject unauthenticated requests with 401.
//
// Expected header:
//
// Authorization: Bearer <JWT>
//
// ============================================================================

import type { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

import type { JwtPayload } from "@/modules/auth/auth.types.js";

import { AppError } from "./app-error.js";

// ============================================================================
// JWT CONFIGURATION
// ============================================================================

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";

if (JWT_SECRET.length === 0) {
  throw new Error("JWT_SECRET is not configured");
}

// ============================================================================
// EXPRESS REQUEST TYPE EXTENSION
// ============================================================================
//
// We attach the authenticated JWT payload to:
//
//     req.user
//
// This allows controllers and authorization middleware to access the
// authenticated user's identity.
//
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // ==========================================================================
  // READ AUTHORIZATION HEADER
  // ==========================================================================

  const authorization = req.headers.authorization;

  // --------------------------------------------------------------------------
  // Missing Authorization header.
  // --------------------------------------------------------------------------

  if (!authorization) {
    next(
      new AppError(
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
        401,
      ),
    );

    return;
  }

  // ==========================================================================
  // VALIDATE BEARER FORMAT
  // ==========================================================================
  //
  // Expected:
  //
  // Bearer eyJhbGciOi...
  //
  // ==========================================================================

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    next(
      new AppError(
        "INVALID_AUTHORIZATION_HEADER",
        "Authorization header must use Bearer token format",
        401,
      ),
    );

    return;
  }

  // ==========================================================================
  // VERIFY JWT
  // ==========================================================================

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // ------------------------------------------------------------------------
    // jwt.verify() can return a string or Jwt payload.
    // ------------------------------------------------------------------------

    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("INVALID_TOKEN", "Invalid authentication token", 401);
    }

    // ------------------------------------------------------------------------
    // Validate required application claims.
    // ------------------------------------------------------------------------

    const sub = typeof decoded.sub === "string" ? decoded.sub : undefined;

    const role = typeof decoded.role === "string" ? decoded.role : undefined;

    // employeeId is allowed to be null.
    const employeeId =
      decoded.employeeId === null || typeof decoded.employeeId === "string"
        ? decoded.employeeId
        : undefined;

    if (!sub || !role) {
      throw new AppError(
        "INVALID_TOKEN",
        "Authentication token is missing required claims",
        401,
      );
    }

    // ------------------------------------------------------------------------
    // Build application JWT payload.
    // ------------------------------------------------------------------------

    const payload: JwtPayload = {
      sub,

      employeeId: employeeId ?? null,

      role: role as JwtPayload["role"],
    };

    // ------------------------------------------------------------------------
    // Attach authenticated user to request.
    // ------------------------------------------------------------------------

    req.user = payload;

    // ------------------------------------------------------------------------
    // Continue request processing.
    // ------------------------------------------------------------------------

    next();
  } catch (error) {
    // ------------------------------------------------------------------------
    // Preserve our own AppError.
    // ------------------------------------------------------------------------

    if (error instanceof AppError) {
      next(error);
      return;
    }

    // ------------------------------------------------------------------------
    // JWT verification failures.
    //
    // Includes:
    //
    // - expired token
    // - invalid signature
    // - malformed token
    // ------------------------------------------------------------------------

    next(
      new AppError(
        "INVALID_TOKEN",
        "Invalid or expired authentication token",
        401,
      ),
    );
  }
}
