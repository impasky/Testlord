-- Bölge kimliğini shard'a uygun hale getirir.
--
-- Önce Region.id doğrudan world-map.json'daki numaraydı (1-61). Bu, ikinci bir
-- dünyanın (shard) aynı haritayı kullanmasını imkânsız kılıyordu: birincil anahtar
-- çakışırdı. Artık id otomatik artan bir veritabanı kimliği, mapId ise kanonik
-- harita numarası. Böylece her dünya kendi 61 bölgesine sahip olabiliyor.

ALTER TABLE "Region" ADD COLUMN "mapId" INTEGER;
UPDATE "Region" SET "mapId" = "id";
ALTER TABLE "Region" ALTER COLUMN "mapId" SET NOT NULL;

-- id artık veritabanı tarafından üretiliyor; mevcut en yüksek değerin ötesinden başlat
CREATE SEQUENCE "Region_id_seq" OWNED BY "Region"."id";
SELECT setval('"Region_id_seq"', COALESCE((SELECT MAX("id") FROM "Region"), 0) + 1, false);
ALTER TABLE "Region" ALTER COLUMN "id" SET DEFAULT nextval('"Region_id_seq"');

CREATE UNIQUE INDEX "Region_worldId_mapId_key" ON "Region"("worldId", "mapId");
