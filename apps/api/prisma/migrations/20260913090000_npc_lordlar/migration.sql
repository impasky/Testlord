-- Rakip lordlar hareket etsin: worker'ın sıra vereceği lordları işaretle.
--
-- Ada bakarak ayırmak kırılgandı (demo lord adları bir listede yazılıydı
-- ve bir oyuncu aynı adı alabilirdi). Bayrak açık ve sorgulanabilir.
ALTER TABLE "Lord" ADD COLUMN "isNpc" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lord" ADD COLUMN "npcSonTur" TIMESTAMP(3);

-- Bugüne kadar açılmış demo lordlar: e-postaları @lordlar.local ile
-- bitiyor ve gerçek bir oyuncunun adresi oraya düşemez.
UPDATE "Lord" SET "isNpc" = true
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" LIKE '%@lordlar.local');

-- Sıra sorgusu bunun üzerinden dönüyor; dünya başına birkaç lord için bile
-- tam tarama yapmaya değmez.
CREATE INDEX "Lord_isNpc_npcSonTur_idx" ON "Lord" ("isNpc", "npcSonTur");
