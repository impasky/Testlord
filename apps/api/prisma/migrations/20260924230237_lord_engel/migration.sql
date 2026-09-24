-- CreateTable
CREATE TABLE "LordEngel" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "engellenenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LordEngel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LordEngel_lordId_engellenenId_key" ON "LordEngel"("lordId", "engellenenId");

-- AddForeignKey
ALTER TABLE "LordEngel" ADD CONSTRAINT "LordEngel_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LordEngel" ADD CONSTRAINT "LordEngel_engellenenId_fkey" FOREIGN KEY ("engellenenId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
