-- Diyar birleşmesi.
--
-- Kalıcı dünyada zaman tek yönlü işliyor: oyuncu bırakıyor, yerine kimse
-- gelmiyor çünkü diyar "dolu" görünüyor. Sonuç kırk hayalet şehir.
-- Altmış günü dolduran diyar, AÇILIŞ TARİHİ YAKIN bir yaşıtıyla
-- birleşiyor.
--
-- Kayıt olarak duruyor çünkü birleşme önce İLAN EDİLİYOR. İlanı her
-- istekte yeniden hesaplamak, aynı oyuncuya her gün başka bir eş
-- göstermek olurdu.
CREATE TABLE "WorldMerge" (
  "id"          TEXT NOT NULL,
  "hostId"      TEXT NOT NULL,
  "guestId"     TEXT NOT NULL,
  "ilanAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "birlesmeAt"  TIMESTAMP(3) NOT NULL,
  "uygulandiAt" TIMESTAMP(3),
  "ozet"        JSONB,
  CONSTRAINT "WorldMerge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorldMerge_birlesmeAt_uygulandiAt_idx" ON "WorldMerge"("birlesmeAt", "uygulandiAt");
CREATE INDEX "WorldMerge_hostId_idx" ON "WorldMerge"("hostId");
CREATE INDEX "WorldMerge_guestId_idx" ON "WorldMerge"("guestId");

ALTER TABLE "WorldMerge" ADD CONSTRAINT "WorldMerge_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldMerge" ADD CONSTRAINT "WorldMerge_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
