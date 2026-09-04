-- İttifak içi kaynak gönderimi (docs/09 B6).
--
-- Kaynak da yol alıyor: anında gönderim, kuşatma altındaki oyuncuyu
-- sınırsız beslerdi ve saldırının ekonomik anlamı kalmazdı. Bu yüzden
-- gönderim bir "sevkiyat" kaydı — varış saatiyle birlikte.
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "fromLordId" TEXT NOT NULL,
    "toLordId" TEXT NOT NULL,
    "altin" INTEGER NOT NULL DEFAULT 0,
    "demir" INTEGER NOT NULL DEFAULT 0,
    "erzak" INTEGER NOT NULL DEFAULT 0,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveAt" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shipment_resolved_arriveAt_idx" ON "Shipment"("resolved", "arriveAt");
CREATE INDEX "Shipment_fromLordId_departAt_idx" ON "Shipment"("fromLordId", "departAt");
CREATE INDEX "Shipment_toLordId_resolved_idx" ON "Shipment"("toLordId", "resolved");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_fromLordId_fkey"
  FOREIGN KEY ("fromLordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_toLordId_fkey"
  FOREIGN KEY ("toLordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
