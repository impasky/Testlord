-- Ogretici: oyuncunun tam ekran tanitimi bitirdigi (ya da gectigi) an.
-- NULL = henuz gormedi.
ALTER TABLE "Lord" ADD COLUMN "ogreticiBittiAt" TIMESTAMP(3);

-- Oyuna zaten baslamis lordlara ogretici GOSTERILMIYOR. Tam ekran bir
-- tanitim, bildigi bir oyunu oynayan birinin yoluna dikilmek demek:
-- xp kazanmis, bolge almis ya da asker egitmis herkes "gormus" sayiliyor.
-- Yepyeni lordlar (hicbir izi olmayanlar) NULL kaliyor ve ogreticiyi
-- ilk girislerinde goruyorlar.
UPDATE "Lord" l SET "ogreticiBittiAt" = now()
WHERE l.xp > 0
   OR EXISTS (SELECT 1 FROM "Region" r WHERE r."ownerLordId" = l.id)
   OR EXISTS (SELECT 1 FROM "ArmyUnit" u WHERE u."lordId" = l.id);
