-- Diyar adı BENZERSİZ.
--
-- Kayıt ekranına diyar seçimi gelince ortaya çıktı: geliştirme
-- veritabanında 23 tane "168. Diyar", 17 tane "İkinci Diyar" vardı. Ad
-- `world.count()` ile üretiliyordu ve sayım, silinen bir diyardan sonra
-- ya da iki kayıt aynı anda gelince aynı sayıyı yeniden veriyordu.
--
-- Daha önce kimse fark etmemişti çünkü adlar hiçbir yerde yan yana
-- gelmiyordu. Seçim ekranında geliyorlar ve orada ad, diyarın KİMLİĞİ:
-- arkadaşının hangisinde olduğunu ondan anlıyorsun. İki satır aynı adı
-- taşıyorsa özellik çalışmıyor demektir.
--
-- Kısıtın kendisi de işin parçası. `createWorld` artık boş sırayı
-- arıyor, ama iki kayıt aynı anda aynı boşluğu bulabilir; o yarışı
-- ancak veritabanı kapatabilir.

-- Önce mevcut çakışmalar ayrılıyor. En ESKİ olan adını koruyor:
-- oyuncusu olan diyarın adı değişmemeli.
UPDATE "World" w
SET name = w.name || ' · ' || s.sira
FROM (
  SELECT id, row_number() OVER (PARTITION BY name ORDER BY "openedAt", id) AS sira
  FROM "World"
) s
WHERE w.id = s.id AND s.sira > 1;

CREATE UNIQUE INDEX "World_name_key" ON "World"("name");
