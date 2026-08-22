// ============================================================================
// EEMS - Leave Management
// Leave Routes
// ============================================================================
//
// Base path: /api/leave
//
// Security model:
//   1. authenticate() validates the JWT and populates req.user.
//   2. authorize(permission) enforces RBAC.
//   3. Controllers derive employee/user identity from req.user.
//   4. Service layer enforces resource ownership and organizational scope.
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import {
  approveLeaveController,
  cancelLeaveController,
  createLeaveController,
  getLeaveController,
  listLeaveController,
  rejectLeaveController,
} from "./leave.controller.js";

const router = Router();

// Every leave endpoint requires a valid JWT.
router.use(authenticate);

// ============================================================================
// CREATE
// ============================================================================

router.post("/", authorize("LEAVE_APPLY"), createLeaveController);

// ============================================================================
// LIST
// ============================================================================
//
// The current controller intentionally scopes this endpoint to the
// authenticated employee. Management-wide listing should be introduced as a
// separate scoped endpoint once the management dashboard is implemented.
// ============================================================================

router.get("/", authorize("LEAVE_VIEW"), listLeaveController);

// ============================================================================
// GET BY ID
// ============================================================================

router.get("/:id", authorize("LEAVE_VIEW"), getLeaveController);

// ============================================================================
// APPROVE
// ============================================================================
//
// RBAC permission: LEAVE_APPROVE
//
// Organizational scope is enforced by the service:
//   ADMIN     -> unrestricted, except self-approval is blocked when linked
//   MANAGER   -> same department
//   TEAM_LEAD -> same team
//   EMPLOYEE  -> forbidden by authorization layer
// ============================================================================

router.post("/:id/approve", authorize("LEAVE_APPROVE"), approveLeaveController);

// ============================================================================
// REJECT
// ============================================================================

router.post("/:id/reject", authorize("LEAVE_APPROVE"), rejectLeaveController);

// ============================================================================
// CANCEL
// ============================================================================
//
// RBAC permission: LEAVE_APPLY
// The service enforces that only the authenticated employee can cancel their
// own PENDING request.
// ============================================================================

router.post("/:id/cancel", authorize("LEAVE_APPLY"), cancelLeaveController);

export default router;
