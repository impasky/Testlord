-- Saldirmazlik pakti: iki ittifak birbirine saldirmamaya soz veriyor.
-- Taraflar KANONIK sirada (aId < bId): X-Y ile Y-X ayni pakt.
CREATE TABLE "Pakt" (
  "id"           TEXT NOT NULL,
  "worldId"      TEXT NOT NULL,
  "aId"          TEXT NOT NULL,
  "bId"          TEXT NOT NULL,
  "teklifEdenId" TEXT NOT NULL,
  "durum"        TEXT NOT NULL DEFAULT 'teklif',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kabulAt"      TIMESTAMP(3),
  "fesihAt"      TIMESTAMP(3),
  "biterAt"      TIMESTAMP(3),
  "fesihEdenId"  TEXT,
  CONSTRAINT "Pakt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pakt_aId_bId_key" ON "Pakt"("aId", "bId");
CREATE INDEX "Pakt_worldId_idx" ON "Pakt"("worldId");
CREATE INDEX "Pakt_aId_idx" ON "Pakt"("aId");
CREATE INDEX "Pakt_bId_idx" ON "Pakt"("bId");

ALTER TABLE "Pakt" ADD CONSTRAINT "Pakt_worldId_fkey"
  FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pakt" ADD CONSTRAINT "Pakt_aId_fkey"
  FOREIGN KEY ("aId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pakt" ADD CONSTRAINT "Pakt_bId_fkey"
  FOREIGN KEY ("bId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
