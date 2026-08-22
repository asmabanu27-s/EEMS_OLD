// ============================================================================
// EEMS - Document Management
// Document Storage
// ============================================================================
//
// Current implementation:
//   Local filesystem storage.
//
// Production storage abstraction:
//   The service does NOT know how files are physically stored.
//
// Security:
//   - Server-generated filenames.
//   - No user-controlled path.
//   - Files are stored outside src/.
//   - Maximum upload size is enforced by multer.
// ============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import type { Express } from "express";
import { fileTypeFromBuffer } from "file-type";

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

const DOCUMENT_STORAGE_ROOT =
  process.env.DOCUMENT_STORAGE_PATH?.trim() ||
  path.resolve(process.cwd(), "storage", "documents");

// Maximum file size.
//
// This MUST match the multer configuration in document.routes.ts.
//
// 10 MB is intentionally conservative for an employee-management system.
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

// ============================================================================
// ALLOWED FILE TYPES
// ============================================================================
//
// MIME type comes from the request and therefore cannot be trusted alone.
//
// We also inspect the file signature where possible.
//
// ============================================================================

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",

  "image/jpeg",
  "image/png",

  "application/msword",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

// ============================================================================
// DIRECTORY INITIALIZATION
// ============================================================================

export async function ensureDocumentStorage(): Promise<void> {
  await fs.mkdir(DOCUMENT_STORAGE_ROOT, {
    recursive: true,
  });
}

// ============================================================================
// EXTENSION VALIDATION
// ============================================================================

export function validateDocumentExtension(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported document file extension");
  }

  return extension;
}

// ============================================================================
// CONTENT VALIDATION
// ============================================================================
//
// Validate file signature when file-type can identify it.
//
// Office Open XML files (.docx/.xlsx) are ZIP containers.
// Legacy .doc/.xls files are OLE/CFB containers.
//
// ============================================================================

export async function validateDocumentContent(
  file: Express.Multer.File,
): Promise<void> {
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("Document file size is invalid");
  }

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
    throw new Error("Unsupported document MIME type");
  }

  const extension = validateDocumentExtension(file.originalname);

  const detected = await fileTypeFromBuffer(file.buffer);

  // --------------------------------------------------------------------------
  // PDF
  // --------------------------------------------------------------------------

  if (extension === ".pdf") {
    if (detected?.ext !== "pdf") {
      throw new Error("Uploaded file content does not match PDF format");
    }

    return;
  }

  // --------------------------------------------------------------------------
  // Images
  // --------------------------------------------------------------------------

  if (extension === ".jpg" || extension === ".jpeg") {
    if (detected?.ext !== "jpg") {
      throw new Error("Uploaded file content does not match JPEG format");
    }

    return;
  }

  if (extension === ".png") {
    if (detected?.ext !== "png") {
      throw new Error("Uploaded file content does not match PNG format");
    }

    return;
  }

  // --------------------------------------------------------------------------
  // Modern Office documents.
  //
  // DOCX/XLSX are ZIP containers.
  // --------------------------------------------------------------------------

  if (extension === ".docx" || extension === ".xlsx") {
    if (detected?.ext !== "zip") {
      throw new Error("Uploaded Office Open XML file content is invalid");
    }

    return;
  }

  // --------------------------------------------------------------------------
  // Legacy Microsoft Office documents.
  //
  // file-type identifies these as CFB/OLE containers.
  // --------------------------------------------------------------------------

  if (extension === ".doc" || extension === ".xls") {
    if (detected?.ext !== "cfb" && detected?.mime !== "application/x-cfb") {
      throw new Error("Uploaded legacy Office file content is invalid");
    }
  }
}

// ============================================================================
// SAVE FILE
// ============================================================================

export async function saveDocumentFile(file: Express.Multer.File): Promise<{
  storedName: string;
  storagePath: string;
}> {
  await ensureDocumentStorage();

  const extension = validateDocumentExtension(file.originalname);

  // UUID-based physical filename.
  //
  // The original filename is NEVER used as a storage path.
  const storedName = `${crypto.randomUUID()}${extension}`;

  const absolutePath = path.join(DOCUMENT_STORAGE_ROOT, storedName);

  // Final path safety check.
  const resolvedRoot = path.resolve(DOCUMENT_STORAGE_ROOT);

  const resolvedFile = path.resolve(absolutePath);

  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Invalid document storage path");
  }

  await fs.writeFile(resolvedFile, file.buffer, {
    flag: "wx",
  });

  return {
    storedName,

    // Database stores only a relative logical path.
    storagePath: storedName,
  };
}

// ============================================================================
// DELETE FILE
// ============================================================================

export async function deleteDocumentFile(storedName: string): Promise<void> {
  const resolvedRoot = path.resolve(DOCUMENT_STORAGE_ROOT);

  const absolutePath = path.resolve(DOCUMENT_STORAGE_ROOT, storedName);

  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Invalid document storage path");
  }

  await fs.rm(absolutePath, {
    force: true,
  });
}

// ============================================================================
// READ FILE
// ============================================================================

export async function readDocumentFile(storedName: string): Promise<Buffer> {
  const resolvedRoot = path.resolve(DOCUMENT_STORAGE_ROOT);

  const absolutePath = path.resolve(DOCUMENT_STORAGE_ROOT, storedName);

  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Invalid document storage path");
  }

  return fs.readFile(absolutePath);
}
