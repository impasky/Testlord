import { describe, expect, it } from 'vitest';
import { WORLD_MAP } from './balance.js';
import {
  hedefDurumu,
  hucredeMi,
  kumeler,
  sinirKenarlari,
  sinirTuru,
  toprakYolu,
  topraklar,
  type HedefGirdisi,
  type Sahiplik,
} from './toprak.js';

const DUNYA_NOKTALARI = WORLD_MAP.regions.map((r) => ({ id: r.id, x: r.x, y: r.y }));

describe('topraklar — Voronoi hücreleri', () => {
  it('dört köşede dört nokta: her biri bir çeyrek', () => {
    const h = topraklar([
      { id: 1, x: 25, y: 25 },
      { id: 2, x: 75, y: 25 },
      { id: 3, x: 25, y: 75 },
      { id: 4, x: 75, y: 75 },
    ]);
    for (const c of h.values()) expect(c.alan).toBeCloseTo(2500, 6);
    expect(h.get(1)!.merkez.x).toBeCloseTo(25, 6);
    expect(h.get(4)!.merkez.y).toBeCloseTo(75, 6);
  });

  it('gerçek dünyada: 121 toprak, her biri kendi bölgesini içeriyor, alanlar dünyayı dolduruyor', () => {
    const h = topraklar(DUNYA_NOKTALARI);
    expect(h.size).toBe(WORLD_MAP.regions.length);
    let toplam = 0;
    for (const p of DUNYA_NOKTALARI) {
      const c = h.get(p.id)!;
      expect(c.kose.length).toBeGreaterThanOrEqual(3);
      expect(hucredeMi(c, p)).toBe(true);
      toplam += c.alan;
    }
    // Boşluk ya da bindirme yok: parçaların toplamı dünyanın kendisi.
    expect(toplam).toBeCloseTo(100 * 100, 4);
  });

  it('ortak kenar iki tarafta da aynı kenar (karşılıklı)', () => {
    const h = topraklar(DUNYA_NOKTALARI);
    for (const c of h.values()) {
      c.komsu.forEach((k, i) => {
        if (k == null) return;
        const p = c.kose[i]!;
        const q = c.kose[(i + 1) % c.kose.length]!;
        const o = h.get(k)!;
        const eslesen = o.komsu.some((kk, j) => {
          if (kk !== c.id) return false;
          const a = o.kose[j]!;
          const b = o.kose[(j + 1) % o.kose.length]!;
          const yakin = (u: typeof p, v: typeof p) => Math.hypot(u.x - v.x, u.y - v.y) < 1e-6;
          return (yakin(a, q) && yakin(b, p)) || (yakin(a, p) && yakin(b, q));
        });
        expect(eslesen, `${c.id}↔${k}`).toBe(true);
      });
    }
  });

  it('sınır kenarları her ortak kenarı BİR kez veriyor', () => {
    const h = topraklar(DUNYA_NOKTALARI);
    const kenarlar = sinirKenarlari(h);
    const anahtarlar = kenarlar.map((k) => `${k.a}-${k.b}`);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
    expect(kenarlar.every((k) => k.a < k.b)).toBe(true);
    // Düzlemsel üçgenlemede kenar sayısı 3n-6'yı geçmez.
    expect(kenarlar.length).toBeLessThanOrEqual(3 * h.size - 6);
  });

  it('SVG yolu kapalı ve her köşeyi taşıyor', () => {
    const h = topraklar(DUNYA_NOKTALARI);
    const c = h.get(1)!;
    const d = toprakYolu(c);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.split('L').length).toBe(c.kose.length);
  });

  it('aynı yerde iki bölge çizimi bozmuyor', () => {
    const h = topraklar([
      { id: 1, x: 50, y: 50 },
      { id: 2, x: 50, y: 50 },
      { id: 3, x: 20, y: 20 },
    ]);
    expect(h.size).toBe(3);
  });
});

describe('sinirTuru', () => {
  const s = (o: Partial<Sahiplik>): Sahiplik => ({
    benim: false,
    lord: null,
    medeniyet: null,
    ...o,
  });

  it('benim toprağımın kenarı her şeyden önce', () => {
    expect(sinirTuru(s({ benim: true, lord: 'ben', medeniyet: 'k' }), s({ medeniyet: 'k' }))).toBe(
      'ben',
    );
  });
  it('iki ayrı lord ya da lord ile sahipsiz: kalın', () => {
    expect(sinirTuru(s({ lord: 'a', medeniyet: 'k' }), s({ lord: 'b', medeniyet: 'k' }))).toBe(
      'lord',
    );
    expect(sinirTuru(s({ lord: 'a', medeniyet: 'k' }), s({ medeniyet: 'k' }))).toBe('lord');
  });
  it('lordsuz iki medeniyet toprağı: orta', () => {
    expect(sinirTuru(s({ medeniyet: 'k' }), s({ medeniyet: 't' }))).toBe('medeniyet');
  });
  it('aynı lordun iki bölgesi: ince', () => {
    expect(sinirTuru(s({ lord: 'a', medeniyet: 'k' }), s({ lord: 'a', medeniyet: 'k' }))).toBe(
      'ic',
    );
    expect(sinirTuru(s({}), s({}))).toBe('ic');
  });
});

describe('kumeler — lord adı toprağın ortasında bir kez', () => {
  it('bitişik aynı sahipler tek küme, ayrı parçalar ayrı küme; etiket kümenin İÇİNDE', () => {
    // 1 2 3 yan yana, 4 uzakta. 1-2 ve 4 aynı lordun.
    const h = topraklar([
      { id: 1, x: 10, y: 50 },
      { id: 2, x: 30, y: 50 },
      { id: 3, x: 50, y: 50 },
      { id: 4, x: 90, y: 50 },
    ]);
    const sahip: Record<number, string | null> = { 1: 'a', 2: 'a', 3: null, 4: 'a' };
    const k = kumeler(h, (id) => sahip[id] ?? null);
    expect(k.length).toBe(2);
    const buyuk = k.find((x) => x.idler.length === 2)!;
    expect(buyuk.idler.sort()).toEqual([1, 2]);
    expect(buyuk.idler.some((id) => hucredeMi(h.get(id)!, buyuk.merkez))).toBe(true);
    expect(k[0]!.alan).toBeGreaterThanOrEqual(k[1]!.alan);
  });
});

describe('hedefDurumu — sunucunun kurallarının haritadaki eşi', () => {
  const r = (o: Partial<HedefGirdisi>): HedefGirdisi => ({
    isMine: false,
    owner: null,
    medeniyet: null,
    cekirdek: false,
    shielded: false,
    paktli: false,
    muttefik: false,
    distance: 3,
    ...o,
  });

  it('kendi bölgem', () => {
    expect(hedefDurumu(r({ isMine: true, owner: { id: 'ben' } }), 'k')).toEqual({ tur: 'benim' });
  });
  it('çekirdek dokunulmaz', () => {
    expect(hedefDurumu(r({ cekirdek: true }), 'k')).toEqual({ tur: 'yasak', sebep: 'cekirdek' });
  });
  it('aynı medeniyetten bir LORDUN toprağı yasak, lordsuz medeniyet toprağı serbest', () => {
    const med = { id: 'k' };
    expect(hedefDurumu(r({ owner: { id: 'o' }, medeniyet: med }), 'k')).toEqual({
      tur: 'yasak',
      sebep: 'yoldas',
    });
    expect(hedefDurumu(r({ medeniyet: med }), 'k')).toEqual({ tur: 'acik', adim: 3 });
  });
  it('ittifak üyesi, pakt ve kalkan', () => {
    expect(hedefDurumu(r({ owner: { id: 'o' }, muttefik: true }), 'k').tur).toBe('yasak');
    expect(hedefDurumu(r({ owner: { id: 'o' }, paktli: true }), 'k')).toEqual({
      tur: 'yasak',
      sebep: 'pakt',
    });
    expect(hedefDurumu(r({ shielded: true }), 'k')).toEqual({ tur: 'yasak', sebep: 'kalkan' });
  });
  it('başka medeniyetin lordu açık hedef, adımı taşıyor', () => {
    expect(
      hedefDurumu(r({ owner: { id: 'o' }, medeniyet: { id: 't' }, distance: 2 }), 'k'),
    ).toEqual({ tur: 'acik', adim: 2 });
  });
});
