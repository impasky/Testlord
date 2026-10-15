-- Savaş raporunu ittifak sohbetinde paylaşma (docs/09 B3).
ALTER TABLE "AllianceMessage" ADD COLUMN "battleId" TEXT;

CREATE INDEX "AllianceMessage_battleId_idx" ON "AllianceMessage"("battleId");

ALTER TABLE "AllianceMessage" ADD CONSTRAINT "AllianceMessage_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
