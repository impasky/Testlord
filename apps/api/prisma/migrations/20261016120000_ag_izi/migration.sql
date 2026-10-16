-- CreateTable
CREATE TABLE "AgIzi" (
    "lordId" TEXT NOT NULL,
    "ozet" TEXT NOT NULL,
    "gun" INTEGER NOT NULL,

    CONSTRAINT "AgIzi_pkey" PRIMARY KEY ("lordId","ozet","gun")
);

-- CreateIndex
CREATE INDEX "AgIzi_ozet_gun_idx" ON "AgIzi"("ozet", "gun");

-- CreateIndex
CREATE INDEX "AgIzi_gun_idx" ON "AgIzi"("gun");

-- AddForeignKey
ALTER TABLE "AgIzi" ADD CONSTRAINT "AgIzi_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

