-- Giriş serisi (docs/09 K4).
--
-- Günlük görev ilerlemesi TÜRETİLİYOR (Battle ve Queue kayıtlarından), o
-- yüzden onlar için kolon yok. Seri türetilemiyor: tek bir lastSeenAt
-- damgası "kaç gün üst üste" sorusunu cevaplayamaz çünkü o bir geçmiş.
--
-- Var olan lordlar 0/NULL ile başlıyor; ilk girişlerinde seri 1 oluyor.
-- Geriye dönük bir seri uydurmuyoruz.
ALTER TABLE "Lord" ADD COLUMN "girisSerisi" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lord" ADD COLUMN "girisSerisiGunu" TIMESTAMP(3);
