// EEMS - Notification Management
// Notification Routes
// ============================================================================
//
// Base path:
//
//   /api/notifications
//
// Security:
//
//   1. authenticate() validates JWT.
//   2. authorize() enforces RBAC.
//   3. Controller obtains employeeId from req.user.
//   4. Service enforces notification ownership.
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import {
  deleteNotificationController,
  getUnreadNotificationCountController,
  listNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
} from "./notification.controller.js";

const router = Router();

// ============================================================================
// AUTHENTICATION
// ============================================================================

router.use(authenticate);

// ============================================================================
// LIST
// ============================================================================
//
// GET /api/notifications
//
// Permission:
//   NOTIFICATION_VIEW
// ============================================================================

router.get("/", authorize("NOTIFICATION_VIEW"), listNotificationsController);

// ============================================================================
// UNREAD COUNT
// ============================================================================
//
// GET /api/notifications/unread-count
//
// Permission:
//   NOTIFICATION_VIEW
// ============================================================================

router.get(
  "/unread-count",
  authorize("NOTIFICATION_VIEW"),
  getUnreadNotificationCountController,
);

// ============================================================================
// MARK ONE AS READ
// ============================================================================
//
// PATCH /api/notifications/:id/read
//
// Permission:
//   NOTIFICATION_VIEW
// ============================================================================

router.patch(
  "/:id/read",
  authorize("NOTIFICATION_VIEW"),
  markNotificationAsReadController,
);

// ============================================================================
// MARK ALL AS READ
// ============================================================================
//
// PATCH /api/notifications/read-all
//
// Permission:
//   NOTIFICATION_VIEW
// ============================================================================

router.patch(
  "/read-all",
  authorize("NOTIFICATION_VIEW"),
  markAllNotificationsAsReadController,
);

// ============================================================================
// DELETE
// ============================================================================
//
// DELETE /api/notifications/:id
//
// Permission:
//   NOTIFICATION_MANAGE
// ============================================================================

router.delete(
  "/:id",
  authorize("NOTIFICATION_MANAGE"),
  deleteNotificationController,
);

export default router;
