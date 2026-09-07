-- Ilk KAZANILAN akinin damgasi (docs/12 §8).
--
-- Sayac degil DAMGA: rehberin "ilk akinina cik" asamasi buna bakiyor.
-- Akin kayitlarini saymak da olurdu ama tickLord her istekte calisiyor
-- ve oraya bir sorgu daha eklemek pahali. Damga geri alinamaz oldugu
-- icin kidemli lord kendini bir daha o asamada bulmuyor.
ALTER TABLE "Lord" ADD COLUMN "ilkAkinAt" TIMESTAMP(3);

-- Var olan lordlarin akin gecmisi varsa damgayi geriye donuk koy:
-- yoksa akin yapmis kidemli bir lord kendini "ilk akinina cik"
-- asamasinda bulurdu.
UPDATE "Lord" l
SET "ilkAkinAt" = a."ilk"
FROM (
  SELECT "lordId", MIN("arriveAt") AS "ilk"
  FROM "Akin"
  WHERE "resolved" = true AND "kazanildi" = true
  GROUP BY "lordId"
) a
WHERE a."lordId" = l."id";
