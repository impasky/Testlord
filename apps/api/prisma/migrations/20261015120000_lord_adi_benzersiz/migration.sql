-- Lord adı veritabanında benzersiz (docs/18 "Lord adı benzersizliği").
--
-- Anahtar `lordAdiAnahtari` (apps/api/src/services/adDenetimi.ts) ile
-- AYNI kural: boşluklar sadeleşiyor, Türkçe I'lar ve büyük harfler
-- küçülüyor. Biri değişirse öteki de değişmeli.
ALTER TABLE "Lord" ADD COLUMN "adAnahtari" TEXT;

UPDATE "Lord"
SET "adAnahtari" = lower(translate(regexp_replace(btrim("name"), '\s+', ' ', 'g'), 'İIıÇĞÖŞÜ', 'iiiçğöşü'));

-- Var olan çakışmalar (kısıt yokken aynı anda gelen kayıtlar, "Ali" ile
-- "ALİ"): en eski lord adını koruyor, sonrakilerin adına kimliğinin son
-- dört hanesi ekleniyor. Kimlik benzersiz, yani ek de benzersiz.
WITH sirali AS (
  SELECT "id", row_number() OVER (PARTITION BY "adAnahtari" ORDER BY "createdAt", "id") AS sira
  FROM "Lord"
)
UPDATE "Lord" AS l
SET "name" = btrim(l."name") || '-' || right(l."id", 4),
    "adAnahtari" = l."adAnahtari" || '-' || lower(right(l."id", 4))
FROM sirali AS s
WHERE s."id" = l."id" AND s.sira > 1;

ALTER TABLE "Lord" ALTER COLUMN "adAnahtari" SET NOT NULL;

CREATE UNIQUE INDEX "Lord_adAnahtari_key" ON "Lord"("adAnahtari");
