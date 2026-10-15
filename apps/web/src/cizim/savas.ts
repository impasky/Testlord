/**
 * SAVAŞ SAHNESİ — raporun tepesinde iki ordunun karşılaştığı tek kare
 * (docs/09 §4.2 G4, docs/24).
 *
 * Rapor savaşı sayılarla anlatıyordu: tur tur güç, kayıp/kalan dökümü.
 * Sayılar "neden"i söylüyor ama savaşın kendisini göstermiyor. Sahne
 * raporun verisinden kuruluyor, süs değil: hangi birlikler sahadaydı,
 * kaçı düştü, kim kazandı, savunanın tahkimatı var mıydı, nerede
 * savaşıldı (bölgenin türü).
 *
 * Soldan saldıran (kırmızı), sağdan savunan (mavi). Birlikler sayıyla
 * değil oranla: binlik bir ordu dokuz figürü aşmıyor (sayının logaritması),
 * figürler türlerine birliklerin payıyla dağılıyor. Düşen figürler kendi
 * hattının önünde yatıyor — kayıp oranı kadar. Kazananın sancağı dik,
 * kaybedeninki yere eğik.
 *
 * Anahtar bütün bunları taşıyor (`savasAnahtari`) ve model YALNIZ
 * anahtardan kuruluyor (tarif `savas:…`): GPU işçisi aynı sahneyi kendisi
 * kurabiliyor, kalıcı kayıt da anahtara bağlı. Figür sayıları küçük
 * tutulduğu için anahtarların sayısı da sınırlı: aynı görünen iki savaş
 * aynı resmi paylaşıyor.
 */
import { arazi, ekrandanYere, gurultu, type Nokta } from './arazi';
import { birlikModeli } from './birlikler';
import { balya, ev, kaleSuru, kule, madenAgzi } from './kir';
import { agac, bayrak, cam, duman, kaya, palisat } from './parca';
import { P, karistir } from './renk';
import { rastgele } from './rastgele';
import { dondur, olcekle, tasi, type Model } from './uc';

export const SAVAS_KUTUSU: [number, number, number, number] = [-30, -15, 60, 23];
const yer = ekrandanYere(SAVAS_KUTUSU);

/** Sahnedeki birlik türleri, anahtardaki kısaltmalarıyla (sıra sabit). */
const TURLER = [
  ['milis', 'mi'],
  ['mizrakci', 'mz'],
  ['okcu', 'ok'],
  ['suvari', 'su'],
  ['kusatma', 'ku'],
] as const;
type Tur = (typeof TURLER)[number][0];
type Ordu = Partial<Record<string, number>>;

/** Bir tarafın en çok figürü. */
const EN_COK = 9;

export interface SavasGirdisi {
  /** Bölgenin türü (`koy`, `tarla`, `maden`, `sehir`, `kale`, `taht`). */
  tip: string | null;
  saldiran: { kalan: Ordu; kayip: Ordu };
  savunan: { kalan: Ordu; kayip: Ordu };
  saldiranKazandi: boolean;
  tahkimat: boolean;
}

/** Bir tarafın figürleri: tür başına ayakta ve düşen. */
type Taraf = { tur: Tur; ayakta: number; dusen: number }[];

/** Ordu → figür. Sayı logaritmayla, türler payla (en büyük kalan). */
function figurler(kalan: Ordu, kayip: Ordu, kazandi: boolean): Taraf {
  const ilk = TURLER.map(([t]) => (kalan[t] ?? 0) + (kayip[t] ?? 0));
  const toplam = ilk.reduce((a, x) => a + x, 0);
  if (toplam <= 0) return [];
  const f = Math.max(1, Math.min(EN_COK, Math.round(1.5 + Math.log10(toplam + 1) * 2.4)));
  const pay = ilk.map((x) => (x / toplam) * f);
  const adet = pay.map(Math.floor);
  // Mancınık tek figür yeter: kocaman ve sahnenin yarısını kaplıyor.
  adet[4] = Math.min(adet[4]!, 1);
  let eksik = f - adet.reduce((a, x) => a + x, 0);
  const sira = pay
    .map((p, i) => [p - Math.floor(p), i] as const)
    .filter(([, i]) => ilk[i]! > 0 && (i !== 4 || adet[4] === 0))
    .sort((a, b) => b[0] - a[0]);
  for (let k = 0; eksik > 0 && sira.length; k++, eksik--) adet[sira[k % sira.length]![1]]!++;
  adet[4] = Math.min(adet[4]!, 1);

  const sonuc: Taraf = [];
  TURLER.forEach(([t], i) => {
    const n = adet[i]!;
    if (n <= 0) return;
    const oran = ilk[i]! > 0 ? (kayip[t] ?? 0) / ilk[i]! : 0;
    sonuc.push({ tur: t, ayakta: n - Math.round(n * oran), dusen: Math.round(n * oran) });
  });
  // Kazanan tarafta en az bir figür ayakta; ordusu bitenin hepsi düşmüş.
  const ayakta = sonuc.reduce((a, s) => a + s.ayakta, 0);
  const kalanToplam = TURLER.reduce((a, [t]) => a + (kalan[t] ?? 0), 0);
  if (kazandi && ayakta === 0 && sonuc[0]) {
    sonuc[0].ayakta = 1;
    sonuc[0].dusen = Math.max(0, sonuc[0].dusen - 1);
  }
  if (kalanToplam === 0) for (const s of sonuc) [s.dusen, s.ayakta] = [s.dusen + s.ayakta, 0];
  return sonuc;
}

function tarafMetni(t: Taraf): string {
  if (!t.length) return '0';
  return t
    .map((s) => {
      const k = TURLER.find(([a]) => a === s.tur)![1];
      return `${k}${s.ayakta}${s.dusen ? '-' + s.dusen : ''}`;
    })
    .join('.');
}

function tarafCoz(m: string): Taraf {
  if (!m || m === '0') return [];
  return m.split('.').flatMap((p) => {
    const e = /^([a-z]{2})(\d+)(?:-(\d+))?$/.exec(p);
    const tur = e && TURLER.find(([, k]) => k === e[1])?.[0];
    return tur ? [{ tur, ayakta: Number(e[2]), dusen: Number(e[3] ?? 0) }] : [];
  });
}

const TIPLER = ['koy', 'tarla', 'maden', 'sehir', 'kale', 'taht'];

/** Raporun verisinden sahnenin anahtarı: `savas:tarla:mz3-1.ok2:mi2-2:s:1`. */
export function savasAnahtari(g: SavasGirdisi): string {
  const tip = g.tip && TIPLER.includes(g.tip) ? g.tip : 'tarla';
  return [
    'savas',
    tip,
    tarafMetni(figurler(g.saldiran.kalan, g.saldiran.kayip, g.saldiranKazandi)),
    tarafMetni(figurler(g.savunan.kalan, g.savunan.kayip, !g.saldiranKazandi)),
    g.saldiranKazandi ? 's' : 'd',
    g.tahkimat ? '1' : '0',
  ].join(':');
}

/* ── Figürler ─────────────────────────────────────────────────────── */

/** Takım rengi: birliğin bezi saldıranda kırmızı, savunanda mavi. */
function takimla(m: Model, saldiran: boolean): Model {
  const [eski, yeni] = saldiran ? [P.maviBez, P.kirmiziBez] : [P.kirmiziBez, P.maviBez];
  return m.map((y) => (y.renk === eski ? { ...y, renk: yeni } : y));
}

/** Birlik figürleri `bak`la kameraya dönük; savaşta karşı tarafa dönüyor. */
const YUZ_SALDIRAN = -0.95;
const YUZ_SAVUNAN = 1.7;
const OLCEK = 1;

function asker(tur: Tur, p: Nokta, saldiran: boolean): Model {
  const m = birlikModeli(tur);
  if (!m) return [];
  const yuz = saldiran ? YUZ_SALDIRAN : YUZ_SAVUNAN;
  const s = tur === 'kusatma' ? OLCEK * 0.8 : OLCEK;
  return tasi(olcekle(dondur(takimla(m, saldiran), 'z', yuz), s), [p[0], p[1], 0]);
}

/** Düşmüş figür: sırtüstü yatıyor, kıpırdamıyor. */
function dusmus(tur: Tur, p: Nokta, saldiran: boolean, r: () => number): Model {
  const m = birlikModeli(tur === 'kusatma' ? 'mizrakci' : tur);
  if (!m) return [];
  let yatik = dondur(takimla(m, saldiran), 'x', Math.PI / 2 - 0.08);
  yatik = dondur(yatik, 'z', (saldiran ? -0.6 : 0.6) + (r() - 0.5) * 1.2);
  let zMin = Infinity;
  for (const y of yatik) for (const q of y.p) zMin = Math.min(zMin, q[2]);
  return tasi(
    olcekle(
      yatik.map((y) => {
        const { bez: _bez, ...kalan } = y as typeof y & { bez?: unknown };
        return kalan;
      }),
      OLCEK,
    ),
    [p[0], p[1], -zMin * OLCEK],
  );
}

/**
 * Bir tarafın dizilişi (ekran yüzdesi). Ön sıra ortaya yakın: yakın dövüş
 * birlikleri önde, okçu arkada, mancınık en geride.
 */
function dizilis(t: Taraf, saldiran: boolean, r: () => number): Model {
  const m: Model = [];
  const yon = saldiran ? -1 : 1; // ortadan dışarı
  const on = saldiran ? 38 : 62;
  const sira: Record<Tur, number> = { milis: 0, mizrakci: 0, suvari: 1, okcu: 2, kusatma: 3 };
  const ayakta = t
    .flatMap((s) => Array.from({ length: s.ayakta }, () => s.tur))
    .sort((a, b) => sira[a] - sira[b]);
  // Her sırada en çok üç figür; sıralar ortadan dışarı, hafif dağınık.
  ayakta.forEach((tur, i) => {
    const satir = Math.floor(i / 3);
    const sutun = i % 3;
    const geri = satir * 9 + (tur === 'kusatma' ? 8 : 0) + r() * 2;
    const px = on + yon * (geri + sutun * 2.5);
    const py = 56 + sutun * 15 + (r() - 0.5) * 4;
    m.push(...asker(tur, yer(px, py), saldiran));
  });
  // Düşenler kendi hattının önünde, ortadaki boşlukta.
  const dusenler = t.flatMap((s) => Array.from({ length: s.dusen }, () => s.tur));
  dusenler.forEach((tur, i) => {
    const px = 50 + yon * (2.5 + (i % 2) * 4 + Math.floor(i / 6) * 3 + r() * 1.5);
    const py = 58 + (Math.floor(i / 2) % 3) * 14 + (r() - 0.5) * 5;
    m.push(...dusmus(tur, yer(px, py), saldiran, r));
  });
  return m;
}

/* ── Arazi ve bölgenin dekoru ─────────────────────────────────────── */

const ARAZI: Record<string, [string, string]> = {
  koy: ['#5d7a3c', '#8f9e4e'],
  tarla: ['#7b8a45', '#b8a65a'],
  maden: ['#6e6a55', '#8f8668'],
  sehir: ['#5b7440', '#86935a'],
  kale: ['#5a6b45', '#7e8460'],
  taht: ['#5b7440', '#9a9a5e'],
};

/** Sahnenin arkasında, savaşın nerede olduğunu söyleyen dekor. */
function dekor(tip: string, r: () => number): Model {
  const m: Model = [];
  const p = (x: number, y: number) => yer(x, y);
  switch (tip) {
    case 'koy': {
      const [a, b] = p(30, 34);
      const [c, d] = p(70, 32);
      m.push(...ev(a - 2, b - 1.5, 0, 4, 3, 2.6, { cati: P.saman }));
      m.push(...ev(c - 1.5, d - 2, 0, 3, 4, 2.4, { cati: P.kiremit }));
      break;
    }
    case 'tarla': {
      for (const [x, y] of [
        [28, 36],
        [36, 30],
        [66, 34],
        [74, 28],
      ] as const)
        m.push(...balya(...p(x, y), 0, 1.1));
      break;
    }
    case 'maden': {
      m.push(...madenAgzi(...p(32, 30), 0, 'y', r));
      for (const [x, y, s] of [
        [62, 32, 1.6],
        [70, 36, 1.1],
        [76, 30, 1.4],
      ] as const)
        m.push(...kaya(...p(x, y), 0, s, r));
      break;
    }
    case 'sehir': {
      const [a, b] = p(28, 32);
      m.push(...ev(a - 2, b - 1.5, 0, 4, 3, 3.6, { cati: P.kiremit, duvar: P.siva }));
      m.push(...kule(...p(72, 30), 0, 1.6, 7, P.tas, 'kulah'));
      break;
    }
    case 'kale':
    case 'taht': {
      const [x, y] = p(60, 30);
      m.push(...kaleSuru(x - 8, y - 3, 0, 16, 6, 4.5, { kule: tip === 'taht' ? 'kulah' : 'kare' }));
      if (tip === 'taht') m.push(...bayrak(...p(60, 22), 9, 9, P.altin));
      break;
    }
  }
  return m;
}

/* ── Sahne ────────────────────────────────────────────────────────── */

/** Anahtardan model: `savas:tip:saldiran:savunan:kazanan:tahkimat`. */
export function savasModeli(ad: string): Model | null {
  const [tip = 'tarla', s = '0', d = '0', kazanan = 's', tahkimat = '0'] = ad.split(':');
  const anahtar = 'savas:' + ad;
  const g = gurultu(anahtar);
  const r = rastgele(anahtar);
  const [c1, c2] = ARAZI[tip] ?? ARAZI.tarla!;
  const m = arazi({
    cerceve: SAVAS_KUTUSU,
    adim: 3,
    h: (x, y) => (g(x, y, 14, 2) - 0.5) * 0.4,
    renk: (x, y) => karistir(c1, c2, g(x + 30, y - 10, 10, 2)),
    r: rastgele('savas-arazi:' + tip),
  });
  m.push(...dekor(tip, r));

  // Savunanın tahkimatı: hattının önünde kazıklı çit.
  if (tahkimat === '1') {
    const [x, y] = yer(58, 50);
    m.push(...palisat(x, y, 12, 'y', 2.6));
  }

  m.push(...dizilis(tarafCoz(s), true, r));
  m.push(...dizilis(tarafCoz(d), false, r));

  // Sancaklar: kazananınki dik ve büyük, kaybedeninki eğik.
  const sancak = (px: number, saldiran: boolean, kazandi: boolean) => {
    const [x, y] = yer(px, 50);
    const renk = saldiran ? P.kirmiziBez : P.maviBez;
    const b = bayrak(x, y, 0, kazandi ? 7 : 5, renk);
    return kazandi ? b : dondur(b, 'x', saldiran ? 0.5 : -0.5, [x, y, 0]);
  };
  m.push(...sancak(10, true, kazanan === 's'));
  m.push(...sancak(90, false, kazanan === 'd'));

  // Savaşın tozu, iki hattın arasında.
  m.push(...duman(...yer(50, 72), 0.4, r, 2));

  // Kenarlara birkaç ağaç (dekorun ve ordunun dışında).
  for (const [px, py] of [
    [4, 30],
    [10, 46],
    [92, 40],
    [97, 26],
    [6, 92],
    [95, 90],
  ] as const) {
    const [x, y] = yer(px, py);
    m.push(...(r() < 0.4 ? cam(x, y, 0, r, 0.8) : agac(x, y, 0, r, 0.8 + r() * 0.3)));
  }
  return m;
}
