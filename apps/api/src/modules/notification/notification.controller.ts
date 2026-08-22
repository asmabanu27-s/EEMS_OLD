// EEMS - Notification Management
// Notification HTTP Controllers
// ============================================================================
//
// SECURITY
// ============================================================================
//
// Employee identity MUST come from:
//
//   req.user.employeeId
//
// Authenticated user ID MUST come from:
//
//   req.user.sub
//
// The HTTP client must never be allowed to provide employeeId for these
// employee-owned notification operations.
// ============================================================================

import type { Request, Response } from "express";

import { AppError } from "@/middleware/app-error.js";

import { auditRequest } from "@/modules/audit/index.js";
import { AUDIT_ACTIONS } from "@/modules/audit/audit.types.js";

import {
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notification.service.js";

// ============================================================================
// AUTHENTICATED USER ID
// ============================================================================

function getAuthenticatedUserId(req: Request): string {
  if (!req.user?.sub) {
    throw new AppError(
      "USER_ID_REQUIRED",
      "Authenticated user ID is missing",
      401,
    );
  }

  return req.user.sub;
}

// ============================================================================
// AUTHENTICATED EMPLOYEE ID
// ============================================================================

function getAuthenticatedEmployeeId(req: Request): string {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!req.user.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  return req.user.employeeId;
}

// ============================================================================
// ROUTE PARAMETER
// ============================================================================

function getIdParam(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new AppError(
      "NOTIFICATION_ID_REQUIRED",
      "Notification id is required",
      400,
    );
  }

  return id.trim();
}

// ============================================================================
// LIST NOTIFICATIONS
// ============================================================================
//
// GET /api/notifications
//
// Query:
//   page
//   limit
//   unreadOnly
// ============================================================================

export async function listNotificationsController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const page =
    typeof req.query.page === "string" ? Number(req.query.page) : undefined;

  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

  const unreadOnly =
    typeof req.query.unreadOnly === "string"
      ? req.query.unreadOnly === "true"
      : undefined;

  const result = await listNotifications(employeeId, {
    ...(page !== undefined && Number.isFinite(page)
      ? {
          page,
        }
      : {}),

    ...(limit !== undefined && Number.isFinite(limit)
      ? {
          limit,
        }
      : {}),

    ...(unreadOnly !== undefined
      ? {
          unreadOnly,
        }
      : {}),
  });

  res.status(200).json({
    success: true,
    data: result.notifications,
    meta: result.pagination,
  });
}

// ============================================================================
// UNREAD COUNT
// ============================================================================
//
// GET /api/notifications/unread-count
// ============================================================================

export async function getUnreadNotificationCountController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const count = await getUnreadNotificationCount(employeeId);

  res.status(200).json({
    success: true,
    data: {
      count,
    },
  });
}

// ============================================================================
// MARK ONE AS READ
// ============================================================================
//
// PATCH /api/notifications/:id/read
// ============================================================================

export async function markNotificationAsReadController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const id = getIdParam(req);

  const notification = await markNotificationAsRead(id, employeeId);

  await auditRequest(
    {
      userId: getAuthenticatedUserId(req),
      employeeId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.NOTIFICATION_READ,
    "NOTIFICATION",
    {
      entityId: id,
      description: "Notification marked as read",
    },
  );

  res.status(200).json({
    success: true,
    data: notification,
  });
}

// ============================================================================
// MARK ALL AS READ
// ============================================================================
//
// PATCH /api/notifications/read-all
// ============================================================================

export async function markAllNotificationsAsReadController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const result = await markAllNotificationsAsRead(employeeId);

  await auditRequest(
    {
      userId: getAuthenticatedUserId(req),
      employeeId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.NOTIFICATION_READ,
    "NOTIFICATION",
    {
      description: "All notifications marked as read",
      metadata: {
        operation: "MARK_ALL_AS_READ",
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// DELETE
// ============================================================================
//
// DELETE /api/notifications/:id
// ============================================================================

export async function deleteNotificationController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const id = getIdParam(req);

  await deleteNotification(id, employeeId);

  await auditRequest(
    {
      userId: getAuthenticatedUserId(req),
      employeeId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.NOTIFICATION_DELETE,
    "NOTIFICATION",
    {
      entityId: id,
      description: "Notification deleted",
    },
  );

  res.status(200).json({
    success: true,
    data: {
      message: "Notification deleted successfully",
    },
  });
}
// ============================================================================
