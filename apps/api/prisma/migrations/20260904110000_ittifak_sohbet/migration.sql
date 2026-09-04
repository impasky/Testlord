-- İttifak sohbeti (docs/09 B3).
--
-- Sadece ittifak içi: kapalı bir gruba (en fazla 8 kişi) yazmak, herkese
-- açık bir kanala yazmaktan bambaşka bir sorumluluk. İttifak silinince
-- mesajlar da gidiyor — sohbet ittifakın kendisi kadar yaşıyor.
CREATE TABLE "AllianceMessage" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllianceMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AllianceMessage_allianceId_createdAt_idx" ON "AllianceMessage"("allianceId", "createdAt");
CREATE INDEX "AllianceMessage_lordId_createdAt_idx" ON "AllianceMessage"("lordId", "createdAt");

ALTER TABLE "AllianceMessage" ADD CONSTRAINT "AllianceMessage_allianceId_fkey"
  FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllianceMessage" ADD CONSTRAINT "AllianceMessage_lordId_fkey"
  FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
