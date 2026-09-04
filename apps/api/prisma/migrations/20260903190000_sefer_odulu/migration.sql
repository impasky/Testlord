-- Haftalık sefer ödülünün "bu hafta alındı" işareti.
--
-- Günlük ödülle aynı desen ve aynı sebep: ödülün verilmesi mevcut hiçbir
-- kayda iz bırakmıyor, kaynak artışı altına karışıyor. Hangi seferin açık
-- olduğu ise SAKLANMIYOR — hafta numarasından türetiliyor.
ALTER TABLE "Lord" ADD COLUMN "seferOduluHaftasi" TIMESTAMP(3);
