// ============================================================================
// EEMS - Project Monitoring
// Project Service
// ============================================================================
//
// Responsibilities:
//
//   - Project CRUD
//   - Organizational scope enforcement
//   - Project membership
//   - Project monitoring
//
// SECURITY:
//
//   Client-supplied departmentId / ownerEmployeeId is NEVER trusted for scope.
//   The service validates those relationships against the database.
// ============================================================================

import {
  ProjectMemberRole,
  ProjectStatus,
  RoleCode,
} from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";

import { AppError } from "@/middleware/app-error.js";

import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ProjectListQuery,
  ProjectScope,
  UpdateProjectInput,
} from "./project.types.js";

// ============================================================================
// PAGINATION
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ============================================================================
// REQUESTER
// ============================================================================

async function getRequester(scope: ProjectScope) {
  if (!scope.employeeId) {
    throw new AppError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Authenticated user is not linked to an employee profile",
      403,
    );
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: scope.employeeId,
    },

    select: {
      id: true,
      departmentId: true,
      teamId: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError(
      "EMPLOYEE_NOT_FOUND",
      "Authenticated employee profile was not found",
      403,
    );
  }

  return employee;
}

// ============================================================================
// PROJECT VISIBILITY
// ============================================================================

async function assertProjectVisible(
  projectId: string,
  scope: ProjectScope,
): Promise<void> {
  const requester = await getRequester(scope);

  if (scope.role === RoleCode.ADMIN) {
    return;
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },

    select: {
      id: true,
      departmentId: true,

      members: {
        where: {
          isActive: true,
        },

        select: {
          employeeId: true,

          employee: {
            select: {
              teamId: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  // --------------------------------------------------------------------------
  // Employee
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.EMPLOYEE) {
    const assigned = project.members.some(
      (member) => member.employeeId === requester.id,
    );

    if (!assigned) {
      throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    return;
  }

  // --------------------------------------------------------------------------
  // Manager
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.MANAGER) {
    if (project.departmentId !== requester.departmentId) {
      throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    return;
  }

  // --------------------------------------------------------------------------
  // Team Lead
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    const teamProject = project.members.some(
      (member) => member.employee.teamId === requester.teamId,
    );

    if (!teamProject) {
      throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    return;
  }

  throw new AppError(
    "PROJECT_ACCESS_DENIED",
    "You do not have permission to access projects",
    403,
  );
}

// ============================================================================
// DATE PARSER
// ============================================================================

function parseOptionalDate(
  value: string | undefined,
  fieldName: string,
): Date | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      `${fieldName.toUpperCase()}_INVALID`,
      `${fieldName} must be a valid date`,
      400,
    );
  }

  return date;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createProject(
  scope: ProjectScope,
  input: CreateProjectInput,
) {
  if (scope.role !== RoleCode.ADMIN && scope.role !== RoleCode.MANAGER) {
    throw new AppError(
      "PROJECT_CREATE_DENIED",
      "You do not have permission to create projects",
      403,
    );
  }

  const requester = await getRequester(scope);

  const code = input.code.trim().toUpperCase();

  const name = input.name.trim();

  if (!code) {
    throw new AppError(
      "PROJECT_CODE_REQUIRED",
      "Project code is required",
      400,
    );
  }

  if (!name) {
    throw new AppError(
      "PROJECT_NAME_REQUIRED",
      "Project name is required",
      400,
    );
  }

  if (code.length > 50) {
    throw new AppError(
      "PROJECT_CODE_INVALID",
      "Project code must not exceed 50 characters",
      400,
    );
  }

  if (name.length > 200) {
    throw new AppError(
      "PROJECT_NAME_INVALID",
      "Project name must not exceed 200 characters",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Department authorization.
  // --------------------------------------------------------------------------

  if (
    scope.role === RoleCode.MANAGER &&
    input.departmentId !== requester.departmentId
  ) {
    throw new AppError(
      "PROJECT_DEPARTMENT_DENIED",
      "Manager can create projects only for their department",
      403,
    );
  }

  const department = await prisma.department.findUnique({
    where: {
      id: input.departmentId,
    },

    select: {
      id: true,
      isActive: true,
    },
  });

  if (!department || !department.isActive) {
    throw new AppError(
      "DEPARTMENT_NOT_FOUND",
      "Active department not found",
      400,
    );
  }

  // --------------------------------------------------------------------------
  // Owner validation.
  // --------------------------------------------------------------------------

  const owner = await prisma.employee.findUnique({
    where: {
      id: input.ownerEmployeeId,
    },

    select: {
      id: true,
      departmentId: true,
      status: true,
    },
  });

  if (!owner) {
    throw new AppError(
      "PROJECT_OWNER_NOT_FOUND",
      "Project owner was not found",
      400,
    );
  }

  if (owner.status !== "ACTIVE") {
    throw new AppError(
      "PROJECT_OWNER_INACTIVE",
      "Project owner must be active",
      400,
    );
  }

  if (owner.departmentId !== input.departmentId) {
    throw new AppError(
      "PROJECT_OWNER_DEPARTMENT_MISMATCH",
      "Project owner must belong to the project department",
      400,
    );
  }

  const startDate = parseOptionalDate(input.startDate, "startDate");

  const endDate = parseOptionalDate(input.endDate, "endDate");

  if (startDate && endDate && endDate < startDate) {
    throw new AppError(
      "PROJECT_DATE_RANGE_INVALID",
      "endDate cannot be earlier than startDate",
      400,
    );
  }

  const existing = await prisma.project.findUnique({
    where: {
      code,
    },

    select: {
      id: true,
    },
  });

  if (existing) {
    throw new AppError(
      "PROJECT_CODE_EXISTS",
      "Project code already exists",
      409,
    );
  }

  const project = await prisma.project.create({
    data: {
      code,
      name,

      ...(input.description
        ? {
            description: input.description.trim(),
          }
        : {}),

      departmentId: input.departmentId,

      ownerEmployeeId: input.ownerEmployeeId,

      ...(startDate
        ? {
            startDate,
          }
        : {}),

      ...(endDate
        ? {
            endDate,
          }
        : {}),
    },

    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      ownerEmployee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },

      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  return project;
}

// ============================================================================
// LIST
// ============================================================================

export async function listProjects(
  scope: ProjectScope,
  query: ProjectListQuery = {},
) {
  const requester = await getRequester(scope);

  const page =
    query.page && query.page > 0 ? Math.floor(query.page) : DEFAULT_PAGE;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  // --------------------------------------------------------------------------
  // Admin
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.ADMIN) {
    // No restriction.
  }

  // --------------------------------------------------------------------------
  // Manager
  // --------------------------------------------------------------------------
  else if (scope.role === RoleCode.MANAGER) {
    where.departmentId = requester.departmentId;
  }

  // --------------------------------------------------------------------------
  // Employee
  // --------------------------------------------------------------------------
  else if (scope.role === RoleCode.EMPLOYEE) {
    where.members = {
      some: {
        employeeId: requester.id,

        isActive: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Team Lead
  // --------------------------------------------------------------------------
  else if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    where.members = {
      some: {
        isActive: true,

        employee: {
          teamId: requester.teamId,
        },
      },
    };
  } else {
    throw new AppError(
      "PROJECT_ACCESS_DENIED",
      "You do not have permission to access projects",
      403,
    );
  }

  if (
    query.status &&
    Object.values(ProjectStatus).includes(query.status as ProjectStatus)
  ) {
    where.status = query.status;
  }

  const [records, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,

      orderBy: {
        updatedAt: "desc",
      },

      skip,
      take: limit,

      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        ownerEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },

        _count: {
          select: {
            members: true,
          },
        },
      },
    }),

    prisma.project.count({
      where,
    }),
  ]);

  return {
    records,

    pagination: {
      page,
      limit,
      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// GET
// ============================================================================

export async function getProjectById(id: string, scope: ProjectScope) {
  await assertProjectVisible(id, scope);

  const project = await prisma.project.findUnique({
    where: {
      id,
    },

    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      ownerEmployee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },

      members: {
        where: {
          isActive: true,
        },

        orderBy: {
          assignedAt: "asc",
        },

        select: {
          id: true,
          role: true,
          assignedAt: true,

          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              departmentId: true,
              teamId: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  return project;
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateProject(
  id: string,
  scope: ProjectScope,
  input: UpdateProjectInput,
) {
  if (scope.role !== RoleCode.ADMIN && scope.role !== RoleCode.MANAGER) {
    throw new AppError(
      "PROJECT_UPDATE_DENIED",
      "You do not have permission to update projects",
      403,
    );
  }

  const existing = await prisma.project.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const requester = await getRequester(scope);

  if (
    scope.role === RoleCode.MANAGER &&
    existing.departmentId !== requester.departmentId
  ) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      throw new AppError(
        "PROJECT_NAME_REQUIRED",
        "Project name cannot be empty",
        400,
      );
    }

    data.name = name;
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  if (input.status !== undefined) {
    if (!Object.values(ProjectStatus).includes(input.status as ProjectStatus)) {
      throw new AppError(
        "PROJECT_STATUS_INVALID",
        "Invalid project status",
        400,
      );
    }

    data.status = input.status;
  }

  if (input.departmentId !== undefined) {
    if (
      scope.role === RoleCode.MANAGER &&
      input.departmentId !== requester.departmentId
    ) {
      throw new AppError(
        "PROJECT_DEPARTMENT_DENIED",
        "Manager cannot move a project outside their department",
        403,
      );
    }

    const department = await prisma.department.findUnique({
      where: {
        id: input.departmentId,
      },
    });

    if (!department || !department.isActive) {
      throw new AppError(
        "DEPARTMENT_NOT_FOUND",
        "Active department not found",
        400,
      );
    }

    data.departmentId = input.departmentId;
  }

  if (input.ownerEmployeeId !== undefined) {
    const departmentId =
      (data.departmentId as string | undefined) ?? existing.departmentId;

    const owner = await prisma.employee.findUnique({
      where: {
        id: input.ownerEmployeeId,
      },
    });

    if (!owner) {
      throw new AppError(
        "PROJECT_OWNER_NOT_FOUND",
        "Project owner was not found",
        400,
      );
    }

    if (owner.status !== "ACTIVE") {
      throw new AppError(
        "PROJECT_OWNER_INACTIVE",
        "Project owner must be active",
        400,
      );
    }

    if (owner.departmentId !== departmentId) {
      throw new AppError(
        "PROJECT_OWNER_DEPARTMENT_MISMATCH",
        "Project owner must belong to the project department",
        400,
      );
    }

    data.ownerEmployeeId = input.ownerEmployeeId;
  }

  const startDate = parseOptionalDate(input.startDate, "startDate");

  const endDate = parseOptionalDate(input.endDate, "endDate");

  if (startDate !== undefined) {
    data.startDate = startDate;
  }

  if (endDate !== undefined) {
    data.endDate = endDate;
  }

  const finalStart = (data.startDate as Date | undefined) ?? existing.startDate;

  const finalEnd = (data.endDate as Date | undefined) ?? existing.endDate;

  if (finalStart && finalEnd && finalEnd < finalStart) {
    throw new AppError(
      "PROJECT_DATE_RANGE_INVALID",
      "endDate cannot be earlier than startDate",
      400,
    );
  }

  return prisma.project.update({
    where: {
      id,
    },

    data,

    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      ownerEmployee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },

      _count: {
        select: {
          members: true,
        },
      },
    },
  });
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteProject(
  id: string,
  scope: ProjectScope,
): Promise<void> {
  if (scope.role !== RoleCode.ADMIN) {
    throw new AppError(
      "PROJECT_DELETE_DENIED",
      "Only administrators can delete projects",
      403,
    );
  }

  const existing = await prisma.project.findUnique({
    where: {
      id,
    },

    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  await prisma.project.delete({
    where: {
      id,
    },
  });
}

// ============================================================================
// ADD MEMBER
// ============================================================================

export async function addProjectMember(
  projectId: string,
  scope: ProjectScope,
  input: AddProjectMemberInput,
) {
  if (scope.role !== RoleCode.ADMIN && scope.role !== RoleCode.MANAGER) {
    throw new AppError(
      "PROJECT_MEMBER_MANAGE_DENIED",
      "You do not have permission to manage project members",
      403,
    );
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },

    select: {
      id: true,
      departmentId: true,
    },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const requester = await getRequester(scope);

  if (
    scope.role === RoleCode.MANAGER &&
    project.departmentId !== requester.departmentId
  ) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: input.employeeId,
    },

    select: {
      id: true,
      departmentId: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError("EMPLOYEE_NOT_FOUND", "Employee not found", 404);
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      "EMPLOYEE_INACTIVE",
      "Only active employees can be assigned to projects",
      400,
    );
  }

  if (employee.departmentId !== project.departmentId) {
    throw new AppError(
      "PROJECT_MEMBER_DEPARTMENT_MISMATCH",
      "Project member must belong to the project department",
      400,
    );
  }

  const role = input.role ?? ProjectMemberRole.MEMBER;

  if (!Object.values(ProjectMemberRole).includes(role as ProjectMemberRole)) {
    throw new AppError(
      "PROJECT_MEMBER_ROLE_INVALID",
      "Invalid project member role",
      400,
    );
  }

  const existing = await prisma.projectMember.findUnique({
    where: {
      projectId_employeeId: {
        projectId,
        employeeId: input.employeeId,
      },
    },
  });

  if (existing) {
    if (existing.isActive) {
      throw new AppError(
        "PROJECT_MEMBER_EXISTS",
        "Employee is already assigned to this project",
        409,
      );
    }

    return prisma.projectMember.update({
      where: {
        id: existing.id,
      },

      data: {
        role: role as ProjectMemberRole,
        isActive: true,
        assignedAt: new Date(),
      },

      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });
  }

  return prisma.projectMember.create({
    data: {
      projectId,
      employeeId: input.employeeId,

      role: role as ProjectMemberRole,
    },

    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
    },
  });
}

// ============================================================================
// REMOVE MEMBER
// ============================================================================

export async function removeProjectMember(
  projectId: string,
  employeeId: string,
  scope: ProjectScope,
): Promise<void> {
  if (scope.role !== RoleCode.ADMIN && scope.role !== RoleCode.MANAGER) {
    throw new AppError(
      "PROJECT_MEMBER_MANAGE_DENIED",
      "You do not have permission to manage project members",
      403,
    );
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },

    select: {
      id: true,
      departmentId: true,
    },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const requester = await getRequester(scope);

  if (
    scope.role === RoleCode.MANAGER &&
    project.departmentId !== requester.departmentId
  ) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_employeeId: {
        projectId,
        employeeId,
      },
    },
  });

  if (!member) {
    throw new AppError(
      "PROJECT_MEMBER_NOT_FOUND",
      "Project member not found",
      404,
    );
  }

  // Soft-remove membership so historical assignment is retained.
  await prisma.projectMember.update({
    where: {
      id: member.id,
    },

    data: {
      isActive: false,
    },
  });
}

// ============================================================================
// MONITORING
// ============================================================================
//
// Returns monitoring information without introducing task/sprint complexity.
// ============================================================================

export async function getProjectMonitoring(
  projectId: string,
  scope: ProjectScope,
) {
  await assertProjectVisible(projectId, scope);

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },

    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      ownerEmployee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          status: true,
        },
      },

      members: {
        where: {
          isActive: true,
        },

        select: {
          id: true,
          role: true,
          assignedAt: true,

          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              status: true,
              departmentId: true,
              teamId: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const activeMembers = project.members.filter(
    (member) => member.employee.status === "ACTIVE",
  ).length;

  const inactiveMembers = project.members.length - activeMembers;

  return {
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      department: project.department,
      owner: project.ownerEmployee,
    },

    monitoring: {
      memberCount: project.members.length,

      activeMembers,

      inactiveMembers,

      progressStatus: project.status,

      isActive: project.status === ProjectStatus.ACTIVE,
    },

    members: project.members,
  };
}
