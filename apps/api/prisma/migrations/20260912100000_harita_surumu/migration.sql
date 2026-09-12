-- Dünya, açıldığı harita sürümünü taşısın.
-- Sürümlemeden önce açılmış dünyalar null kalır; seed onları BİR KEZ
-- o günkü sürümle damgalar, çünkü eski davranış zaten hepsini kanonik
-- haritaya eşitliyordu.
ALTER TABLE "World" ADD COLUMN "mapVersion" TEXT;
