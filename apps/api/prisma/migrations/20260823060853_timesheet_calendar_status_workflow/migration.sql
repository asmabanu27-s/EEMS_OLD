/*
  Warnings:

  - The values [CORRECTED] on the enum `TimesheetSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "TimesheetDayStatus" AS ENUM ('MISSED', 'PRESENT', 'WEEK_OFF', 'ABSENT', 'COMPOFF', 'LEAVE');

-- CreateEnum
CREATE TYPE "TimesheetDaySource" AS ENUM ('ATTENDANCE', 'MANUAL', 'LEAVE', 'WEEK_OFF', 'COMPOFF');

-- CreateEnum
CREATE TYPE "TimesheetDayRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TimesheetEditRequestStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "TimesheetSource_new" AS ENUM ('ATTENDANCE', 'MANUAL');
ALTER TABLE "public"."Timesheet" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Timesheet" ALTER COLUMN "source" TYPE "TimesheetSource_new" USING ("source"::text::"TimesheetSource_new");
ALTER TYPE "TimesheetSource" RENAME TO "TimesheetSource_old";
ALTER TYPE "TimesheetSource_new" RENAME TO "TimesheetSource";
DROP TYPE "public"."TimesheetSource_old";
ALTER TABLE "Timesheet" ALTER COLUMN "source" SET DEFAULT 'MANUAL';
COMMIT;

-- CreateTable
CREATE TABLE "TimesheetDay" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" "TimesheetDayStatus" NOT NULL DEFAULT 'MISSED',
    "source" "TimesheetDaySource" NOT NULL DEFAULT 'ATTENDANCE',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetDayChangeRequest" (
    "id" TEXT NOT NULL,
    "timesheetDayId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedStatus" "TimesheetDayStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TimesheetDayRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approverEmployeeId" TEXT,
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetDayChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetDay_employeeId_idx" ON "TimesheetDay"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetDay_workDate_idx" ON "TimesheetDay"("workDate");

-- CreateIndex
CREATE INDEX "TimesheetDay_status_idx" ON "TimesheetDay"("status");

-- CreateIndex
CREATE INDEX "TimesheetDay_source_idx" ON "TimesheetDay"("source");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetDay_employeeId_workDate_key" ON "TimesheetDay"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "TimesheetDayChangeRequest_timesheetDayId_idx" ON "TimesheetDayChangeRequest"("timesheetDayId");

-- CreateIndex
CREATE INDEX "TimesheetDayChangeRequest_employeeId_idx" ON "TimesheetDayChangeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetDayChangeRequest_status_idx" ON "TimesheetDayChangeRequest"("status");

-- CreateIndex
CREATE INDEX "TimesheetDayChangeRequest_requestedAt_idx" ON "TimesheetDayChangeRequest"("requestedAt");

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDayChangeRequest" ADD CONSTRAINT "TimesheetDayChangeRequest_timesheetDayId_fkey" FOREIGN KEY ("timesheetDayId") REFERENCES "TimesheetDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDayChangeRequest" ADD CONSTRAINT "TimesheetDayChangeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
