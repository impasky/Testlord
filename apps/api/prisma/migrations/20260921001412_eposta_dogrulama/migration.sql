-- AlterTable
ALTER TABLE "User" ADD COLUMN     "epostaDogrulandi" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EpostaDogrulama" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpostaDogrulama_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EpostaDogrulama_tokenHash_key" ON "EpostaDogrulama"("tokenHash");

-- CreateIndex
CREATE INDEX "EpostaDogrulama_userId_createdAt_idx" ON "EpostaDogrulama"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "EpostaDogrulama" ADD CONSTRAINT "EpostaDogrulama_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
