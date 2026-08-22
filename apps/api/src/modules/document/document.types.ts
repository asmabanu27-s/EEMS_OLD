// ============================================================================
// EEMS - Document Management
// Document Types
// ============================================================================
//
// This file contains HTTP/service contracts only.
// Prisma-specific implementation remains inside document.service.ts.
// ============================================================================

export interface DocumentListQuery {
  page?: number;
  limit?: number;
  documentType?: string;
}

export interface DocumentScope {
  userId: string;
  employeeId: string | null;
  role: string;
}

export interface DocumentListResult {
  records: unknown[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
