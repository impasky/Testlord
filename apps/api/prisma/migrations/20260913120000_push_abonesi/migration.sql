-- Push bildirimi abonelikleri (M14 geri dönüş kancası).
--
-- Cihaz başına bir satır, oyuncu başına değil: aynı lord telefondan ve
-- tabletten girebilir ve ikisine de haber gitmeli. `endpoint` tarayıcının
-- verdiği adres ve benzersiz — aynı cihaz izni yeniden verdiğinde aynı
-- adres geliyor, yani tekrar abonelik satır çoğaltmıyor.
CREATE TABLE "PushAbonesi" (
  "id"          TEXT NOT NULL,
  "lordId"      TEXT NOT NULL,
  "endpoint"    TEXT NOT NULL,
  "p256dh"      TEXT NOT NULL,
  "auth"        TEXT NOT NULL,
  "cihaz"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sonGonderim" TIMESTAMP(3),
  CONSTRAINT "PushAbonesi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushAbonesi_endpoint_key" ON "PushAbonesi"("endpoint");
CREATE INDEX "PushAbonesi_lordId_idx" ON "PushAbonesi"("lordId");

-- Lord silinince aboneliği de gitsin: ölü adrese bildirim göndermenin
-- anlamı yok ve push servisleri bunu kötüye kullanım sayıyor.
ALTER TABLE "PushAbonesi" ADD CONSTRAINT "PushAbonesi_lordId_fkey"
  FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
