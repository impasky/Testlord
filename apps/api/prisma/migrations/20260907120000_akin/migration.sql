-- Akin: NPC haritalarindaki gruplara yapilan seferler (docs/12 §6).
--
-- March'tan ayri bir tablo: akinin hedefi bir Region degil ve
-- March.toRegionId zorunlu. Sahte bir bolge kimligi uydurmak, harita
-- sorgularinin bir gun o satirlari gercek bolge sanmasi demekti.
CREATE TABLE "Akin" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "haritaKey" TEXT NOT NULL,
    "grupNo" INTEGER NOT NULL,
    "army" JSONB NOT NULL,
    "generalIds" JSONB NOT NULL,
    "duzen" JSONB,
    "kazanildi" BOOLEAN NOT NULL DEFAULT false,
    "yarali" JSONB,
    "odul" JSONB,
    "dusenItemId" TEXT,
    "seed" TEXT NOT NULL,
    "log" JSONB,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveAt" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Akin_pkey" PRIMARY KEY ("id")
);

-- Worker bu indeksle "varis saati gelmis, cozulmemis" satirlari buluyor.
CREATE INDEX "Akin_resolved_arriveAt_idx" ON "Akin"("resolved", "arriveAt");
CREATE INDEX "Akin_lordId_resolved_idx" ON "Akin"("lordId", "resolved");
-- Yenilenme AYRI BIR SUTUN DEGIL, bu indeksten turuyor: "bu lord bu
-- grubu en son ne zaman dusurdu". Ayri sutun tutmak, onu guncelleyecek
-- bir zamanlayici gerektirirdi ve zamanlayici uyudugunda harita yanlis
-- gorunurdu.
CREATE INDEX "Akin_lordId_haritaKey_grupNo_kazanildi_idx" ON "Akin"("lordId", "haritaKey", "grupNo", "kazanildi");

ALTER TABLE "Akin" ADD CONSTRAINT "Akin_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
