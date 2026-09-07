-- Mevcut lordlara baslangic binalari (docs/12 §3).
--
-- Bina sistemi Y3'te geldi ve mevcut lordlarin bina tablosu bostu. Bos
-- birakmak, oyunu yillardir oynayan bir lordu bir anda arsalarla
-- karsilastirmak demekti. Malikane ve kisla herkese veriliyor; kalanini
-- kendileri dikecek.
--
-- Kademe tavani zaten sinirliyor: kamptaki lord seviye 1'den yukari
-- cikaramiyor, o yuzden bu hediye dengeyi bozmuyor.
UPDATE "Lord"
SET "binalar" = '{"malikane": 1, "kisla": 1}'::jsonb
WHERE "binalar" = '{}'::jsonb OR "binalar" IS NULL;
