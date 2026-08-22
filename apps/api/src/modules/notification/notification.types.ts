// ============================================================================
// EEMS - Notification Management
// Notification Types
// ============================================================================

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResult {
  notifications: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
