// ============================================================================
// EEMS - Employee Management System
// Audit Controller
// ============================================================================
//
// HTTP layer for audit log administration.
//
// Endpoint:
//
//   GET /api/audit
//
// IMPORTANT:
//
//   Audit logs are security-sensitive.
//   This controller never exposes passwords, JWTs, refresh tokens,
//   authorization headers, or other authentication secrets.
//
// ============================================================================

import type { Request, Response } from "express";

import { prisma } from "@/lib/prisma.js";
import { AppError } from "@/middleware/app-error.js";

// ============================================================================
// QUERY TYPES
// ============================================================================

interface AuditListQuery {
  page: number;
  limit: number;
  action?: string;
  entity?: string;
  userId?: string;
  employeeId?: string;
  from?: Date;
  to?: Date;
}

// ============================================================================
// INTEGER PARSER
// ============================================================================

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
  maximum: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(
      "INVALID_QUERY_PARAMETER",
      "Pagination values must be positive integers",
      400,
    );
  }

  return Math.min(parsed, maximum);
}

// ============================================================================
// DATE PARSER
// ============================================================================

function parseDate(value: unknown, parameterName: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(
      "INVALID_QUERY_PARAMETER",
      `${parameterName} must be a valid date`,
      400,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      "INVALID_QUERY_PARAMETER",
      `${parameterName} must be a valid date`,
      400,
    );
  }

  return date;
}

// ============================================================================
// QUERY PARSER
// ============================================================================

function parseAuditQuery(req: Request): AuditListQuery {
  const query = req.query as Record<string, unknown>;

  const page = parsePositiveInteger(query.page, 1, 100000);

  const limit = parsePositiveInteger(query.limit, 50, 100);

  const action =
    typeof query.action === "string" && query.action.trim().length > 0
      ? query.action.trim()
      : undefined;

  const entity =
    typeof query.entity === "string" && query.entity.trim().length > 0
      ? query.entity.trim()
      : undefined;

  const userId =
    typeof query.userId === "string" && query.userId.trim().length > 0
      ? query.userId.trim()
      : undefined;

  const employeeId =
    typeof query.employeeId === "string" && query.employeeId.trim().length > 0
      ? query.employeeId.trim()
      : undefined;

  const from = parseDate(query.from, "from");

  const to = parseDate(query.to, "to");

  if (from && to && from > to) {
    throw new AppError(
      "INVALID_DATE_RANGE",
      "from date cannot be later than to date",
      400,
    );
  }

  return {
    page,
    limit,
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(userId ? { userId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

// ============================================================================
// LIST AUDIT LOGS
// ============================================================================
//
// GET /api/audit
//
// Supported query parameters:
//
//   page
//   limit
//   action
//   entity
//   userId
//   employeeId
//   from
//   to
//
// Example:
//
//   GET /api/audit?page=1&limit=50&entity=EMPLOYEE
//
// ============================================================================

export async function listAuditLogsController(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  const query = parseAuditQuery(req);

  const where = {
    ...(query.action
      ? {
          action: query.action,
        }
      : {}),

    ...(query.entity
      ? {
          entity: query.entity,
        }
      : {}),

    ...(query.userId
      ? {
          userId: query.userId,
        }
      : {}),

    ...(query.employeeId
      ? {
          employeeId: query.employeeId,
        }
      : {}),

    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from
              ? {
                  gte: query.from,
                }
              : {}),

            ...(query.to
              ? {
                  lte: query.to,
                }
              : {}),
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [records, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip,

      take: query.limit,

      select: {
        id: true,
        userId: true,
        employeeId: true,
        action: true,
        entity: true,
        entityId: true,
        description: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),

    prisma.auditLog.count({
      where,
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  res.status(200).json({
    success: true,

    data: {
      items: records,

      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
      },
    },
  });
}
