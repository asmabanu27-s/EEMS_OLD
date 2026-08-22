// EEMS - Document Management
// Document Routes
// ============================================================================
//
// Base path:
//
//   /api/documents
//
// Security:
//
//   authenticate()
//        |
//        v
//   authorize()
//        |
//        v
//   controller
//        |
//        v
//   service
//
// IMPORTANT:
//
//   upload route uses multer memory storage.
//   File is validated before being persisted.
// ============================================================================

import { Router } from "express";

import multer from "multer";

import { authenticate } from "@/middleware/authenticate.js";

import { authorize } from "@/middleware/authorize.js";

import {
  MAX_DOCUMENT_SIZE_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from "./document.storage.js";

import {
  deleteDocumentController,
  downloadDocumentController,
  getDocumentController,
  listDocumentsController,
  uploadDocumentController,
} from "./document.controller.js";

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================
//
// Memory storage is used because we perform content validation before writing
// the file to permanent storage.
//
// The hard size limit prevents uncontrolled memory usage.
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_DOCUMENT_SIZE_BYTES,

    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Unsupported document MIME type"));

      return;
    }

    callback(null, true);
  },
});

// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// All document endpoints require authentication.
router.use(authenticate);

// ============================================================================
// LIST
// ============================================================================
//
// GET /api/documents
//
// Permission:
//   DOCUMENT_VIEW
//
// Scope:
//   Employee -> own
//   Team Lead -> team
//   Manager -> department
//   Admin -> all
// ============================================================================

router.get("/", authorize("DOCUMENT_VIEW"), listDocumentsController);

// ============================================================================
// GET METADATA
// ============================================================================
//
// GET /api/documents/:id
// ============================================================================

router.get("/:id", authorize("DOCUMENT_VIEW"), getDocumentController);

// ============================================================================
// DOWNLOAD
// ============================================================================
//
// GET /api/documents/:id/download
//
// IMPORTANT:
// This route MUST appear before /:id.
// ============================================================================

router.get(
  "/:id/download",
  authorize("DOCUMENT_VIEW"),
  downloadDocumentController,
);

// ============================================================================
// UPLOAD
// ============================================================================
//
// POST /api/documents
//
// Content-Type:
//   multipart/form-data
//
// Fields:
//
//   documentType
//   file
//
// ============================================================================

router.post(
  "/",
  authorize("DOCUMENT_UPLOAD"),
  upload.single("file"),
  uploadDocumentController,
);

// ============================================================================
// DELETE
// ============================================================================
//
// DELETE /api/documents/:id
//
// For the first production version, deletion is intentionally restricted to
// ADMIN by requiring DOCUMENT_DELETE.
//
// ============================================================================

router.delete("/:id", authorize("DOCUMENT_DELETE"), deleteDocumentController);

export default router;
