-- Bildirim tercihleri (docs/12 §17): kapatılan konular ve sessiz saatler.
-- Null = hepsi açık; var olan oyuncular için hiçbir şey değişmiyor.
ALTER TABLE "Lord" ADD COLUMN "bildirimTercihi" JSONB;
