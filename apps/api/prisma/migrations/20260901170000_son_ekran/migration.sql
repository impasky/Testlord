-- Oyuncunun oyunu bıraktığı ekran. Tek işi ölçüm (docs/08 İ7):
-- "oyuncular hangi ekranda kapatıyor" sorusu tahminle cevaplanamaz.
ALTER TABLE "Lord" ADD COLUMN "lastScreen" TEXT;
