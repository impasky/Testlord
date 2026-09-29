/**
 * Canlı yerleşke (docs/24 "Hareket"): talim alanında ok atan okçular,
 * kuklaya mızrak saplayan mızrakçılar, iki uçtan birbirine at süren
 * şövalyeler; tarlada saban süren, orak biçen, demet taşıyan köylüler.
 *
 * Her aktör bir turun duruşlarından kuruluyor (`canlandir`): `poz(t)` t
 * anındaki modeli veriyor, her karede AYNI yüzlerle (yalnız köşeler
 * kayıyor): ok bir an kılıfta, bir an kirişte, bir an hedefte ama hep aynı
 * ok. Kareler GPU'da bir kez çizilip atlasa yazılıyor, sayfada CSS adım
 * adım oynatıyor (bkz. `bayrakAni.ts`). Tur başa sarınca her aktör
 * başladığı yerde: düşen şövalye bile atına binip kendi ucuna dönüyor.
 *
 * Birimler figürün birimi (insan ~8 boy); yerleşim `YERLESIM_OLCEK` ile
 * küçültüp yerine koyuyor.
 */
import { at, insan, type AtAyari, type Insan } from './figur';
import { cadir, cubuk, uzuv } from './parca';
import { P, isikla } from './renk';
import {
  birlestir,
  dondur,
  koni,
  kure,
  kutu,
  olcekle,
  silindir,
  tasi,
  type Model,
  type V3,
} from './uc';

/* ── Canlandırma ───────────────────────────────────────────────────── */

/**
 * Bir aktörün turu: `poz(t)` (t ∈ [0, 1)) her karede aynı yüzleri
 * veriyor. Dönen model ilk karenin kendisi; her yüzü `bez.canli` ile
 * sonraki karelerindeki hâlini taşıyor (tembel: yalnız hareketli GPU
 * çizimi istiyor, SVG ve durağan resim ilk kareyi çiziyor). `kok`
 * aktörün kimliği: bütün yüzleri tek parça olarak çiziliyor.
 */
export function canlandir(
  poz: (t: number) => Model,
  kare: number,
  sure: number,
  kok: V3,
  golgesiz = false,
): Model {
  const ilk = poz(0);
  // Kareler sırayla isteniyor (bir karenin bütün yüzleri art arda): son
  // kareyi tutmak yetiyor, bütün tur bellekte durmuyor.
  let sonK = 0;
  let son = ilk;
  const karesi = (k: number): Model => {
    if (k !== sonK) {
      son = poz(k / kare);
      sonK = k;
      if (son.length !== ilk.length) throw new Error('canlandir: kareler aynı yüzlerden kurulmalı');
    }
    return son;
  };
  return ilk.map((y, i) => ({
    ...y,
    bez: {
      dinlenik: y.p,
      u: y.p.map(() => 0),
      kok,
      sure,
      canli: { kare, yuz: (k: number) => karesi(k)[i]!, golgesiz },
    },
  }));
}

/* ── Yardımcılar ───────────────────────────────────────────────────── */

const topla = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cikar = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const kat = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
function birimV(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
const sayi = (a: number, b: number, u: number) => a + (b - a) * u;
const nokta3 = (a: V3, b: V3, u: number): V3 => [
  sayi(a[0], b[0], u),
  sayi(a[1], b[1], u),
  sayi(a[2], b[2], u),
];
const yumusak = (u: number) => u * u * (3 - 2 * u);

/**
 * Anahtar karelerden ara değer: `[t, değer]` sıralı, 0'dan 1'e. Geçişler
 * yumuşak (yavaş başlayıp yavaş bitiyor); tur başa sarınca aynı değere
 * dönsün diye son anahtar ilkiyle aynı yazılıyor.
 */
function iz<T>(anahtar: [number, T][], t: number, kar: (a: T, b: T, u: number) => T): T {
  for (let i = 0; i < anahtar.length - 1; i++) {
    const [t0, a] = anahtar[i]!;
    const [t1, b] = anahtar[i + 1]!;
    if (t <= t1) return kar(a, b, yumusak(Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)))));
  }
  return anahtar[anahtar.length - 1]![1];
}
const izS = (a: [number, number][], t: number) => iz(a, t, sayi);
const izV = (a: [number, V3][], t: number) => iz(a, t, nokta3);

/** Ok: gövde, demir uç, kırmızı tüy. İnce ama küçük ölçekte seçilsin diye açık renk. */
function ok(kuyruk: V3, uc: V3): Model {
  const d = birimV(cikar(uc, kuyruk));
  const bas = cikar(uc, kat(d, 0.8));
  return birlestir(
    uzuv(kuyruk, bas, 0.17, 0.17, '#eadfc4', 4),
    uzuv(bas, uc, 0.3, 0.05, P.celik, 4),
    uzuv(kuyruk, topla(kuyruk, kat(d, 0.9)), 0.36, 0.2, P.kirmiziBez, 4),
  );
}

/* ── Okçu ──────────────────────────────────────────────────────────── */

export const OKCU_KARE = 24;
export const OKCU_SURE = 2.8;
/** Okçunun hedefe uzaklığı (figür birimi, ileri +y). */
export const OKCU_MENZIL = 24;

const OKCU: Insan = {
  ten: P.ten1,
  sac: P.sac3,
  govde: '#5a6b3a',
  bacak: '#5a4a38',
  cizme: P.deri,
  kol: '#6b5a40',
  zirh: { tip: 'deri', renk: '#7a5a38' },
  baslik: { tip: 'kukuleta', renk: '#4a5a30' },
  sadak: true,
};

/** Hedefin (saman taban) ortası, okçunun yerine göre. */
const HEDEF_ORTA: V3 = [-0.4, OKCU_MENZIL, 4.6];

/**
 * Yay: tutamak sol elde; uçlar yukarı ve aşağıda, geriye bükük. Kiriş
 * çekiliyorsa sağ elden (`cekis`), değilse iki uç arasından geçiyor.
 */
function yay(tutamak: V3, cekis: V3 | null): Model {
  const bukum = cekis ? 1.0 : 0.4;
  const ust: V3 = topla(tutamak, [0, -bukum, 2.4]);
  const alt: V3 = topla(tutamak, [0, -bukum, -2.4]);
  const ustOrta: V3 = topla(tutamak, [0, -bukum * 0.3, 1.3]);
  const altOrta: V3 = topla(tutamak, [0, -bukum * 0.3, -1.3]);
  const kiris = cekis ?? nokta3(ust, alt, 0.5);
  const r = '#6b4526';
  return birlestir(
    uzuv(tutamak, ustOrta, 0.2, 0.16, r, 4),
    uzuv(ustOrta, ust, 0.16, 0.08, r, 4),
    uzuv(tutamak, altOrta, 0.2, 0.16, r, 4),
    uzuv(altOrta, alt, 0.16, 0.08, r, 4),
    uzuv(ust, kiris, 0.05, 0.05, '#efe6d6', 3),
    uzuv(kiris, alt, 0.05, 0.05, '#efe6d6', 3),
  );
}

/**
 * Okçunun bir turu: kılıftan ok, kirişe tak, çek, nişan, bırak; ok uçup
 * hedefe saplanıyor, yay iniyor. İleri +y, hedef `OKCU_MENZIL` ötede.
 */
export function okcuPoz(t: number): Model {
  const sol = izV(
    [
      [0, [-1.5, 0.7, 4.0]],
      [0.18, [-1.1, 1.8, 5.0]],
      [0.32, [-0.4, 3.0, 5.9]],
      [0.66, [-0.4, 3.0, 5.9]],
      [0.84, [-0.5, 2.8, 5.7]],
      [1, [-1.5, 0.7, 4.0]],
    ],
    t,
  );
  const sag = izV(
    [
      [0, [0.7, -0.8, 6.8]],
      [0.18, [-0.5, 1.6, 5.1]],
      [0.32, [-0.35, 2.4, 5.9]],
      [0.56, [0.35, 0.5, 6.4]],
      [0.62, [0.35, 0.5, 6.4]],
      [0.66, [1.0, -0.4, 6.6]],
      [0.84, [1.0, -0.3, 6.3]],
      [1, [0.7, -0.8, 6.8]],
    ],
    t,
  );
  const cekiyor = t >= 0.3 && t < 0.63;
  const m = birlestir(insan({ ...OKCU, eller: { sag, sol } }), yay(sol, cekiyor ? sag : null));
  // Ok: elde (kılıftan yeni çekilmiş), kirişte, uçuşta, hedefte.
  let kuyruk: V3;
  let uc: V3;
  if (t < 0.18) {
    kuyruk = topla(sag, [0.1, 0.2, -0.6]);
    uc = topla(kuyruk, [-0.3, 0.9, 3.6]);
  } else if (t < 0.63) {
    kuyruk = sag;
    uc = topla(sag, kat(birimV(topla(cikar(sol, sag), [0, 0.8, 0])), 4.3));
  } else if (t < 0.8) {
    const u = (t - 0.63) / 0.17;
    const bas = topla(sol, [0, 1.0, 0]);
    const yer = nokta3(bas, HEDEF_ORTA, u);
    yer[2] += 1.4 * 4 * u * (1 - u);
    // Yönü yolun teğeti: önce hafif yukarı, sonra aşağı.
    const d = birimV(topla(cikar(HEDEF_ORTA, bas), [0, 0, 1.4 * 4 * (1 - 2 * u)]));
    uc = yer;
    kuyruk = cikar(yer, kat(d, 4.3));
  } else {
    const d = birimV(cikar(HEDEF_ORTA, topla(sol, [0, 1.0, 0])));
    uc = topla(HEDEF_ORTA, kat(d, 0.5));
    kuyruk = cikar(uc, kat(d, 4.3));
  }
  m.push(...ok(kuyruk, uc));
  return m;
}

/** Okçunun hedefi: iki ayak üstünde saman taban, okçuya dönük halkalar. Durağan. */
export function okHedefi(): Model {
  const [x, y, z] = HEDEF_ORTA;
  const m: Model = [];
  m.push(...cubuk([x - 1.2, y + 0.9, 0], [x - 0.9, y + 0.2, z + 0.4], 0.3, P.koyuTahta));
  m.push(...cubuk([x + 1.2, y + 0.9, 0], [x + 0.9, y + 0.2, z + 0.4], 0.3, P.koyuTahta));
  m.push(...cubuk([x, y + 1.6, 0], [x, y + 0.5, z], 0.3, P.koyuTahta));
  // Taban: ekseni ileri (+y) yatık silindir; ön yüzü okçuya bakıyor.
  const taban = dondur(silindir(0, 0, -0.5, 1.9, 0.9, P.saman, 10), 'x', Math.PI / 2);
  m.push(...tasi(taban, [x, y, z]));
  for (const [r, renk] of [
    [1.5, '#efe6d6'],
    [1.0, P.kirmiziBez],
    [0.45, P.altin],
  ] as [number, string][]) {
    const halka = dondur(silindir(0, 0, 0, r, 0.06, renk, 10), 'x', Math.PI / 2);
    m.push(...tasi(halka, [x, y - 0.5 - (1.6 - r) * 0.05, z]));
  }
  // Önceki atışlardan saplı kalmış iki ok.
  m.push(...ok([x + 0.6, y - 4.2, z + 1.0], [x + 0.5, y - 0.1, z + 0.5]));
  m.push(...ok([x - 0.8, y - 4.1, z - 0.2], [x - 0.6, y, z - 0.6]));
  return m;
}

/* ── Mızrakçı ──────────────────────────────────────────────────────── */

export const MIZRAK_KARE = 16;
export const MIZRAK_SURE = 1.9;

const MIZRAKCI: Insan = {
  ten: P.ten2,
  sac: P.sac2,
  govde: P.maviBez,
  bacak: '#4a4038',
  cizme: P.deri,
  kol: '#8a8f94',
  zirh: { tip: 'zincir', renk: '#8a8f94' },
  tabard: '#e2d8c0',
  baslik: { tip: 'migfer', renk: P.celik },
};

/** Kuklanın okçuya (mızrakçıya) uzaklığı: tam hamlede ucu gövdesine giriyor. */
export const KUKLA_UZAK = 12.6;

/** Talim kuklası: direk, kollar, saman gövde ve baş. Figür biriminde. */
function kukla(egim: number): Model {
  const m = birlestir(
    silindir(0, 0, 0, 0.28, 7.2, P.koyuTahta, 5),
    kutu(-2.2, -0.2, 5.3, 4.4, 0.4, 0.4, P.tahta),
    silindir(0, 0, 3.0, 1.15, 3.1, P.saman, 7),
    kure(0, 0, 6.9, 0.85, P.saman, 6, 3),
    kutu(-1.18, -0.6, 4.3, 2.36, 1.2, 0.3, P.kirmiziBez),
  );
  // Darbe: tabanından geriye (+y) yatıyor.
  return egim ? dondur(m, 'x', -egim) : m;
}

/**
 * Mızrakçının bir turu: hazır duruş, geri çekil, ileri atılıp kuklaya
 * sapla, geri dön. Kukla darbede sallanıyor. İleri +y.
 */
export function mizrakciPoz(t: number): Model {
  const ileri = izS(
    [
      [0, 0],
      [0.3, -0.4],
      [0.42, 1.4],
      [0.58, 1.4],
      [0.82, 0],
      [1, 0],
    ],
    t,
  );
  const egim = izS(
    [
      [0, 0],
      [0.3, -0.06],
      [0.42, 0.24],
      [0.58, 0.24],
      [0.82, 0],
      [1, 0],
    ],
    t,
  );
  const adim = izS(
    [
      [0, 0.35],
      [0.3, 0.2],
      [0.42, 1],
      [0.58, 1],
      [0.82, 0.35],
      [1, 0.35],
    ],
    t,
  );
  const sol = izV(
    [
      [0, [0.3, 2.0, 4.7]],
      [0.3, [0.4, 0.9, 4.9]],
      [0.42, [0.2, 3.5, 5.0]],
      [0.58, [0.2, 3.5, 5.0]],
      [0.82, [0.3, 2.0, 4.7]],
      [1, [0.3, 2.0, 4.7]],
    ],
    t,
  );
  const sag = izV(
    [
      [0, [1.0, -0.4, 4.3]],
      [0.3, [1.1, -1.5, 4.6]],
      [0.42, [0.6, 1.9, 4.9]],
      [0.58, [0.6, 1.9, 4.9]],
      [0.82, [1.0, -0.4, 4.3]],
      [1, [1.0, -0.4, 4.3]],
    ],
    t,
  );
  const d = birimV(cikar(sol, sag));
  const mizrak = birlestir(
    uzuv(cikar(sag, kat(d, 1.6)), topla(sol, kat(d, 6.6)), 0.14, 0.12, P.tahta, 5),
    uzuv(topla(sol, kat(d, 6.6)), topla(sol, kat(d, 7.8)), 0.3, 0.04, P.celik, 4),
  );
  const govde = birlestir(insan({ ...MIZRAKCI, eller: { sag, sol }, adim }), mizrak);
  // Öne eğilme: ayaklar yerinde, baş ileri (+y).
  const kisi = tasi(dondur(govde, 'x', -egim), [0, ileri, 0]);
  // Kukla: uç gövdesine girince geriye yatıp sallanarak doğruluyor.
  const darbe = t < 0.42 ? 0 : Math.max(0, 1 - (t - 0.42) / 0.4);
  const kuklaEgim = 0.2 * darbe * Math.cos((t - 0.42) * 22);
  return birlestir(kisi, tasi(kukla(kuklaEgim), [0.6, KUKLA_UZAK, 0]));
}

/* ── Mızrak düellosu ───────────────────────────────────────────────── */

export const DUELLO_KARE = 40;
export const DUELLO_SURE = 7;
/** Koşu yolunun yarı uzunluğu ve atların perdeye (y = 0) uzaklığı. */
export const DUELLO_YARI = 22;
export const DUELLO_ARALIK = 2.6;
/** Bir turdaki adım sayısı (tam sayı: tur başa sarınca bacaklar da aynı yerde). */
const DUELLO_ADIM = 10;

interface Sovalye {
  at: AtAyari;
  binici: Insan;
}

const MAVI: Sovalye = {
  at: { renk: '#e8e2d6', yele: '#9a9084', eyer: P.deri, ortu: P.maviBez },
  binici: {
    ten: P.ten1,
    govde: P.celik,
    bacak: '#8a8f94',
    cizme: '#6f757c',
    kol: P.celik,
    zirh: { tip: 'plaka', renk: P.celik },
    tabard: P.maviBez,
    omuz: P.celik,
    baslik: { tip: 'kapali', renk: P.celik, ikinci: P.maviBez },
    sol: { tip: 'kalkan', renk: P.maviBez, ikinci: P.altin },
    oturan: true,
  },
};
const KIZIL: Sovalye = {
  at: { renk: '#5a3a24', yele: '#2a1c12', eyer: P.deri, ortu: P.kirmiziBez },
  binici: {
    ...MAVI.binici,
    tabard: P.kirmiziBez,
    baslik: { tip: 'kapali', renk: '#b8bec4', ikinci: P.kirmiziBez },
    sol: { tip: 'kalkan', renk: P.kirmiziBez, ikinci: '#efe6d6' },
  },
};

/** Binicinin atın üstündeki ölçeği ve kalçasının yeri (at biriminde). */
const BINICI_OLCEK = 0.74;
const EYER: V3 = [-0.25, 0, 5.55];

/**
 * Binici, kalçası başlangıçta ve atın yönünde (+x): mızrak `kaldir` 0'da
 * koltuk altında ileri ve perdeye doğru (sağa), 1'de dimdik. `egim`:
 * geriye devrilme (radyan).
 */
function binici(s: Sovalye, kaldir: number, egim: number): Model {
  const el: V3 = [1.45, 1.2, 4.7];
  // Koltuk altında ileri ve perdenin üstünden karşı yana (sağa): uç, karşı
  // şövalyenin göğsüne varsın.
  const yatik = birimV([0.42, 1, 0.04]);
  const dik = birimV([0.05, 0.12, 1]);
  const d = birimV(nokta3(yatik, dik, kaldir));
  const mizrak = birlestir(
    uzuv(cikar(el, kat(d, 3)), topla(el, kat(d, 11)), 0.2, 0.12, '#e6ddc8', 6),
    uzuv(topla(el, kat(d, 11)), topla(el, kat(d, 12.3)), 0.2, 0.05, P.celik, 4),
    // Mızrak siperi: elin önünde koni biçimli kalkan
    uzuv(
      topla(el, kat(d, 0.2)),
      topla(el, kat(d, 1.1)),
      0.7,
      0.2,
      isikla(s.binici.tabard!, 1.1),
      6,
    ),
  );
  const govde = birlestir(insan({ ...s.binici, eller: { sag: el } }), mizrak);
  // Figür +y'ye bakıyor; ata göre +x'e çevir, kalça başlangıca.
  const cevrik = dondur(govde, 'z', -Math.PI / 2);
  const olcekli = tasi(olcekle(cevrik, BINICI_OLCEK), [0, 0, -3.2 * BINICI_OLCEK]);
  return egim ? dondur(olcekli, 'y', -egim) : olcekli;
}

/** At biriminden yere: yön (radyan, +x'ten), konum, sıçrama. */
function yere(m: Model, x: number, y: number, yon: number, z = 0): Model {
  return tasi(dondur(m, 'z', yon), [x, y, z]);
}

/** Bir noktayı atın biriminden yere taşır (eyerdeki binicinin yeri için). */
function yereNokta(q: V3, x: number, y: number, yon: number, z = 0): V3 {
  const c = Math.cos(yon);
  const s = Math.sin(yon);
  return [x + q[0] * c - q[1] * s, y + q[0] * s + q[1] * c, z + q[2]];
}

/**
 * Düellonun bir turu. Mavi şövalye perdenin yakın yanında (+y) −x ucundan,
 * kızıl uzak yanında (−y) +x ucundan dörtnala çıkıyor; mızraklar ortada
 * buluşuyor, kızıl eyerden geriye uçup yere düşüyor. Mavi yolun ucunda
 * dönüp geri tırısa çıkıyor; kızılın boş atı dönüp sahibine geliyor,
 * şövalye doğrulup atına biniyor ve kendi ucuna dönüyor. Tur başa
 * sarınca ikisi de başladıkları yerde.
 */
export function duelloPoz(t: number): Model {
  const L = DUELLO_YARI;
  const W = DUELLO_ARALIK;
  const faz = DUELLO_ADIM * t;
  const dusus = 7; // kızılın düştüğü yer (x)
  const sicra = (g: number) => g * 0.35 * Math.abs(Math.sin(Math.PI * faz * 2));

  // Mavi: −L → +L·0.85 (dörtnala), dön, geri −L (tırıs), dön.
  const maviX = izS(
    [
      [0, -L],
      [0.28, -4.4],
      [0.46, L * 0.85],
      [0.56, L * 0.85],
      [0.93, -L],
      [1, -L],
    ],
    t,
  );
  const maviYon = izS(
    [
      [0, 0],
      [0.47, 0],
      [0.56, Math.PI],
      [0.94, Math.PI],
      [1, 2 * Math.PI],
    ],
    t,
  );
  const maviGenlik = izS(
    [
      [0, 0.6],
      [0.4, 0.6],
      [0.5, 0.2],
      [0.6, 0.35],
      [0.9, 0.35],
      [1, 0.6],
    ],
    t,
  );
  const maviMizrak = izS(
    [
      [0, 0],
      [0.32, 0],
      [0.45, 1],
      [0.9, 1],
      [1, 0],
    ],
    t,
  );

  // Kızılın atı: +L → −L·0.85, dön (+x'e), sahibine gel, bekle, birlikte +L, dön.
  const bekle = dusus - 3.2;
  const atX = izS(
    [
      [0, L],
      [0.28, 4.4],
      [0.46, -L * 0.85],
      [0.56, -L * 0.85],
      [0.7, bekle],
      [0.8, bekle],
      [0.95, L],
      [1, L],
    ],
    t,
  );
  const atYon = izS(
    [
      [0, Math.PI],
      [0.47, Math.PI],
      [0.56, 2 * Math.PI],
      [0.95, 2 * Math.PI],
      [1, 3 * Math.PI],
    ],
    t,
  );
  const atGenlik = izS(
    [
      [0, 0.6],
      [0.4, 0.6],
      [0.5, 0.2],
      [0.6, 0.35],
      [0.7, 0.1],
      [0.8, 0.1],
      [0.85, 0.5],
      [1, 0.6],
    ],
    t,
  );

  // Kızıl binici: eyerde (0–0.28), uçuş (0.28–0.4), sırt üstü (–0.52),
  // doğrulup oturuyor (–0.6), bekliyor (–0.72), atına biniyor (–0.8).
  const eyer = yereNokta(EYER, atX, -W, atYon, sicra(atGenlik));
  const yerde: V3 = [dusus, -W - 1.6, 1.0];
  const oturus: V3 = [dusus, -W - 1.6, 1.7];
  let kalca: V3;
  let egim: number;
  let yon: number;
  if (t < 0.28 || t >= 0.8) {
    kalca = eyer;
    egim = 0;
    yon = atYon;
  } else if (t < 0.4) {
    const u = (t - 0.28) / 0.12;
    const bas = yereNokta(EYER, 4.4, -W, Math.PI, 0);
    kalca = nokta3(bas, yerde, u);
    kalca[2] += 3.5 * 4 * u * (1 - u);
    egim = 1.45 * yumusak(u);
    yon = Math.PI;
  } else if (t < 0.52) {
    kalca = yerde;
    egim = 1.45;
    yon = Math.PI;
  } else if (t < 0.6) {
    const u = yumusak((t - 0.52) / 0.08);
    kalca = nokta3(yerde, oturus, u);
    egim = 1.45 * (1 - u);
    yon = Math.PI;
  } else if (t < 0.72) {
    kalca = oturus;
    egim = 0;
    yon = Math.PI;
  } else {
    // Atına biniyor: yerden eyere sıçrayıp atın yönüne dönüyor.
    const u = yumusak((t - 0.72) / 0.08);
    kalca = nokta3(oturus, eyer, u);
    kalca[2] += 1.5 * 4 * u * (1 - u);
    egim = 0;
    yon = sayi(Math.PI, atYon, u);
  }
  const kizilMizrak = izS(
    [
      [0, 0],
      [0.28, 0],
      [0.34, 1],
      [0.9, 1],
      [1, 0],
    ],
    t,
  );

  const maviEyer = yereNokta(EYER, maviX, W, maviYon, sicra(maviGenlik));
  const mavi = birlestir(
    yere(at({ ...MAVI.at, adim: faz, genlik: maviGenlik }), maviX, W, maviYon, sicra(maviGenlik)),
    yere(binici(MAVI, maviMizrak, 0), maviEyer[0], maviEyer[1], maviYon, maviEyer[2]),
  );
  const kizil = birlestir(
    yere(at({ ...KIZIL.at, adim: faz + 0.3, genlik: atGenlik }), atX, -W, atYon, sicra(atGenlik)),
    yere(binici(KIZIL, kizilMizrak, egim), kalca[0], kalca[1], yon, kalca[2]),
  );
  return birlestir(mavi, kizil);
}

/** Düello alanı: ortada perde (tilt), iki uçta çadır ve sancak. Durağan. */
export function duelloAlani(): Model {
  const L = DUELLO_YARI;
  const m: Model = [];
  // Perde: iki sıra kalas, direkler, üstünde kırmızı-beyaz örtü.
  for (let x = -L + 4; x <= L - 4; x += 4)
    m.push(...kutu(x - 0.25, -0.25, 0, 0.5, 0.5, 3.6, P.koyuTahta));
  m.push(...kutu(-L + 4, -0.3, 2.4, 2 * L - 8, 0.6, 0.5, P.tahta));
  m.push(...kutu(-L + 4, -0.3, 3.4, 2 * L - 8, 0.6, 0.4, P.tahta));
  for (let i = 0; i < (2 * L - 8) / 4; i++)
    m.push(...kutu(-L + 4 + i * 4, -0.36, 2.2, 4, 0.72, 1.3, i % 2 ? '#efe6d6' : P.kirmiziBez));
  // Uçlarda çadırlar (mavi ve kızıl) ve yolun dış çiti.
  m.push(...cadir(-L - 11, 2, 7, 6, 6, P.maviBez, 'y'));
  m.push(...cadir(L + 4, -8, 7, 6, 6, P.kirmiziBez, 'y'));
  return m;
}

/* ── Tarla ─────────────────────────────────────────────────────────── */

export const SABAN_KARE = 24;
export const SABAN_SURE = 13;
/** Saban izinin yarı uzunluğu (figür birimi, x boyunca). */
export const SABAN_YARI = 16;
const SABAN_ADIM = 12;

const KOYLU: Insan = {
  ten: P.ten2,
  sac: P.sac2,
  govde: '#8a7458',
  etek: '#7a6448',
  bacak: '#6b5a45',
  cizme: P.deri,
  baslik: { tip: 'bone', renk: '#9a8a6a' },
};
const KOYLU_KADIN: Insan = {
  ten: P.ten1,
  sac: P.sac3,
  govde: '#8a5a48',
  etek: '#6a4a3a',
  bacak: '#6b5a45',
  cizme: P.deri,
  kadin: true,
  baslik: { tip: 'kukuleta', renk: '#c9b89a' },
};

/**
 * Saban takımı, +x'e bakıyor: önde öküz, arkasında saban, en arkada
 * sapından tutan köylü. `adim` yürüyüşün evresi.
 */
function sabanTakimi(adim: number): Model {
  // Öküz: atın gövdesi, iri ve kısa bacaklı; yelesiz, boynuzlu.
  const okuz = olcekle(
    at({ renk: '#7a5236', yele: '#6a4630', boynuz: '#e6dcc8', adim, genlik: 0.28 }),
    [1.0, 1.45, 0.85],
  );
  // Boyunduruk: öküzün boynundan sabana uzanan ok.
  const saban = birlestir(
    cubuk([2.2, 0, 5.2], [-6.2, 0, 1.4], 0.35, P.tahta),
    cubuk([-6.2, 0, 1.4], [-7.4, 0, 0.2], 0.4, P.koyuTahta),
    uzuv([-7.6, 0, 0.1], [-6.2, 0, 0.1], 0.35, 0.05, P.demir, 4),
    cubuk([-7.2, 0.5, 0.6], [-9.2, 0.7, 4.0], 0.26, P.koyuTahta),
    cubuk([-7.2, -0.5, 0.6], [-9.2, -0.7, 4.0], 0.26, P.koyuTahta),
  );
  const y = Math.sin(2 * Math.PI * adim);
  const kisi = tasi(
    dondur(
      insan({
        ...KOYLU,
        adim: y * 0.8,
        eller: { sag: [0.7, 1.5, 4.0], sol: [-0.7, 1.5, 4.0] },
      }),
      'z',
      -Math.PI / 2,
    ),
    [-10.7, 0, Math.abs(y) * 0.12],
  );
  return birlestir(okuz, saban, kisi);
}

/**
 * Saban turu: iz boyunca git, dön, geri gel, dön. Dönüşte takım yerinde
 * çeviriliyor. Tur başa sarınca aynı yerde.
 */
export function sabanPoz(t: number): Model {
  const F = SABAN_YARI;
  const x = izS(
    [
      [0, -F],
      [0.45, F],
      [0.5, F],
      [0.95, -F],
      [1, -F],
    ],
    t,
  );
  const yon = izS(
    [
      [0, 0],
      [0.45, 0],
      [0.5, Math.PI],
      [0.95, Math.PI],
      [1, 2 * Math.PI],
    ],
    t,
  );
  // Takımın ortası öküzle saban arası: dönerken orada dönsün.
  const orta = -4.5;
  const m = sabanTakimi(SABAN_ADIM * t);
  return tasi(dondur(tasi(m, [-orta, 0, 0]), 'z', yon), [x, 0, 0]);
}

export const ORAK_KARE = 16;
export const ORAK_SURE = 1.8;

/** Orak: sap ve kıvrık ağız, elden `d` yönüne. */
function orak(el: V3, d: V3): Model {
  const yan = birimV([-d[1], d[0], 0]);
  const sapUc = topla(el, kat(d, 1.0));
  const a = topla(sapUc, kat(d, 0.9));
  const b = topla(a, topla(kat(d, 0.5), kat(yan, 0.9)));
  const c = topla(b, topla(kat(d, -0.4), kat(yan, 0.9)));
  return birlestir(
    uzuv(el, sapUc, 0.18, 0.16, P.acikTahta, 4),
    uzuv(sapUc, a, 0.12, 0.1, P.celik, 4),
    uzuv(a, b, 0.1, 0.08, P.celik, 4),
    uzuv(b, c, 0.08, 0.03, P.celik, 4),
  );
}

/** Orakçı: öne eğilmiş, sol eli başakları topluyor, sağ el orağı savuruyor. İleri +y. */
export function orakciPoz(t: number): Model {
  const sag = izV(
    [
      [0, [1.8, 1.6, 2.6]],
      [0.35, [-0.9, 2.5, 2.1]],
      [0.5, [-0.8, 2.3, 2.3]],
      [0.85, [1.6, 1.3, 3.1]],
      [1, [1.8, 1.6, 2.6]],
    ],
    t,
  );
  const sol: V3 = [-0.9, 2.3, 2.7 + 0.2 * Math.sin(2 * Math.PI * t)];
  const d = birimV(
    izV(
      [
        [0, [-0.3, 1, -0.4]],
        [0.35, [-1, 0.4, -0.3]],
        [0.85, [0.2, 1, 0.2]],
        [1, [-0.3, 1, -0.4]],
      ],
      t,
    ),
  );
  const m = birlestir(insan({ ...KOYLU, eller: { sag, sol } }), orak(sag, d));
  // Eğilme: kalçadan öne, turda hafifçe inip kalkıyor.
  return dondur(m, 'x', -(0.5 + 0.08 * Math.sin(2 * Math.PI * t)));
}

export const DEMET_KARE = 24;
export const DEMET_SURE = 3.4;

/** Demet: sarı saplar, ortasından bağlı. Figür biriminde, dik. */
function demet(q: V3): Model {
  return birlestir(
    silindir(q[0], q[1], q[2] - 1.5, 0.75, 3.0, P.saman, 7),
    koni(q[0], q[1], q[2] + 1.5, 0.85, 0.7, isikla(P.saman, 1.08), 7),
    silindir(q[0], q[1], q[2] - 0.1, 0.8, 0.3, P.koyuTahta, 7),
  );
}

/** Demetin yığına konduğu yer (demetçinin sağında). */
const YIGIN: V3 = [4.2, 0.4, 0];

/**
 * Demetçi (kadın): yerden demeti alıp sağındaki yığına koyuyor. İleri +y;
 * yığın `YIGIN`da, durağan (bkz. `demetYigini`).
 */
export function demetciPoz(t: number): Model {
  const egim = izS(
    [
      [0, 0.05],
      [0.2, 0.7],
      [0.3, 0.7],
      [0.45, 0.1],
      [0.62, 0.35],
      [0.72, 0.1],
      [1, 0.05],
    ],
    t,
  );
  const don = izS(
    [
      [0, 0],
      [0.42, 0],
      [0.6, -1.3],
      [0.74, -1.3],
      [0.9, 0],
      [1, 0],
    ],
    t,
  );
  const eller = izV(
    [
      [0, [0, 1.3, 3.9]],
      [0.2, [0, 2.4, 2.0]],
      [0.3, [0, 2.4, 2.0]],
      [0.45, [0, 1.6, 4.4]],
      [0.62, [0, 2.2, 4.0]],
      [0.72, [0, 1.3, 3.9]],
      [1, [0, 1.3, 3.9]],
    ],
    t,
  );
  const sag = topla(eller, [0.6, 0, 0]);
  const sol = topla(eller, [-0.6, 0, 0]);
  const kisi = dondur(insan({ ...KOYLU_KADIN, eller: { sag, sol } }), 'x', -egim);
  const kisiDonuk = dondur(kisi, 'z', don);
  // Demetin yeri: yerde (başta), elde (0.25–0.66), yığının tepesinde (sonra).
  const yerdeki: V3 = [0, 2.6, 1.5];
  const yiginUstu = topla(YIGIN, [0, 0, 4.2]);
  let q: V3;
  if (t < 0.25) q = yerdeki;
  else if (t < 0.66) {
    // Elin dünyadaki yeri: eğilme ve dönüşle birlikte.
    const el = dondur(dondur([{ p: [eller], renk: '' }], 'x', -egim), 'z', don)[0]!.p[0]!;
    q = topla(el, [0, 0, -0.4]);
  } else if (t < 0.96) q = yiginUstu;
  else q = topla(YIGIN, [0, 0, 1.2]);
  return birlestir(kisiDonuk, demet(q));
}

/** Demet yığını (durağan): demetçinin sağında, birbirine yaslanmış demetler. */
export function demetYigini(): Model {
  const m: Model = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.push(...demet([YIGIN[0] + Math.cos(a) * 0.9, YIGIN[1] + Math.sin(a) * 0.9, 1.5]));
  }
  m.push(...demet([YIGIN[0], YIGIN[1], 2.7]));
  return m;
}

/** Durağan köylü (seyirci): canlı değil, duruş salınımı var (`insan`). */
export function seyirci(i: number): Model {
  const kiyafet = [KOYLU, KOYLU_KADIN, { ...KOYLU, govde: '#6a5a78', baslik: undefined }];
  return insan({ ...kiyafet[i % kiyafet.length]!, sac: [P.sac1, P.sac2, P.sac4][i % 3] });
}
