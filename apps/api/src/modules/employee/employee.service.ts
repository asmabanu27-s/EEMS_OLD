// ============================================================================
// EEMS - Employee Management
// Employee Service
// ============================================================================
//
// Production responsibilities:
//
// 1. Employee CRUD
// 2. Organizational validation
// 3. Role-based organizational scope
// 4. Duplicate protection
// 5. Soft termination
// 6. Historical-data preservation
//
// Scope:
//
// ADMIN
//   -> All employees
//
// MANAGER
//   -> Own department
//
// TEAM_LEAD
//   -> Own team
//
// EMPLOYEE
//   -> Own employee record
//
// ============================================================================

import type { EmployeeStatus } from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";
import { AppError } from "@/middleware/app-error.js";

import type {
  CreateEmployeeInput,
  EmployeeActor,
  EmployeeListQuery,
  UpdateEmployeeInput,
} from "./employee.types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ============================================================================
// COMMON INCLUDE
// ============================================================================

const employeeInclude = {
  department: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },

  team: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },

  position: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function requireNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new AppError("VALIDATION_ERROR", `${fieldName} is required`, 400);
  }

  return normalized;
}

function parseOptionalDate(
  value: string | undefined | null,
  fieldName: string,
): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${fieldName} must be a valid date`,
      400,
    );
  }

  return date;
}

// ============================================================================
// ACTOR VALIDATION
// ============================================================================

function requireActor(actor: EmployeeActor): void {
  if (!actor.userId) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
      401,
    );
  }
}

// ============================================================================
// GET ACTOR EMPLOYEE
// ============================================================================

async function getActorEmployee(actor: EmployeeActor) {
  requireActor(actor);

  if (!actor.employeeId) {
    return null;
  }

  return prisma.employee.findUnique({
    where: {
      id: actor.employeeId,
    },
    select: {
      id: true,
      departmentId: true,
      teamId: true,
      status: true,
    },
  });
}

// ============================================================================
// CHECK EMPLOYEE ACCESS
// ============================================================================
//
// Returns whether the authenticated actor can access the target employee.
//
// ADMIN
//   unrestricted
//
// MANAGER
//   same department
//
// TEAM_LEAD
//   same team
//
// EMPLOYEE
//   own employee record
//
// ============================================================================

async function assertEmployeeAccess(
  actor: EmployeeActor,
  targetEmployee: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
): Promise<void> {
  requireActor(actor);

  if (actor.role === "ADMIN") {
    return;
  }

  const actorEmployee = await getActorEmployee(actor);

  if (!actorEmployee) {
    throw new AppError(
      "FORBIDDEN",
      "Authenticated user is not linked to an employee",
      403,
    );
  }

  if (actor.role === "MANAGER") {
    if (actorEmployee.departmentId !== targetEmployee.departmentId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only access employees within your department",
        403,
      );
    }

    return;
  }

  if (actor.role === "TEAM_LEAD") {
    if (
      !actorEmployee.teamId ||
      actorEmployee.teamId !== targetEmployee.teamId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You can only access employees within your team",
        403,
      );
    }

    return;
  }

  if (actor.role === "EMPLOYEE") {
    if (actorEmployee.id !== targetEmployee.id) {
      throw new AppError(
        "FORBIDDEN",
        "You can only access your own employee record",
        403,
      );
    }

    return;
  }

  throw new AppError(
    "FORBIDDEN",
    "You do not have permission to access this employee",
    403,
  );
}

// ============================================================================
// CHECK CREATE SCOPE
// ============================================================================

async function assertCreateScope(
  actor: EmployeeActor,
  departmentId: string,
  teamId?: string,
): Promise<void> {
  requireActor(actor);

  if (actor.role === "ADMIN") {
    return;
  }

  const actorEmployee = await getActorEmployee(actor);

  if (!actorEmployee) {
    throw new AppError(
      "FORBIDDEN",
      "Authenticated user is not linked to an employee",
      403,
    );
  }

  if (actor.role === "MANAGER") {
    if (actorEmployee.departmentId !== departmentId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only create employees within your department",
        403,
      );
    }

    return;
  }

  if (actor.role === "TEAM_LEAD") {
    if (!actorEmployee.teamId || !teamId || actorEmployee.teamId !== teamId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only create employees within your team",
        403,
      );
    }

    return;
  }

  throw new AppError(
    "FORBIDDEN",
    "You do not have permission to create employees",
    403,
  );
}

// ============================================================================
// CHECK UPDATE SCOPE
// ============================================================================

async function assertUpdateScope(
  actor: EmployeeActor,
  existingEmployee: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
  newDepartmentId?: string,
  newTeamId?: string | null,
): Promise<void> {
  requireActor(actor);

  if (actor.role === "ADMIN") {
    return;
  }

  const actorEmployee = await getActorEmployee(actor);

  if (!actorEmployee) {
    throw new AppError(
      "FORBIDDEN",
      "Authenticated user is not linked to an employee",
      403,
    );
  }

  if (actor.role === "EMPLOYEE") {
    if (actorEmployee.id !== existingEmployee.id) {
      throw new AppError(
        "FORBIDDEN",
        "You can only update your own employee record",
        403,
      );
    }

    // Employees cannot change organizational placement/status.
    if (newDepartmentId !== undefined || newTeamId !== undefined) {
      throw new AppError(
        "FORBIDDEN",
        "Employees cannot change department or team",
        403,
      );
    }

    return;
  }

  if (actor.role === "MANAGER") {
    if (actorEmployee.departmentId !== existingEmployee.departmentId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only update employees within your department",
        403,
      );
    }

    if (
      newDepartmentId !== undefined &&
      newDepartmentId !== actorEmployee.departmentId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You cannot move an employee outside your department",
        403,
      );
    }

    return;
  }

  if (actor.role === "TEAM_LEAD") {
    if (
      !actorEmployee.teamId ||
      actorEmployee.teamId !== existingEmployee.teamId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You can only update employees within your team",
        403,
      );
    }

    if (newDepartmentId !== undefined || newTeamId !== undefined) {
      if (newTeamId !== undefined && newTeamId !== actorEmployee.teamId) {
        throw new AppError(
          "FORBIDDEN",
          "You cannot move an employee outside your team",
          403,
        );
      }

      if (
        newDepartmentId !== undefined &&
        newDepartmentId !== actorEmployee.departmentId
      ) {
        throw new AppError(
          "FORBIDDEN",
          "You cannot move an employee outside your department",
          403,
        );
      }
    }

    return;
  }

  throw new AppError(
    "FORBIDDEN",
    "You do not have permission to update this employee",
    403,
  );
}

// ============================================================================
// CREATE
// ============================================================================

export async function createEmployee(
  actor: EmployeeActor,
  input: CreateEmployeeInput,
) {
  requireActor(actor);

  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Employee request body is required",
      400,
    );
  }

  const employeeCode = requireNonEmpty(
    input.employeeCode,
    "employeeCode",
  ).toUpperCase();

  const firstName = requireNonEmpty(input.firstName, "firstName");

  const departmentId = requireNonEmpty(input.departmentId, "departmentId");

  // --------------------------------------------------------------------------
  // Validate authorization scope first.
  // --------------------------------------------------------------------------

  await assertCreateScope(actor, departmentId, input.teamId);

  // --------------------------------------------------------------------------
  // Duplicate employee code.
  // --------------------------------------------------------------------------

  const existingEmployee = await prisma.employee.findUnique({
    where: {
      employeeCode,
    },
    select: {
      id: true,
    },
  });

  if (existingEmployee) {
    throw new AppError(
      "EMPLOYEE_CODE_EXISTS",
      `Employee code '${employeeCode}' already exists`,
      409,
    );
  }

  // --------------------------------------------------------------------------
  // Validate department.
  // --------------------------------------------------------------------------

  const department = await prisma.department.findUnique({
    where: {
      id: departmentId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!department) {
    throw new AppError("DEPARTMENT_NOT_FOUND", "Department not found", 404);
  }

  if (!department.isActive) {
    throw new AppError("DEPARTMENT_INACTIVE", "Department is inactive", 400);
  }

  // --------------------------------------------------------------------------
  // Validate team.
  // --------------------------------------------------------------------------

  if (input.teamId) {
    const team = await prisma.team.findUnique({
      where: {
        id: input.teamId,
      },
      select: {
        id: true,
        departmentId: true,
        isActive: true,
      },
    });

    if (!team) {
      throw new AppError("TEAM_NOT_FOUND", "Team not found", 404);
    }

    if (!team.isActive) {
      throw new AppError("TEAM_INACTIVE", "Team is inactive", 400);
    }

    if (team.departmentId !== departmentId) {
      throw new AppError(
        "TEAM_DEPARTMENT_MISMATCH",
        "Selected team does not belong to the selected department",
        400,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Validate position.
  // --------------------------------------------------------------------------

  if (input.positionId) {
    const position = await prisma.position.findUnique({
      where: {
        id: input.positionId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!position) {
      throw new AppError("POSITION_NOT_FOUND", "Position not found", 404);
    }

    if (!position.isActive) {
      throw new AppError("POSITION_INACTIVE", "Position is inactive", 400);
    }
  }

  // --------------------------------------------------------------------------
  // Create employee.
  // --------------------------------------------------------------------------

  return prisma.employee.create({
    data: {
      employeeCode,

      firstName,

      lastName: input.lastName?.trim() || null,

      displayName:
        input.displayName?.trim() ||
        `${firstName}${input.lastName ? ` ${input.lastName.trim()}` : ""}`,

      phone: input.phone?.trim() || null,

      dateOfJoining: parseOptionalDate(input.dateOfJoining, "dateOfJoining"),

      dateOfBirth: parseOptionalDate(input.dateOfBirth, "dateOfBirth"),

      departmentId,

      teamId: input.teamId || null,

      positionId: input.positionId || null,
    },

    include: employeeInclude,
  });
}

// ============================================================================
// LIST
// ============================================================================

export async function listEmployees(
  actor: EmployeeActor,
  query: EmployeeListQuery,
) {
  requireActor(actor);

  const page = Math.max(DEFAULT_PAGE, query.page ?? DEFAULT_PAGE);

  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));

  const skip = (page - 1) * limit;

  const search = query.search?.trim();

  // --------------------------------------------------------------------------
  // Determine organizational scope.
  // --------------------------------------------------------------------------

  const actorEmployee = await getActorEmployee(actor);

  if (actor.role !== "ADMIN" && !actorEmployee) {
    throw new AppError(
      "FORBIDDEN",
      "Authenticated user is not linked to an employee",
      403,
    );
  }

  const where: Record<string, unknown> = {};

  // --------------------------------------------------------------------------
  // Role-based scope.
  // --------------------------------------------------------------------------

  if (actor.role === "ADMIN") {
    // No organizational restriction.
  } else if (actor.role === "MANAGER") {
    where.departmentId = actorEmployee!.departmentId;
  } else if (actor.role === "TEAM_LEAD") {
    if (!actorEmployee!.teamId) {
      throw new AppError(
        "FORBIDDEN",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    where.teamId = actorEmployee!.teamId;
  } else if (actor.role === "EMPLOYEE") {
    where.id = actorEmployee!.id;
  } else {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to view employees",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // Additional filters.
  //
  // Filters cannot escape the role-based scope.
  // --------------------------------------------------------------------------

  if (query.departmentId) {
    if (
      actor.role === "MANAGER" &&
      query.departmentId !== actorEmployee!.departmentId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You can only view employees within your department",
        403,
      );
    }

    if (
      actor.role === "TEAM_LEAD" &&
      query.departmentId !== actorEmployee!.departmentId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You can only view employees within your department",
        403,
      );
    }

    if (
      actor.role === "EMPLOYEE" &&
      query.departmentId !== actorEmployee!.departmentId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You can only view employees within your department",
        403,
      );
    }

    where.departmentId = query.departmentId;
  }

  if (query.teamId) {
    if (actor.role === "TEAM_LEAD" && query.teamId !== actorEmployee!.teamId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only view employees within your team",
        403,
      );
    }

    if (actor.role === "EMPLOYEE" && query.teamId !== actorEmployee!.teamId) {
      throw new AppError(
        "FORBIDDEN",
        "You can only view employees within your team",
        403,
      );
    }

    where.teamId = query.teamId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (search) {
    where.OR = [
      {
        employeeCode: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        firstName: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        lastName: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        displayName: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  // --------------------------------------------------------------------------
  // Query.
  // --------------------------------------------------------------------------

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: [
        {
          firstName: "asc",
        },
        {
          employeeCode: "asc",
        },
      ],
      skip,
      take: limit,
    }),

    prisma.employee.count({
      where,
    }),
  ]);

  return {
    employees,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getEmployeeById(actor: EmployeeActor, id: string) {
  requireActor(actor);

  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
    include: employeeInclude,
  });

  if (!employee) {
    return null;
  }

  await assertEmployeeAccess(actor, {
    id: employee.id,
    departmentId: employee.department.id,
    teamId: employee.team?.id ?? null,
  });

  return employee;
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateEmployee(
  actor: EmployeeActor,
  id: string,
  input: UpdateEmployeeInput,
) {
  requireActor(actor);

  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      employeeCode: true,
      departmentId: true,
      teamId: true,
      status: true,
    },
  });

  if (!existingEmployee) {
    return null;
  }

  // --------------------------------------------------------------------------
  // Authorization scope.
  // --------------------------------------------------------------------------

  await assertUpdateScope(
    actor,
    {
      id: existingEmployee.id,
      departmentId: existingEmployee.departmentId,
      teamId: existingEmployee.teamId,
    },
    input.departmentId,
    input.teamId,
  );

  // --------------------------------------------------------------------------
  // Employee code.
  // --------------------------------------------------------------------------

  let normalizedEmployeeCode: string | undefined;

  if (input.employeeCode !== undefined) {
    normalizedEmployeeCode = requireNonEmpty(
      input.employeeCode,
      "employeeCode",
    ).toUpperCase();

    const duplicate = await prisma.employee.findFirst({
      where: {
        employeeCode: normalizedEmployeeCode,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new AppError(
        "EMPLOYEE_CODE_EXISTS",
        `Employee code '${normalizedEmployeeCode}' already exists`,
        409,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Department.
  // --------------------------------------------------------------------------

  const finalDepartmentId = input.departmentId ?? existingEmployee.departmentId;

  const department = await prisma.department.findUnique({
    where: {
      id: finalDepartmentId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!department) {
    throw new AppError("DEPARTMENT_NOT_FOUND", "Department not found", 404);
  }

  if (!department.isActive) {
    throw new AppError("DEPARTMENT_INACTIVE", "Department is inactive", 400);
  }

  // --------------------------------------------------------------------------
  // Team.
  // --------------------------------------------------------------------------

  const finalTeamId =
    input.teamId !== undefined ? input.teamId : existingEmployee.teamId;

  if (finalTeamId) {
    const team = await prisma.team.findUnique({
      where: {
        id: finalTeamId,
      },
      select: {
        id: true,
        departmentId: true,
        isActive: true,
      },
    });

    if (!team) {
      throw new AppError("TEAM_NOT_FOUND", "Team not found", 404);
    }

    if (!team.isActive) {
      throw new AppError("TEAM_INACTIVE", "Team is inactive", 400);
    }

    if (team.departmentId !== finalDepartmentId) {
      throw new AppError(
        "TEAM_DEPARTMENT_MISMATCH",
        "Selected team does not belong to the selected department",
        400,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Position.
  // --------------------------------------------------------------------------

  if (input.positionId) {
    const position = await prisma.position.findUnique({
      where: {
        id: input.positionId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!position) {
      throw new AppError("POSITION_NOT_FOUND", "Position not found", 404);
    }

    if (!position.isActive) {
      throw new AppError("POSITION_INACTIVE", "Position is inactive", 400);
    }
  }

  // --------------------------------------------------------------------------
  // Employee status protection.
  // --------------------------------------------------------------------------

  if (input.status !== undefined && actor.role !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Only administrators can change employee status",
      403,
    );
  }

  // --------------------------------------------------------------------------
  // Build update data.
  // --------------------------------------------------------------------------

  const data = {
    ...(normalizedEmployeeCode !== undefined
      ? {
          employeeCode: normalizedEmployeeCode,
        }
      : {}),

    ...(input.firstName !== undefined
      ? {
          firstName: requireNonEmpty(input.firstName, "firstName"),
        }
      : {}),

    ...(input.lastName !== undefined
      ? {
          lastName: input.lastName?.trim() || null,
        }
      : {}),

    ...(input.displayName !== undefined
      ? {
          displayName: input.displayName?.trim() || null,
        }
      : {}),

    ...(input.phone !== undefined
      ? {
          phone: input.phone?.trim() || null,
        }
      : {}),

    ...(input.dateOfJoining !== undefined
      ? {
          dateOfJoining: parseOptionalDate(
            input.dateOfJoining,
            "dateOfJoining",
          ),
        }
      : {}),

    ...(input.dateOfBirth !== undefined
      ? {
          dateOfBirth: parseOptionalDate(input.dateOfBirth, "dateOfBirth"),
        }
      : {}),

    ...(input.departmentId !== undefined
      ? {
          departmentId: input.departmentId,
        }
      : {}),

    ...(input.teamId !== undefined
      ? {
          teamId: input.teamId,
        }
      : {}),

    ...(input.positionId !== undefined
      ? {
          positionId: input.positionId,
        }
      : {}),

    ...(input.status !== undefined
      ? {
          status: input.status,
        }
      : {}),
  };

  // --------------------------------------------------------------------------
  // Update.
  // --------------------------------------------------------------------------

  return prisma.employee.update({
    where: {
      id,
    },
    data,
    include: employeeInclude,
  });
}

// ============================================================================
// DELETE / SOFT TERMINATION
// ============================================================================

export async function deleteEmployee(actor: EmployeeActor, id: string) {
  requireActor(actor);

  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      departmentId: true,
      teamId: true,
      status: true,
    },
  });

  if (!employee) {
    return null;
  }

  // --------------------------------------------------------------------------
  // Only ADMIN and MANAGER can terminate.
  //
  // Team Leads and Employees cannot terminate employees.
  // --------------------------------------------------------------------------

  if (actor.role !== "ADMIN" && actor.role !== "MANAGER") {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to terminate employees",
      403,
    );
  }

  await assertEmployeeAccess(actor, {
    id: employee.id,
    departmentId: employee.departmentId,
    teamId: employee.teamId,
  });

  // --------------------------------------------------------------------------
  // Already terminated.
  // --------------------------------------------------------------------------

  if (employee.status === ("TERMINATED" as EmployeeStatus)) {
    throw new AppError(
      "EMPLOYEE_ALREADY_TERMINATED",
      "Employee is already terminated",
      409,
    );
  }

  // --------------------------------------------------------------------------
  // Soft delete.
  //
  // Historical attendance, leave and timesheet data are preserved.
  // --------------------------------------------------------------------------

  return prisma.employee.update({
    where: {
      id,
    },

    data: {
      status: "TERMINATED" as EmployeeStatus,
    },

    include: employeeInclude,
  });
}
