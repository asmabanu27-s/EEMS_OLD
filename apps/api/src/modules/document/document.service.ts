// ============================================================================
// EEMS - Document Management
// Document Service
// ============================================================================
//
// Responsibilities:
//
//   1. Validate employee.
//   2. Enforce organizational document scope.
//   3. Create document metadata.
//   4. List documents.
//   5. Get document metadata.
//   6. Delete documents.
//   7. Resolve physical storage information.
//
// SECURITY:
//
//   Employee:
//       own documents only.
//
//   Team Lead:
//       team documents.
//
//   Manager:
//       department documents.
//
//   Admin:
//       unrestricted.
//
// The service NEVER trusts employeeId supplied by the HTTP client.
// ============================================================================

import { RoleCode } from "@/generated/prisma/enums.js";

import { prisma } from "@/lib/prisma.js";
import { AppError } from "@/middleware/app-error.js";

import { deleteDocumentFile, saveDocumentFile } from "./document.storage.js";

import type {
  DocumentListQuery,
  DocumentListResult,
  DocumentScope,
} from "./document.types.js";

import type { Express } from "express";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ============================================================================
// REQUESTER
// ============================================================================

async function getRequester(scope: DocumentScope) {
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
// DOCUMENT SCOPE
// ============================================================================

function buildScopeWhere(
  scope: DocumentScope,
  requester: {
    id: string;
    departmentId: string;
    teamId: string | null;
  },
) {
  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.ADMIN) {
    return {};
  }

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.EMPLOYEE) {
    return {
      employeeId: requester.id,
    };
  }

  // --------------------------------------------------------------------------
  // MANAGER
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.MANAGER) {
    return {
      employee: {
        departmentId: requester.departmentId,
      },
    };
  }

  // --------------------------------------------------------------------------
  // TEAM LEAD
  // --------------------------------------------------------------------------

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId) {
      throw new AppError(
        "TEAM_REQUIRED",
        "Team Lead is not assigned to a team",
        403,
      );
    }

    return {
      employee: {
        teamId: requester.teamId,
      },
    };
  }

  throw new AppError(
    "DOCUMENT_ACCESS_DENIED",
    "You do not have permission to access documents",
    403,
  );
}

// ============================================================================
// RECORD SCOPE
// ============================================================================

async function assertDocumentScope(
  document: {
    employeeId: string;
  },
  scope: DocumentScope,
): Promise<void> {
  const requester = await getRequester(scope);

  if (scope.role === RoleCode.ADMIN) {
    return;
  }

  if (scope.role === RoleCode.EMPLOYEE) {
    if (document.employeeId !== requester.id) {
      throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
    }

    return;
  }

  const target = await prisma.employee.findUnique({
    where: {
      id: document.employeeId,
    },

    select: {
      id: true,
      departmentId: true,
      teamId: true,
    },
  });

  if (!target) {
    throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
  }

  if (scope.role === RoleCode.MANAGER) {
    if (target.departmentId !== requester.departmentId) {
      throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
    }

    return;
  }

  if (scope.role === RoleCode.TEAM_LEAD) {
    if (!requester.teamId || target.teamId !== requester.teamId) {
      throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
    }

    return;
  }

  throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
}

// ============================================================================
// CREATE
// ============================================================================

export async function createDocument(
  scope: DocumentScope,
  documentType: string,
  file: Express.Multer.File,
) {
  const requester = await getRequester(scope);

  if (!file) {
    throw new AppError(
      "DOCUMENT_FILE_REQUIRED",
      "Document file is required",
      400,
    );
  }

  const normalizedType = documentType.trim();

  if (!normalizedType) {
    throw new AppError(
      "DOCUMENT_TYPE_REQUIRED",
      "documentType is required",
      400,
    );
  }

  if (normalizedType.length > 100) {
    throw new AppError(
      "DOCUMENT_TYPE_INVALID",
      "documentType must not exceed 100 characters",
      400,
    );
  }

  // Employee ownership is always the authenticated employee.
  const employeeId = requester.id;

  let stored:
    | {
        storedName: string;
        storagePath: string;
      }
    | undefined;

  try {
    stored = await saveDocumentFile(file);

    const record = await prisma.document.create({
      data: {
        employeeId,

        originalName: file.originalname,

        storedName: stored.storedName,

        documentType: normalizedType,

        mimeType: file.mimetype,

        sizeBytes: file.size,

        storagePath: stored.storagePath,
      },
    });

    return record;
  } catch (error) {
    // --------------------------------------------------------------------------
    // Database failure after physical file creation.
    //
    // Remove the physical file to avoid orphaned storage.
    // --------------------------------------------------------------------------

    if (stored) {
      await deleteDocumentFile(stored.storedName).catch(() => undefined);
    }

    throw error;
  }
}

// ============================================================================
// LIST
// ============================================================================

export async function listDocuments(
  scope: DocumentScope,
  query: DocumentListQuery = {},
): Promise<DocumentListResult> {
  const requester = await getRequester(scope);

  const page =
    query.page && query.page > 0 ? Math.floor(query.page) : DEFAULT_PAGE;

  const limit =
    query.limit && query.limit > 0
      ? Math.min(Math.floor(query.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  const scopeWhere = buildScopeWhere(scope, requester);

  const documentType = query.documentType?.trim();

  const where = {
    ...scopeWhere,

    ...(documentType
      ? {
          documentType,
        }
      : {}),
  };

  const [records, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip,
      take: limit,

      select: {
        id: true,
        employeeId: true,
        originalName: true,
        documentType: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,

        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    }),

    prisma.document.count({
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
// GET BY ID
// ============================================================================

export async function getDocumentById(id: string, scope: DocumentScope) {
  if (!id.trim()) {
    throw new AppError("DOCUMENT_ID_REQUIRED", "Document id is required", 400);
  }

  const document = await prisma.document.findUnique({
    where: {
      id: id.trim(),
    },

    select: {
      id: true,
      employeeId: true,
      originalName: true,
      storedName: true,
      documentType: true,
      mimeType: true,
      sizeBytes: true,
      storagePath: true,
      createdAt: true,
      updatedAt: true,

      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
  }

  await assertDocumentScope(document, scope);

  return document;
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteDocument(
  id: string,
  scope: DocumentScope,
): Promise<void> {
  if (!id.trim()) {
    throw new AppError("DOCUMENT_ID_REQUIRED", "Document id is required", 400);
  }

  const document = await prisma.document.findUnique({
    where: {
      id: id.trim(),
    },

    select: {
      id: true,
      employeeId: true,
      storedName: true,
    },
  });

  if (!document) {
    throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
  }

  await assertDocumentScope(document, scope);

  // Delete DB metadata first only after storage is known.
  await prisma.document.delete({
    where: {
      id: document.id,
    },
  });

  // Storage cleanup is intentionally best-effort.
  //
  // A failed physical deletion should not leave a database record pointing
  // to a file that no longer exists.
  await deleteDocumentFile(document.storedName).catch(() => undefined);
}
