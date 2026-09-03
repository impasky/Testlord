-- Keşif raporu: bir lordun bir bölge hakkındaki istihbaratı.
--
-- Rapor bir fotoğraf: süresi geçince satır silinmiyor, "eski istihbarat"
-- olarak gösteriliyor. Lord başına bölge başına tek satır — yeni keşif
-- eskisini ezer, geçmiş tutmanın oyun içinde karşılığı yok.
CREATE TABLE "Scout" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "regionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "Scout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Scout_lordId_regionId_key" ON "Scout"("lordId", "regionId");
CREATE INDEX "Scout_lordId_expiresAt_idx" ON "Scout"("lordId", "expiresAt");

ALTER TABLE "Scout" ADD CONSTRAINT "Scout_lordId_fkey"
  FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scout" ADD CONSTRAINT "Scout_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
