// ============================================================================
// EEMS - Document Management
// Document HTTP Controllers
// ============================================================================
//
// SECURITY:
//
//   employeeId comes ONLY from req.user.employeeId.
//
//   userId comes ONLY from req.user.sub.
//
//   role comes ONLY from req.user.role.
//
//   Never trust employeeId from multipart form-data.
// ============================================================================

import type { Request, Response } from "express";

import { AppError } from "@/middleware/app-error.js";

import { auditRequest } from "@/modules/audit/index.js";
import { AUDIT_ACTIONS } from "@/modules/audit/audit.types.js";

import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
} from "./document.service.js";

import {
  readDocumentFile,
  validateDocumentContent,
} from "./document.storage.js";

import type { DocumentListQuery, DocumentScope } from "./document.types.js";

// ============================================================================
// AUTHENTICATED SCOPE
// ============================================================================

function getScope(req: Request): DocumentScope {
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
// PATH ID
// ============================================================================

function getPathId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new AppError("DOCUMENT_ID_REQUIRED", "Document id is required", 400);
  }

  return id.trim();
}

// ============================================================================
// LIST
// ============================================================================

export async function listDocumentsController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const page =
    typeof req.query.page === "string" ? Number(req.query.page) : undefined;

  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

  const documentType =
    typeof req.query.documentType === "string"
      ? req.query.documentType
      : undefined;

  const query: DocumentListQuery = {
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

    ...(documentType !== undefined
      ? {
          documentType,
        }
      : {}),
  };

  const result = await listDocuments(scope, query);

  res.status(200).json({
    success: true,

    data: result.records,

    meta: result.pagination,
  });
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getDocumentController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getPathId(req);

  const result = await getDocumentById(id, scope);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// UPLOAD
// ============================================================================

export async function uploadDocumentController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const file = req.file;

  if (!file) {
    throw new AppError(
      "DOCUMENT_FILE_REQUIRED",
      "Document file is required. Use multipart field name 'file'.",
      400,
    );
  }

  try {
    await validateDocumentContent(file);
  } catch (error) {
    throw new AppError(
      "INVALID_DOCUMENT",
      error instanceof Error ? error.message : "Invalid document file",
      400,
    );
  }

  const documentType =
    typeof req.body?.documentType === "string" ? req.body.documentType : "";

  const result = await createDocument(scope, documentType, file);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.DOCUMENT_UPLOAD,
    "DOCUMENT",
    {
      entityId: result.id,
      description: "Document uploaded",
      metadata: {
        documentType: result.documentType,
        originalName: result.originalName,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: result,
  });
}

// ============================================================================
// DOWNLOAD
// ============================================================================

export async function downloadDocumentController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getPathId(req);

  const document = await getDocumentById(id, scope);

  const file = await readDocumentFile(document.storedName);

  res.setHeader("Content-Type", document.mimeType);

  res.setHeader("Content-Length", file.length.toString());

  // attachment forces download instead of inline browser rendering.
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(document.originalName)}"`,
  );

  res.status(200).send(file);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteDocumentController(
  req: Request,
  res: Response,
): Promise<void> {
  const scope = getScope(req);

  const id = getPathId(req);

  const document = await getDocumentById(id, scope);

  await deleteDocument(id, scope);

  await auditRequest(
    {
      userId: scope.userId,
      employeeId: scope.employeeId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    },
    AUDIT_ACTIONS.DOCUMENT_DELETE,
    "DOCUMENT",
    {
      entityId: id,
      description: "Document deleted",
      metadata: {
        originalName: document.originalName,
        documentType: document.documentType,
      },
    },
  );

  res.status(200).json({
    success: true,

    data: {
      message: "Document deleted successfully",
    },
  });
}
