-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "playerCap" INTEGER NOT NULL DEFAULT 120,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "guc" INTEGER NOT NULL DEFAULT 5,
    "dayaniklilik" INTEGER NOT NULL DEFAULT 5,
    "liderlik" INTEGER NOT NULL DEFAULT 5,
    "kurnazlik" INTEGER NOT NULL DEFAULT 5,
    "statPoints" INTEGER NOT NULL DEFAULT 0,
    "altin" INTEGER NOT NULL DEFAULT 0,
    "demir" INTEGER NOT NULL DEFAULT 0,
    "erzak" INTEGER NOT NULL DEFAULT 0,
    "fame" INTEGER NOT NULL DEFAULT 0,
    "fortressFameAccrued" INTEGER NOT NULL DEFAULT 0,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "pvpWins" INTEGER NOT NULL DEFAULT 0,
    "pvpLosses" INTEGER NOT NULL DEFAULT 0,
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protectionUntil" TIMESTAMP(3),
    "woundedUntil" TIMESTAMP(3),
    "dailyAttacks" INTEGER NOT NULL DEFAULT 0,
    "dailyResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "upgradeLevel" INTEGER NOT NULL DEFAULT 0,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArmyUnit" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationId" TEXT,

    CONSTRAINT "ArmyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearLine" (
    "lordId" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GearLine_pkey" PRIMARY KEY ("lordId","line")
);

-- CreateTable
CREATE TABLE "LordGeneral" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "generalKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "slotIndex" INTEGER,
    "restUntil" TIMESTAMP(3),

    CONSTRAINT "LordGeneral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" INTEGER NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "ring" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "ownerLordId" TEXT,
    "npcGarrison" JSONB NOT NULL,
    "incomeMult" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "storeAltin" INTEGER NOT NULL DEFAULT 0,
    "storeDemir" INTEGER NOT NULL DEFAULT 0,
    "storeErzak" INTEGER NOT NULL DEFAULT 0,
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shieldUntil" TIMESTAMP(3),

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "March" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "fromRegionId" INTEGER,
    "toRegionId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "army" JSONB NOT NULL,
    "generalIds" JSONB NOT NULL,
    "loot" JSONB,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveAt" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "March_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "regionId" INTEGER NOT NULL,
    "attackerLordId" TEXT NOT NULL,
    "defenderLordId" TEXT,
    "seed" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "captured" BOOLEAN NOT NULL DEFAULT false,
    "log" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishAt" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "lordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Lord_worldId_fame_idx" ON "Lord"("worldId", "fame");

-- CreateIndex
CREATE INDEX "Lord_worldId_elo_idx" ON "Lord"("worldId", "elo");

-- CreateIndex
CREATE UNIQUE INDEX "Lord_userId_worldId_key" ON "Lord"("userId", "worldId");

-- CreateIndex
CREATE INDEX "Item_lordId_equipped_idx" ON "Item"("lordId", "equipped");

-- CreateIndex
CREATE INDEX "ArmyUnit_locationType_locationId_idx" ON "ArmyUnit"("locationType", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ArmyUnit_lordId_unitType_locationType_locationId_key" ON "ArmyUnit"("lordId", "unitType", "locationType", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "LordGeneral_lordId_generalKey_key" ON "LordGeneral"("lordId", "generalKey");

-- CreateIndex
CREATE INDEX "Region_worldId_ownerLordId_idx" ON "Region"("worldId", "ownerLordId");

-- CreateIndex
CREATE UNIQUE INDEX "Region_worldId_q_r_key" ON "Region"("worldId", "q", "r");

-- CreateIndex
CREATE INDEX "March_resolved_arriveAt_idx" ON "March"("resolved", "arriveAt");

-- CreateIndex
CREATE INDEX "March_lordId_resolved_idx" ON "March"("lordId", "resolved");

-- CreateIndex
CREATE INDEX "Battle_attackerLordId_createdAt_idx" ON "Battle"("attackerLordId", "createdAt");

-- CreateIndex
CREATE INDEX "Battle_defenderLordId_createdAt_idx" ON "Battle"("defenderLordId", "createdAt");

-- CreateIndex
CREATE INDEX "Queue_resolved_finishAt_idx" ON "Queue"("resolved", "finishAt");

-- CreateIndex
CREATE INDEX "Queue_lordId_resolved_idx" ON "Queue"("lordId", "resolved");

-- CreateIndex
CREATE INDEX "Event_lordId_createdAt_idx" ON "Event"("lordId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lord" ADD CONSTRAINT "Lord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lord" ADD CONSTRAINT "Lord_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArmyUnit" ADD CONSTRAINT "ArmyUnit_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearLine" ADD CONSTRAINT "GearLine_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LordGeneral" ADD CONSTRAINT "LordGeneral_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_ownerLordId_fkey" FOREIGN KEY ("ownerLordId") REFERENCES "Lord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "March" ADD CONSTRAINT "March_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_attackerLordId_fkey" FOREIGN KEY ("attackerLordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_defenderLordId_fkey" FOREIGN KEY ("defenderLordId") REFERENCES "Lord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_lordId_fkey" FOREIGN KEY ("lordId") REFERENCES "Lord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
