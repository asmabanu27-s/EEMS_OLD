// ============================================================================
// EEMS - Employee Management
// Employee Routes
// ============================================================================
//
// Authentication and authorization are intentionally enforced at route level.
//
// Permission matrix:
//
// GET    /api/employees
//        EMPLOYEE_VIEW
//
// GET    /api/employees/:id
//        EMPLOYEE_VIEW
//
// POST   /api/employees
//        EMPLOYEE_CREATE
//
// PATCH  /api/employees/:id
//        EMPLOYEE_UPDATE
//
// DELETE /api/employees/:id
//        EMPLOYEE_DELETE
//
// Organizational scope is enforced inside employee.service.ts.
//
// ============================================================================

import { Router } from "express";

import { authenticate } from "@/middleware/authenticate.js";
import { authorize } from "@/middleware/authorize.js";

import {
  createEmployeeController,
  deleteEmployeeController,
  getEmployee,
  getEmployees,
  updateEmployeeController,
} from "./employee.controller.js";

// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// ============================================================================
// EMPLOYEE COLLECTION
// ============================================================================

// GET /api/employees
//
// Permission:
//   EMPLOYEE_VIEW
//
// Scope is determined by the authenticated role.

router.get("/", authenticate, authorize("EMPLOYEE_VIEW"), getEmployees);

// POST /api/employees
//
// Permission:
//   EMPLOYEE_CREATE
//
// Scope:
//
// ADMIN      -> unrestricted
// MANAGER    -> own department
// TEAM_LEAD  -> own team
//
// Employee creation remains permission-controlled.

router.post(
  "/",
  authenticate,
  authorize("EMPLOYEE_CREATE"),
  createEmployeeController,
);

// ============================================================================
// INDIVIDUAL EMPLOYEE
// ============================================================================

// GET /api/employees/:id
//
// Permission:
//   EMPLOYEE_VIEW
//
// Scope:
//
// ADMIN      -> any employee
// MANAGER    -> same department
// TEAM_LEAD  -> same team
// EMPLOYEE   -> own record

router.get("/:id", authenticate, authorize("EMPLOYEE_VIEW"), getEmployee);

// PATCH /api/employees/:id
//
// Permission:
//   EMPLOYEE_UPDATE
//
// Scope is enforced by employee.service.ts.

router.patch(
  "/:id",
  authenticate,
  authorize("EMPLOYEE_UPDATE"),
  updateEmployeeController,
);

// DELETE /api/employees/:id
//
// Permission:
//   EMPLOYEE_DELETE
//
// Actual termination authorization is additionally enforced
// by employee.service.ts.
//
// ADMIN      -> any employee
// MANAGER    -> own department
// TEAM_LEAD  -> denied
// EMPLOYEE   -> denied

router.delete(
  "/:id",
  authenticate,
  authorize("EMPLOYEE_DELETE"),
  deleteEmployeeController,
);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
