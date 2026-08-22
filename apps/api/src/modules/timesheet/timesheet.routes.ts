// ============================================================================
// EEMS - Timesheet Management
// Timesheet Routes
// ============================================================================
//
// Base path:
//
//   /api/timesheets
//
// Security:
//
//   Every Timesheet endpoint requires a valid JWT.
//
//   Authorization is handled using RBAC permissions:
//
//     TIMESHEET_VIEW
//     TIMESHEET_EXPORT
//
// Request flow:
//
//   Request
//      |
//      v
//   authenticate()
//      |
//      v
//   authorize(permission)
//      |
//      v
//   Controller
//      |
//      v
//   Timesheet Service
//      |
//      v
//   PostgreSQL
//
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import {
  approveTimesheetController,
  createTimesheetController,
  exportTimesheetController,
  getTimesheetController,
  listTimesheetsController,
  rejectTimesheetController,
  submitTimesheetController,
  updateTimesheetController,
} from "./timesheet.controller.js";
// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// ============================================================================
// LIST TIMESHEETS
// ============================================================================
//
// GET /api/timesheets
//
// Permission:
//
//   TIMESHEET_VIEW
//
// Query parameters:
//
//   employeeId
//   status
//   from
//   to
//   page
//   limit
//
// ============================================================================

router.get(
  "/",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  listTimesheetsController,
);

// ============================================================================
// EXPORT TIMESHEETS
// ============================================================================
//
// GET /api/timesheets/export
//
// Supported formats:
//
//   /api/timesheets/export?format=xlsx
//   /api/timesheets/export?format=csv
//
// Permission:
//
//   TIMESHEET_EXPORT
//
// IMPORTANT:
//
//   This route must appear BEFORE /:id.
//
// ============================================================================

router.get(
  "/export",
  authenticate,
  authorize("TIMESHEET_EXPORT"),
  exportTimesheetController,
);

// ============================================================================
// CREATE TIMESHEET
// ============================================================================
//
// POST /api/timesheets
//
// Permission:
//
//   TIMESHEET_VIEW
//
// The employee identity is taken from the authenticated JWT.
//
// ============================================================================

router.post(
  "/",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  createTimesheetController,
);

// ============================================================================
// GET TIMESHEET BY ID
// ============================================================================
//
// GET /api/timesheets/:id
//
// Permission:
//
//   TIMESHEET_VIEW
//
// ============================================================================

router.get(
  "/:id",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  getTimesheetController,
);

// ============================================================================
// UPDATE TIMESHEET
// ============================================================================
//
// PATCH /api/timesheets/:id
//
// Permission:
//
//   TIMESHEET_VIEW
//
// Only the owner can modify the timesheet.
//
// The Timesheet service allows modification when the current status is:
//
//   DRAFT
//   REJECTED
//
// ============================================================================

router.patch(
  "/:id",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  updateTimesheetController,
);
// ============================================================================
// SUBMIT TIMESHEET
// ============================================================================
//
// POST /api/timesheets/:id/submit
//
// Permission:
//
//   TIMESHEET_VIEW
//
// The authenticated employee can submit their own DRAFT or REJECTED
// timesheet.
//
// ============================================================================

router.post(
  "/:id/submit",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  submitTimesheetController,
);

// ============================================================================
// APPROVE TIMESHEET
// ============================================================================
//
// POST /api/timesheets/:id/approve
//
// Permission:
//
//   TIMESHEET_VIEW
//
// Approval scope is enforced by timesheet.service.ts.
//
// The service prevents:
//
//   - self approval
//   - cross-department approval by Manager
//   - cross-team approval by Team Lead
//   - unauthorized approval
//
// ============================================================================

router.post(
  "/:id/approve",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  approveTimesheetController,
);

// ============================================================================
// REJECT TIMESHEET
// ============================================================================
//
// POST /api/timesheets/:id/reject
//
// Permission:
//
//   TIMESHEET_VIEW
//
// Approval scope is enforced by timesheet.service.ts.
//
// ============================================================================

router.post(
  "/:id/reject",
  authenticate,
  authorize("TIMESHEET_VIEW"),
  rejectTimesheetController,
);
// ============================================================================
// EXPORT
// ============================================================================

export default router;
