-- Akın ganimeti eşyaları oyunda olmayan iki yuvayla yazıyordu: "miğfer"
-- (doğrusu "migfer") ve "yüzük" (yuva listesinde yok; altıncı yuva "at").
-- Bu parçalar Demirhane'de adsız ve resimsiz görünüyor, kuşanılınca da
-- yedinci bir yuva gibi güç ekliyordu. Kayıtlar oyunun yuvalarına taşınıyor.
UPDATE "Item" SET "slot" = 'migfer' WHERE "slot" = 'miğfer';
UPDATE "Item" SET "slot" = 'at' WHERE "slot" = 'yüzük';
UPDATE "EsyaIlani" SET "slot" = 'migfer' WHERE "slot" = 'miğfer';
UPDATE "EsyaIlani" SET "slot" = 'at' WHERE "slot" = 'yüzük';
UPDATE "OnSiparis" SET "slot" = 'migfer' WHERE "slot" = 'miğfer';
UPDATE "OnSiparis" SET "slot" = 'at' WHERE "slot" = 'yüzük';
UPDATE "EsyaIslemi" SET "slot" = 'migfer' WHERE "slot" = 'miğfer';
UPDATE "EsyaIslemi" SET "slot" = 'at' WHERE "slot" = 'yüzük';

-- Taşınınca bir yuvada iki kuşanık parça kalabiliyor (ör. hem "yüzük" hem
-- "at" kuşanıktı). Her yuvada en güçlüsü (kademe, nadirlik, yükseltme
-- sırasıyla) kuşanık kalıyor; öteki envantere dönüyor, kaybolmuyor.
WITH sirali AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "lordId", "slot"
           ORDER BY "tier" DESC,
                    CASE "rarity"
                      WHEN 'kadim' THEN 5
                      WHEN 'efsanevi' THEN 4
                      WHEN 'nadir' THEN 3
                      WHEN 'usta' THEN 2
                      ELSE 1
                    END DESC,
                    "upgradeLevel" DESC,
                    "createdAt" ASC
         ) AS "sira"
  FROM "Item"
  WHERE "equipped" = true
)
UPDATE "Item" SET "equipped" = false
WHERE "id" IN (SELECT "id" FROM sirali WHERE "sira" > 1);
