/*
  Warnings:

  - A unique constraint covering the columns `[attendanceId]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TimesheetSource" AS ENUM ('ATTENDANCE', 'MANUAL', 'CORRECTED');

-- CreateEnum
CREATE TYPE "TimesheetEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "TimesheetStatus" ADD VALUE 'AUTOMATIC';

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "attendanceId" TEXT,
ADD COLUMN     "source" "TimesheetSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "TimesheetEditRequest" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedWorkDate" TIMESTAMP(3),
    "requestedWorkingMinutes" INTEGER NOT NULL,
    "requestedDescription" TEXT,
    "requestedTaskDescription" TEXT,
    "reason" TEXT NOT NULL,
    "status" "TimesheetEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "approverEmployeeId" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetEditRequest_timesheetId_idx" ON "TimesheetEditRequest"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetEditRequest_employeeId_idx" ON "TimesheetEditRequest"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetEditRequest_status_idx" ON "TimesheetEditRequest"("status");

-- CreateIndex
CREATE INDEX "TimesheetEditRequest_requestedAt_idx" ON "TimesheetEditRequest"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_attendanceId_key" ON "Timesheet"("attendanceId");

-- CreateIndex
CREATE INDEX "Timesheet_attendanceId_idx" ON "Timesheet"("attendanceId");

-- CreateIndex
CREATE INDEX "Timesheet_source_idx" ON "Timesheet"("source");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEditRequest" ADD CONSTRAINT "TimesheetEditRequest_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEditRequest" ADD CONSTRAINT "TimesheetEditRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
