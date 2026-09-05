-- Rehberin kapatıldığı an. Tarayıcı deposundan sunucuya taşındı:
-- depo tarayıcı başına tutulduğu için aynı tarayıcıda açılan her yeni
-- hesap rehbersiz açılıyordu.
ALTER TABLE "Lord" ADD COLUMN "rehberBittiAt" TIMESTAMP(3);
