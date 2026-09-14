-- Moderasyon: şikâyetin insana taşınması.
--
-- Report tablosu vardı ama okuyan yoktu; şikâyetler kara deliğe düşüyordu.
-- Bu göç kuyruğu okunabilir hâle getiriyor ve yöneticiye iki araç veriyor:
-- mesajı kaldır, sohbette sustur. Otomatik ceza yok.

-- Yetki lorda değil KULLANICIYA bağlı: dünya değişince kaybolmaz.
ALTER TABLE "User" ADD COLUMN "yonetici" BOOLEAN NOT NULL DEFAULT false;

-- Susturma. Süresi geçen kayıt temizlenmiyor: geçmiş, kararın dayanağı.
ALTER TABLE "Lord" ADD COLUMN "susturmaBitis" TIMESTAMP(3);
ALTER TABLE "Lord" ADD COLUMN "susturmaSebebi" TEXT;

-- Mesaj yumuşak siliniyor: silinen metin, şikâyeti inceleyenin kanıtı.
ALTER TABLE "AllianceMessage" ADD COLUMN "silindiAn" TIMESTAMP(3);
ALTER TABLE "AllianceMessage" ADD COLUMN "silenId" TEXT;
ALTER TABLE "AllianceMessage" ADD COLUMN "gizli" BOOLEAN NOT NULL DEFAULT false;

-- Şikâyet: tür, hedef mesaj, karar durumu.
ALTER TABLE "Report" ADD COLUMN "tur" TEXT NOT NULL DEFAULT 'lord';
ALTER TABLE "Report" ADD COLUMN "mesajId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Report" ADD COLUMN "durum" TEXT NOT NULL DEFAULT 'acik';
ALTER TABLE "Report" ADD COLUMN "karar" TEXT;
ALTER TABLE "Report" ADD COLUMN "bakanId" TEXT;
ALTER TABLE "Report" ADD COLUMN "bakildiAn" TIMESTAMP(3);

-- Tekillik mesajı da kapsıyor. mesajId null DEĞİL boş dize: Postgres
-- tekilliğinde null'lar birbirinden farklı sayılır ve aynı lordu tekrar
-- tekrar şikâyet etmek kuyruğu şişirirdi.
DROP INDEX IF EXISTS "Report_reporterId_targetId_key";
CREATE UNIQUE INDEX "Report_reporterId_targetId_mesajId_key"
  ON "Report"("reporterId", "targetId", "mesajId");
CREATE INDEX "Report_durum_createdAt_idx" ON "Report"("durum", "createdAt");
CREATE INDEX "Report_mesajId_idx" ON "Report"("mesajId");

-- Verilen kararın kalıcı kaydı. Şikâyetten ayrı: şikâyet "biri rahatsız
-- oldu", kayıt "bir yönetici şunu yaptı". Yönetici de denetlenebilir olmalı.
CREATE TABLE "ModerasyonKaydi" (
  "id" TEXT NOT NULL,
  "lordId" TEXT NOT NULL,
  "yoneticiId" TEXT NOT NULL,
  "raporId" TEXT,
  "karar" TEXT NOT NULL,
  "ozet" TEXT NOT NULL,
  "saat" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerasyonKaydi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModerasyonKaydi_lordId_createdAt_idx" ON "ModerasyonKaydi"("lordId", "createdAt");
CREATE INDEX "ModerasyonKaydi_createdAt_idx" ON "ModerasyonKaydi"("createdAt");
ALTER TABLE "ModerasyonKaydi" ADD CONSTRAINT "ModerasyonKaydi_lordId_fkey"
  FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
