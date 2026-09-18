-- CreateIndex
CREATE INDEX "Lord_worldId_medeniyetId_idx" ON "Lord"("worldId", "medeniyetId");

-- CreateIndex
CREATE INDEX "Region_worldId_ownerMedeniyetId_idx" ON "Region"("worldId", "ownerMedeniyetId");
