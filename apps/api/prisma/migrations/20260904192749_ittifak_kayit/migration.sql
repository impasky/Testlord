-- CreateTable
CREATE TABLE "AllianceLog" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lordId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllianceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllianceLog_allianceId_createdAt_idx" ON "AllianceLog"("allianceId", "createdAt");

-- AddForeignKey
ALTER TABLE "AllianceLog" ADD CONSTRAINT "AllianceLog_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
