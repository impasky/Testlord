/**
 * KALABALIK — yerleşkenin insanları ve evleri (docs/24 "Kalabalık").
 *
 * Oyuncu: "görsel olarak hâlâ çok yetersiz." Yapılar büyüse de kasaba
 * ıssızdı: talim alanı ve tarla dışında kimse yoktu, yapıların arası boş
 * çayırdı. Burada:
 *
 * - Ek köy evleri kasabanın boş yerlerinde (kademeyle artıyor, kademenin
 *   duvarı ve çatısıyla). Boş yer modelin kendisinden bulunuyor: çimen
 *   olmayan yer (yol, avlu, tarla) ve nesnelerin ayağı dolu sayılıyor;
 *   ARSALARIN HEPSİ (kilitli olanlar da) kapalı: kademe atlayınca açılan
 *   arsa bir evin altında kalmasın.
 * - Kuyunun (ateşin) başında sohbet eden köylüler (durağan).
 * - Yolda gidip gelen köylüler: çuval, sepet, kova taşıyor; yolun kendi
 *   eğrisini izliyor, uçta dönüyor. Canlı parça (`canlandir`); az sayıda,
 *   kısa yolda: atlası rotası kadar.
 */
import { canlandir } from './canli';
import { insan, type Insan } from './figur';
import { bostan } from './cevre';
import { ev } from './kir';
import { cadir, sandik } from './parca';
import { P, isikla } from './renk';
import { rastgele } from './rastgele';
import { birlestir, cember, dondur, kutu, olcekle, prizma, silindir, tasi, yansitici } from './uc';
import type { Model } from './uc';

/**
 * Kasabadaki insanın ölçeği (figür biriminden). Talim alanının ve tarlanın
 * aktörlerinden (0,55) küçük: büyütülen yapıların yanında köylü kapının
 * boyunu aşıyordu.
 */
const OLCEK = 0.42;

const KIYAFET: Insan[] = [
  {
    ten: P.ten2,
    sac: P.sac2,
    govde: '#8a7458',
    etek: '#7a6448',
    bacak: '#6b5a45',
    cizme: P.deri,
    baslik: { tip: 'bone', renk: '#9a8a6a' },
  },
  {
    ten: P.ten1,
    sac: P.sac3,
    govde: '#8a5a48',
    etek: '#6a4a3a',
    bacak: '#6b5a45',
    cizme: P.deri,
    kadin: true,
    baslik: { tip: 'kukuleta', renk: '#c9b89a' },
  },
  {
    ten: P.ten3,
    sac: P.sac1,
    govde: '#5a6a7a',
    etek: '#4a5a68',
    bacak: '#5a4a3a',
    cizme: P.deri,
  },
  {
    ten: P.ten1,
    sac: P.sac4,
    govde: '#6a7a4a',
    etek: '#5a6a3a',
    bacak: '#6b5a45',
    cizme: P.deri,
    kadin: true,
    elbise: true,
  },
];

/* ── Doluluk ───────────────────────────────────────────────────────── */

const H = 1;

/**
 * Yerin dolu hücreleri (dünya, 1 birim): nesnelerin yere yakın yüzleri ve
 * çimen olmayan yer yüzleri. Kaba ama tutucu: kutu kutu işaretleniyor.
 */
function dolulukIzgarasi(m: Model): (x: number, y: number) => boolean {
  const dolu = new Set<number>();
  const k = (i: number, j: number) => i * 100003 + j;
  for (const f of m) {
    if (f.gpu || f.p.length < 3) continue;
    const yer = (f.katman ?? 0) < 0;
    if (yer && f.doku === 'cimen') continue;
    if (!yer && !f.p.some((q) => q[2] < 1.5)) continue;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const q of f.p) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
    // Yerleşkeyi kaplayan taban ve çok büyük yer yüzleri değil.
    if ((x1 - x0) * (y1 - y0) > 400) continue;
    for (let i = Math.floor(x0 / H); i <= Math.floor(x1 / H); i++)
      for (let j = Math.floor(y0 / H); j <= Math.floor(y1 / H); j++) dolu.add(k(i, j));
  }
  return (x, y) => dolu.has(k(Math.floor(x / H), Math.floor(y / H)));
}

/* ── Ek evler ──────────────────────────────────────────────────────── */

export interface KalabalikAyari {
  /** Ekrandan dünyaya (yerleşkenin `zemineGeri`si). */
  geri: (sx: number, sy: number) => [number, number];
  /** Kasabanın ekran kutusu: ek evler bunun içinde. */
  kasaba: [number, number, number, number];
  /** Arsaların ekran kutuları (hepsi, kilitliler de): evlere kapalı. */
  arsalar: [number, number, number, number][];
  /**
   * Kilitli (henüz açılmamış) arsalar: plakanın ortası ve kenarı (dünya).
   * Boş çayır bırakılmıyor: köy evi ve bostanı (kampta çadır); arsa
   * açılınca ev kalkıyor, yerine inşaat yeri geliyor.
   */
  kilitli: [number, number, number][];
  kamp: boolean;
  /** Yol ağının çizgileri (dünya): yürüyenler bunların üstünde. */
  yollar: [number, number][][];
  /** Kuyunun/ateşin yeri (dünya) ve köylülerin ona uzaklığı: sohbet edenler. */
  gobek: [number, number];
  sohbetUzak: number;
  /** Kaç ek ev, kaç yürüyen. */
  ev: number;
  yuruyen: number;
  /** Evlerin duvarı ve çatısı (kademe). */
  evAyari: (i: number) => { duvar: string; cati: string; h: number; kiris: boolean };
}

function ekEvler(m: Model, a: KalabalikAyari, r: () => number): Model {
  const out: Model = [];
  const dolu = dolulukIzgarasi(m);
  const ekran = yansitici();
  const arsada = (sx: number, sy: number) =>
    a.arsalar.some(([x0, y0, x1, y1]) => sx > x0 && sx < x1 && sy > y0 && sy < y1);
  const [kx, ky, kx1, ky1] = a.kasaba;
  const evler: [number, number, number, number][] = [];
  let deneme = 0;
  while (evler.length < a.ev && deneme++ < 600) {
    const [x, y] = a.geri(kx + r() * (kx1 - kx), ky + r() * (ky1 - ky));
    const sx = 3.2 + r() * 0.8;
    const sy = 2.6 + r() * 0.6;
    const pay = 1.4;
    let bos = true;
    for (let u = -sx / 2 - pay; u <= sx / 2 + pay && bos; u += 0.5)
      for (let v = -sy / 2 - pay; v <= sy / 2 + pay + 1.6 && bos; v += 0.5) {
        if (dolu(x + u, y + v)) bos = false;
        else {
          const [px, py] = ekran([x + u, y + v, 0]);
          if (arsada(px, py)) bos = false;
        }
      }
    if (!bos) continue;
    // Evler birbirine de yapışmasın.
    if (evler.some(([ex, ey]) => Math.hypot(ex - x, ey - y) < 6.5)) continue;
    evler.push([x, y, sx, sy]);
  }
  evler.forEach(([x, y, sx, sy], i) => {
    const o = a.evAyari(i);
    out.push(
      ...ev(x - sx / 2, y - sy / 2, 0, sx, sy, o.h, {
        duvar: o.duvar,
        cati: o.cati,
        baca: i % 2 === 0,
        kiris: o.kiris,
        isik: true,
      }),
    );
    // Kapı önünde çiğnenmiş toprak, yanında odun ya da fıçı.
    out.push(
      ...prizma(
        cember(x + 0.3, y + sy / 2 + 1.2, 1.5, 8, r()),
        0,
        0.02,
        isikla(P.toprak, 1.04),
      ).map((f) => ({ ...f, katman: -1.3, kenarsiz: true })),
    );
    if (i % 2)
      out.push(
        ...kutu(x + sx / 2 + 0.3, y - sy / 2 + 0.3, 0, 0.8, 1.6, 0.7, {
          ust: '#b08a5a',
          yan: P.koyuTahta,
        }),
      );
    else out.push(...silindir(x - sx / 2 - 0.6, y + sy / 2 - 0.4, 0, 0.45, 0.9, P.tahta, 8));
  });
  return out;
}

/* ── Sohbet eden köylüler ──────────────────────────────────────────── */

/** Kuyunun başında üç köylü, yüzleri ortaya dönük (durağan: kalabalıkta katman olmasın). */
function sohbet(a: KalabalikAyari): Model {
  const out: Model = [];
  const [gx, gy] = a.gobek;
  const R = a.sohbetUzak;
  [0.55, 1.75, 3.0].forEach((aci, i) => {
    const x = gx + Math.cos(aci) * R;
    const y = gy + Math.sin(aci) * R;
    // İnsan +y'ye bakıyor; ortaya dönsün.
    const yon = Math.atan2(gy - y, gx - x) - Math.PI / 2;
    const kisi = insan({
      ...KIYAFET[i % KIYAFET.length]!,
      eller: i === 1 ? { sag: [0.9, 1.4, 4.4] } : undefined,
    });
    out.push(
      ...tasi(dondur(olcekle(kisi, OLCEK), 'z', yon), [x, y, 0]).map((f) => ({
        ...f,
        bez: undefined,
      })),
    );
  });
  return out;
}

/* ── Yürüyenler ────────────────────────────────────────────────────── */

const YURUYEN_KARE = 32;
/** Yürüyüş hızı (dünya birimi / sn) ve rotanın en uzun hâli. */
const HIZ = 1.15;
const ROTA = 13;

/** Çizgi boyunca uzunluk parametresi: nokta ve yön. */
function cizgiBoyunca(noktalar: [number, number][]) {
  const boy: number[] = [0];
  for (let i = 1; i < noktalar.length; i++) {
    const [ax, ay] = noktalar[i - 1]!;
    const [bx, by] = noktalar[i]!;
    boy.push(boy[i - 1]! + Math.hypot(bx - ax, by - ay));
  }
  const L = boy[boy.length - 1]!;
  return {
    L,
    at(s: number): { x: number; y: number; dx: number; dy: number } {
      const u = Math.max(0, Math.min(L, s));
      let i = 1;
      while (i < boy.length - 1 && boy[i]! < u) i++;
      const [ax, ay] = noktalar[i - 1]!;
      const [bx, by] = noktalar[i]!;
      const l = boy[i]! - boy[i - 1]! || 1;
      const t = (u - boy[i - 1]!) / l;
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / l, dy: (by - ay) / l };
    },
  };
}

/** Taşınan yük (figür biriminde, insanın kendi ekseninde). */
function yuk(tur: number): Model {
  if (tur === 0)
    // Omuzda çuval.
    return kutu(0.15, -0.55, 4.55, 1.0, 1.1, 0.85, { ust: '#d8c49a', yan: '#bfa878' });
  if (tur === 1)
    // Elde sepet.
    return silindir(1.0, 0.4, 2.0, 0.55, 0.7, { ust: '#7a5a30', yan: '#a07a44' }, 8);
  // Elde kova.
  return silindir(1.0, 0.3, 1.9, 0.45, 0.75, { ust: '#3e5a6e', yan: P.tahta }, 8);
}

function yuruyen(cizgi: [number, number][], i: number): Model {
  const yol = cizgiBoyunca(cizgi);
  // Rota: çizginin ortasında, en çok ROTA uzunluğunda.
  const uzun = Math.min(ROTA, yol.L - 1);
  const bas = (yol.L - uzun) / 2;
  const sure = (2 * uzun) / HIZ;
  // Adım: iki yönde de aynı sayıda; tur başa sarınca adım da başta.
  const adimSayisi = Math.max(4, Math.round(uzun / 0.9));
  const kiyafet = KIYAFET[(i + 1) % KIYAFET.length]!;
  const tasinan = yuk(i % 3);
  const eller: Insan['eller'] =
    i % 3 === 0 ? { sag: [0.6, 0.2, 4.6], sol: [-0.7, 0.2, 2.6] } : { sag: [1.0, 0.4, 2.7] };
  const poz = (t: number): Model => {
    const ileri = t < 0.5;
    const u = ileri ? t * 2 : (1 - t) * 2;
    const p = yol.at(bas + u * uzun);
    const aci = Math.atan2(p.dy, p.dx) + (ileri ? 0 : Math.PI);
    const adim = Math.sin(2 * Math.PI * adimSayisi * t);
    const kisi = birlestir(insan({ ...kiyafet, adim: adim * 0.8, eller }), tasinan);
    return tasi(dondur(olcekle(kisi, OLCEK), 'z', aci - Math.PI / 2), [
      p.x,
      p.y,
      Math.abs(adim) * 0.04,
    ]);
  };
  const orta = yol.at(bas + uzun / 2);
  return canlandir(poz, YURUYEN_KARE, sure, [orta.x, orta.y, 0]);
}

/* ── Hepsi ─────────────────────────────────────────────────────────── */

/** Kilitli arsada köy evi, bostan, odun (kampta çadır ve sandıklar). */
function kilitliArsalar(a: KalabalikAyari, r: () => number): Model {
  const out: Model = [];
  a.kilitli.forEach(([cx, cy, k], i) => {
    if (a.kamp) {
      // Kampta: iri bir çadır, yanında küçük bir çadır, sandıklar ve taş ocak.
      out.push(
        ...cadir(
          cx - k * 0.3,
          cy - k * 0.24,
          k * 0.3,
          k * 0.24,
          k * 0.21,
          i % 2 ? P.cadir : '#9c8a62',
          'y',
        ),
        ...cadir(cx + k * 0.08, cy - k * 0.28, k * 0.2, k * 0.17, k * 0.15, '#8a7a5a', 'x'),
        ...sandik(cx + k * 0.22, cy + k * 0.12, 0, 0.9),
        ...sandik(cx + k * 0.3, cy + k * 0.02, 0, 0.75),
      );
      for (let j = 0; j < 7; j++) {
        const t = (j / 7) * Math.PI * 2;
        out.push(
          ...kutu(
            cx - k * 0.05 + Math.cos(t) * 0.75,
            cy + k * 0.15 + Math.sin(t) * 0.75,
            0,
            0.35,
            0.35,
            0.25,
            P.kaya,
          ),
        );
      }
      return;
    }
    const o = a.evAyari(i);
    const sx = k * 0.3 + (i % 2) * 0.4;
    const sy = k * 0.24;
    const ex = cx - k * 0.22;
    const ey = cy - k * 0.12;
    out.push(
      ...ev(ex - sx / 2, ey - sy / 2, 0, sx, sy, o.h, {
        duvar: o.duvar,
        cati: o.cati,
        baca: i % 2 === 0,
        kiris: o.kiris,
        isik: true,
      }),
      ...prizma(
        cember(ex + 0.3, ey + sy / 2 + 1.2, 1.6, 8, r()),
        0,
        0.02,
        isikla(P.toprak, 1.04),
      ).map((f) => ({ ...f, katman: -1.3, kenarsiz: true })),
      ...bostan(cx + k * 0.05, cy - k * 0.3, k * 0.24, k * 0.24),
      ...kutu(ex + sx / 2 + 0.4, ey - sy / 2, 0, 0.9, 1.8, 0.75, {
        ust: '#b08a5a',
        yan: P.koyuTahta,
      }),
    );
  });
  return out;
}

export function kalabalik(m: Model, a: KalabalikAyari, anahtar: string): Model {
  const r = rastgele('kalabalik:' + anahtar);
  const arsaKoyu = kilitliArsalar(a, r);
  const out: Model = [...arsaKoyu, ...ekEvler([...m, ...arsaKoyu], a, r), ...sohbet(a)];
  const uzunlar = a.yollar
    .map((c) => ({ c, L: cizgiBoyunca(c).L }))
    .filter(({ L }) => L >= 9)
    .sort((x, y) => y.L - x.L);
  for (let i = 0; i < Math.min(a.yuruyen, uzunlar.length); i++)
    out.push(...yuruyen(uzunlar[i]!.c, i));
  return out;
}
