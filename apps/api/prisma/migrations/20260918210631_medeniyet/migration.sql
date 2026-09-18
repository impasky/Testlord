-- AlterTable
ALTER TABLE "Lord" ADD COLUMN     "faydaPuani" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "medeniyetId" TEXT;

-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "ownerMedeniyetId" TEXT;

-- CreateTable
CREATE TABLE "Medeniyet" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medeniyet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CekirdekYatirim" (
    "id" TEXT NOT NULL,
    "medeniyetId" TEXT NOT NULL,
    "mapId" INTEGER NOT NULL,
    "seviye" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CekirdekYatirim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medeniyet_worldId_key_key" ON "Medeniyet"("worldId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CekirdekYatirim_medeniyetId_mapId_key" ON "CekirdekYatirim"("medeniyetId", "mapId");

-- AddForeignKey
ALTER TABLE "Lord" ADD CONSTRAINT "Lord_medeniyetId_fkey" FOREIGN KEY ("medeniyetId") REFERENCES "Medeniyet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_ownerMedeniyetId_fkey" FOREIGN KEY ("ownerMedeniyetId") REFERENCES "Medeniyet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medeniyet" ADD CONSTRAINT "Medeniyet_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CekirdekYatirim" ADD CONSTRAINT "CekirdekYatirim_medeniyetId_fkey" FOREIGN KEY ("medeniyetId") REFERENCES "Medeniyet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
