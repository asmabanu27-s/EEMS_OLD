// EEMS - Project Monitoring
// Project Routes
// ============================================================================
//
// Base path:
//
//   /api/projects
//
// Every endpoint requires:
//   1. JWT authentication
//   2. RBAC permission
//   3. Service-level organizational scope
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";

import { authorize } from "@/middleware/authorize.js";

import {
  addProjectMemberController,
  createProjectController,
  deleteProjectController,
  getProjectController,
  listProjectsController,
  projectMonitoringController,
  removeProjectMemberController,
  updateProjectController,
} from "./project.controller.js";

const router = Router();

// All project endpoints require authentication.
router.use(authenticate);

// ============================================================================
// LIST
// ============================================================================

router.get("/", authorize("PROJECT_VIEW"), listProjectsController);

// ============================================================================
// CREATE
// ============================================================================

router.post("/", authorize("PROJECT_CREATE"), createProjectController);

router.get(
  "/:id/monitoring",
  authorize("PROJECT_MONITOR"),
  projectMonitoringController,
);

router.post(
  "/:id/members",
  authorize("PROJECT_MEMBER_MANAGE"),
  addProjectMemberController,
);

router.delete(
  "/:id/members/:employeeId",
  authorize("PROJECT_MEMBER_MANAGE"),
  removeProjectMemberController,
);

router.get("/:id", authorize("PROJECT_VIEW"), getProjectController);

router.patch("/:id", authorize("PROJECT_UPDATE"), updateProjectController);

router.delete("/:id", authorize("PROJECT_DELETE"), deleteProjectController);

export default router;
