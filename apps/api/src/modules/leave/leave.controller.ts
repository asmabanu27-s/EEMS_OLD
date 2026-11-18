// ============================================================================
// EEMS - Leave Management
// Leave HTTP Controllers
// ============================================================================
//
// Responsibilities:
//
// 1. Read HTTP request data.
// 2. Read authenticated user information.
// 3. Validate request-level input.
// 4. Build the authenticated actor.
// 5. Call Leave service.
// 6. Create audit records for successful leave mutations.
// 7. Return HTTP responses.
//
// Business rules remain inside:
//
//   leave.service.ts
//
// SECURITY
// ============================================================================
//
// Employee identity MUST come from:
//
//   req.user.employeeId
//
// Authenticated User ID MUST come from:
//
//   req.user.sub
//
// Role MUST come from:
//
//   req.user.role
//
// Never trust employeeId, approverId, role, departmentId, or teamId supplied
// by the HTTP client.
//
// AUDIT
// ============================================================================
//
// Successful mutations are recorded:
//
//   LEAVE_APPLY
//   LEAVE_APPROVE
//   LEAVE_REJECT
//   LEAVE_CANCEL
//
// Read-only operations are not audited.
//
// Audit failures are handled by auditRequest() and must not break the primary
// leave transaction.
// ============================================================================

import type { Request, Response } from "express";

import { AppError } from "@/middleware/app-error.js";

import { auditRequest, AUDIT_ACTIONS } from "@/modules/audit/index.js";

import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequestById,
  listActiveLeaveTypes,
  listLeaveRequests,
  rejectLeaveRequest,
} from "./leave.service.js";

// ============================================================================
// AUTHENTICATED EMPLOYEE ID
// ============================================================================

function getAuthenticatedEmployeeId(req: Request): string {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!req.user.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  return req.user.employeeId;
}

// ============================================================================
// AUTHENTICATED USER ID
// ============================================================================

function getAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!req.user.sub) {
    throw new AppError(
      "USER_ID_REQUIRED",
      "Authenticated user ID is missing",
      401,
    );
  }

  return req.user.sub;
}

// ============================================================================
// AUTHENTICATED ROLE
// ============================================================================

function getAuthenticatedRole(req: Request): string {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!req.user.role) {
    throw new AppError(
      "ROLE_REQUIRED",
      "Authenticated user role is missing",
      403,
    );
  }

  return req.user.role;
}

// ============================================================================
// AUTHENTICATED ACTOR
// ============================================================================
//
// Trusted identity used for management-level operations.
//
// Values come exclusively from the authenticated JWT.
// ============================================================================

function getAuthenticatedActor(req: Request) {
  if (!req.user) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }

  if (!req.user.sub) {
    throw new AppError(
      "USER_ID_REQUIRED",
      "Authenticated user ID is missing",
      401,
    );
  }

  if (!req.user.role) {
    throw new AppError(
      "ROLE_REQUIRED",
      "Authenticated user role is missing",
      403,
    );
  }

  return {
    userId: req.user.sub,
    employeeId: req.user.employeeId,
    role: req.user.role,
  };
}

// ============================================================================
// AUDIT CONTEXT
// ============================================================================
//
// req.ip is typed as string | undefined by Express.
//
// AuditRequestContext expects string | null.
//
// Therefore undefined is explicitly normalized to null.
// ============================================================================

function getAuditContext(req: Request) {
  return {
    userId: req.user?.sub ?? null,
    employeeId: req.user?.employeeId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

// ============================================================================
// CREATE LEAVE REQUEST
// ============================================================================
//
// POST /api/leave
//
// Employee identity comes ONLY from JWT.
//
// Audit:
//
//   LEAVE_APPLY
// ============================================================================

export async function createLeaveController(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as {
    leaveTypeId?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    reason?: unknown;
  };

  const employeeId = getAuthenticatedEmployeeId(req);

  // --------------------------------------------------------------------------
  // Leave type
  // --------------------------------------------------------------------------

  if (
    typeof body.leaveTypeId !== "string" ||
    body.leaveTypeId.trim().length === 0
  ) {
    throw new AppError(
      "LEAVE_TYPE_ID_REQUIRED",
      "leaveTypeId is required",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Start date
  // --------------------------------------------------------------------------

  if (
    typeof body.startDate !== "string" ||
    body.startDate.trim().length === 0
  ) {
    throw new AppError("START_DATE_REQUIRED", "startDate is required", 400);
  }

  // --------------------------------------------------------------------------
  // End date
  // --------------------------------------------------------------------------

  if (typeof body.endDate !== "string" || body.endDate.trim().length === 0) {
    throw new AppError("END_DATE_REQUIRED", "endDate is required", 400);
  }

  // --------------------------------------------------------------------------
  // Optional reason
  // --------------------------------------------------------------------------

  const reason = typeof body.reason === "string" ? body.reason : undefined;

  // --------------------------------------------------------------------------
  // Create leave request
  // --------------------------------------------------------------------------

  const request = await createLeaveRequest({
    employeeId,

    leaveTypeId: body.leaveTypeId.trim(),

    startDate: body.startDate.trim(),

    endDate: body.endDate.trim(),

    ...(reason !== undefined
      ? {
          reason,
        }
      : {}),
  });

  // --------------------------------------------------------------------------
  // Audit successful leave application.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.LEAVE_CREATE,
    "LEAVE_REQUEST",
    {
      entityId: request.id,

      description: "Leave request submitted",

      metadata: {
        employeeId,
        leaveTypeId: request.leaveTypeId,
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: request,
  });
}

// ============================================================================
// LIST LEAVE REQUESTS
// ============================================================================
//
// GET /api/leave
//
// ROLE-BASED VISIBILITY
//
// EMPLOYEE
//   -> own leave requests
//
// TEAM_LEAD
//   -> same team
//
// MANAGER
//   -> same department
//
// ADMIN
//   -> all leave requests
//
// employeeId from query parameters is intentionally ignored.
// ============================================================================

export async function listLeaveController(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = getAuthenticatedActor(req);

  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;

  const from = typeof req.query.from === "string" ? req.query.from : undefined;

  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const page =
    typeof req.query.page === "string" ? Number(req.query.page) : undefined;

  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

  const result = await listLeaveRequests(
    {
      ...(status !== undefined
        ? {
            status: status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED",
          }
        : {}),

      ...(from !== undefined
        ? {
            from,
          }
        : {}),

      ...(to !== undefined
        ? {
            to,
          }
        : {}),

      ...(page !== undefined && Number.isFinite(page)
        ? {
            page,
          }
        : {}),

      ...(limit !== undefined && Number.isFinite(limit)
        ? {
            limit,
          }
        : {}),
    },
    actor,
  );

  res.status(200).json({
    success: true,
    data: result.requests,
    meta: result.pagination,
  });
}

// ============================================================================
// GET /api/leave/types
// ============================================================================
//
// Returns active leave types available for new leave applications.
//
// ============================================================================

export async function listLeaveTypesController(
  req: Request,
  res: Response,
): Promise<void> {
  const leaveTypes = await listActiveLeaveTypes();

  res.status(200).json({
    success: true,
    data: leaveTypes,
  });
}

// ============================================================================
// GET SINGLE LEAVE REQUEST
// ============================================================================
//
// GET /api/leave/:id
//
// Current self-service behavior:
//
//   authenticated employee
//     -> only their own request
//
// ============================================================================

export async function getLeaveController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const id = getIdParam(req);

  const request = await getLeaveRequestById(id, employeeId);

  if (!request) {
    res.status(404).json({
      success: false,
      error: {
        code: "LEAVE_NOT_FOUND",
        message: "Leave request not found",
      },
    });

    return;
  }

  res.status(200).json({
    success: true,
    data: request,
  });
}

// ============================================================================
// APPROVE LEAVE REQUEST
// ============================================================================
//
// POST /api/leave/:id/approve
//
// Authorization:
//
// ADMIN
//   -> unrestricted
//
// MANAGER
//   -> same department
//
// TEAM_LEAD
//   -> same team
//
// EMPLOYEE
//   -> forbidden
//
// Approver identity comes ONLY from JWT.
//
// Audit:
//
//   LEAVE_APPROVE
// ============================================================================

export async function approveLeaveController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getIdParam(req);

  const body = req.body as {
    approvalNote?: unknown;
  };

  const actor = getAuthenticatedActor(req);

  const approvalNote =
    typeof body.approvalNote === "string" ? body.approvalNote : undefined;

  // --------------------------------------------------------------------------
  // Approve leave request.
  // --------------------------------------------------------------------------

  const request = await approveLeaveRequest(id, actor, {
    ...(approvalNote !== undefined
      ? {
          approvalNote,
        }
      : {}),
  });

  // --------------------------------------------------------------------------
  // Audit successful approval.
  //
  // Never log the complete request body because approvalNote may contain
  // sensitive business information.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.LEAVE_APPROVE,
    "LEAVE_REQUEST",
    {
      entityId: request.id,

      description: "Leave request approved",

      metadata: {
        approverUserId: actor.userId,

        approverEmployeeId: actor.employeeId,

        status: request.status,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: request,
  });
}

// ============================================================================
// REJECT LEAVE REQUEST
// ============================================================================
//
// POST /api/leave/:id/reject
//
// Same authorization model as approval.
//
// Audit:
//
//   LEAVE_REJECT
// ============================================================================

export async function rejectLeaveController(
  req: Request,
  res: Response,
): Promise<void> {
  const id = getIdParam(req);

  const body = req.body as {
    approvalNote?: unknown;
  };

  const actor = getAuthenticatedActor(req);

  const approvalNote =
    typeof body.approvalNote === "string" ? body.approvalNote : undefined;

  // --------------------------------------------------------------------------
  // Reject leave request.
  // --------------------------------------------------------------------------

  const request = await rejectLeaveRequest(id, actor, {
    ...(approvalNote !== undefined
      ? {
          approvalNote,
        }
      : {}),
  });

  // --------------------------------------------------------------------------
  // Audit successful rejection.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.LEAVE_REJECT,
    "LEAVE_REQUEST",
    {
      entityId: request.id,

      description: "Leave request rejected",

      metadata: {
        approverUserId: actor.userId,

        approverEmployeeId: actor.employeeId,

        status: request.status,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: request,
  });
}

// ============================================================================
// CANCEL LEAVE REQUEST
// ============================================================================
//
// POST /api/leave/:id/cancel
//
// Employee can only cancel their own PENDING request.
//
// Audit:
//
//   LEAVE_CANCEL
// ============================================================================

export async function cancelLeaveController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const id = getIdParam(req);

  // --------------------------------------------------------------------------
  // Cancel leave request.
  // --------------------------------------------------------------------------

  const request = await cancelLeaveRequest(id, employeeId);

  // --------------------------------------------------------------------------
  // Audit successful cancellation.
  // --------------------------------------------------------------------------

  await auditRequest(
    getAuditContext(req),
    AUDIT_ACTIONS.LEAVE_CANCEL,
    "LEAVE_REQUEST",
    {
      entityId: request.id,

      description: "Leave request cancelled",

      metadata: {
        employeeId,

        status: request.status,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: request,
  });
}

// ============================================================================
// ROUTE PARAMETER VALIDATION
// ============================================================================

function getIdParam(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new AppError(
      "LEAVE_REQUEST_ID_REQUIRED",
      "Leave request id is required",
      400,
    );
  }

  return id.trim();
}
