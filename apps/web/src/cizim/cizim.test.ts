import { describe, expect, it } from 'vitest';
import { AKIN_HARITALARI, B, HAZIR_PORTRELER } from '@lordlar/shared';
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import { diyarModeli } from './diyarlar';
import { dunyaUcgenleri } from './dunya';
import { ZEMIN_ADLARI, zeminModeli } from './zeminler';
import { GENERAL_ADLARI, PORTRE_ADLARI, generalModeli, lordModeli, portreModeli } from './kisiler';
import {
  BIRLIK_ADLARI,
  DUSMAN_ADLARI,
  EKIPMAN_ADLARI,
  birlikModeli,
  dusmanModeli,
  ekipmanModeli,
} from './birlikler';
import { BOLGE_SAHNELERI, bolgeAdiCoz, bolgeModeli } from './bolgeler';
import { rastgele } from './rastgele';
import { gecis } from './arazi';
import { insan, type Insan } from './figur';
import { P, isikla } from './renk';
import { BAYRAK_KARE, bayrakGruplari, bayrakKareleri } from './bayrakAni';
import { KOSE } from './glAg';
import { BAYRAK_FAZ, bayrak, bezAni, duman } from './parca';
import {
  ciz,
  dilim,
  dondur,
  kutu,
  levha,
  olcekle,
  oneAl,
  sabitKutu,
  silindir,
  tasi,
  yansitici,
  zemineGeri,
  type V3,
} from './uc';
import { YERLESIM_KADEMELERI, yerlesimModeli, yerlesimNoktasi, yerlesimYuzdesi } from './yerlesim';

const sayilar = (n: string) => n.split(/[ ,]/).map(Number);

describe('3B motor', () => {
  it('kamera bir küpün tam üç yüzünü görüyor (üst, +x, +y)', () => {
    const c = ciz(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    expect(c.cokgenler).toHaveLength(3);
  });

  it('ışık: üst yüz en açık, +y yüzü en koyu', () => {
    const c = ciz(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    const parlak = c.cokgenler.map((p) => parseInt(p.renk.slice(1, 3), 16)).sort((a, b) => a - b);
    expect(new Set(parlak).size).toBe(3);
  });

  it('dilim: 5 ve üstü yuvarlak sayılıp artıyor, 4 ve altı bilerek köşeli kalıyor', () => {
    expect(dilim(4)).toBe(4);
    expect(dilim(3)).toBe(3);
    expect(dilim(5)).toBeGreaterThan(5);
    expect(dilim(8)).toBe(12);
    // Silindirin yan dilimleri yumuşak kenarlı, kapakları değil.
    const s = silindir(0, 0, 0, 1, 2, '#808080', 8);
    expect(s).toHaveLength(2 + 12);
    expect(s.filter((y) => y.yumusak)).toHaveLength(12);
  });

  it('gölgeleme normali ışığı değiştiriyor, görünürlüğü değil', () => {
    const duz = levha(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
      '#808080',
    );
    const egik = duz.map((y) => ({ ...y, gn: [0, 1, 0.2] as [number, number, number] }));
    const a = ciz(duz).cokgenler;
    const b = ciz(egik).cokgenler;
    expect(b).toHaveLength(a.length);
    expect(b[0]!.renk).not.toBe(a[0]!.renk);
  });

  it('geçiş: eşiğin altında 0, üstünde 1, arada sürekli', () => {
    expect(gecis(0, 0.3)).toBe(0);
    expect(gecis(1, 0.3)).toBe(1);
    expect(gecis(0.3, 0.3)).toBeCloseTo(0.5);
    expect(gecis(0.31, 0.3)).toBeGreaterThan(gecis(0.29, 0.3));
  });

  it('zemine geri yansıtma, yansıtmanın tersi', () => {
    const e = yansitici();
    const g = zemineGeri();
    for (const [x, y] of [
      [3, 4],
      [-7, 2],
      [0, 0],
    ] as [number, number][]) {
      const [sx, sy] = e([x, y, 0]);
      const [gx, gy] = g(sx, sy);
      expect(gx).toBeCloseTo(x, 6);
      expect(gy).toBeCloseTo(y, 6);
    }
  });

  it('sabit kutu hacmin bütün köşelerini içeriyor', () => {
    const [x, y, w, h] = sabitKutu([0, 0, 0], [10, 10, 10]);
    const e = yansitici();
    for (const q of [
      [0, 0, 0],
      [10, 10, 10],
      [10, 0, 10],
      [0, 10, 0],
    ] as [number, number, number][]) {
      const [px, py] = e(q);
      expect(px).toBeGreaterThanOrEqual(x);
      expect(px).toBeLessThanOrEqual(x + w);
      expect(py).toBeGreaterThanOrEqual(y);
      expect(py).toBeLessThanOrEqual(y + h);
    }
  });

  it('öne alma (onde) yalnız ressam sırasını değiştiriyor: aynı derinlikte sonra çiziliyor', () => {
    const kare = (renk: string) =>
      levha(
        [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        renk,
      );
    const [alt, ust] = [kare('#ff0000'), kare('#00ff00')];
    // Eklenme sırası tersine olsa da öne alınan sonra (üstte) çiziliyor.
    const c = ciz([...oneAl(ust, 0.3), ...alt]);
    expect(c.cokgenler).toHaveLength(2);
    // Işıklanmış renk: kırmızı kanal ilkinde dolu, ikincide boş.
    expect(parseInt(c.cokgenler[0]!.renk.slice(1, 3), 16)).toBeGreaterThan(0);
    expect(parseInt(c.cokgenler[1]!.renk.slice(1, 3), 16)).toBe(0);
  });

  it('duman yüzleri kaynağını taşıyor; kaynak taşıma, ölçek ve dönmeyle birlikte gidiyor', () => {
    const d = duman(2, 3, 5, rastgele('duman'), 2);
    expect(d.length).toBeGreaterThan(0);
    expect(d.every((y) => y.duman?.join() === '2,3,5')).toBe(true);
    const yakin = (a: V3 | undefined, b: V3) => a!.map((x, i) => +(x - b[i]!).toFixed(6));
    expect(yakin(tasi(d, [1, 1, 1])[0]!.duman, [3, 4, 6])).toEqual([0, 0, 0]);
    expect(yakin(olcekle(d, 2, [1, 1, 1])[0]!.duman, [3, 5, 9])).toEqual([0, 0, 0]);
    expect(yakin(dondur(d, 'z', Math.PI / 2)[0]!.duman, [-3, 2, 5])).toEqual([0, 0, 0]);
    // Duman olmayan yüz duman almıyor.
    expect(tasi(kutu(0, 0, 0, 1, 1, 1, '#808080'), [1, 0, 0])[0]!.duman).toBeUndefined();
  });

  it('bayrak kumaşı: durağan hâl dalganın bir anı; direk kenarı yerinde, uç dalgalanıyor', () => {
    const bez = bayrak(0, 0, 0, 6, '#aa0000').filter((y) => y.bez);
    expect(bez.length).toBeGreaterThanOrEqual(4);
    const yakin = (a: V3[], b: V3[]) =>
      a.every((q, i) => q.every((v, j) => Math.abs(v - b[i]![j]!) < 1e-9));
    for (const y of bez) expect(yakin(bezAni(y, BAYRAK_FAZ).p, y.p)).toBe(true);
    const ilk = bez.find((y) => y.bez!.u.includes(0))!;
    const son = bez.find((y) => y.bez!.u.includes(1))!;
    const direk = ilk.bez!.u.indexOf(0);
    const uc = son.bez!.u.indexOf(1);
    expect(bezAni(ilk, 0.3).p[direk]).toEqual(bezAni(ilk, 2.5).p[direk]);
    expect(Math.abs(bezAni(son, 0.3).p[uc]![0] - bezAni(son, 2.5).p[uc]![0])).toBeGreaterThan(0.1);
    // Normal birim ve kumaşa dik (dikey kumaşta yatay).
    for (const n of bezAni(son, 1).vn!) {
      expect(Math.hypot(...n)).toBeCloseTo(1);
      expect(Math.abs(n[2])).toBeLessThan(1e-9);
    }
  });

  it('bayrak dönüşümlerle taşınıyor; aynalamada dalga da aynalanıyor', () => {
    const b = bayrak(1, 2, 0, 6, '#aa0000').filter((y) => y.bez);
    const t = tasi(b, [3, 0, 1]);
    expect(t[0]!.bez!.dinlenik[0]).toEqual(
      b[0]!.bez!.dinlenik[0]!.map((v, i) => v + [3, 0, 1][i]!),
    );
    const ayna = olcekle(b, [-1, 1, 1]);
    for (let i = 0; i < b.length; i++) {
      const once = bezAni(b[i]!, 0.8)
        .p.map((q) => [-q[0], q[1], q[2]] as V3)
        .reverse();
      const sonra = bezAni(ayna[i]!, 0.8).p;
      once.forEach((q, j) => q.forEach((v, k) => expect(sonra[j]![k]).toBeCloseTo(v)));
    }
    const d = dondur(b, 'z', Math.PI / 2);
    for (let i = 0; i < b.length; i++) {
      const once = bezAni(b[i]!, 0.8).p.map(([x, y, z]) => [-y, x, z] as V3);
      bezAni(d[i]!, 0.8).p.forEach((q, j) =>
        q.forEach((v, k) => expect(v).toBeCloseTo(once[j]![k]!)),
      );
    }
  });

  it('bayrak kareleri: bayrak bayrak ardışık, her karede aynı köşe sayısı, kumaş kıpırdıyor', () => {
    const m = [...bayrak(0, 0, 0, 6, '#aa0000'), ...bayrak(20, 0, 0, 6, '#0000aa', 'x')];
    expect(bayrakGruplari(m)).toHaveLength(2);
    const k = bayrakKareleri(m)!;
    expect(k.kareler).toHaveLength(BAYRAK_KARE);
    expect(k.gruplar).toHaveLength(2);
    const toplam = k.gruplar.reduce((a, b) => a + b, 0) * KOSE;
    for (const t of k.kareler) expect(t.length).toBe(toplam);
    expect(k.kareler[0]).not.toEqual(k.kareler[BAYRAK_KARE / 2]);
    expect(bayrakKareleri(kutu(0, 0, 0, 1, 1, 1, '#808080'))).toBeUndefined();
  });

  it('tohumlu rastgele: aynı anahtar aynı dizi', () => {
    const a = rastgele('kisla_3');
    const b = rastgele('kisla_3');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('bina çizimleri', () => {
  it.each(BINA_ADLARI)('%s: NaN yok, çerçeveye sığıyor, boş değil', (ad) => {
    const c = ciz(binaModeli(ad));
    expect(c.cokgenler.length).toBeGreaterThan(20);
    const [x, y, w, h] = BINA_KUTUSU;
    for (const p of c.cokgenler) {
      const s = sayilar(p.n);
      expect(s.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < s.length; i += 2) {
        expect(s[i]!).toBeGreaterThanOrEqual(x - 0.01);
        expect(s[i]!).toBeLessThanOrEqual(x + w + 0.01);
        expect(s[i + 1]!).toBeGreaterThanOrEqual(y - 0.01);
        expect(s[i + 1]!).toBeLessThanOrEqual(y + h + 0.01);
      }
    }
  });
});

describe('yerleşim zeminleri', () => {
  it.each(YERLESIM_KADEMELERI)('%s: NaN yok', (k) => {
    const c = ciz(yerlesimModeli(k));
    expect(c.cokgenler.length).toBeGreaterThan(50);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });

  it('binanın ekran yüzdesi dünyaya ve geri aynı yüzdeye dönüyor', () => {
    const [x, y] = yerlesimNoktasi(51, 53);
    const [px, py] = yerlesimYuzdesi(x, y);
    expect(px).toBeCloseTo(51, 6);
    expect(py).toBeCloseTo(53, 6);
  });
});

describe('bölge sahneleri', () => {
  it.each(BOLGE_SAHNELERI)('%s: NaN yok, dolu', (ad) => {
    const c = ciz(bolgeModeli(ad));
    expect(c.cokgenler.length).toBeGreaterThan(400);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });

  it('aşama adı çözülüyor; bilinmeyen tür null', () => {
    expect(bolgeAdiCoz('tarla_3')).toEqual(['tarla', 3]);
    expect(bolgeAdiCoz('kale')).toEqual(['kale', 1]);
    expect(bolgeAdiCoz('ejderha')).toBeNull();
  });

  it('aynı türün aşamaları aynı araziyi paylaşıyor', () => {
    const arazi = (ad: string) =>
      bolgeModeli(ad)
        .filter((y) => y.katman === -2)
        .map((y) => y.p.flat().join(','))
        .slice(0, 50)
        .join('|');
    expect(arazi('koy_3')).toBe(arazi('koy'));
  });
});

describe('birlik, düşman, ekipman', () => {
  it('oyundaki her birlik çiziliyor', () => {
    for (const b of Object.keys(B.birimler)) expect(BIRLIK_ADLARI).toContain(b);
  });
  it('her diyarın düşmanı er ve şef olarak çiziliyor', () => {
    for (const h of AKIN_HARITALARI) {
      expect(DUSMAN_ADLARI).toContain(h.dusman_key);
      expect(DUSMAN_ADLARI).toContain(h.dusman_key + '_sef');
    }
  });
  it('her ekipman yuvasının beş kademesi çiziliyor', () => {
    for (const y of B.ekipman.slotlar)
      for (let t = 1; t <= 5; t++) expect(EKIPMAN_ADLARI).toContain(`${y}_t${t}`);
  });
  it.each([
    ...BIRLIK_ADLARI.map((a) => [a, birlikModeli] as const),
    ...DUSMAN_ADLARI.map((a) => [a, dusmanModeli] as const),
    ...EKIPMAN_ADLARI.map((a) => [a, ekipmanModeli] as const),
  ])('%s: NaN yok', (ad, uret) => {
    const c = ciz(uret(ad)!);
    expect(c.cokgenler.length).toBeGreaterThan(8);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });
  it('bilinmeyen ad null', () => {
    expect(birlikModeli('ejderha')).toBeNull();
    expect(ekipmanModeli('silah_t9')).toBeNull();
  });
});

describe('generaller, lord, portreler', () => {
  it('seçilebilen her hazır portrenin çizimi var', () => {
    for (const p of HAZIR_PORTRELER) expect(PORTRE_ADLARI).toContain(p.key);
  });
  it('lordun beş kuşam aşaması çiziliyor', () => {
    for (let i = 1; i <= 5; i++) expect(lordModeli(`lord_${i}`)).not.toBeNull();
    expect(lordModeli('lord_6')).toBeNull();
  });
  it.each(PORTRE_ADLARI)('%s: NaN yok', (ad) => {
    const c = ciz(portreModeli(ad)!);
    expect(c.cokgenler.length).toBeGreaterThan(80);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });
  it('general tam boy = portre (aynı kişi)', () => {
    for (const g of GENERAL_ADLARI) expect(portreModeli(g)).toEqual(generalModeli(g));
  });
});

describe('figür: yüz ve el', () => {
  const temel: Insan = {
    ten: '#c08060',
    govde: '#6a4a30',
    bacak: '#40302a',
    cizme: '#2a221c',
  };
  const var_ = (m: ReturnType<typeof insan>, renk: string) => m.some((y) => y.renk === renk);

  it('açık yüzde göz akı, gözbebeği ve ağız var', () => {
    const m = insan(temel);
    expect(var_(m, P.gozAki)).toBe(true);
    expect(var_(m, P.gozBebegi)).toBe(true);
    expect(var_(m, P.dudak)).toBe(true);
  });

  it('kapalı miğfer ve maske yüzü örtüyor; sakal ağzı örtüyor', () => {
    for (const tip of ['kapali', 'maske'] as const) {
      const m = insan({ ...temel, baslik: { tip, renk: '#8a8f94' } });
      expect(var_(m, P.gozAki)).toBe(false);
    }
    const sakalli = insan({ ...temel, sakal: '#3a2a1a' });
    expect(var_(sakalli, P.gozAki)).toBe(true);
    expect(var_(sakalli, P.dudak)).toBe(false);
  });

  it('plaka zırhlının eli parlak demir eldiven; öbürü çıplak', () => {
    const zirh = '#8a8f94';
    const sovalye = insan({ ...temel, zirh: { tip: 'plaka', renk: zirh } });
    const eldiven = isikla(zirh, 0.8);
    expect(sovalye.some((y) => y.renk === eldiven && (y.parlak ?? 0) > 0)).toBe(true);
    const koylu = insan(temel);
    expect(var_(koylu, eldiven)).toBe(false);
  });

  it('saç kabuğu SVG sırasında başın önüne alınıyor', () => {
    const m = insan({ ...temel, sac: '#5a3a1e' });
    const sac = m.filter((y) => y.renk === '#5a3a1e');
    expect(sac.length).toBeGreaterThan(0);
    expect(sac.every((y) => (y.onde ?? 0) > 0)).toBe(true);
  });
});

describe('belirlenimcilik', () => {
  // Çizim her açılışta aynı olmalı: Math.random'a düşen bir parça (kürk
  // yakasında oldu) aynı generalin iki ekranda farklı görünmesi demek.
  it.each([
    ...BINA_ADLARI.map((a) => [a, () => binaModeli(a)] as const),
    ...BIRLIK_ADLARI.map((a) => [a, () => birlikModeli(a)] as const),
    ...DUSMAN_ADLARI.map((a) => [a, () => dusmanModeli(a)] as const),
    ...EKIPMAN_ADLARI.map((a) => [a, () => ekipmanModeli(a)] as const),
    ...PORTRE_ADLARI.map((a) => [a, () => portreModeli(a)] as const),
    ['koy_5', () => bolgeModeli('koy_5')] as const,
  ])('%s iki kez aynı çiziliyor', (_, uret) => {
    expect(ciz(uret()!).cokgenler).toEqual(ciz(uret()!).cokgenler);
  });
});

describe('akın diyarları', () => {
  it.each(AKIN_HARITALARI.flatMap((h) => [[h.key, 'kapak'] as const, [h.key, 'harita'] as const]))(
    '%s %s: NaN yok, dolu',
    (ad, kadraj) => {
      const c = ciz(diyarModeli(ad, kadraj)!);
      expect(c.cokgenler.length).toBeGreaterThan(300);
      for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
    },
  );
  it('bilinmeyen diyar null', () => expect(diyarModeli('ay', 'kapak')).toBeNull());
});

describe('ekran zeminleri ve dünya', () => {
  it.each(ZEMIN_ADLARI)('%s zemini: NaN yok, dolu', (ad) => {
    const c = ciz(zeminModeli(ad)!);
    expect(c.cokgenler.length).toBeGreaterThan(200);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });

  it('dünya zemini: kara, deniz ve orman var; koordinatlar haritanın içinde', () => {
    const u = dunyaUcgenleri(4);
    expect(u.length).toBeGreaterThan(1000);
    const renkler = new Set(u.map((x) => x.renk));
    expect(renkler.size).toBeGreaterThan(50);
    for (const x of u)
      for (const v of x.n) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(-2);
        expect(v).toBeLessThan(102);
      }
    // Belirlenimci: iki üretim aynı.
    expect(dunyaUcgenleri(4)).toEqual(u);
  });
});
