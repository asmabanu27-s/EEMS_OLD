// ============================================================================
// EEMS - Project Monitoring
// Project Types
// ============================================================================

export interface ProjectListQuery {
  page?: number;
  limit?: number;
  status?: string;
}

export interface ProjectScope {
  userId: string;
  employeeId: string | null;
  role: string;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string;
  departmentId: string;
  ownerEmployeeId: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
  departmentId?: string;
  ownerEmployeeId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AddProjectMemberInput {
  employeeId: string;
  role?: string;
}
