-- İttifak: birlikte oynayan lordlar (docs/09 B1).
--
-- Çekirdek kasten küçük: ad, etiket, lider, üyeler. Tek kuralı bile tek
-- başına değerli — birbirine saldıramamak, "yalnız değilim" hissinin en
-- somut hâli.
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "leaderLordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- Üyesi olduğu ittifak. Ayrılma anı ayrı tutuluyor: ittifaktan çıkıp hemen
-- başkasına girmek, saldırı kilidini kalkan gibi kullanmayı mümkün kılardı.
ALTER TABLE "Lord" ADD COLUMN "allianceId" TEXT;
ALTER TABLE "Lord" ADD COLUMN "allianceLeftAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Alliance_leaderLordId_key" ON "Alliance"("leaderLordId");
CREATE UNIQUE INDEX "Alliance_worldId_name_key" ON "Alliance"("worldId", "name");
CREATE UNIQUE INDEX "Alliance_worldId_tag_key" ON "Alliance"("worldId", "tag");
CREATE INDEX "Alliance_worldId_idx" ON "Alliance"("worldId");
CREATE INDEX "Lord_allianceId_idx" ON "Lord"("allianceId");

ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_worldId_fkey"
  FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_leaderLordId_fkey"
  FOREIGN KEY ("leaderLordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lord" ADD CONSTRAINT "Lord_allianceId_fkey"
  FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
