-- Günlük görev ödülünün "bugün alındı" işareti.
--
-- Türetilemiyor: ödülün verildiği an hiçbir mevcut kayda iz bırakmıyor
-- (kaynak artışı Lord.altin'e karışıyor). Giriş serisiyle aynı desen:
-- tek bir gün damgası, gün numarası UTC'ye göre karşılaştırılıyor.
ALTER TABLE "Lord" ADD COLUMN "gunlukOdulGunu" TIMESTAMP(3);
