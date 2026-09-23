import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { etkiRozeti } from '../src/components/arastirmaRozeti';
import { IKONLAR } from '../src/components/ikon-verisi';

describe('araştırma etki rozeti', () => {
  it('depo çarpanı yüzde olarak', () => {
    expect(etkiRozeti({ depo_carpani: 0.5 })).toEqual({
      ikon: 'depo',
      yon: null,
      deger: 50,
      tur: 'yuzde',
      isaret: 1,
      fazla: 0,
    });
  });

  it('birim etkisi birim simgesi ve yön taşıyor', () => {
    const r = etkiRozeti({ suvari_saldiri: 0.1, suvari_savunma: 0.06 });
    expect(r).toMatchObject({ ikon: 'suvari', yon: 'saldiri', deger: 10, fazla: 1 });
  });

  it('adet etkileri yüzde değil', () => {
    expect(etkiRozeti({ komuta_kapasitesi: 40 })).toMatchObject({ tur: 'sayi', deger: 40 });
    expect(etkiRozeti({ arastirma_yuvasi: 1 })).toMatchObject({ ikon: 'kitap', deger: 1 });
  });

  it('maliyet azaltan etki eksi işaretli', () => {
    expect(etkiRozeti({ casus_maliyeti: -0.3 })).toMatchObject({ isaret: -1, deger: 30 });
    // Bakım indirimi veride artı yazılıyor ama bakımı AZALTIYOR.
    expect(etkiRozeti({ bakim_indirimi: 0.15 })).toMatchObject({ ikon: 'erzak', isaret: -1 });
  });

  it('taktik ustalıkları tek simgede', () => {
    expect(etkiRozeti({ taktik_hilal: 0.3 })).toMatchObject({ ikon: 'taktik', deger: 30 });
  });

  it('tanınmayan etki rozetsiz', () => {
    expect(etkiRozeti({ bilinmeyen: 1 })).toBeNull();
    expect(etkiRozeti({})).toBeNull();
  });

  /*
   * Asıl güvence: ağaçtaki HER etki anahtarının bir rozeti var ve her
   * rozetin simgesi gerçekten çizilebiliyor. Veriye yeni bir etki
   * eklenince burası kalıyor; kutu sessizce rozetsiz kalmıyor.
   */
  it('ağaçtaki her düğümün rozeti var ve simgesi tanımlı', () => {
    const agac = JSON.parse(
      readFileSync(new URL('../../../data/arastirma.json', import.meta.url), 'utf8'),
    ) as { dallar: { dugumler: { key: string; etki: Record<string, number> }[] }[] };
    const rozetsiz: string[] = [];
    for (const d of agac.dallar.flatMap((x) => x.dugumler)) {
      const r = etkiRozeti(d.etki);
      if (!r || !(r.ikon in IKONLAR)) rozetsiz.push(d.key);
    }
    expect(rozetsiz).toEqual([]);
  });
});
