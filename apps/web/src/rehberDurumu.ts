/**
 * Rehberin aşamalarını kapatan oyun durumu.
 *
 * `RehberDurumu` üç yerde gerekiyor: kâhya kartı (Lord ekranı), rehber
 * ışığı (App) ve turu bitiren damga (App). Üçünün de aynı hesabı ayrı ayrı
 * yapması, klasik öğretici hatasının kapısını açardı — biri "bitti" derken
 * öbürü "bitmedi" der.
 *
 * Alanların çoğu `/me` içinde ZATEN dönüyor; yeni bir sunucu alanı
 * açılmadı. Yalnız araştırma ayrı bir uçtan geliyor ve o da omurganın
 * kullandığı önbellek anahtarı — ikinci bir istek üretmiyor.
 */
import { useQuery } from '@tanstack/react-query';
import type { RehberDurumu } from '@lordlar/shared';
import { api, type LordState } from './api/client';

/** Lord henüz yüklenmemişken kullanılacak boş durum. */
const BOS: RehberDurumu = {
  orduVar: false,
  bolgeSayisi: 0,
  kusanilanEkipman: 0,
  generalVar: false,
  gelismisBolgeVar: false,
  arastirmaBasladi: false,
};

export function useRehberDurumu(lord: LordState | undefined): RehberDurumu {
  const generaller = useQuery({
    queryKey: ['generals'],
    queryFn: api.generals,
    enabled: Boolean(lord),
  });
  const arastirma = useQuery({
    queryKey: ['arastirma'],
    queryFn: api.arastirma,
    enabled: Boolean(lord),
  });

  if (!lord) return BOS;
  return {
    /*
     * `usedSlots` sahadaki BÜTÜN askeri sayıyor — evdeki, yoldaki,
     * garnizondaki. Evdeki orduya baksaydık ilk seferini yola çıkaran
     * oyuncunun "Ordunu kur" aşaması listede geri açılırdı; asker
     * kurulmuştu, sadece evde değildi.
     */
    orduVar: lord.usedSlots > 0,
    bolgeSayisi: lord.regionCount,
    kusanilanEkipman: lord.equippedItems.length,
    // Sahiplik ölçütü, sahada olma ölçütü değil: dinlenen general de
    // kiralanmış generaldir. Omurga da aynı ölçüte bakıyor.
    generalVar: (generaller.data?.kadro ?? []).some((g) => g.sahipMi),
    // Taht Kalesi hariç en yüksek bölge seviyesi — /me içinde hazır.
    gelismisBolgeVar: lord.basarimOlcutleri.en_yuksek_bolge_seviyesi > 1,
    // "Başlamış" sayılıyorsa: ya biri bitmiş ya biri sürüyor.
    arastirmaBasladi: (arastirma.data?.ilerleme.biten ?? 0) > 0 || arastirma.data?.suren != null,
  };
}
