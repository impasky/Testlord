-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "asgariSeviye" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "katilim" TEXT NOT NULL DEFAULT 'basvuru';

-- CreateTable
CREATE TABLE "AllianceBasvuru" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "mesaj" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bekliyor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kararAt" TIMESTAMP(3),
    "kararVerenId" TEXT,

    CONSTRAINT "AllianceBasvuru_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllianceBasvuru_allianceId_durum_idx" ON "AllianceBasvuru"("allianceId", "durum");

-- CreateIndex
CREATE INDEX "AllianceBasvuru_lordId_durum_idx" ON "AllianceBasvuru"("lordId", "durum");

-- CreateIndex
CREATE UNIQUE INDEX "AllianceBasvuru_allianceId_lordId_key" ON "AllianceBasvuru"("allianceId", "lordId");

-- AddForeignKey
ALTER TABLE "AllianceBasvuru" ADD CONSTRAINT "AllianceBasvuru_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceBasvuru" ADD CONSTRAINT "AllianceBasvuru_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
