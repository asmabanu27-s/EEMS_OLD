// ============================================================================
// EEMS - Employee Management
// Employee HTTP Controllers
// ============================================================================
//
// Responsibilities:
//
// 1. Validate HTTP request parameters.
// 2. Extract authenticated actor from req.user.
// 3. Call Employee service methods.
// 4. Create audit records for employee mutations.
// 5. Return consistent HTTP responses.
//
// Business logic remains in employee.service.ts.
//
// IMPORTANT:
//   - Authentication is expected to run before these controllers.
//   - Authorization is expected to run at the route level.
//   - Employee identity must come from the authenticated actor.
//   - Audit failures must never break the primary transaction.
// ============================================================================

import type { Request, Response } from "express";

import type { JwtPayload } from "@/modules/auth/auth.types.js";

import { auditRequest, AUDIT_ACTIONS } from "@/modules/audit/index.js";

import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
} from "./employee.service.js";

import type { EmployeeActor } from "./employee.types.js";

// ============================================================================
// AUTHENTICATED ACTOR
// ============================================================================

/**
 * Extract the authenticated actor from req.user.
 *
 * The authentication middleware is responsible for validating the JWT and
 * populating req.user.
 *
 * The client must never be allowed to supply:
 *
 *   userId
 *   employeeId
 *   role
 *
 * directly for employee operations.
 */
function getActor(req: Request): EmployeeActor {
  const user = req.user as JwtPayload | undefined;

  if (!user) {
    throw new Error("Authenticated user is missing");
  }

  return {
    userId: user.sub,
    employeeId: user.employeeId ?? null,
    role: user.role,
  };
}

// ============================================================================
// EMPLOYEE ID
// ============================================================================

/**
 * Extract employee ID from route parameters.
 *
 * Used by:
 *
 *   GET    /api/employees/:id
 *   PATCH  /api/employees/:id
 *   DELETE /api/employees/:id
 */
function getEmployeeId(req: Request): string | null {
  const id = req.params.id;

  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  return id.trim();
}

// ============================================================================
// GET /api/employees
// ============================================================================
//
// Supported query parameters:
//
//   ?search=John
//   ?departmentId=<UUID>
//   ?teamId=<UUID>
//   ?status=ACTIVE
//   ?page=1
//   ?limit=20
//
// Actor is passed to the service so that organizational scope and permission
// rules remain inside the service layer.
// ============================================================================

export async function getEmployees(req: Request, res: Response) {
  const actor = getActor(req);

  const query = {
    ...(typeof req.query.search === "string"
      ? {
          search: req.query.search,
        }
      : {}),

    ...(typeof req.query.departmentId === "string"
      ? {
          departmentId: req.query.departmentId,
        }
      : {}),

    ...(typeof req.query.teamId === "string"
      ? {
          teamId: req.query.teamId,
        }
      : {}),

    ...(typeof req.query.status === "string"
      ? {
          status: req.query.status as any,
        }
      : {}),

    ...(typeof req.query.page === "string"
      ? {
          page: Number(req.query.page),
        }
      : {}),

    ...(typeof req.query.limit === "string"
      ? {
          limit: Number(req.query.limit),
        }
      : {}),
  };

  const result = await listEmployees(actor, query);

  return res.status(200).json({
    success: true,
    data: result.employees,
    meta: result.pagination,
  });
}

// ============================================================================
// GET /api/employees/:id
// ============================================================================

export async function getEmployee(req: Request, res: Response) {
  const id = getEmployeeId(req);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_EMPLOYEE_ID",
        message: "Employee ID is required",
      },
    });
  }

  const actor = getActor(req);

  const employee = await getEmployeeById(actor, id);

  if (!employee) {
    return res.status(404).json({
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found",
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: employee,
  });
}

// ============================================================================
// POST /api/employees
// ============================================================================
//
// Creates a new employee.
//
// Audit:
//   EMPLOYEE_CREATE
// ============================================================================

export async function createEmployeeController(req: Request, res: Response) {
  const actor = getActor(req);

  // --------------------------------------------------------------------------
  // Create employee.
  // --------------------------------------------------------------------------

  const employee = await createEmployee(actor, req.body);

  // --------------------------------------------------------------------------
  // Audit successful employee creation.
  //
  // IMPORTANT:
  // Audit is performed only after the primary operation succeeds.
  // --------------------------------------------------------------------------

  await auditRequest(
    {
      userId: actor.userId,
      employeeId: actor.employeeId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.EMPLOYEE_CREATE,
    "EMPLOYEE",
    {
      entityId: employee.id,
      description: "Employee created",
      metadata: {
        employeeCode: employee.employeeCode,
      },
    },
  );

  return res.status(201).json({
    success: true,
    data: employee,
  });
}

// ============================================================================
// PATCH /api/employees/:id
// ============================================================================
//
// Updates an existing employee.
//
// Audit:
//   EMPLOYEE_UPDATE
// ============================================================================

export async function updateEmployeeController(req: Request, res: Response) {
  // --------------------------------------------------------------------------
  // Validate employee ID.
  // --------------------------------------------------------------------------

  const id = getEmployeeId(req);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_EMPLOYEE_ID",
        message: "Employee ID is required",
      },
    });
  }

  const actor = getActor(req);

  // --------------------------------------------------------------------------
  // Update employee.
  // --------------------------------------------------------------------------

  const employee = await updateEmployee(actor, id, req.body);

  // --------------------------------------------------------------------------
  // Employee not found.
  //
  // Audit must NOT be created when the primary operation did not happen.
  // --------------------------------------------------------------------------

  if (!employee) {
    return res.status(404).json({
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found",
      },
    });
  }

  // --------------------------------------------------------------------------
  // Audit successful employee update.
  // --------------------------------------------------------------------------

  await auditRequest(
    {
      userId: actor.userId,
      employeeId: actor.employeeId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.EMPLOYEE_UPDATE,
    "EMPLOYEE",
    {
      entityId: employee.id,
      description: "Employee updated",
      metadata: {
        employeeCode: employee.employeeCode,
        updatedFields: Object.keys(req.body),
      },
    },
  );

  return res.status(200).json({
    success: true,
    data: employee,
  });
}

// ============================================================================
// DELETE /api/employees/:id
// ============================================================================
//
// IMPORTANT:
//
// This is a SOFT DELETE.
//
// Employee data is retained for historical:
//
//   - Attendance
//   - Timesheet
//   - Leave
//   - Employee records
//
// The Employee service changes the employee status to TERMINATED.
//
// Audit:
//   EMPLOYEE_DELETE
// ============================================================================

export async function deleteEmployeeController(req: Request, res: Response) {
  // --------------------------------------------------------------------------
  // Validate employee ID.
  // --------------------------------------------------------------------------

  const id = getEmployeeId(req);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_EMPLOYEE_ID",
        message: "Employee ID is required",
      },
    });
  }

  const actor = getActor(req);

  // --------------------------------------------------------------------------
  // Soft-delete / terminate employee.
  // --------------------------------------------------------------------------

  const employee = await deleteEmployee(actor, id);

  // --------------------------------------------------------------------------
  // Employee not found.
  //
  // Do not create an audit record because no employee was terminated.
  // --------------------------------------------------------------------------

  if (!employee) {
    return res.status(404).json({
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found",
      },
    });
  }

  // --------------------------------------------------------------------------
  // Audit successful employee termination.
  // --------------------------------------------------------------------------

  await auditRequest(
    {
      userId: actor.userId,
      employeeId: actor.employeeId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.EMPLOYEE_DELETE,
    "EMPLOYEE",
    {
      entityId: employee.id,
      description: "Employee terminated",
      metadata: {
        employeeCode: employee.employeeCode,
        operation: "SOFT_DELETE",
      },
    },
  );

  return res.status(200).json({
    success: true,
    data: employee,
    meta: {
      message: "Employee terminated successfully",
    },
  });
}
