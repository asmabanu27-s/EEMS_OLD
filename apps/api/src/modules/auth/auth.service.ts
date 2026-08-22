// ============================================================================
// EEMS - Authentication
// Authentication Service
// ============================================================================
//
// Responsibilities:
//
// 1. Authenticate using username, email, or employee code.
// 2. Verify password using bcrypt.
// 3. Validate user account status.
// 4. Validate employee status.
// 5. Load employee information.
// 6. Load role and permissions.
// 7. Generate JWT access token.
// 8. Update lastLoginAt.
// 9. Never expose passwordHash.
// 10. Return a safe authenticated-user object.
//
// Authentication flow:
//
//   identifier + password
//          |
//          v
//      Find User
//          |
//          v
//     Check User Status
//          |
//          v
//   Check Employee Status
//          |
//          v
//   Verify Password
//          |
//          v
//    Load Permissions
//          |
//          v
//     Generate JWT
//          |
//          v
//     Update Login Time
//          |
//          v
//      Return Token
//
// ============================================================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { EmployeeStatus, UserStatus } from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";
import { AppError } from "@/middleware/app-error.js";

import type {
  AuthenticatedUser,
  JwtPayload,
  LoginInput,
  LoginResult,
} from "./auth.types.js";

// ============================================================================
// JWT CONFIGURATION
// ============================================================================
//
// JWT_SECRET is mandatory.
//
// IMPORTANT:
// Never hard-code the production JWT secret.
//
// Development .env:
//
// JWT_SECRET=your-development-secret
//
// ============================================================================

// ============================================================================
// JWT CONFIGURATION
// ============================================================================

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";

if (JWT_SECRET.length === 0) {
  throw new Error("JWT_SECRET is not configured");
}

// ============================================================================
// JWT EXPIRATION
// ============================================================================
//
// Token lifetime:
//
// 8 hours = 8 × 60 × 60 = 28800 seconds
//
// We intentionally use a numeric value here because the installed
// jsonwebtoken type definitions expose StringValue in a way that conflicts
// with exactOptionalPropertyTypes when a normal environment string is used.
//
// This can later be moved into the central environment configuration.
// ============================================================================

const JWT_EXPIRES_IN_SECONDS = 8 * 60 * 60;

// ============================================================================
// LOGIN
// ============================================================================
//
// Supports login using:
//
// - username
// - email
// - employee code
//
// Example:
//
// {
//   "identifier": "EMP0001",
//   "password": "Admin@123"
// }
//
// ============================================================================

export async function login(input: LoginInput): Promise<LoginResult> {
  // --------------------------------------------------------------------------
  // Normalize identifier.
  // --------------------------------------------------------------------------

  const identifier = input.identifier?.trim() ?? "";

  // --------------------------------------------------------------------------
  // Validate identifier.
  // --------------------------------------------------------------------------

  if (!identifier) {
    throw new AppError(
      "LOGIN_IDENTIFIER_REQUIRED",
      "Username, email, or employee ID is required",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Validate password.
  // --------------------------------------------------------------------------

  if (!input.password) {
    throw new AppError("PASSWORD_REQUIRED", "Password is required", 400);
  }

  // ==========================================================================
  // FIND USER
  // ==========================================================================
  //
  // Supported login identifiers:
  //
  // 1. username
  // 2. email
  // 3. employeeCode
  //
  // employeeCode belongs to Employee, so Prisma relation filtering is used.
  //
  // ==========================================================================

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          username: identifier,
        },

        {
          email: identifier,
        },

        {
          employee: {
            employeeCode: identifier,
          },
        },
      ],
    },

    // ----------------------------------------------------------------------
    // Load only the information required for authentication.
    // ----------------------------------------------------------------------

    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          status: true,
        },
      },

      role: {
        include: {
          permissions: {
            include: {
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

  // ==========================================================================
  // USER NOT FOUND
  // ==========================================================================
  //
  // Do not reveal whether the username, email, or employee code exists.
  //
  // This prevents account enumeration.
  //
  // ==========================================================================

  if (!user) {
    throw new AppError(
      "INVALID_CREDENTIALS",
      "Invalid username, email, employee ID, or password",
      401,
    );
  }

  // ==========================================================================
  // USER STATUS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // Locked account.
  // --------------------------------------------------------------------------

  if (user.status === UserStatus.LOCKED) {
    throw new AppError("ACCOUNT_LOCKED", "User account is locked", 403);
  }

  // --------------------------------------------------------------------------
  // Inactive account.
  // --------------------------------------------------------------------------

  if (user.status === UserStatus.INACTIVE) {
    throw new AppError("ACCOUNT_INACTIVE", "User account is inactive", 403);
  }

  // ==========================================================================
  // EMPLOYEE STATUS
  // ==========================================================================
  //
  // employeeId is optional in the current User model.
  //
  // If a User is linked to an Employee, that employee must be ACTIVE.
  //
  // ==========================================================================

  if (user.employee && user.employee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError(
      "EMPLOYEE_NOT_ACTIVE",
      "Employee account is not active",
      403,
    );
  }

  // ==========================================================================
  // PASSWORD VERIFICATION
  // ==========================================================================
  //
  // Compare the supplied password with the bcrypt passwordHash stored in
  // PostgreSQL.
  //
  // passwordHash is never returned to the client.
  //
  // ==========================================================================

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(
      "INVALID_CREDENTIALS",
      "Invalid username, email, employee ID, or password",
      401,
    );
  }

  // ==========================================================================
  // EXTRACT PERMISSIONS
  // ==========================================================================
  //
  // Database relationship:
  //
  // Role
  //   |
  //   +-- RolePermission
  //          |
  //          +-- Permission
  //
  // Convert the relationship into a simple permission-code array.
  //
  // Example:
  //
  // [
  //   "EMPLOYEE_VIEW",
  //   "EMPLOYEE_CREATE",
  //   "ATTENDANCE_VIEW"
  // ]
  //
  // ==========================================================================

  const permissions = user.role.permissions.map(
    (rolePermission) => rolePermission.permission.code,
  );

  // ==========================================================================
  // CREATE JWT PAYLOAD
  // ==========================================================================

  const payload: JwtPayload = {
    // Authenticated User ID.
    sub: user.id,

    // Employee ID can be null because the User model allows an optional
    // employee relationship.
    employeeId: user.employee?.id ?? null,

    // System role.
    role: user.role.code,
  };

  // ==========================================================================
  // GENERATE JWT
  // ==========================================================================
  //
  // Using a numeric expiration in seconds avoids the StringValue typing
  // incompatibility from the installed jsonwebtoken definitions.
  //
  // 28800 seconds = 8 hours.
  //
  // ==========================================================================

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  });

  // ==========================================================================
  // UPDATE LAST LOGIN
  // ==========================================================================
  //
  // This happens only after:
  //
  // - user exists
  // - user is active
  // - employee is active
  // - password is correct
  //
  // Failed authentication attempts do not update lastLoginAt.
  //
  // ==========================================================================

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      lastLoginAt: new Date(),
    },
  });

  // ==========================================================================
  // BUILD SAFE USER RESPONSE
  // ==========================================================================
  //
  // IMPORTANT:
  //
  // passwordHash is deliberately excluded.
  //
  // Only safe user information is returned to the frontend.
  //
  // ==========================================================================

  const authenticatedUser: AuthenticatedUser = {
    id: user.id,

    username: user.username,

    email: user.email,

    status: user.status,

    // ------------------------------------------------------------------------
    // Employee information.
    // ------------------------------------------------------------------------

    employee:
      user.employee && user.employee.status === EmployeeStatus.ACTIVE
        ? {
            id: user.employee.id,

            employeeCode: user.employee.employeeCode,

            firstName: user.employee.firstName,

            lastName: user.employee.lastName,

            displayName: user.employee.displayName,
          }
        : null,

    // ------------------------------------------------------------------------
    // Role and permissions.
    // ------------------------------------------------------------------------

    role: {
      code: user.role.code,

      name: user.role.name,

      permissions,
    },
  };

  // ==========================================================================
  // RETURN LOGIN RESULT
  // ==========================================================================

  return {
    accessToken,

    user: authenticatedUser,
  };
}
