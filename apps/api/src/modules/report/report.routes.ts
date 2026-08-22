// EEMS - Employee Management System
// Report Routes
// ============================================================================
//
// Base path:
//
//   /api/reports
//
// Security:
//
//   JSON reports:
//     REPORT_VIEW
//
//   File exports:
//     REPORT_EXPORT
//
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import {
  attendanceReport,
  attendanceReportExport,
  employeeReport,
  employeeReportExport,
  leaveReport,
  leaveReportExport,
  projectReport,
  projectReportExport,
  reportSummary,
  timesheetReport,
  timesheetReportExport,
} from "./report.controller.js";

// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// ============================================================================
// REPORT SUMMARY
// ============================================================================
//
// GET /api/reports/summary
//
// ============================================================================

router.get("/summary", authenticate, authorize("REPORT_VIEW"), reportSummary);

// ============================================================================
// ATTENDANCE REPORT
// ============================================================================
//
// GET /api/reports/attendance
//
// ============================================================================

router.get(
  "/attendance",
  authenticate,
  authorize("REPORT_VIEW"),
  attendanceReport,
);

// ============================================================================
// ATTENDANCE EXPORT
// ============================================================================
//
// GET /api/reports/attendance/export
//
// Query:
//
//   ?format=csv
//   ?format=xlsx
//   ?format=pdf
//
// ============================================================================

router.get(
  "/attendance/export",
  authenticate,
  authorize("REPORT_EXPORT"),
  attendanceReportExport,
);

// ============================================================================
// LEAVE REPORT
// ============================================================================

router.get("/leave", authenticate, authorize("REPORT_VIEW"), leaveReport);

// ============================================================================
// LEAVE EXPORT
// ============================================================================

router.get(
  "/leave/export",
  authenticate,
  authorize("REPORT_EXPORT"),
  leaveReportExport,
);

// ============================================================================
// TIMESHEET REPORT
// ============================================================================

router.get(
  "/timesheets",
  authenticate,
  authorize("REPORT_VIEW"),
  timesheetReport,
);

// ============================================================================
// TIMESHEET EXPORT
// ============================================================================

router.get(
  "/timesheets/export",
  authenticate,
  authorize("REPORT_EXPORT"),
  timesheetReportExport,
);

// ============================================================================
// EMPLOYEE REPORT
// ============================================================================

router.get(
  "/employees",
  authenticate,
  authorize("REPORT_VIEW"),
  employeeReport,
);

// ============================================================================
// EMPLOYEE EXPORT
// ============================================================================

router.get(
  "/employees/export",
  authenticate,
  authorize("REPORT_EXPORT"),
  employeeReportExport,
);

// ============================================================================
// PROJECT REPORT
// ============================================================================

router.get("/projects", authenticate, authorize("REPORT_VIEW"), projectReport);

// ============================================================================
// PROJECT EXPORT
// ============================================================================

router.get(
  "/projects/export",
  authenticate,
  authorize("REPORT_EXPORT"),
  projectReportExport,
);

// ============================================================================
// EXPORT ROUTER
// ============================================================================

export default router;
