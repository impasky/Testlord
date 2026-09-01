-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_targetId_createdAt_idx" ON "Report"("targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetId_key" ON "Report"("reporterId", "targetId");
