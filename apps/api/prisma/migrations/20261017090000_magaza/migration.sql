-- AlterTable
ALTER TABLE "Lord" ADD COLUMN     "reklamDakikasi" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SatinAlma" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "jeton" TEXT NOT NULL,
    "siparisNo" TEXT,
    "urun" TEXT NOT NULL,
    "elmas" INTEGER NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'verildi',
    "test" BOOLEAN NOT NULL DEFAULT false,
    "tuketildi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iadeAt" TIMESTAMP(3),

    CONSTRAINT "SatinAlma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReklamOturumu" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "hedefKuyrukId" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bekliyor',
    "islemNo" TEXT,
    "kuyrukSaniye" INTEGER NOT NULL DEFAULT 0,
    "bankaDakika" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odulAt" TIMESTAMP(3),

    CONSTRAINT "ReklamOturumu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SatinAlma_jeton_key" ON "SatinAlma"("jeton");

-- CreateIndex
CREATE INDEX "SatinAlma_lordId_createdAt_idx" ON "SatinAlma"("lordId", "createdAt");

-- CreateIndex
CREATE INDEX "SatinAlma_tuketildi_createdAt_idx" ON "SatinAlma"("tuketildi", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReklamOturumu_islemNo_key" ON "ReklamOturumu"("islemNo");

-- CreateIndex
CREATE INDEX "ReklamOturumu_lordId_createdAt_idx" ON "ReklamOturumu"("lordId", "createdAt");

-- AddForeignKey
ALTER TABLE "SatinAlma" ADD CONSTRAINT "SatinAlma_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReklamOturumu" ADD CONSTRAINT "ReklamOturumu_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

