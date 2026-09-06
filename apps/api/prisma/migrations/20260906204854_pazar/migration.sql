-- AlterTable
ALTER TABLE "Lord" ADD COLUMN     "pazarGunu" TIMESTAMP(3),
ADD COLUMN     "pazarHacmi" INTEGER NOT NULL DEFAULT 0;
