-- İttifakın ortak hedefi: "hep birlikte şuraya".
--
-- İttifak başına tek hedef, bilerek. Beş işaretli hedef koordinasyon
-- değil gürültüdür; tek hedef bir karar demektir ve karar tartışılır.
ALTER TABLE "Alliance" ADD COLUMN "targetRegionId" INTEGER;
ALTER TABLE "Alliance" ADD COLUMN "targetSetAt" TIMESTAMP(3);
ALTER TABLE "Alliance" ADD COLUMN "targetNote" TEXT;

ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_targetRegionId_fkey"
  FOREIGN KEY ("targetRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
