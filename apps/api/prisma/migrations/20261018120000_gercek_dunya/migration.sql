-- GERÇEK DÜNYA (docs/27): medeniyet katmanı kalkıyor, lord ülkesini seçiyor,
-- dünyalar harita kuşağını taşıyor (kuşağı geride kalan açılışta göçüyor).

-- DropForeignKey
ALTER TABLE "Lord" DROP CONSTRAINT "Lord_medeniyetId_fkey";

-- DropForeignKey
ALTER TABLE "Region" DROP CONSTRAINT "Region_ownerMedeniyetId_fkey";

-- DropForeignKey
ALTER TABLE "Medeniyet" DROP CONSTRAINT "Medeniyet_worldId_fkey";

-- DropForeignKey
ALTER TABLE "CekirdekYatirim" DROP CONSTRAINT "CekirdekYatirim_medeniyetId_fkey";

-- DropIndex
DROP INDEX "Lord_worldId_medeniyetId_idx";

-- DropIndex
DROP INDEX "Region_worldId_ownerMedeniyetId_idx";

-- AlterTable
ALTER TABLE "World" ADD COLUMN     "haritaKusagi" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Lord" DROP COLUMN "faydaPuani",
DROP COLUMN "medeniyetDegisimAt",
DROP COLUMN "medeniyetId",
ADD COLUMN     "ulke" TEXT;

-- AlterTable
ALTER TABLE "Region" DROP COLUMN "ownerMedeniyetId";

-- DropTable
DROP TABLE "Medeniyet";

-- DropTable
DROP TABLE "CekirdekYatirim";

-- CreateIndex
CREATE INDEX "Lord_worldId_ulke_idx" ON "Lord"("worldId", "ulke");

