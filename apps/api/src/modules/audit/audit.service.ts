// ============================================================================
// EEMS - Employee Management System
// Audit Service
// ============================================================================
//
// Centralized audit logging.
//
// IMPORTANT:
//   Audit failures must NEVER break the primary business transaction.
//
// Never log:
//   - passwords
//   - JWTs
//   - refresh tokens
//   - authorization headers
//   - sensitive credentials
//
// ============================================================================

import { prisma } from "@/lib/prisma.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CreateAuditLogInput {
  userId?: string | null;
  employeeId?: string | null;

  action: string;
  entity: string;
  entityId?: string | null;

  description?: string | null;

  metadata?: Record<string, unknown>;

  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================================
// CREATE AUDIT LOG
// ============================================================================

export async function createAuditLog(
  input: CreateAuditLogInput,
): Promise<void> {
  try {
    const data: {
      userId?: string | null;
      employeeId?: string | null;

      action: string;
      entity: string;
      entityId?: string | null;

      description?: string | null;

      metadata?: Record<string, unknown>;

      ipAddress?: string | null;
      userAgent?: string | null;
    } = {
      action: input.action,
      entity: input.entity,
    };

    // ------------------------------------------------------------------------
    // Optional scalar fields
    // ------------------------------------------------------------------------

    if (input.userId !== undefined) {
      data.userId = input.userId;
    }

    if (input.employeeId !== undefined) {
      data.employeeId = input.employeeId;
    }

    if (input.entityId !== undefined) {
      data.entityId = input.entityId;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.ipAddress !== undefined) {
      data.ipAddress = input.ipAddress;
    }

    if (input.userAgent !== undefined) {
      data.userAgent = input.userAgent;
    }

    // ------------------------------------------------------------------------
    // JSON metadata
    //
    // IMPORTANT:
    // Prisma 7 does not accept JavaScript null directly for this JSON field.
    // Therefore metadata is only added when an actual object is supplied.
    // ------------------------------------------------------------------------

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    await prisma.auditLog.create({
      data: data as Parameters<typeof prisma.auditLog.create>[0]["data"],
    });
  } catch (error) {
    // ------------------------------------------------------------------------
    // Audit failure must NEVER break the primary operation.
    // ------------------------------------------------------------------------

    console.error("EEMS Audit Log Error:", {
      error,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      userId: input.userId,
      employeeId: input.employeeId,
    });
  }
}

// ============================================================================
// REQUEST AUDIT CONTEXT
// ============================================================================

export interface AuditRequestContext {
  userId?: string | null;
  employeeId?: string | null;

  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================================
// CREATE REQUEST AUDIT
// ============================================================================

export async function auditRequest(
  context: AuditRequestContext,
  action: string,
  entity: string,
  options?: {
    entityId?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const input: CreateAuditLogInput = {
    action,
    entity,
  };

  // --------------------------------------------------------------------------
  // Request context
  // --------------------------------------------------------------------------

  if (context.userId !== undefined) {
    input.userId = context.userId;
  }

  if (context.employeeId !== undefined) {
    input.employeeId = context.employeeId;
  }

  if (context.ipAddress !== undefined) {
    input.ipAddress = context.ipAddress;
  }

  if (context.userAgent !== undefined) {
    input.userAgent = context.userAgent;
  }

  // --------------------------------------------------------------------------
  // Audit information
  // --------------------------------------------------------------------------

  if (options?.entityId !== undefined) {
    input.entityId = options.entityId;
  }

  if (options?.description !== undefined) {
    input.description = options.description;
  }

  if (options?.metadata !== undefined) {
    input.metadata = options.metadata;
  }

  return createAuditLog(input);
}
