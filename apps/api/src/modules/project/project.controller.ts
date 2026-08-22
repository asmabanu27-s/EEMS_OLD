// EEMS - Project Monitoring
// Project HTTP Controllers
// ============================================================================

import type { Request, Response } from "express";

import { AppError } from "@/middleware/app-error.js";

import { auditRequest } from "@/modules/audit/index.js";
import { AUDIT_ACTIONS } from "@/modules/audit/audit.types.js";

import {
  addProjectMember,
  createProject,
  deleteProject,
  getProjectById,
  getProjectMonitoring,
  listProjects,
  removeProjectMember,
  updateProject,
} from "./project.service.js";

import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ProjectListQuery,
  ProjectScope,
  UpdateProjectInput,
} from "./project.types.js";

// ============================================================================
// AUTHENTICATED SCOPE
// ============================================================================

function getScope(req: Request): ProjectScope {
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

  return {
    userId: req.user.sub,

    employeeId: req.user.employeeId,

    role: req.user.role,
  };
}

// ============================================================================
// ID
// ============================================================================

function getId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("PROJECT_ID_REQUIRED", "Project id is required", 400);
  }

  return id.trim();
}

// ============================================================================
// EMPLOYEE ID
// ============================================================================

function getEmployeeId(req: Request): string {
  const employeeId = req.params.employeeId;

  if (typeof employeeId !== "string" || !employeeId.trim()) {
    throw new AppError("EMPLOYEE_ID_REQUIRED", "Employee id is required", 400);
  }

  return employeeId.trim();
}

// ============================================================================
// LIST
// ============================================================================

export async function listProjectsController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const query: ProjectListQuery = {};

  if (typeof req.query.page === "string") {
    const page = Number(req.query.page);

    if (Number.isFinite(page)) {
      query.page = page;
    }
  }

  if (typeof req.query.limit === "string") {
    const limit = Number(req.query.limit);

    if (Number.isFinite(limit)) {
      query.limit = limit;
    }
  }

  if (typeof req.query.status === "string" && req.query.status.trim()) {
    query.status = req.query.status.trim();
  }

  const result = await listProjects(scope, query);

  res.status(200).json({
    success: true,
    data: result.records,
    meta: result.pagination,
  });
}

// ============================================================================
// CREATE
// ============================================================================

export async function createProjectController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const input = req.body as CreateProjectInput;

  const result = await createProject(scope, input);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.PROJECT_CREATE,
    "PROJECT",
    {
      entityId: result.id,
      description: "Project created",
      metadata: {
        code: result.code,
        name: result.name,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// GET
// ============================================================================

export async function getProjectController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getId(req);

  const result = await getProjectById(id, scope);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateProjectController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getId(req);

  const input = req.body as UpdateProjectInput;

  const result = await updateProject(id, scope, input);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.PROJECT_UPDATE,
    "PROJECT",
    {
      entityId: result.id,
      description: "Project updated",
      metadata: {
        code: result.code,
        updatedFields: Object.keys(req.body ?? {}),
      },
    },
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteProjectController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getId(req);

  await deleteProject(id, scope);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.PROJECT_DELETE,
    "PROJECT",
    {
      entityId: id,
      description: "Project deleted",
    },
  );

  res.status(200).json({
    success: true,

    data: {
      message: "Project deleted successfully",
    },
  });
}

// ============================================================================
// ADD MEMBER
// ============================================================================

export async function addProjectMemberController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const projectId = getId(req);

  const input = req.body as AddProjectMemberInput;

  if (typeof input.employeeId !== "string") {
    throw new AppError("EMPLOYEE_ID_REQUIRED", "employeeId is required", 400);
  }

  const result = await addProjectMember(projectId, scope, input);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.PROJECT_MEMBER_ADD,
    "PROJECT_MEMBER",
    {
      entityId: result.id,
      description: "Project member added",
      metadata: {
        projectId,
        employeeId: input.employeeId,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// REMOVE MEMBER
// ============================================================================

export async function removeProjectMemberController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const projectId = getId(req);

  const employeeId = getEmployeeId(req);

  await removeProjectMember(projectId, employeeId, scope);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.PROJECT_MEMBER_REMOVE,
    "PROJECT_MEMBER",
    {
      entityId: projectId,
      description: "Project member removed",
      metadata: {
        projectId,
        employeeId,
      },
    },
  );

  res.status(200).json({
    success: true,

    data: {
      message: "Project member removed successfully",
    },
  });
}

// ============================================================================
// MONITORING
// ============================================================================

export async function projectMonitoringController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getId(req);

  const result = await getProjectMonitoring(id, scope);

  res.status(200).json({
    success: true,
    data: result,
  });
}
