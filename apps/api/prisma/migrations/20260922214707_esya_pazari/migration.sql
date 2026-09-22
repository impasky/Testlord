-- AlterTable
ALTER TABLE "Lord" ADD COLUMN     "pazarEmirGunu" TIMESTAMP(3),
ADD COLUMN     "pazarEmirSayisi" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pazarKasasi" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EsyaFiyati" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "upgradeLevel" INTEGER NOT NULL,
    "taban" INTEGER NOT NULL,
    "sonIslemAt" TIMESTAMP(3),
    "sonBaskiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sonCapaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EsyaFiyati_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsyaIlani" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "upgradeLevel" INTEGER NOT NULL,
    "basamak" INTEGER NOT NULL,
    "fiyat" INTEGER NOT NULL,
    "sira" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kuyrukBitis" TIMESTAMP(3),
    "bantDisiBildirildi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EsyaIlani_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnSiparis" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "upgradeLevel" INTEGER NOT NULL,
    "basamak" INTEGER NOT NULL,
    "fiyat" INTEGER NOT NULL,
    "sira" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bantDisiBildirildi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnSiparis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsyaIslemi" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "upgradeLevel" INTEGER NOT NULL,
    "basamak" INTEGER NOT NULL,
    "fiyat" INTEGER NOT NULL,
    "vergi" INTEGER NOT NULL,
    "saticiId" TEXT NOT NULL,
    "aliciId" TEXT NOT NULL,
    "kura" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EsyaIslemi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EsyaFiyati_sonBaskiAt_idx" ON "EsyaFiyati"("sonBaskiAt");

-- CreateIndex
CREATE UNIQUE INDEX "EsyaFiyati_worldId_tier_rarity_upgradeLevel_key" ON "EsyaFiyati"("worldId", "tier", "rarity", "upgradeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "EsyaIlani_itemId_key" ON "EsyaIlani"("itemId");

-- CreateIndex
CREATE INDEX "EsyaIlani_worldId_tier_rarity_upgradeLevel_slot_idx" ON "EsyaIlani"("worldId", "tier", "rarity", "upgradeLevel", "slot");

-- CreateIndex
CREATE INDEX "EsyaIlani_lordId_idx" ON "EsyaIlani"("lordId");

-- CreateIndex
CREATE INDEX "EsyaIlani_kuyrukBitis_idx" ON "EsyaIlani"("kuyrukBitis");

-- CreateIndex
CREATE INDEX "OnSiparis_worldId_tier_rarity_upgradeLevel_slot_idx" ON "OnSiparis"("worldId", "tier", "rarity", "upgradeLevel", "slot");

-- CreateIndex
CREATE INDEX "OnSiparis_lordId_idx" ON "OnSiparis"("lordId");

-- CreateIndex
CREATE INDEX "EsyaIslemi_worldId_tier_rarity_upgradeLevel_createdAt_idx" ON "EsyaIslemi"("worldId", "tier", "rarity", "upgradeLevel", "createdAt");

-- CreateIndex
CREATE INDEX "EsyaIslemi_createdAt_idx" ON "EsyaIslemi"("createdAt");

-- AddForeignKey
ALTER TABLE "EsyaFiyati" ADD CONSTRAINT "EsyaFiyati_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsyaIlani" ADD CONSTRAINT "EsyaIlani_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsyaIlani" ADD CONSTRAINT "EsyaIlani_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnSiparis" ADD CONSTRAINT "OnSiparis_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsyaIslemi" ADD CONSTRAINT "EsyaIslemi_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
