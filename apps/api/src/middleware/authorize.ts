// ============================================================================
// EEMS - Authorization Middleware
// Role-Based Access Control (RBAC)
// ============================================================================
//
// Responsibilities:
//
// 1. Confirm the request has already been authenticated.
// 2. Load the user's current permissions from the database.
// 3. Verify that the user has the required permission.
// 4. Reject unauthorized requests with HTTP 403.
//
// IMPORTANT:
//
// Authentication and authorization are separate:
//
//   authenticate()
//       |
//       | Valid JWT?
//       v
//   authorize("EMPLOYEE_VIEW")
//       |
//       | Has permission?
//       v
//   Controller
//
// We deliberately load permissions from PostgreSQL rather than trusting a
// permission list supplied by the client.
//
// ============================================================================

import type { NextFunction, Request, Response } from "express";

import { prisma } from "@/lib/prisma.js";
import { AppError } from "./app-error.js";

// ============================================================================
// AUTHORIZE
// ============================================================================
//
// Usage:
//
// router.get(
//   "/",
//   authenticate,
//   authorize("EMPLOYEE_VIEW"),
//   getEmployees,
// );
//
// Multiple permissions can also be supplied:
//
// authorize(
//   "EMPLOYEE_VIEW",
//   "EMPLOYEE_UPDATE",
// )
//
// By default, the user must have ALL supplied permissions.
//
// ============================================================================

export function authorize(...requiredPermissions: string[]) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // ======================================================================
      // AUTHENTICATION CHECK
      // ======================================================================
      //
      // authorize() must always run AFTER authenticate().
      //
      // ======================================================================

      if (!req.user) {
        next(
          new AppError(
            "AUTHENTICATION_REQUIRED",
            "Authentication is required",
            401,
          ),
        );

        return;
      }

      // ======================================================================
      // VALIDATE PERMISSION CONFIGURATION
      // ======================================================================

      if (requiredPermissions.length === 0) {
        next(
          new AppError(
            "AUTHORIZATION_CONFIGURATION_ERROR",
            "No authorization permission was configured for this route",
            500,
          ),
        );

        return;
      }

      // ======================================================================
      // LOAD CURRENT USER
      // ======================================================================
      //
      // We query the database using the authenticated User ID.
      //
      // This means permissions can be changed by an administrator without
      // having to issue a new token.
      //
      // ======================================================================

      const user = await prisma.user.findUnique({
        where: {
          id: req.user.sub,
        },

        select: {
          id: true,

          status: true,

          role: {
            select: {
              code: true,

              permissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // ======================================================================
      // USER NO LONGER EXISTS
      // ======================================================================

      if (!user) {
        next(
          new AppError(
            "USER_NOT_FOUND",
            "Authenticated user no longer exists",
            401,
          ),
        );

        return;
      }

      // ======================================================================
      // USER ACCOUNT STATUS
      // ======================================================================
      //
      // A previously issued JWT should not allow access after an administrator
      // deactivates or locks the account.
      //
      // ======================================================================

      if (user.status === "LOCKED") {
        next(new AppError("ACCOUNT_LOCKED", "User account is locked", 403));

        return;
      }

      if (user.status === "INACTIVE") {
        next(new AppError("ACCOUNT_INACTIVE", "User account is inactive", 403));

        return;
      }

      // ======================================================================
      // EXTRACT PERMISSIONS
      // ======================================================================

      const userPermissions = new Set(
        user.role.permissions.map(
          (rolePermission) => rolePermission.permission.code,
        ),
      );

      // ======================================================================
      // CHECK REQUIRED PERMISSIONS
      // ======================================================================
      //
      // ALL required permissions must be present.
      //
      // Example:
      //
      // authorize(
      //   "EMPLOYEE_VIEW",
      //   "EMPLOYEE_UPDATE",
      // )
      //
      // requires both permissions.
      //
      // ======================================================================

      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.has(permission),
      );

      // ======================================================================
      // ACCESS DENIED
      // ======================================================================

      if (missingPermissions.length > 0) {
        next(
          new AppError(
            "FORBIDDEN",
            "You do not have permission to perform this action",
            403,
          ),
        );

        return;
      }

      // ======================================================================
      // AUTHORIZATION SUCCESSFUL
      // ======================================================================

      next();
    } catch (error) {
      // ----------------------------------------------------------------------
      // Pass unexpected database/application errors to the global handler.
      // ----------------------------------------------------------------------

      next(error);
    }
  };
}
