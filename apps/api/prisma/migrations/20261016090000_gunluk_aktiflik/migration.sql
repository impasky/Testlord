-- CreateTable
CREATE TABLE "GunlukAktiflik" (
    "gun" INTEGER NOT NULL,
    "lordId" TEXT NOT NULL,

    CONSTRAINT "GunlukAktiflik_pkey" PRIMARY KEY ("gun","lordId")
);

-- CreateIndex
CREATE INDEX "GunlukAktiflik_lordId_idx" ON "GunlukAktiflik"("lordId");

-- AddForeignKey
ALTER TABLE "GunlukAktiflik" ADD CONSTRAINT "GunlukAktiflik_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Geçmişten bilinen iki gün: kayıt günü ve son görülme günü. Aradaki
-- günler bilinmiyor; pano bu yüzden tabloyu başlatan günden önceki
-- kohortlarda tutundurmayı eksik sayabilir (docs/05).
INSERT INTO "GunlukAktiflik" ("gun", "lordId")
SELECT floor(extract(epoch FROM "createdAt") / 86400)::int, "id" FROM "Lord" WHERE NOT "isNpc"
ON CONFLICT DO NOTHING;
INSERT INTO "GunlukAktiflik" ("gun", "lordId")
SELECT floor(extract(epoch FROM "lastSeenAt") / 86400)::int, "id" FROM "Lord" WHERE NOT "isNpc"
ON CONFLICT DO NOTHING;
