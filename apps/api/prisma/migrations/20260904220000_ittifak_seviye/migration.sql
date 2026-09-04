-- Ittifak seviyesi: bagis XP'si, duyuru, uye rutbesi.
ALTER TABLE "Alliance" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Alliance" ADD COLUMN "duyuru" TEXT;
ALTER TABLE "Lord" ADD COLUMN "ittifakRutbe" TEXT;

-- Bagis satiri: hem gunluk hakki hem haftalik katkiyi bu tablodan sayiyoruz.
CREATE TABLE "AllianceDonation" (
  "id"         TEXT NOT NULL,
  "allianceId" TEXT NOT NULL,
  "lordId"     TEXT NOT NULL,
  "xp"         INTEGER NOT NULL,
  "altin"      INTEGER NOT NULL,
  "demir"      INTEGER NOT NULL,
  "erzak"      INTEGER NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AllianceDonation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AllianceDonation_allianceId_createdAt_idx" ON "AllianceDonation"("allianceId", "createdAt");
CREATE INDEX "AllianceDonation_lordId_createdAt_idx" ON "AllianceDonation"("lordId", "createdAt");

ALTER TABLE "AllianceDonation" ADD CONSTRAINT "AllianceDonation_allianceId_fkey"
  FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllianceDonation" ADD CONSTRAINT "AllianceDonation_lordId_fkey"
  FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
