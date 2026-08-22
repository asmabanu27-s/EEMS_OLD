// ============================================================================
// EEMS - Notification Management
// Notification Service
// ============================================================================
//
// Responsibilities:
//
// 1. List authenticated employee notifications.
// 2. Return unread notification count.
// 3. Mark one notification as read.
// 4. Mark all employee notifications as read.
// 5. Delete one employee notification.
// 6. Create notifications for future modules.
//
// SECURITY
// ============================================================================
//
// Notification ownership is ALWAYS enforced using employeeId.
//
// The employeeId supplied by the HTTP client is never trusted.
//
// The controller obtains employeeId from req.user.
// ============================================================================

import { AppError } from "@/middleware/app-error.js";
import { prisma } from "@/lib/prisma.js";

import type {
  NotificationListQuery,
  NotificationListResult,
} from "./notification.types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ============================================================================
// CREATE NOTIFICATION
// ============================================================================
//
// This function is intentionally reusable.
//
// Leave, Attendance, Timesheet, Project, Admin, etc. can call this service
// without duplicating notification creation logic.
// ============================================================================

export interface CreateNotificationInput {
  employeeId: string;
  title: string;
  message: string;
  type: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const employeeId = input.employeeId.trim();
  const title = input.title.trim();
  const message = input.message.trim();
  const type = input.type.trim();

  if (!employeeId) {
    throw new AppError("EMPLOYEE_ID_REQUIRED", "employeeId is required", 400);
  }

  if (!title) {
    throw new AppError(
      "NOTIFICATION_TITLE_REQUIRED",
      "Notification title is required",
      400,
    );
  }

  if (!message) {
    throw new AppError(
      "NOTIFICATION_MESSAGE_REQUIRED",
      "Notification message is required",
      400,
    );
  }

  if (!type) {
    throw new AppError(
      "NOTIFICATION_TYPE_REQUIRED",
      "Notification type is required",
      400,
    );
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
    },
  });

  if (!employee) {
    throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
  }

  return prisma.notification.create({
    data: {
      employeeId,
      title,
      message,
      type,
    },
  });
}

// ============================================================================
// LIST NOTIFICATIONS
// ============================================================================

export async function listNotifications(
  employeeId: string,
  query: NotificationListQuery = {},
): Promise<NotificationListResult> {
  if (!employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated employee profile is required",
      403,
    );
  }

  const page =
    query.page && query.page > 0 ? Math.floor(query.page) : DEFAULT_PAGE;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  const where = {
    employeeId,

    ...(query.unreadOnly === true
      ? {
          isRead: false,
        }
      : {}),
  };

  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip,
      take: limit,
    }),

    prisma.notification.count({
      where,
    }),
  ]);

  return {
    notifications,

    pagination: {
      page,
      limit,
      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// UNREAD COUNT
// ============================================================================

export async function getUnreadNotificationCount(
  employeeId: string,
): Promise<number> {
  if (!employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated employee profile is required",
      403,
    );
  }

  return prisma.notification.count({
    where: {
      employeeId,
      isRead: false,
    },
  });
}

// ============================================================================
// MARK ONE NOTIFICATION AS READ
// ============================================================================

export async function markNotificationAsRead(
  notificationId: string,
  employeeId: string,
) {
  if (!notificationId.trim()) {
    throw new AppError(
      "NOTIFICATION_ID_REQUIRED",
      "Notification id is required",
      400,
    );
  }

  if (!employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated employee profile is required",
      403,
    );
  }

  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId.trim(),
    },

    select: {
      id: true,
      employeeId: true,
      isRead: true,
    },
  });

  if (!notification) {
    throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
  }

  // --------------------------------------------------------------------------
  // OWNERSHIP
  // --------------------------------------------------------------------------

  if (notification.employeeId !== employeeId) {
    throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
  }

  // --------------------------------------------------------------------------
  // Already read
  // --------------------------------------------------------------------------

  if (notification.isRead) {
    return prisma.notification.findUnique({
      where: {
        id: notification.id,
      },
    });
  }

  return prisma.notification.update({
    where: {
      id: notification.id,
    },

    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

// ============================================================================
// MARK ALL AS READ
// ============================================================================

export async function markAllNotificationsAsRead(
  employeeId: string,
): Promise<{ updatedCount: number }> {
  if (!employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated employee profile is required",
      403,
    );
  }

  const result = await prisma.notification.updateMany({
    where: {
      employeeId,
      isRead: false,
    },

    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
}

// ============================================================================
// DELETE NOTIFICATION
// ============================================================================

export async function deleteNotification(
  notificationId: string,
  employeeId: string,
): Promise<void> {
  if (!notificationId.trim()) {
    throw new AppError(
      "NOTIFICATION_ID_REQUIRED",
      "Notification id is required",
      400,
    );
  }

  if (!employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated employee profile is required",
      403,
    );
  }

  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId.trim(),
    },

    select: {
      id: true,
      employeeId: true,
    },
  });

  if (!notification) {
    throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
  }

  // --------------------------------------------------------------------------
  // OWNERSHIP
  // --------------------------------------------------------------------------

  if (notification.employeeId !== employeeId) {
    throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
  }

  await prisma.notification.delete({
    where: {
      id: notification.id,
    },
  });
}
