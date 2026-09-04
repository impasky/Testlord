-- Arma: oyuncunun heraldik kimliği (docs/10 §1.1).
--
-- Beş küçük anahtar. Hiçbir sayıya dokunmuyor, saf görünüş. Boş bırakılırsa
-- lord adından türetiliyor — herkesin aynı kırmızı kalkanla başlaması,
-- armanın kimlik olma özelliğini daha ilk günden yok ederdi.
ALTER TABLE "Lord" ADD COLUMN "armaKalkan" TEXT;
ALTER TABLE "Lord" ADD COLUMN "armaDesen" TEXT;
ALTER TABLE "Lord" ADD COLUMN "armaRenk1" TEXT;
ALTER TABLE "Lord" ADD COLUMN "armaRenk2" TEXT;
ALTER TABLE "Lord" ADD COLUMN "armaSembol" TEXT;
