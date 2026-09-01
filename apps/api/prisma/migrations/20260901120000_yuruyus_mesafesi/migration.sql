-- Yürüyüşün hex mesafesini kaydet.
-- Dönüş süresi eskiden gidiş süresinden geri türetiliyordu; ilk saldırının
-- süresi kısaltılabilir olunca o türetme yanlış mesafe veriyor.
ALTER TABLE "March" ADD COLUMN "distance" INTEGER NOT NULL DEFAULT 1;
