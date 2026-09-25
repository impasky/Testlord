-- AlterTable
ALTER TABLE "Lord" ADD COLUMN     "profilResmi" TEXT;

-- CreateTable
CREATE TABLE "GenelMesaj" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "silindiAn" TIMESTAMP(3),
    "silenId" TEXT,
    "gizli" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GenelMesaj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilResmi" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "veri" BYTEA,
    "durum" TEXT NOT NULL,
    "tahmin" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bakanId" TEXT,
    "bakildiAn" TIMESTAMP(3),

    CONSTRAINT "ProfilResmi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenelMesaj_createdAt_idx" ON "GenelMesaj"("createdAt");

-- CreateIndex
CREATE INDEX "GenelMesaj_lordId_createdAt_idx" ON "GenelMesaj"("lordId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfilResmi_lordId_createdAt_idx" ON "ProfilResmi"("lordId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfilResmi_durum_createdAt_idx" ON "ProfilResmi"("durum", "createdAt");

-- AddForeignKey
ALTER TABLE "GenelMesaj" ADD CONSTRAINT "GenelMesaj_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilResmi" ADD CONSTRAINT "ProfilResmi_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
