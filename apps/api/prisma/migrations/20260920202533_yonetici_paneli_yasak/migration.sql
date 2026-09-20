-- AlterTable
ALTER TABLE "User" ADD COLUMN     "yasakBitis" TIMESTAMP(3),
ADD COLUMN     "yasakSebebi" TEXT,
ADD COLUMN     "yasakli" BOOLEAN NOT NULL DEFAULT false;
