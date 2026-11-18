// ============================================================================
// EEMS - Prisma Database Seed
// ============================================================================
//
// Purpose:
//
//   Initialize the EEMS database with:
//   1. System permissions
//   2. System roles
//   3. Role -> Permission mappings
//   4. Departments
//   5. Teams
//   6. Leave types
//   7. Development test employees
//   8. Development test users
//
// IMPORTANT:
//
//   This seed is designed to be safely executed multiple times.
//
//   We use upsert() wherever possible so that:
//
//       npx prisma db seed
//
//   can be run repeatedly without creating duplicate records.
//
// Development users:
//
//   emp0001
//     Employee
//     EMP0001
//
//   manager1
//     Manager
//     EMP0002
//
// EMP0003 is currently created as an IT employee for department-scope testing.
//
// ============================================================================

import "dotenv/config";

import {
  RoleCode,
  UserStatus,
  EmployeeStatus,
} from "../src/generated/prisma/client";

import { prisma } from "../src/lib/prisma";

// ============================================================================
// 1. SYSTEM PERMISSIONS
// ============================================================================
//
// Permission codes are used by the authorization middleware:
//
//     authorize("EMPLOYEE_VIEW")
//
// Keep these codes stable because application routes depend on them.
//
// ============================================================================

const permissions = [
  ["USER_MANAGE", "Manage users"],
  ["ROLE_MANAGE", "Manage roles and permissions"],

  ["EMPLOYEE_VIEW", "View employees"],
  ["EMPLOYEE_CREATE", "Create employees"],
  ["EMPLOYEE_UPDATE", "Update employees"],
  ["EMPLOYEE_DELETE", "Delete employees"],

  ["ATTENDANCE_VIEW", "View attendance"],
  ["ATTENDANCE_MANAGE", "Manage attendance"],

  ["LEAVE_VIEW", "View leave requests"],
  ["LEAVE_APPLY", "Apply for leave"],
  ["LEAVE_APPROVE", "Approve leave requests"],

  ["TIMESHEET_VIEW", "View timesheets"],
  ["TIMESHEET_EXPORT", "Export timesheets"],
  ["TIMESHEET_APPROVE", "Approve or reject timesheet edit requests"],

  ["NOTIFICATION_VIEW", "View notifications"],
  ["NOTIFICATION_MANAGE", "Manage notifications"],

  ["REPORT_VIEW", "View reports"],
  ["REPORT_EXPORT", "Export reports"],

  ["AUDIT_VIEW", "View audit logs"],

  ["DOCUMENT_VIEW", "View documents"],
  ["DOCUMENT_UPLOAD", "Upload documents"],
  ["DOCUMENT_DELETE", "Delete documents"],

  ["PROJECT_VIEW", "View projects"],
  ["PROJECT_UPDATE", "Update projects"],
  ["PROJECT_DELETE", "Delete projects"],
  ["PROJECT_MEMBER_MANAGE", "Manage project members"],
  ["PROJECT_MONITOR", "Monitor projects"],
  ["PROJECT_CREATE", "Create projects"],
] as const;

// ============================================================================
// 2. SYSTEM ROLES
// ============================================================================

const roles = [
  {
    code: RoleCode.ADMIN,
    name: "Administrator",
    description: "Full system administrator",
    isSystem: true,
  },

  {
    code: RoleCode.MANAGER,
    name: "Manager",
    description: "Department or organizational manager",
    isSystem: true,
  },

  {
    code: RoleCode.TEAM_LEAD,
    name: "Team Lead",
    description: "Team-level supervisor",
    isSystem: true,
  },

  {
    code: RoleCode.EMPLOYEE,
    name: "Employee",
    description: "Standard employee",
    isSystem: true,
  },
];

// ============================================================================
// 3. ROLE -> PERMISSION DEFINITIONS
// ============================================================================
//
// This is the central RBAC configuration for EEMS.
//
// ADMIN
//   - Full access to every permission.
//
// MANAGER
//   - Employee management
//   - Attendance management
//   - Leave approval
//   - Timesheets
//   - Reports
//   - Documents
//   - Projects
//
// TEAM_LEAD
//   - Employee viewing
//   - Attendance management
//   - Leave approval
//   - Timesheets
//   - Reports
//   - Documents
//   - Project monitoring
//
// EMPLOYEE
//   - Employee viewing
//   - Attendance
//   - Leave application
//   - Timesheets
//   - Documents
//   - Projects
//
// ============================================================================

const rolePermissions: Record<RoleCode, readonly string[]> = {
  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------

  [RoleCode.ADMIN]: permissions.map(([code]) => code),

  // --------------------------------------------------------------------------
  // MANAGER
  // --------------------------------------------------------------------------

  [RoleCode.MANAGER]: [
    "EMPLOYEE_VIEW",
    "EMPLOYEE_CREATE",
    "EMPLOYEE_UPDATE",

    "ATTENDANCE_VIEW",
    "ATTENDANCE_MANAGE",

    "LEAVE_VIEW",
    "LEAVE_APPROVE",

    "TIMESHEET_VIEW",
    "TIMESHEET_APPROVE",
    "TIMESHEET_EXPORT",

    "NOTIFICATION_VIEW",

    "REPORT_VIEW",
    "REPORT_EXPORT",

    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",

    "PROJECT_VIEW",
    "PROJECT_UPDATE",
    "PROJECT_MEMBER_MANAGE",
    "PROJECT_MONITOR",
    "PROJECT_CREATE",
  ],

  // --------------------------------------------------------------------------
  // TEAM LEAD
  // --------------------------------------------------------------------------

  [RoleCode.TEAM_LEAD]: [
    "EMPLOYEE_VIEW",

    "ATTENDANCE_VIEW",
    "ATTENDANCE_MANAGE",

    "LEAVE_VIEW",
    "LEAVE_APPROVE",

    "TIMESHEET_APPROVE",
    "TIMESHEET_VIEW",
    "TIMESHEET_EXPORT",

    "NOTIFICATION_VIEW",

    "REPORT_VIEW",

    "DOCUMENT_VIEW",

    "PROJECT_VIEW",
    "PROJECT_MONITOR",
  ],

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------

  [RoleCode.EMPLOYEE]: [
    "EMPLOYEE_VIEW",

    "ATTENDANCE_VIEW",
    "ATTENDANCE_MANAGE",

    "LEAVE_VIEW",
    "LEAVE_APPLY",

    "TIMESHEET_VIEW",
    "TIMESHEET_EXPORT",

    "NOTIFICATION_VIEW",

    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",

    "PROJECT_VIEW",
  ],
};

// ============================================================================
// MAIN SEED
// ============================================================================

async function main() {
  console.log("");
  console.log("========================================");
  console.log("Starting EEMS seed...");
  console.log("========================================");
  console.log("");

  // ==========================================================================
  // 1. PERMISSIONS
  // ==========================================================================

  for (const [code, name] of permissions) {
    await prisma.permission.upsert({
      where: {
        code,
      },

      update: {
        name,
      },

      create: {
        code,
        name,
      },
    });
  }

  console.log(`Created/updated ${permissions.length} permissions.`);

  // ==========================================================================
  // 2. ROLES
  // ==========================================================================

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },

      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },

      create: role,
    });
  }

  console.log(`Created/updated ${roles.length} roles.`);

  // ==========================================================================
  // 3. ROLE -> PERMISSION MAPPINGS
  // ==========================================================================

  const permissionRecords = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
    },
  });

  const permissionMap = new Map(
    permissionRecords.map((permissionCountermission) => [permission.code, permission.id]),
  );

  // --------------------------------------------------------------------------
  // Load roles once instead of repeatedly querying them.
  // --------------------------------------------------------------------------

  const roleRecords = await prisma.role.findMany({
    select: {
      id: true,
      code: true,
    },
  });

  const roleMap = new Map(roleRecords.map((role) => [role.code, role.id]));

  // --------------------------------------------------------------------------
  // Assign permissions.
  // --------------------------------------------------------------------------

  for (const role of roles) {
    const roleId = roleMap.get(role.code);

    if (!roleId) {
      throw new Error(
        `Role "${role.code}" not found while seeding role permissions`,
      );
    }

    const permissionCodes = rolePermissions[role.code];

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionMap.get(permissionCode);

      if (!permissionId) {
        throw new Error(
          `Permission "${permissionCode}" not found while seeding role "${role.code}"`,
        );
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },

        update: {},

        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  console.log("Created/updated role-permission mappings.");

  // ==========================================================================
  // 4. DEPARTMENTS
  // ==========================================================================

  const hr = await prisma.department.upsert({
    where: {
      code: "HR",
    },

    update: {
      name: "Human Resources",
      isActive: true,
    },

    create: {
      code: "HR",
      name: "Human Resources",
      isActive: true,
    },
  });

  const it = await prisma.department.upsert({
    where: {
      code: "IT",
    },

    update: {
      name: "Information Technology",
      isActive: true,
    },

    create: {
      code: "IT",
      name: "Information Technology",
      isActive: true,
    },
  });

  console.log("Created/updated HR and IT departments.");

  // ==========================================================================
  // 5. TEAMS
  // ==========================================================================

  const hrOps = await prisma.team.upsert({
    where: {
      code: "HR-OPS",
    },

    update: {
      name: "HR Operations",
      departmentId: hr.id,
      isActive: true,
    },

    create: {
      code: "HR-OPS",
      name: "HR Operations",
      departmentId: hr.id,
      isActive: true,
    },
  });

  const itDev = await prisma.team.upsert({
    where: {
      code: "IT-DEV",
    },

    update: {
      name: "Development",
      departmentId: it.id,
      isActive: true,
    },

    create: {
      code: "IT-DEV",
      name: "Development",
      departmentId: it.id,
      isActive: true,
    },
  });

  await prisma.team.upsert({
    where: {
      code: "IT-INFRA",
    },

    update: {
      name: "Infrastructure",
      departmentId: it.id,
      isActive: true,
    },

    create: {
      code: "IT-INFRA",
      name: "Infrastructure",
      departmentId: it.id,
      isActive: true,
    },
  });

  console.log("Created/updated organization teams.");

  // ==========================================================================
  // 6. LEAVE TYPES
  // ==========================================================================

  const leaveTypes = [
    {
      code: "CASUAL",
      name: "Casual Leave",
      description: "Leave for personal or casual requirements",
      isPaid: true,
    },

    {
      code: "SICK",
      name: "Sick Leave",
      description: "Leave due to illness",
      isPaid: true,
    },

    {
      code: "EARNED",
      name: "Earned Leave",
      description: "Earned or annual leave",
      isPaid: true,
    },

    {
      code: "MATERNITY",
      name: "Maternity Leave",
      description: "Maternity leave",
      isPaid: true,
    },

    {
      code: "PATERNITY",
      name: "Paternity Leave",
      description: "Paternity leave",
      isPaid: true,
    },

    {
      code: "UNPAID",
      name: "Unpaid Leave",
      description: "Leave without pay",
      isPaid: false,
    },

    {
      code: "OTHER",
      name: "Other Leave",
      description: "Other approved leave types",
      isPaid: false,
    },
  ];

  for (const leaveType of leaveTypes) {
    await prisma.leaveType.upsert({
      where: {
        code: leaveType.code,
      },

      update: {
        name: leaveType.name,
        description: leaveType.description,
        isPaid: leaveType.isPaid,
        isActive: true,
      },

      create: {
        ...leaveType,
        isActive: true,
      },
    });
  }

  console.log(`Created/updated ${leaveTypes.length} leave types.`);

  // ==========================================================================
  // 7. DEVELOPMENT TEST EMPLOYEE - EMP0001
  // ==========================================================================
  //
  // EMP0001
  //   HR
  //   HR-OPS
  //   EMPLOYEE
  //
  // NOTE:
  // EMP0001 already exists in your current database.
  //
  // We intentionally do not overwrite its organizational assignment here.
  //
  // ==========================================================================

  const employee = await prisma.employee.findUnique({
    where: {
      employeeCode: "EMP0001",
    },
  });

  if (!employee) {
    throw new Error(
      "EMP0001 employee was not found. Create EMP0001 before running this seed.",
    );
  }

  // ==========================================================================
  // 8. DEVELOPMENT TEST EMPLOYEE - EMP0002
  // ==========================================================================
  //
  // EMP0002
  //   HR
  //   HR-OPS
  //   MANAGER
  //
  // This user is used to test:
  //
  //   MANAGER + same department -> allowed
  //
  // ==========================================================================

  const managerEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP0002",
    },

    update: {
      firstName: "Test",
      lastName: "Manager",
      displayName: "Test Manager",
      phone: "9876543211",
      departmentId: hr.id,
      teamId: hrOps.id,
      status: EmployeeStatus.ACTIVE,
    },

    create: {
      employeeCode: "EMP0002",
      firstName: "Test",
      lastName: "Manager",
      displayName: "Test Manager",
      phone: "9876543211",
      dateOfJoining: new Date("2026-08-09T00:00:00.000Z"),
      departmentId: hr.id,
      teamId: hrOps.id,
      status: EmployeeStatus.ACTIVE,
    },
  });

  // ==========================================================================
  // 9. DEVELOPMENT TEST EMPLOYEE - EMP0003
  // ==========================================================================
  //
  // EMP0003
  //   IT
  //   IT-DEV
  //   Employee
  //
  // This employee is used to test:
  //
  //   HR Manager -> IT Employee -> FORBIDDEN
  //
  // No user is created for EMP0003 yet.
  //
  // ==========================================================================

  const itEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP0003",
    },

    update: {
      firstName: "Test",
      lastName: "IT Employee",
      displayName: "Test IT Employee",
      phone: "9876543212",
      departmentId: it.id,
      teamId: itDev.id,
      status: EmployeeStatus.ACTIVE,
    },

    create: {
      employeeCode: "EMP0003",
      firstName: "Test",
      lastName: "IT Employee",
      displayName: "Test IT Employee",
      phone: "9876543212",
      dateOfJoining: new Date("2026-08-09T00:00:00.000Z"),
      departmentId: it.id,
      teamId: itDev.id,
      status: EmployeeStatus.ACTIVE,
    },
  });

  console.log("Created/updated development employees: EMP0002 and EMP0003.");

  // ==========================================================================
  // 10. DEVELOPMENT TEST USER - EMP0001
  // ==========================================================================
  //
  // Links:
  //
  //   EMP0001
  //      |
  //      +-- User: emp0001
  //      |
  //      +-- Role: EMPLOYEE
  //
  // Development credentials:
  //
  //   Username : emp0001
  //   Password : Admin@123
  //
  // IMPORTANT:
  //
  // This password is ONLY for local development/testing.
  // Replace it before any production deployment.
  //
  // ==========================================================================

  const employeeRole = await prisma.role.findUnique({
    where: {
      code: RoleCode.EMPLOYEE,
    },
  });

  if (!employeeRole) {
    throw new Error("EMPLOYEE role was not found");
  }

  // --------------------------------------------------------------------------
  // bcrypt hash for:
  //
  //     Admin@123
  //
  // --------------------------------------------------------------------------

  const employeePasswordHash =
    "$2b$12$O1MELDGewfDCFKBokGxFWOyyEPmmtSbolzBUZZyrTVaHpFhSnGjPi";

  await prisma.user.upsert({
    where: {
      username: "emp0001",
    },

    update: {
      email: "emp0001@eems.local",
      passwordHash: employeePasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: employee.id,
      roleId: employeeRole.id,
    },

    create: {
      username: "emp0001",
      email: "emp0001@eems.local",
      passwordHash: employeePasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: employee.id,
      roleId: employeeRole.id,
    },
  });

  console.log("Created/updated development user: emp0001.");

  // ==========================================================================
  // 11. DEVELOPMENT TEST USER - MANAGER1
  // ==========================================================================
  //
  // Links:
  //
  //   EMP0002
  //      |
  //      +-- User: manager1
  //      |
  //      +-- Role: MANAGER
  //
  // Development credentials:
  //
  //   Username : manager1
  //   Password : Manager@123
  //
  // IMPORTANT:
  //
  // This password is ONLY for local development/testing.
  // Replace it before any production deployment.
  //
  // ==========================================================================

  const managerRole = await prisma.role.findUnique({
    where: {
      code: RoleCode.MANAGER,
    },
  });

  if (!managerRole) {
    throw new Error("MANAGER role was not found");
  }

  // --------------------------------------------------------------------------
  // bcrypt hash for:
  //
  //     Manager@123
  //
  // --------------------------------------------------------------------------

  const managerPasswordHash =
    "$2b$12$4v9vAcNYZC7nR.4gGDRDzeIw.AO6h1VxB28l3OHEWSOLEDhnhQBim";

  await prisma.user.upsert({
    where: {
      username: "manager1",
    },

    update: {
      email: "manager1@eems.local",
      passwordHash: managerPasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: managerEmployee.id,
      roleId: managerRole.id,
    },

    create: {
      username: "manager1",
      email: "manager1@eems.local",
      passwordHash: managerPasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: managerEmployee.id,
      roleId: managerRole.id,
    },
  });

  console.log("Created/updated development user: manager1.");

  // ==========================================================================
  // DEVELOPMENT TEST USER - IT EMPLOYEE
  // ==========================================================================
  //
  // Links:
  //
  //   EMP0003
  //      |
  //      +-- User: itemployee
  //      |
  //      +-- Role: EMPLOYEE
  //
  // Development credentials:
  //
  //   Username : itemployee
  //   Password : Employee@123
  //
  // Used to create an IT leave request for authorization testing.
  // ==========================================================================

  const itEmployeeRole = await prisma.role.findUnique({
    where: {
      code: RoleCode.EMPLOYEE,
    },
  });

  if (!itEmployeeRole) {
    throw new Error("EMPLOYEE role was not found");
  }

  // bcrypt hash for:
  // Employee@123

  const itEmployeePasswordHash =
    "$2b$12$o/2M9lmAFyz28kS7BosYjekzPOxhBG86NrVYjiQTKilXUAKaBRJNm";

  await prisma.user.upsert({
    where: {
      username: "itemployee",
    },

    update: {
      email: "itemployee@eems.local",
      passwordHash: itEmployeePasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: itEmployee.id,
      roleId: itEmployeeRole.id,
    },

    create: {
      username: "itemployee",
      email: "itemployee@eems.local",
      passwordHash: itEmployeePasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: itEmployee.id,
      roleId: itEmployeeRole.id,
    },
  });

  console.log("Created/updated development user: itemployee.");

  // ==========================================================================
  // DEVELOPMENT TEST EMPLOYEE - EMP0004
  // ==========================================================================
  //
  // TEAM LEAD
  //
  //   EMP0004
  //   HR
  //   HR-OPS
  //   TEAM_LEAD
  //
  // ==========================================================================

  const teamLeadEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP0004",
    },

    update: {
      firstName: "Test",
      lastName: "Team Lead",
      displayName: "Test Team Lead",
      phone: "9876543213",
      departmentId: hr.id,
      teamId: hrOps.id,
      status: EmployeeStatus.ACTIVE,
    },

    create: {
      employeeCode: "EMP0004",
      firstName: "Test",
      lastName: "Team Lead",
      displayName: "Test Team Lead",
      phone: "9876543213",
      dateOfJoining: new Date("2026-08-09T00:00:00.000Z"),
      departmentId: hr.id,
      teamId: hrOps.id,
      status: EmployeeStatus.ACTIVE,
    },
  });

  // ==========================================================================
  // DEVELOPMENT TEST EMPLOYEE - EMP0005
  // ==========================================================================
  //
  // ADMIN
  //
  //   EMP0005
  //   IT
  //   IT-DEV
  //   ADMIN
  //
  // ==========================================================================

  const adminEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP0005",
    },

    update: {
      firstName: "Test",
      lastName: "Admin",
      displayName: "Test Admin",
      phone: "9876543214",
      departmentId: it.id,
      teamId: itDev.id,
      status: EmployeeStatus.ACTIVE,
    },

    create: {
      employeeCode: "EMP0005",
      firstName: "Test",
      lastName: "Admin",
      displayName: "Test Admin",
      phone: "9876543214",
      dateOfJoining: new Date("2026-08-09T00:00:00.000Z"),
      departmentId: it.id,
      teamId: itDev.id,
      status: EmployeeStatus.ACTIVE,
    },
  });

  console.log("Created/updated development employees: EMP0004 and EMP0005.");

  // ==========================================================================
  // DEVELOPMENT TEST USER - TEAMLEAD1
  // ==========================================================================

  const teamLeadRole = await prisma.role.findUnique({
    where: {
      code: RoleCode.TEAM_LEAD,
    },
  });

  if (!teamLeadRole) {
    throw new Error("TEAM_LEAD role was not found");
  }

  // Replace this with the hash generated for:
  // TeamLead@123

  const teamLeadPasswordHash =
    "$2b$12$ULQmw5a5NBtH7Am1mwiYAOf0xqFT3KWMemKokRptN202JUQQWd1om";

  await prisma.user.upsert({
    where: {
      username: "teamlead1",
    },

    update: {
      email: "teamlead1@eems.local",
      passwordHash: teamLeadPasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: teamLeadEmployee.id,
      roleId: teamLeadRole.id,
    },

    create: {
      username: "teamlead1",
      email: "teamlead1@eems.local",
      passwordHash: teamLeadPasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: teamLeadEmployee.id,
      roleId: teamLeadRole.id,
    },
  });

  console.log("Created/updated development user: teamlead1.");

  // ==========================================================================
  // DEVELOPMENT TEST USER - ADMIN1
  // ==========================================================================

  const adminRole = await prisma.role.findUnique({
    where: {
      code: RoleCode.ADMIN,
    },
  });

  if (!adminRole) {
    throw new Error("ADMIN role was not found");
  }

  // Replace this with the hash generated for:
  // Admin@123

  const adminPasswordHash =
    "$2b$12$iMcUmmNeSrx2xOihc.gJTOUe8E0OsGjQ/JkGXl2QOGEoT4bE50DAG";

  await prisma.user.upsert({
    where: {
      username: "admin1",
    },

    update: {
      email: "admin1@eems.local",
      passwordHash: adminPasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: adminEmployee.id,
      roleId: adminRole.id,
    },

    create: {
      username: "admin1",
      email: "admin1@eems.local",
      passwordHash: adminPasswordHash,
      status: UserStatus.ACTIVE,
      employeeId: adminEmployee.id,
      roleId: adminRole.id,
    },
  });

  console.log("Created/updated development user: admin1.");

  // ==========================================================================
  // 12. SUMMARY
  // ==========================================================================

  const roleCount = await prisma.role.count();

  const permissionCount = await prisma.permission.count();

  const rolePermissionCount = await prisma.rolePermission.count();

  const departmentCount = await prisma.department.count();

  const teamCount = await prisma.team.count();

  const leaveTypeCount = await prisma.leaveType.count();

  const employeeCount = await prisma.employee.count();

  const userCount = await prisma.user.count();

  console.log("");
  console.log("========================================");
  console.log("EEMS seed completed successfully.");
  console.log("========================================");
  console.log(`Roles             : ${roleCount}`);
  console.log(`Permissions       : ${permissionCount}`);
  console.log(`Role Permissions  : ${rolePermissionCount}`);
  console.log(`Departments       : ${departmentCount}`);
  console.log(`Teams             : ${teamCount}`);
  console.log(`Leave Types       : ${leaveTypeCount}`);
  console.log(`Employees         : ${employeeCount}`);
  console.log(`Users             : ${userCount}`);
  console.log("========================================");
  console.log("");

  // --------------------------------------------------------------------------
  // Keep this reference so TypeScript doesn't consider the IT employee
  // unused while making the intended test data explicit.
  // --------------------------------------------------------------------------

  if (!itEmployee.id) {
    throw new Error("EMP0003 was not created correctly");
  }
}

// ============================================================================
// EXECUTE SEED
// ============================================================================

main()
  .catch((error) => {
    console.error("");
    console.error("EEMS seed failed.");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
