// ============================================================================
// EEMS - Employee Management System
// Audit Routes
// ============================================================================
//
// Base path:
//
//   /api/audit
//
// Security:
//
//   Valid JWT
//   +
//   AUDIT_VIEW permission
//
// Audit logs are administrative/security information and are not exposed to
// ordinary employees.
//
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import { listAuditLogsController } from "./audit.controller.js";

const router = Router();

// ============================================================================
// LIST AUDIT LOGS
// ============================================================================
//
// GET /api/audit
//
// ============================================================================

router.get("/", authenticate, authorize("AUDIT_VIEW"), listAuditLogsController);

export default router;
