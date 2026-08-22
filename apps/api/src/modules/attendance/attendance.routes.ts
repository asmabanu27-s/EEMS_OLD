// ============================================================================
// EEMS - Attendance Routes
// ============================================================================
//
// Base path:
//
//     /api/attendance
//
// Security:
//
//     Every endpoint requires JWT authentication.
//
// RBAC:
//
//     ATTENDANCE_VIEW
//     ATTENDANCE_MANAGE
//
// Resource-level scope is enforced by attendance.service.ts.
//
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import {
  checkInController,
  checkOutController,
  getTodayAttendanceController,
  listAttendanceController,
  getAttendanceController,
} from "./attendance.controller.js";

const router = Router();

// ============================================================================
// CHECK-IN
// ============================================================================
//
// POST /api/attendance/check-in
//
// Employee checks in themselves.
//
// employeeId is obtained from req.user.employeeId.
// Request body is ignored.
//
// ============================================================================

router.post(
  "/check-in",
  authenticate,
  authorize("ATTENDANCE_MANAGE"),
  checkInController,
);

// ============================================================================
// CHECK-OUT
// ============================================================================
//
// POST /api/attendance/check-out
//
// Employee checks out themselves.
//
// ============================================================================

router.post(
  "/check-out",
  authenticate,
  authorize("ATTENDANCE_MANAGE"),
  checkOutController,
);

// ============================================================================
// TODAY
// ============================================================================
//
// GET /api/attendance/today
//
// Returns authenticated employee's current-day attendance.
//
// ============================================================================

router.get(
  "/today",
  authenticate,
  authorize("ATTENDANCE_VIEW"),
  getTodayAttendanceController,
);

// ============================================================================
// ATTENDANCE HISTORY
// ============================================================================
//
// GET /api/attendance
//
// Query:
//
//     employeeId
//     status
//     from
//     to
//     page
//     limit
//
// Scope:
//
//     ADMIN     -> all
//     MANAGER   -> department
//     TEAM_LEAD -> team
//     EMPLOYEE  -> own
//
// ============================================================================

router.get(
  "/",
  authenticate,
  authorize("ATTENDANCE_VIEW"),
  listAttendanceController,
);

// ============================================================================
// ATTENDANCE BY ID
// ============================================================================
//
// GET /api/attendance/:id
//
// Resource-level scope is enforced by the service.
//
// IMPORTANT:
//
// /today is registered before /:id so that "today" is not interpreted
// as an attendance UUID.
// ============================================================================

router.get(
  "/:id",
  authenticate,
  authorize("ATTENDANCE_VIEW"),
  getAttendanceController,
);

export default router;
