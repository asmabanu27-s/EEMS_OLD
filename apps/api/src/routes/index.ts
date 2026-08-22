import { Router } from "express";

import healthRoutes from "./health.routes.js";

import authRoutes from "@/modules/auth/auth.routes.js";
import employeeRoutes from "@/modules/employee/employee.routes.js";
import attendanceRoutes from "@/modules/attendance/attendance.routes.js";
import leaveRoutes from "@/modules/leave/leave.routes.js";
import timesheetRoutes from "@/modules/timesheet/timesheet.routes.js";
import notificationRoutes from "@/modules/notification/notification.routes.js";
import documentRoutes from "@/modules/document/document.routes.js";
import projectRoutes from "@/modules/project/project.routes.js";
import reportRoutes from "@/modules/report/report.routes.js";
import auditRoutes from "@/modules/audit/audit.routes.js";

const router = Router();

router.use("/health", healthRoutes);

router.use("/auth", authRoutes);

router.use("/employees", employeeRoutes);

router.use("/attendance", attendanceRoutes);

router.use("/leave", leaveRoutes);

router.use("/timesheets", timesheetRoutes);

router.use("/projects", projectRoutes);

router.use("/documents", documentRoutes);

router.use("/reports", reportRoutes);

router.use("/notifications", notificationRoutes);

router.use("/audit", auditRoutes);

export default router;
