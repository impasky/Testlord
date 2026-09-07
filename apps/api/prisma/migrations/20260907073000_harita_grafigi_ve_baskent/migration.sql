-- Altigen izgara kalkti, komsuluk grafigi geldi (docs/12 §1).
--
-- Gocun tamami YERINDE: hicbir dunya, lord ya da bolge silinmiyor.
-- Yeni alanlar once bosluga izin vererek ekleniyor, kanonik haritadan
-- dolduruluyor, sonra zorunlu hale getiriliyor. Boylece calisan bir
-- dunyanin ortasinda da guvenle uygulanabilir.

-- ---------------------------------------------------------------- Region
ALTER TABLE "Region" ADD COLUMN "x" DOUBLE PRECISION;
ALTER TABLE "Region" ADD COLUMN "y" DOUBLE PRECISION;
ALTER TABLE "Region" ADD COLUMN "komsular" JSONB;

-- Konum ve komsuluk kanonik haritadan (world-map.json), mapId uzerinden.
UPDATE "Region" r
SET "x" = k.x, "y" = k.y, "komsular" = k.komsular
FROM (VALUES
  (1, 50.0, 50.0, '[2, 12, 13, 32, 42, 52]'::jsonb),
  (2, 61.0, 50.0, '[1, 3, 4, 13, 52, 54]'::jsonb),
  (3, 66.5, 61.0, '[2, 4, 6, 7, 13, 16]'::jsonb),
  (4, 72.0, 50.0, '[2, 3, 7, 8, 54, 57]'::jsonb),
  (5, 66.5, 83.0, '[6, 9, 16, 18, 29, 30]'::jsonb),
  (6, 72.0, 72.0, '[3, 5, 7, 9, 10, 16]'::jsonb),
  (7, 77.5, 61.0, '[3, 4, 6, 8, 10, 11]'::jsonb),
  (8, 83.0, 50.0, '[4, 7, 11, 31, 57, 61]'::jsonb),
  (9, 77.5, 83.0, '[5, 6, 10, 30]'::jsonb),
  (10, 83.0, 72.0, '[6, 7, 9, 11]'::jsonb),
  (11, 88.5, 61.0, '[7, 8, 10, 31]'::jsonb),
  (12, 44.5, 61.0, '[1, 13, 14, 15, 22, 32]'::jsonb),
  (13, 55.5, 61.0, '[1, 2, 3, 12, 15, 16]'::jsonb),
  (14, 39.0, 72.0, '[12, 15, 17, 22, 24, 25]'::jsonb),
  (15, 50.0, 72.0, '[12, 13, 14, 16, 17, 18]'::jsonb),
  (16, 61.0, 72.0, '[3, 5, 6, 13, 15, 18]'::jsonb),
  (17, 44.5, 83.0, '[14, 15, 18, 20, 21, 25]'::jsonb),
  (18, 55.5, 83.0, '[5, 15, 16, 17, 21, 29]'::jsonb),
  (19, 28.0, 94.0, '[20, 25, 28]'::jsonb),
  (20, 39.0, 94.0, '[17, 19, 21, 25]'::jsonb),
  (21, 50.0, 94.0, '[17, 18, 20, 29]'::jsonb),
  (22, 33.5, 61.0, '[12, 14, 23, 24, 32, 33]'::jsonb),
  (23, 22.5, 61.0, '[22, 24, 26, 27, 33, 35]'::jsonb),
  (24, 28.0, 72.0, '[14, 22, 23, 25, 27, 28]'::jsonb),
  (25, 33.5, 83.0, '[14, 17, 19, 20, 24, 28]'::jsonb),
  (26, 11.5, 61.0, '[23, 27, 35, 38]'::jsonb),
  (27, 17.0, 72.0, '[23, 24, 26, 28]'::jsonb),
  (28, 22.5, 83.0, '[19, 24, 25, 27]'::jsonb),
  (29, 61.0, 94.0, '[5, 18, 21, 30]'::jsonb),
  (30, 72.0, 94.0, '[5, 9, 29]'::jsonb),
  (31, 94.0, 50.0, '[8, 11, 61]'::jsonb),
  (32, 39.0, 50.0, '[1, 12, 22, 33, 34, 42]'::jsonb),
  (33, 28.0, 50.0, '[22, 23, 32, 34, 35, 36]'::jsonb),
  (34, 33.5, 39.0, '[32, 33, 36, 37, 42, 43]'::jsonb),
  (35, 17.0, 50.0, '[23, 26, 33, 36, 38, 39]'::jsonb),
  (36, 22.5, 39.0, '[33, 34, 35, 37, 39, 40]'::jsonb),
  (37, 28.0, 28.0, '[34, 36, 40, 41, 43, 45]'::jsonb),
  (38, 6.0, 50.0, '[26, 35, 39]'::jsonb),
  (39, 11.5, 39.0, '[35, 36, 38, 40]'::jsonb),
  (40, 17.0, 28.0, '[36, 37, 39, 41]'::jsonb),
  (41, 22.5, 17.0, '[37, 40, 45, 48]'::jsonb),
  (42, 44.5, 39.0, '[1, 32, 34, 43, 44, 52]'::jsonb),
  (43, 39.0, 28.0, '[34, 37, 42, 44, 45, 46]'::jsonb),
  (44, 50.0, 28.0, '[42, 43, 46, 47, 52, 53]'::jsonb),
  (45, 33.5, 17.0, '[37, 41, 43, 46, 48, 49]'::jsonb),
  (46, 44.5, 17.0, '[43, 44, 45, 47, 49, 50]'::jsonb),
  (47, 55.5, 17.0, '[44, 46, 50, 51, 53, 55]'::jsonb),
  (48, 28.0, 6.0, '[41, 45, 49]'::jsonb),
  (49, 39.0, 6.0, '[45, 46, 48, 50]'::jsonb),
  (50, 50.0, 6.0, '[46, 47, 49, 51]'::jsonb),
  (51, 61.0, 6.0, '[47, 50, 55, 58]'::jsonb),
  (52, 55.5, 39.0, '[1, 2, 42, 44, 53, 54]'::jsonb),
  (53, 61.0, 28.0, '[44, 47, 52, 54, 55, 56]'::jsonb),
  (54, 66.5, 39.0, '[2, 4, 52, 53, 56, 57]'::jsonb),
  (55, 66.5, 17.0, '[47, 51, 53, 56, 58, 59]'::jsonb),
  (56, 72.0, 28.0, '[53, 54, 55, 57, 59, 60]'::jsonb),
  (57, 77.5, 39.0, '[4, 8, 54, 56, 60, 61]'::jsonb),
  (58, 72.0, 6.0, '[51, 55, 59]'::jsonb),
  (59, 77.5, 17.0, '[55, 56, 58, 60]'::jsonb),
  (60, 83.0, 28.0, '[56, 57, 59, 61]'::jsonb),
  (61, 88.5, 39.0, '[8, 31, 57, 60]'::jsonb)
) AS k("mapId", x, y, komsular)
WHERE r."mapId" = k."mapId";

-- Kanonik haritada karsiligi olmayan satir kalmamali; kalirsa mesafe
-- hesabi onlari haritanin disinda sayar. Emniyet olarak haritanin
-- merkezine ve komsusuz olarak isaretleniyorlar.
UPDATE "Region" SET "x" = 50, "y" = 50, "komsular" = '[]'::jsonb
WHERE "x" IS NULL;

ALTER TABLE "Region" ALTER COLUMN "x" SET NOT NULL;
ALTER TABLE "Region" ALTER COLUMN "y" SET NOT NULL;
ALTER TABLE "Region" ALTER COLUMN "komsular" SET NOT NULL;

-- ------------------------------------------------------------------ Lord
ALTER TABLE "Lord" ADD COLUMN "homeBolgeId" INTEGER;
ALTER TABLE "Lord" ADD COLUMN "baskentBolgeId" INTEGER;
ALTER TABLE "Lord" ADD COLUMN "binalar" JSONB NOT NULL DEFAULT '{}';

-- Kampin cipasi: lordun eski koordinatinin denk geldigi bolge. Boylece
-- herkesin baslangic yeri oldugu gibi kaliyor.
UPDATE "Lord" l
SET "homeBolgeId" = COALESCE(
  (SELECT r."mapId" FROM "Region" r
    WHERE r."worldId" = l."worldId" AND r."q" = l."homeQ" AND r."r" = l."homeR"
    LIMIT 1),
  1
);
ALTER TABLE "Lord" ALTER COLUMN "homeBolgeId" SET NOT NULL;
ALTER TABLE "Lord" ALTER COLUMN "homeBolgeId" SET DEFAULT 1;

-- Baskent: elindeki YERLESIM turu bolgelerin en gelismisi. Tarla ve
-- maden yerlesim degil, o yuzden disarida. Hicbiri yoksa NULL kaliyor --
-- bu gecerli bir durum: lord kampta demektir (docs/12 §2.3).
UPDATE "Lord" l
SET "baskentBolgeId" = (
  SELECT r."mapId" FROM "Region" r
   WHERE r."ownerLordId" = l."id"
     AND r."type" IN ('koy', 'sehir', 'kale', 'taht')
   ORDER BY r."level" DESC, r."mapId" ASC
   LIMIT 1
);

-- ------------------------------------------------------- Eski hex alanlari
DROP INDEX IF EXISTS "Region_worldId_q_r_key";
ALTER TABLE "Region" DROP COLUMN "q";
ALTER TABLE "Region" DROP COLUMN "r";
ALTER TABLE "Region" DROP COLUMN "ring";
ALTER TABLE "Lord" DROP COLUMN "homeQ";
ALTER TABLE "Lord" DROP COLUMN "homeR";
