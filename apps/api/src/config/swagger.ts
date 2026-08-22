// ============================================================================
// EEMS API - Swagger / OpenAPI Configuration
// ============================================================================
//
// Swagger UI:
//     http://localhost:4000/docs
//
// OpenAPI JSON:
//     http://localhost:4000/docs.json
//
// ============================================================================

export const swaggerDocument = {
  openapi: "3.0.3",

  info: {
    title: "EEMS API",
    version: "1.0.0",
    description: "Employee Enterprise Management System API",
  },

  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development server",
    },
  ],

  tags: [
    {
      name: "Health",
      description: "API health and monitoring",
    },

    {
      name: "Audit",
      description: "Audit log and security history APIs",
    },

    {
      name: "Authentication",
      description: "Authentication and JWT token management",
    },

    {
      name: "Employees",
      description: "Employee management",
    },

    {
      name: "Attendance",
      description: "Employee attendance and work sessions",
    },

    {
      name: "Leave",
      description: "Leave management and approvals",
    },

    {
      name: "Timesheets",
      description: "Timesheet management",
    },

    {
      name: "Documents",
      description: "Employee document management APIs",
    },
    {
      name: "Reports",
      description:
        "Attendance, leave, timesheet, employee and project reports.",
    },

    {
      name: "Projects",
      description: "Project management and monitoring APIs",
    },

    {
      name: "Notifications",
      description: "Employee notification management",
    },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Enter the JWT access token returned by POST /api/auth/login.",
      },
    },

    schemas: {
      ApiError: {
        type: "object",

        properties: {
          success: {
            type: "boolean",
            example: false,
          },

          error: {
            type: "object",

            properties: {
              code: {
                type: "string",
                example: "FORBIDDEN",
              },

              message: {
                type: "string",
                example: "You do not have permission to perform this action",
              },
            },

            required: ["code", "message"],
          },
        },

        required: ["success", "error"],
      },

      LoginRequest: {
        type: "object",

        required: ["identifier", "password"],

        properties: {
          identifier: {
            type: "string",

            description: "Username, email address, or employee code",

            example: "emp0001",
          },

          password: {
            type: "string",
            format: "password",
            example: "Admin@123",
          },
        },
      },

      LoginResponse: {
        type: "object",

        properties: {
          success: {
            type: "boolean",
            example: true,
          },

          data: {
            type: "object",

            properties: {
              accessToken: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIs...",
              },

              user: {
                type: "object",

                properties: {
                  id: {
                    type: "string",
                    format: "uuid",
                  },

                  username: {
                    type: "string",
                  },

                  email: {
                    type: "string",
                    format: "email",
                  },

                  status: {
                    type: "string",
                  },

                  role: {
                    type: "object",

                    properties: {
                      code: {
                        type: "string",
                        example: "EMPLOYEE",
                      },

                      name: {
                        type: "string",
                        example: "Employee",
                      },

                      permissions: {
                        type: "array",

                        items: {
                          type: "string",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // ==========================================================================
      // DOCUMENT SCHEMAS
      // ==========================================================================

      Document: {
        type: "object",

        properties: {
          id: {
            type: "string",
            format: "uuid",
          },

          employeeId: {
            type: "string",
            format: "uuid",
          },

          originalName: {
            type: "string",
            example: "Aadhaar.pdf",
          },

          documentType: {
            type: "string",
            example: "IDENTITY",
          },

          mimeType: {
            type: "string",
            example: "application/pdf",
          },

          sizeBytes: {
            type: "integer",
            example: 245678,
          },

          createdAt: {
            type: "string",
            format: "date-time",
          },

          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },

        required: [
          "id",
          "employeeId",
          "originalName",
          "documentType",
          "mimeType",
          "sizeBytes",
          "createdAt",
          "updatedAt",
        ],
      },
      //=============================Projects=======================
      Project: {
        type: "object",

        properties: {
          id: {
            type: "string",
            format: "uuid",
          },

          code: {
            type: "string",
            example: "EEMS-001",
          },

          name: {
            type: "string",
            example: "Employee Management System",
          },

          description: {
            type: "string",
            nullable: true,
          },

          status: {
            type: "string",
            enum: ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
          },

          departmentId: {
            type: "string",
            format: "uuid",
          },

          ownerEmployeeId: {
            type: "string",
            format: "uuid",
          },

          startDate: {
            type: "string",
            format: "date",
            nullable: true,
          },

          endDate: {
            type: "string",
            format: "date",
            nullable: true,
          },

          createdAt: {
            type: "string",
            format: "date-time",
          },

          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },

        required: [
          "id",
          "code",
          "name",
          "status",
          "departmentId",
          "ownerEmployeeId",
          "createdAt",
          "updatedAt",
        ],
      },

      // ==========================================================================
      // NOTIFICATION SCHEMAS
      // ==========================================================================

      NotificationResponse: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },

          employeeId: {
            type: "string",
            format: "uuid",
          },

          title: {
            type: "string",
            example: "Leave Approved",
          },

          message: {
            type: "string",
            example: "Your leave request has been approved.",
          },

          type: {
            type: "string",
            example: "LEAVE",
          },

          isRead: {
            type: "boolean",
            example: false,
          },

          readAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },

          createdAt: {
            type: "string",
            format: "date-time",
          },

          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },

        required: [
          "id",
          "employeeId",
          "title",
          "message",
          "type",
          "isRead",
          "createdAt",
          "updatedAt",
        ],
      },

      EmployeeCreateRequest: {
        type: "object",

        required: [
          "employeeCode",
          "firstName",
          "lastName",
          "departmentId",
          "teamId",
        ],

        properties: {
          employeeCode: {
            type: "string",
            example: "EMP9001",
          },

          firstName: {
            type: "string",
            example: "Test",
          },

          lastName: {
            type: "string",
            example: "Employee",
          },

          displayName: {
            type: "string",
            example: "Test Employee",
          },

          phone: {
            type: "string",
            example: "9876543210",
          },

          dateOfJoining: {
            type: "string",
            format: "date",
            example: "2026-08-10",
          },

          departmentId: {
            type: "string",
            format: "uuid",
          },

          teamId: {
            type: "string",
            format: "uuid",
          },
        },
      },

      EmployeeUpdateRequest: {
        type: "object",

        properties: {
          firstName: {
            type: "string",
          },

          lastName: {
            type: "string",
          },

          displayName: {
            type: "string",
          },

          phone: {
            type: "string",
          },

          dateOfJoining: {
            type: "string",
            format: "date",
          },

          departmentId: {
            type: "string",
            format: "uuid",
          },

          teamId: {
            type: "string",
            format: "uuid",
          },

          status: {
            type: "string",
          },
        },
      },

      Employee: {
        type: "object",

        properties: {
          id: {
            type: "string",
            format: "uuid",
          },

          employeeCode: {
            type: "string",
            example: "EMP0001",
          },

          firstName: {
            type: "string",
            example: "Test",
          },

          lastName: {
            type: "string",
            example: "Employee",
          },

          displayName: {
            type: "string",
            example: "Test Employee",
          },

          phone: {
            type: "string",
          },

          dateOfJoining: {
            type: "string",
            format: "date-time",
          },

          status: {
            type: "string",
            example: "ACTIVE",
          },
        },
      },

      LeaveCreateRequest: {
        type: "object",

        required: ["leaveTypeId", "startDate", "endDate"],

        properties: {
          leaveTypeId: {
            type: "string",
            format: "uuid",
          },

          startDate: {
            type: "string",
            format: "date",
            example: "2026-09-15",
          },

          endDate: {
            type: "string",
            format: "date",
            example: "2026-09-16",
          },

          reason: {
            type: "string",
            example: "Personal requirement",
          },
        },
      },

      LeaveDecisionRequest: {
        type: "object",

        properties: {
          approvalNote: {
            type: "string",
            example: "Approved",
          },
        },
      },

      AttendanceSession: {
        type: "object",

        properties: {
          id: {
            type: "string",
            format: "uuid",
          },

          checkInAt: {
            type: "string",
            format: "date-time",
          },

          checkOutAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },

          workingMinutes: {
            type: "integer",
            example: 240,
          },

          status: {
            type: "string",
            enum: ["OPEN", "COMPLETED"],

            example: "COMPLETED",
          },
        },
      },

      Attendance: {
        type: "object",

        properties: {
          id: {
            type: "string",
            format: "uuid",
          },

          employeeId: {
            type: "string",
            format: "uuid",
          },

          employeeCode: {
            type: "string",
            example: "EMP0001",
          },

          firstName: {
            type: "string",
            example: "Test",
          },

          lastName: {
            type: "string",
            nullable: true,
            example: "Employee",
          },

          displayName: {
            type: "string",
            nullable: true,
            example: "Test Employee",
          },

          attendanceDate: {
            type: "string",
            format: "date",
            example: "2026-08-11",
          },

          status: {
            type: "string",

            enum: ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"],

            example: "PRESENT",
          },

          workingMinutes: {
            type: "integer",
            example: 480,
          },

          requiredWorkingMinutes: {
            type: "integer",
            example: 480,
          },

          remainingWorkingMinutes: {
            type: "integer",
            example: 0,
          },

          sessions: {
            type: "array",

            items: {
              $ref: "#/components/schemas/AttendanceSession",
            },
          },
        },
      },

      AttendanceListResponse: {
        type: "object",

        properties: {
          success: {
            type: "boolean",
            example: true,
          },

          data: {
            type: "array",

            items: {
              $ref: "#/components/schemas/Attendance",
            },
          },

          meta: {
            type: "object",

            properties: {
              page: {
                type: "integer",
                example: 1,
              },

              limit: {
                type: "integer",
                example: 20,
              },

              total: {
                type: "integer",
                example: 42,
              },

              totalPages: {
                type: "integer",
                example: 3,
              },
            },
          },
        },
      },

      CheckInResponse: {
        type: "object",

        properties: {
          success: {
            type: "boolean",
            example: true,
          },

          data: {
            type: "object",

            properties: {
              attendanceId: {
                type: "string",
                format: "uuid",
              },

              sessionId: {
                type: "string",
                format: "uuid",
              },

              employeeId: {
                type: "string",
                format: "uuid",
              },

              attendanceDate: {
                type: "string",
                format: "date",
              },

              checkInAt: {
                type: "string",
                format: "date-time",
              },

              sessionStatus: {
                type: "string",
                example: "OPEN",
              },

              attendanceStatus: {
                type: "string",
                example: "ABSENT",
              },

              workingMinutes: {
                type: "integer",
                example: 0,
              },
            },
          },
        },
      },

      CheckOutResponse: {
        type: "object",

        properties: {
          success: {
            type: "boolean",
            example: true,
          },

          data: {
            type: "object",

            properties: {
              attendanceId: {
                type: "string",
                format: "uuid",
              },

              sessionId: {
                type: "string",
                format: "uuid",
              },

              employeeId: {
                type: "string",
                format: "uuid",
              },

              attendanceDate: {
                type: "string",
                format: "date",
              },

              checkInAt: {
                type: "string",
                format: "date-time",
              },

              checkOutAt: {
                type: "string",
                format: "date-time",
              },

              sessionWorkingMinutes: {
                type: "integer",
                example: 480,
              },

              totalWorkingMinutes: {
                type: "integer",
                example: 480,
              },

              attendanceStatus: {
                type: "string",
                example: "PRESENT",
              },
            },
          },
        },
      },

      TodayAttendanceResponse: {
        type: "object",

        properties: {
          success: {
            type: "boolean",
            example: true,
          },

          data: {
            nullable: true,

            allOf: [
              {
                $ref: "#/components/schemas/TodayAttendance",
              },
            ],
          },
        },
      },

      TodayAttendance: {
        type: "object",

        properties: {
          attendanceId: {
            type: "string",
            format: "uuid",
          },

          employeeId: {
            type: "string",
            format: "uuid",
          },

          attendanceDate: {
            type: "string",
            format: "date",
          },

          status: {
            type: "string",

            enum: ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"],
          },

          workingMinutes: {
            type: "integer",
            example: 240,
          },

          requiredWorkingMinutes: {
            type: "integer",
            example: 480,
          },

          remainingWorkingMinutes: {
            type: "integer",
            example: 240,
          },

          sessions: {
            type: "array",

            items: {
              $ref: "#/components/schemas/AttendanceSession",
            },
          },
        },
      },

      Timesheet: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          employeeId: {
            type: "string",
            format: "uuid",
          },
          employeeCode: {
            type: "string",
            example: "EMP0001",
          },
          firstName: {
            type: "string",
            example: "Test",
          },
          lastName: {
            type: "string",
            nullable: true,
            example: "Employee",
          },
          displayName: {
            type: "string",
            nullable: true,
            example: "Test Employee",
          },
          workDate: {
            type: "string",
            format: "date",
            example: "2026-08-11",
          },
          description: {
            type: "string",
            nullable: true,
            example: "Daily development work",
          },
          taskDescription: {
            type: "string",
            nullable: true,
            example: "Implemented employee management API",
          },
          workingMinutes: {
            type: "integer",
            minimum: 0,
            example: 480,
          },
          status: {
            type: "string",
            enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
            example: "DRAFT",
          },
          submittedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          approvedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          rejectedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          approverEmployeeId: {
            type: "string",
            format: "uuid",
            nullable: true,
          },
          approvalNote: {
            type: "string",
            nullable: true,
            example: "Approved after review",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },

      TimesheetCreateRequest: {
        type: "object",
        required: ["workDate", "workingMinutes"],
        properties: {
          workDate: {
            type: "string",
            format: "date",
            example: "2026-08-11",
          },
          description: {
            type: "string",
            nullable: true,
            example: "Daily development work",
          },
          taskDescription: {
            type: "string",
            nullable: true,
            example: "Implemented employee management API",
          },
          workingMinutes: {
            type: "integer",
            minimum: 0,
            example: 480,
          },
        },
      },

      TimesheetDecisionRequest: {
        type: "object",
        properties: {
          approvalNote: {
            type: "string",
            nullable: true,
            example: "Approved after review",
          },
        },
      },

      TimesheetResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          data: {
            $ref: "#/components/schemas/Timesheet",
          },
        },
      },

      TimesheetListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Timesheet",
            },
          },
          pagination: {
            type: "object",
            properties: {
              page: {
                type: "integer",
                example: 1,
              },
              limit: {
                type: "integer",
                example: 20,
              },
              total: {
                type: "integer",
                example: 42,
              },
              totalPages: {
                type: "integer",
                example: 3,
              },
            },
          },
        },
      },
    },
  },

  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],

        summary: "Health check",

        responses: {
          "200": {
            description: "API is healthy",
          },
        },
      },
    },

    "/api/health/ready": {
      get: {
        tags: ["Health"],

        summary: "Health Ready check",

        responses: {
          "200": {
            description: "API is healthy",
          },
        },
      },
    },

    "/api/auth/login": {
      post: {
        tags: ["Authentication"],

        summary: "Login",

        description: "Authenticate using username, email, or employee code.",

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Authentication successful",

            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginResponse",
                },
              },
            },
          },

          "400": {
            description: "Invalid request",
          },

          "401": {
            description: "Invalid credentials",
          },

          "403": {
            description: "Account inactive or locked",
          },
        },
      },
    },

    "/api/employees": {
      get: {
        tags: ["Employees"],

        summary: "List employees",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Employees visible to the authenticated user",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission",
          },
        },
      },

      post: {
        tags: ["Employees"],

        summary: "Create employee",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/EmployeeCreateRequest",
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Employee created",
          },

          "400": {
            description: "Validation error",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission or scope",
          },

          "409": {
            description: "Employee code already exists",
          },
        },
      },
    },

    "/api/employees/{id}": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          description: "Employee UUID",

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      get: {
        tags: ["Employees"],

        summary: "Get employee",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Employee details",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Employee outside allowed scope",
          },

          "404": {
            description: "Employee not found",
          },
        },
      },

      patch: {
        tags: ["Employees"],

        summary: "Update employee",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/EmployeeUpdateRequest",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Employee updated",
          },

          "400": {
            description: "Validation error",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission or scope",
          },

          "404": {
            description: "Employee not found",
          },

          "409": {
            description: "Duplicate employee code",
          },
        },
      },

      delete: {
        tags: ["Employees"],

        summary: "Delete employee",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "204": {
            description: "Employee deleted",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission",
          },

          "404": {
            description: "Employee not found",
          },
        },
      },
    },

    "/api/attendance": {
      get: {
        tags: ["Attendance"],

        summary: "List attendance records",

        description:
          "Returns attendance records according to the authenticated user's organizational scope. ADMIN can view all records, MANAGER can view department records, TEAM_LEAD can view team records, and EMPLOYEE can view only their own records.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "employeeId",

            in: "query",

            required: false,

            description:
              "Employee UUID. EMPLOYEE users can only request their own employee ID. MANAGER users are restricted to their department. TEAM_LEAD users are restricted to their team. ADMIN users can request any employee.",

            schema: {
              type: "string",
              format: "uuid",
            },
          },

          {
            name: "status",

            in: "query",

            required: false,

            description: "Filter by attendance status.",

            schema: {
              type: "string",

              enum: ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"],
            },
          },

          {
            name: "from",

            in: "query",

            required: false,

            description: "Start attendance date.",

            schema: {
              type: "string",

              format: "date",

              example: "2026-08-01",
            },
          },

          {
            name: "to",

            in: "query",

            required: false,

            description: "End attendance date.",

            schema: {
              type: "string",

              format: "date",

              example: "2026-08-31",
            },
          },

          {
            name: "page",

            in: "query",

            required: false,

            schema: {
              type: "integer",

              minimum: 1,

              default: 1,
            },
          },

          {
            name: "limit",

            in: "query",

            required: false,

            schema: {
              type: "integer",

              minimum: 1,

              maximum: 100,

              default: 20,
            },
          },
        ],

        responses: {
          "200": {
            description: "Attendance records returned successfully",

            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AttendanceListResponse",
                },
              },
            },
          },

          "400": {
            description: "Invalid query parameter",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description:
              "Attendance outside the user's allowed organizational scope",
          },
        },
      },
    },

    "/api/attendance/{id}": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          description: "Attendance record UUID",

          schema: {
            type: "string",

            format: "uuid",
          },
        },
      ],

      get: {
        tags: ["Attendance"],

        summary: "Get attendance record",

        description:
          "Returns one attendance record after applying resource-level authorization.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Attendance record returned successfully",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      $ref: "#/components/schemas/Attendance",
                    },
                  },
                },
              },
            },
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Attendance outside the user's allowed scope",
          },

          "404": {
            description: "Attendance record not found",
          },
        },
      },
    },

    "/api/attendance/today": {
      get: {
        tags: ["Attendance"],

        summary: "Get today's attendance",

        description:
          "Returns today's attendance for the authenticated employee. The employee ID is obtained from the JWT and cannot be supplied by the client.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Today's attendance",

            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TodayAttendanceResponse",
                },
              },
            },
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description:
              "Authenticated user is not linked to an active employee profile",
          },
        },
      },
    },

    "/api/attendance/check-in": {
      post: {
        tags: ["Attendance"],

        summary: "Check in",

        description:
          "Checks in the authenticated employee. No employeeId is accepted in the request body. Employee identity is taken from the JWT.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: false,

          content: {
            "application/json": {
              schema: {
                type: "object",

                description: "No request body is required.",

                example: {},
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Check-in successful",

            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CheckInResponse",
                },
              },
            },
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Employee profile is missing or inactive",
          },

          "409": {
            description: "Employee already has an active check-in session",
          },
        },
      },
    },

    "/api/attendance/check-out": {
      post: {
        tags: ["Attendance"],

        summary: "Check out",

        description:
          "Checks out the authenticated employee and recalculates total working minutes. Employee identity is obtained from the JWT.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: false,

          content: {
            "application/json": {
              schema: {
                type: "object",

                description: "No request body is required.",

                example: {},
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Check-out successful",

            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CheckOutResponse",
                },
              },
            },
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Employee profile is missing or inactive",
          },

          "404": {
            description: "Today's attendance record does not exist",
          },

          "409": {
            description: "No active check-in session exists",
          },
        },
      },
    },

    "/api/timesheets": {
      get: {
        tags: ["Timesheets"],

        summary: "List timesheets",

        description:
          "Returns timesheets according to the authenticated user's organizational scope. Supported filters are employeeId, status, from, to, page and limit.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "employeeId",
            in: "query",
            required: false,
            description:
              "Employee UUID. Access is restricted by the authenticated user's scope.",
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter by timesheet workflow status.",
            schema: {
              type: "string",
              enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
            },
          },
          {
            name: "from",
            in: "query",
            required: false,
            description: "Start work date.",
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-01",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            description: "End work date.",
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-31",
            },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],

        responses: {
          "200": {
            description: "Timesheets returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetListResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid query parameter",
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Insufficient permission or timesheet outside the user's allowed scope",
          },
        },
      },

      post: {
        tags: ["Timesheets"],

        summary: "Create timesheet",

        description:
          "Creates a timesheet for the authenticated employee. Employee identity is taken from the JWT and is not supplied by the request body.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TimesheetCreateRequest",
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Timesheet created",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetResponse",
                },
              },
            },
          },
          "400": {
            description: "Validation error or invalid timesheet data",
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Authenticated user is not linked to an employee profile or insufficient permission",
          },
          "409": {
            description:
              "A timesheet already exists for the employee and work date",
          },
        },
      },
    },

    "/api/timesheets/export": {
      get: {
        tags: ["Timesheets"],

        summary: "Export timesheets",

        description:
          "Exports timesheets in XLSX or CSV format using the same filters as the timesheet list endpoint.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "format",
            in: "query",
            required: true,
            description: "Export file format.",
            schema: {
              type: "string",
              enum: ["xlsx", "csv"],
              default: "xlsx",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
            },
          },
          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-01",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-31",
            },
          },
        ],

        responses: {
          "200": {
            description: "Timesheet export file",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {
                  schema: {
                    type: "string",
                    format: "binary",
                  },
                },
            },
          },
          "400": {
            description: "Invalid export format or query parameter",
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Insufficient export permission or timesheet outside the user's allowed scope",
          },
        },
      },
    },

    "/api/timesheets/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Timesheet UUID",
          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      // ==========================================================================
      // GET TIMESHEET
      // ==========================================================================

      get: {
        tags: ["Timesheets"],

        summary: "Get timesheet by ID",

        description:
          "Returns one timesheet after applying resource-level authorization.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Timesheet returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetResponse",
                },
              },
            },
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Insufficient permission or timesheet outside the user's allowed scope",
          },
          "404": {
            description: "Timesheet not found",
          },
        },
      },

      // ==========================================================================
      // UPDATE TIMESHEET
      // ==========================================================================

      patch: {
        tags: ["Timesheets"],

        summary: "Update timesheet",

        description:
          "Updates a timesheet owned by the authenticated employee. Updates are allowed only when the current timesheet status is DRAFT or REJECTED.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TimesheetUpdateRequest",
              },

              example: {
                workDate: "2026-08-15",
                firstCheckIn: "2026-08-15T09:00:00.000Z",
                lastCheckOut: "2026-08-15T18:00:00.000Z",
                workingMinutes: 540,
                notes: "Updated timesheet details",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Timesheet updated successfully",

            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetResponse",
                },
              },
            },
          },

          "400": {
            description: "Invalid timesheet data or invalid status transition",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description:
              "Insufficient permission or authenticated employee is not the owner of the timesheet",
          },

          "404": {
            description: "Timesheet not found",
          },

          "409": {
            description:
              "A timesheet already exists for the employee and work date",
          },
        },
      },
    },

    "/api/timesheets/{id}/submit": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Timesheet UUID",
          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      post: {
        tags: ["Timesheets"],
        summary: "Submit timesheet",
        description:
          "Submits a DRAFT or REJECTED timesheet owned by the authenticated employee.",
        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Timesheet submitted successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetResponse",
                },
              },
            },
          },
          "400": {
            description: "Only DRAFT or REJECTED timesheets can be submitted",
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Authenticated employee is not allowed to submit this timesheet",
          },
          "404": {
            description: "Timesheet not found",
          },
        },
      },
    },

    "/api/timesheets/{id}/approve": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Timesheet UUID",
          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      post: {
        tags: ["Timesheets"],
        summary: "Approve timesheet",
        description:
          "Approves a SUBMITTED timesheet according to the approver's role and organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TimesheetDecisionRequest",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Timesheet approved successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetResponse",
                },
              },
            },
          },
          "400": {
            description: "Only SUBMITTED timesheets can be approved",
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Approver does not have permission or organizational scope",
          },
          "404": {
            description: "Timesheet not found",
          },
        },
      },
    },

    "/api/timesheets/{id}/reject": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Timesheet UUID",
          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      post: {
        tags: ["Timesheets"],
        summary: "Reject timesheet",
        description:
          "Rejects a SUBMITTED timesheet according to the approver's role and organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TimesheetDecisionRequest",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Timesheet rejected successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TimesheetResponse",
                },
              },
            },
          },
          "400": {
            description: "Only SUBMITTED timesheets can be rejected",
          },
          "401": {
            description: "Authentication required",
          },
          "403": {
            description:
              "Approver does not have permission or organizational scope",
          },
          "404": {
            description: "Timesheet not found",
          },
        },
      },
    },

    "/api/leave": {
      get: {
        tags: ["Leave"],

        summary: "List leave requests",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "employeeId",

            in: "query",

            schema: {
              type: "string",
              format: "uuid",
            },
          },

          {
            name: "status",

            in: "query",

            schema: {
              type: "string",

              enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
            },
          },

          {
            name: "from",

            in: "query",

            schema: {
              type: "string",
              format: "date",
            },
          },

          {
            name: "to",

            in: "query",

            schema: {
              type: "string",
              format: "date",
            },
          },

          {
            name: "page",

            in: "query",

            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
          },

          {
            name: "limit",

            in: "query",

            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],

        responses: {
          "200": {
            description: "Leave requests",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission",
          },
        },
      },

      post: {
        tags: ["Leave"],

        summary: "Apply for leave",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LeaveCreateRequest",
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Leave request created",
          },

          "400": {
            description: "Validation error or overlapping leave",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission",
          },
        },
      },
    },

    "/api/leave/{id}/approve": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      post: {
        tags: ["Leave"],

        summary: "Approve leave",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: false,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LeaveDecisionRequest",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Leave approved",
          },

          "400": {
            description: "Invalid leave status",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Approver does not have permission or scope",
          },

          "404": {
            description: "Leave request not found",
          },
        },
      },
    },

    "/api/leave/{id}/reject": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      post: {
        tags: ["Leave"],

        summary: "Reject leave",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: false,

          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LeaveDecisionRequest",
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Leave rejected",
          },

          "400": {
            description: "Invalid leave status",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Approver does not have permission or scope",
          },

          "404": {
            description: "Leave request not found",
          },
        },
      },
    },

    "/api/leave/{id}/cancel": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      post: {
        tags: ["Leave"],

        summary: "Cancel leave",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Leave cancelled",
          },

          "400": {
            description: "Invalid leave status",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Only the owner can cancel",
          },

          "404": {
            description: "Leave request not found",
          },
        },
      },
    },
    // ==========================================================================
    // DOCUMENTS
    // ==========================================================================

    "/api/documents": {
      get: {
        tags: ["Documents"],

        summary: "List documents",

        description:
          "Lists documents within the authenticated user's organizational scope.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "page",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
          },

          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },

          {
            name: "documentType",
            in: "query",
            required: false,
            schema: {
              type: "string",
              maxLength: 100,
            },
          },
        ],

        responses: {
          "200": {
            description: "Documents returned successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient document permission",
          },
        },
      },

      post: {
        tags: ["Documents"],

        summary: "Upload document",

        description:
          "Uploads an employee document using multipart/form-data. Maximum file size is 10 MB.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "multipart/form-data": {
              schema: {
                type: "object",

                required: ["documentType", "file"],

                properties: {
                  documentType: {
                    type: "string",
                    example: "IDENTITY",
                  },

                  file: {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Document uploaded successfully",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      $ref: "#/components/schemas/Document",
                    },
                  },
                },
              },
            },
          },

          "400": {
            description:
              "Invalid document, unsupported file type, missing file, or file too large",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Document upload permission required",
          },
        },
      },
    },

    "/api/documents/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      get: {
        tags: ["Documents"],

        summary: "Get document metadata",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Document metadata returned successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient document permission",
          },

          "404": {
            description: "Document not found",
          },
        },
      },

      delete: {
        tags: ["Documents"],

        summary: "Delete document",

        description: "Deletes a document. Requires DOCUMENT_DELETE permission.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Document deleted successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Document delete permission required",
          },

          "404": {
            description: "Document not found",
          },
        },
      },
    },

    "/api/documents/{id}/download": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      get: {
        tags: ["Documents"],

        summary: "Download document",

        description:
          "Downloads a document belonging to the authenticated user's allowed organizational scope.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Document binary content",
            content: {
              "application/octet-stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient document permission",
          },

          "404": {
            description: "Document not found",
          },
        },
      },
    },
    // ==========================================================================
    // PROJECTS
    // ==========================================================================

    "/api/projects": {
      get: {
        tags: ["Projects"],

        summary: "List projects",

        description:
          "Lists projects available within the authenticated user's organizational scope.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
          },

          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },

          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
            },
          },
        ],

        responses: {
          "200": {
            description: "Projects returned successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Project view permission required",
          },
        },
      },

      post: {
        tags: ["Projects"],

        summary: "Create project",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                type: "object",

                required: ["code", "name", "departmentId", "ownerEmployeeId"],

                properties: {
                  code: {
                    type: "string",
                    example: "EEMS-001",
                  },

                  name: {
                    type: "string",
                    example: "EEMS Development",
                  },

                  description: {
                    type: "string",
                  },

                  departmentId: {
                    type: "string",
                    format: "uuid",
                  },

                  ownerEmployeeId: {
                    type: "string",
                    format: "uuid",
                  },

                  startDate: {
                    type: "string",
                    format: "date",
                  },

                  endDate: {
                    type: "string",
                    format: "date",
                  },
                },
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Project created successfully",
          },

          "400": {
            description: "Invalid project data",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description:
              "Project create permission or organizational access denied",
          },

          "409": {
            description: "Project code already exists",
          },
        },
      },
    },

    "/api/projects/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      get: {
        tags: ["Projects"],

        summary: "Get project",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Project returned successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Project view permission required",
          },

          "404": {
            description: "Project not found",
          },
        },
      },

      patch: {
        tags: ["Projects"],

        summary: "Update project",

        security: [
          {
            bearerAuth: [],
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                type: "object",

                properties: {
                  name: {
                    type: "string",
                  },

                  description: {
                    type: "string",
                    nullable: true,
                  },

                  status: {
                    type: "string",
                    enum: [
                      "PLANNED",
                      "ACTIVE",
                      "ON_HOLD",
                      "COMPLETED",
                      "CANCELLED",
                    ],
                  },

                  departmentId: {
                    type: "string",
                    format: "uuid",
                  },

                  ownerEmployeeId: {
                    type: "string",
                    format: "uuid",
                  },

                  startDate: {
                    type: "string",
                    format: "date",
                  },

                  endDate: {
                    type: "string",
                    format: "date",
                  },
                },
              },
            },
          },
        },

        responses: {
          "200": {
            description: "Project updated successfully",
          },

          "400": {
            description: "Invalid project data",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description:
              "Project update permission or organizational access denied",
          },

          "404": {
            description: "Project not found",
          },
        },
      },

      delete: {
        tags: ["Projects"],

        summary: "Delete project",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Project deleted successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Project delete permission required",
          },

          "404": {
            description: "Project not found",
          },
        },
      },
    },

    "/api/projects/{id}/members": {
      post: {
        tags: ["Projects"],

        summary: "Add project member",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,

            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                type: "object",

                required: ["employeeId"],

                properties: {
                  employeeId: {
                    type: "string",
                    format: "uuid",
                  },

                  role: {
                    type: "string",
                    enum: ["MEMBER", "LEAD"],
                    default: "MEMBER",
                  },
                },
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Project member added successfully",
          },

          "400": {
            description: "Invalid employee or project membership",
          },

          "403": {
            description: "Project member management permission required",
          },

          "404": {
            description: "Project or employee not found",
          },

          "409": {
            description: "Employee is already assigned",
          },
        },
      },
    },

    "/api/projects/{id}/members/{employeeId}": {
      delete: {
        tags: ["Projects"],

        summary: "Remove project member",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,

            schema: {
              type: "string",
              format: "uuid",
            },
          },

          {
            name: "employeeId",
            in: "path",
            required: true,

            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],

        responses: {
          "200": {
            description: "Project member removed successfully",
          },

          "403": {
            description: "Project member management permission required",
          },

          "404": {
            description: "Project or project member not found",
          },
        },
      },
    },

    "/api/projects/{id}/monitoring": {
      get: {
        tags: ["Projects"],

        summary: "Monitor project",

        description:
          "Returns project status, ownership, member counts and active project members within the authenticated user's organizational scope.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,

            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],

        responses: {
          "200": {
            description: "Project monitoring data returned successfully",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Project monitoring permission required",
          },

          "404": {
            description: "Project not found",
          },
        },
      },
    },

    // ==========================================================================
    // NOTIFICATIONS
    // ==========================================================================

    "/api/notifications": {
      get: {
        tags: ["Notifications"],

        summary: "List notifications",

        description:
          "Returns notifications belonging to the authenticated employee. Notifications can be filtered to unread notifications only.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "page",

            in: "query",

            required: false,

            description: "Page number. Defaults to 1.",

            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
          },

          {
            name: "limit",

            in: "query",

            required: false,

            description: "Number of notifications per page. Maximum 100.",

            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },

          {
            name: "unreadOnly",

            in: "query",

            required: false,

            description: "Return only unread notifications.",

            schema: {
              type: "boolean",
              default: false,
            },
          },
        ],

        responses: {
          "200": {
            description: "Notifications returned successfully.",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      type: "array",

                      items: {
                        $ref: "#/components/schemas/NotificationResponse",
                      },
                    },

                    meta: {
                      type: "object",

                      properties: {
                        page: {
                          type: "integer",
                          example: 1,
                        },

                        limit: {
                          type: "integer",
                          example: 20,
                        },

                        total: {
                          type: "integer",
                          example: 5,
                        },

                        totalPages: {
                          type: "integer",
                          example: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          "401": {
            description: "Authentication required.",
          },

          "403": {
            description:
              "Authenticated user is not linked to an employee profile or does not have notification view permission.",
          },
        },
      },
    },

    "/api/notifications/unread-count": {
      get: {
        tags: ["Notifications"],

        summary: "Get unread notification count",

        description:
          "Returns the number of unread notifications belonging to the authenticated employee.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Unread notification count returned successfully.",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      type: "object",

                      properties: {
                        count: {
                          type: "integer",
                          example: 3,
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          "401": {
            description: "Authentication required.",
          },

          "403": {
            description:
              "Authenticated user is not linked to an employee profile or does not have notification view permission.",
          },
        },
      },
    },

    "/api/notifications/{id}/read": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          description: "Notification UUID.",

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      patch: {
        tags: ["Notifications"],

        summary: "Mark notification as read",

        description:
          "Marks a notification belonging to the authenticated employee as read.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Notification marked as read successfully.",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      $ref: "#/components/schemas/NotificationResponse",
                    },
                  },
                },
              },
            },
          },

          "400": {
            description: "Notification ID is invalid or missing.",
          },

          "401": {
            description: "Authentication required.",
          },

          "403": {
            description: "Notification view permission is required.",
          },

          "404": {
            description:
              "Notification not found or does not belong to the authenticated employee.",
          },
        },
      },
    },

    "/api/notifications/read-all": {
      patch: {
        tags: ["Notifications"],

        summary: "Mark all notifications as read",

        description:
          "Marks all unread notifications belonging to the authenticated employee as read.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Notifications marked as read successfully.",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      type: "object",

                      properties: {
                        updatedCount: {
                          type: "integer",
                          example: 4,
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          "401": {
            description: "Authentication required.",
          },

          "403": {
            description: "Notification view permission is required.",
          },
        },
      },
    },

    "/api/notifications/{id}": {
      parameters: [
        {
          name: "id",

          in: "path",

          required: true,

          description: "Notification UUID.",

          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ],

      delete: {
        tags: ["Notifications"],

        summary: "Delete notification",

        description:
          "Deletes a notification belonging to the authenticated employee. This operation requires notification management permission.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        responses: {
          "200": {
            description: "Notification deleted successfully.",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      type: "object",

                      properties: {
                        message: {
                          type: "string",
                          example: "Notification deleted successfully",
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          "400": {
            description: "Notification ID is invalid or missing.",
          },

          "401": {
            description: "Authentication required.",
          },

          "403": {
            description: "Notification management permission is required.",
          },

          "404": {
            description:
              "Notification not found or does not belong to the authenticated employee.",
          },
        },
      },
    },

    // ==========================================================================
    // REPORTS
    // ==========================================================================

    "/api/reports/summary": {
      get: {
        tags: ["Reports"],
        summary: "Get report summary",
        description:
          "Returns a consolidated summary of attendance, leave, timesheet, employee and project data according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "Report summary returned successfully.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description: "Report permission is required.",
          },
        },
      },
    },

    "/api/reports/attendance": {
      get: {
        tags: ["Reports"],
        summary: "Get attendance report",
        description:
          "Returns attendance records according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-01",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-31",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "teamId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["PRESENT", "ABSENT"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Attendance report returned successfully.",
          },
          "400": {
            description: "Invalid date range or filter.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description: "Report access denied.",
          },
        },
      },
    },

    "/api/reports/leave": {
      get: {
        tags: ["Reports"],
        summary: "Get leave report",
        description:
          "Returns leave requests according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-01",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-31",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "teamId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Leave report returned successfully.",
          },
          "400": {
            description: "Invalid date range or filter.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description: "Report access denied.",
          },
        },
      },
    },

    "/api/reports/timesheets": {
      get: {
        tags: ["Reports"],
        summary: "Get timesheet report",
        description:
          "Returns timesheets according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-01",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-08-31",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "teamId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Timesheet report returned successfully.",
          },
          "400": {
            description: "Invalid date range or filter.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description: "Report access denied.",
          },
        },
      },
    },

    "/api/reports/employees": {
      get: {
        tags: ["Reports"],
        summary: "Get employee report",
        description:
          "Returns employee information according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "teamId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Employee report returned successfully.",
          },
          "400": {
            description: "Invalid filter.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description: "Report access denied.",
          },
        },
      },
    },

    "/api/reports/projects": {
      get: {
        tags: ["Reports"],
        summary: "Get project report",
        description:
          "Returns projects according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Project report returned successfully.",
          },
          "400": {
            description: "Invalid project filter.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description: "Report access denied.",
          },
        },
      },
    },
    "/api/reports/attendance/export": {
      get: {
        tags: ["Reports"],
        summary: "Export attendance report",
        description:
          "Exports the attendance report according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "format",
            in: "query",
            required: false,
            description: "Export file format.",
            schema: {
              type: "string",
              enum: ["csv", "xlsx", "pdf"],
              default: "xlsx",
            },
          },
          {
            name: "from",
            in: "query",
            required: false,
            description: "Start date in YYYY-MM-DD format.",
            schema: {
              type: "string",
              format: "date",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            description: "End date in YYYY-MM-DD format.",
            schema: {
              type: "string",
              format: "date",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            description: "Employee UUID.",
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            description: "Attendance status.",
            schema: {
              type: "string",
              enum: ["PRESENT", "ABSENT"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Attendance report exported successfully.",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {
                  schema: {
                    type: "string",
                    format: "binary",
                  },
                },
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": {
            description: "Invalid report filter or export format.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description:
              "Report export permission is required or the requested data is outside the user's organizational scope.",
          },
        },
      },
    },

    "/api/reports/leave/export": {
      get: {
        tags: ["Reports"],
        summary: "Export leave report",
        description:
          "Exports the leave report according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "format",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["csv", "xlsx", "pdf"],
              default: "xlsx",
            },
          },
          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Leave report exported successfully.",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {
                  schema: {
                    type: "string",
                    format: "binary",
                  },
                },
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": {
            description: "Invalid report filter or export format.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description:
              "Report export permission is required or the requested data is outside the user's organizational scope.",
          },
        },
      },
    },

    "/api/reports/timesheets/export": {
      get: {
        tags: ["Reports"],
        summary: "Export timesheet report",
        description:
          "Exports the timesheet report according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "format",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["csv", "xlsx", "pdf"],
              default: "xlsx",
            },
          },
          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
            },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Timesheet report exported successfully.",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {
                  schema: {
                    type: "string",
                    format: "binary",
                  },
                },
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": {
            description: "Invalid report filter or export format.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description:
              "Report export permission is required or the requested data is outside the user's organizational scope.",
          },
        },
      },
    },

    "/api/reports/employees/export": {
      get: {
        tags: ["Reports"],
        summary: "Export employee report",
        description:
          "Exports employee information according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "format",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["csv", "xlsx", "pdf"],
              default: "xlsx",
            },
          },
          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "teamId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "TERMINATED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Employee report exported successfully.",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {
                  schema: {
                    type: "string",
                    format: "binary",
                  },
                },
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": {
            description: "Invalid report filter or export format.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description:
              "Report export permission is required or the requested data is outside the user's organizational scope.",
          },
        },
      },
    },

    "/api/reports/projects/export": {
      get: {
        tags: ["Reports"],
        summary: "Export project report",
        description:
          "Exports project information according to the authenticated user's organizational scope.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "format",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["csv", "xlsx", "pdf"],
              default: "xlsx",
            },
          },
          {
            name: "departmentId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Project report exported successfully.",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {
                  schema: {
                    type: "string",
                    format: "binary",
                  },
                },
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": {
            description: "Invalid report filter or export format.",
          },
          "401": {
            description: "Authentication required.",
          },
          "403": {
            description:
              "Report export permission is required or the requested data is outside the user's organizational scope.",
          },
        },
      },
    },
    // ========================================================================
    // AUDIT
    // ========================================================================

    "/api/audit": {
      get: {
        tags: ["Audit"],

        summary: "List audit logs",

        description:
          "Returns audit logs for administrators. Supports filtering by action, entity, user, employee and date range.",

        security: [
          {
            bearerAuth: [],
          },
        ],

        parameters: [
          {
            name: "page",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
            description: "Page number",
          },

          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            description: "Number of audit records per page",
          },

          {
            name: "action",
            in: "query",
            required: false,
            schema: {
              type: "string",
            },
            description: "Filter by audit action",
          },

          {
            name: "entity",
            in: "query",
            required: false,
            schema: {
              type: "string",
            },
            description: "Filter by entity type",
          },

          {
            name: "userId",
            in: "query",
            required: false,
            schema: {
              type: "string",
            },
            description: "Filter by user ID",
          },

          {
            name: "employeeId",
            in: "query",
            required: false,
            schema: {
              type: "string",
            },
            description: "Filter by employee ID",
          },

          {
            name: "from",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date-time",
            },
            description: "Return logs created on or after this date",
          },

          {
            name: "to",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date-time",
            },
            description: "Return logs created on or before this date",
          },
        ],

        responses: {
          "200": {
            description: "Audit logs retrieved successfully",

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },

                    data: {
                      type: "object",

                      properties: {
                        items: {
                          type: "array",

                          items: {
                            type: "object",

                            properties: {
                              id: {
                                type: "string",
                                format: "uuid",
                              },

                              userId: {
                                type: "string",
                                nullable: true,
                              },

                              employeeId: {
                                type: "string",
                                nullable: true,
                              },

                              action: {
                                type: "string",
                                example: "EMPLOYEE_CREATED",
                              },

                              entity: {
                                type: "string",
                                example: "EMPLOYEE",
                              },

                              entityId: {
                                type: "string",
                                nullable: true,
                              },

                              description: {
                                type: "string",
                                nullable: true,
                              },

                              metadata: {
                                type: "object",
                                nullable: true,
                                additionalProperties: true,
                              },

                              ipAddress: {
                                type: "string",
                                nullable: true,
                              },

                              userAgent: {
                                type: "string",
                                nullable: true,
                              },

                              createdAt: {
                                type: "string",
                                format: "date-time",
                              },
                            },
                          },
                        },

                        pagination: {
                          type: "object",

                          properties: {
                            page: {
                              type: "integer",
                              example: 1,
                            },

                            limit: {
                              type: "integer",
                              example: 50,
                            },

                            total: {
                              type: "integer",
                              example: 125,
                            },

                            totalPages: {
                              type: "integer",
                              example: 3,
                            },

                            hasNextPage: {
                              type: "boolean",
                              example: true,
                            },

                            hasPreviousPage: {
                              type: "boolean",
                              example: false,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          "400": {
            description: "Invalid query parameters or date range",
          },

          "401": {
            description: "Authentication required",
          },

          "403": {
            description: "Insufficient permission",
          },
        },
      },
    },
  },
};
