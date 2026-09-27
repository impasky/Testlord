/**
 * BİRLİK, DÜŞMAN VE EKİPMAN ÇİZİMLERİ (docs/24).
 *
 * Birlik: milis, mızrakçı, okçu, süvari, mancınık — Kışla, dizilim, ordu
 * sahnesi. Düşman: akın gruplarının beş halkı, her biri er ve şef. Ekipman:
 * altı yuva × beş kademe — Demirhane, Lord ekranı, akın ganimeti.
 *
 * Kademe dili bütün ekipmanda aynı: 1 kaba demir · 2 parlak çelik ·
 * 3 mavi çelik ve altın kenar · 4 altın · 5 kara ve içinden yanan. Oyuncu
 * kalkanla kılıcı yan yana görünce kademeyi renkten okuyabilmeli.
 */
import { at, insan, kalkan, kilicModeli, mancinik, type AtAyari, type Insan } from './figur';
import { kubbe, uzuv } from './parca';
import { P, isikla } from './renk';
import {
  dondur,
  koni,
  kure,
  kutu,
  levha,
  olcekle,
  silindir,
  tasi,
  type Model,
  type V3,
} from './uc';

/** Dörtte üç bakış: kameraya dönük, bir tık ekranın sağına. */
const bak = (m: Model, aci = 0.35): Model => dondur(m, 'z', -Math.PI / 4 + aci);

/* ── Birlikler ─────────────────────────────────────────────────────── */

const MIZRAKCI: Insan = {
  ten: P.ten1,
  sac: P.sac2,
  govde: P.maviBez,
  bacak: '#4a4038',
  cizme: P.deri,
  kol: '#8a8f94',
  zirh: { tip: 'zincir', renk: '#8a8f94' },
  tabard: '#e2d8c0',
  baslik: { tip: 'migfer', renk: P.celik },
  sag: { tip: 'mizrak' },
  sol: { tip: 'kalkan', renk: '#e2d8c0', ikinci: P.kirmiziBez },
};

function suvari(): Model {
  const binici = insan({
    ten: P.ten1,
    govde: P.celik,
    bacak: '#8a8f94',
    cizme: '#6f757c',
    kol: P.celik,
    zirh: { tip: 'plaka', renk: P.celik },
    tabard: P.maviBez,
    omuz: P.celik,
    baslik: { tip: 'kapali', renk: P.celik, ikinci: P.maviBez },
    sag: { tip: 'kargi' },
    sol: { tip: 'kalkan', renk: P.maviBez, ikinci: P.altin },
    oturan: true,
  });
  const m = at({ renk: '#c9c4ba', yele: '#8a847a', eyer: P.deri, ortu: P.maviBez });
  // Binici atın ölçeğine: kalçası eyerde (5.55).
  const o = 0.74;
  m.push(...tasi(olcekle(dondur(binici, 'z', -Math.PI / 2), o), [-0.25, 0, 5.55 - 3.2 * o]));
  return bak(m, 0.3);
}

const BIRLIK: Record<string, () => Model> = {
  milis: () =>
    bak(
      insan({
        ten: P.ten2,
        sac: P.sac2,
        govde: '#8a7458',
        etek: '#7a6448',
        bacak: '#6b5a45',
        cizme: '#5a4530',
        baslik: { tip: 'kukuleta', renk: '#7a6a52' },
        sag: { tip: 'yaba' },
      }),
    ),
  mizrakci: () => bak(insan(MIZRAKCI)),
  okcu: () =>
    bak(
      insan({
        ten: P.ten1,
        sac: P.sac3,
        govde: '#5a6b3a',
        bacak: '#5a4a38',
        cizme: P.deri,
        kol: '#6b5a40',
        zirh: { tip: 'deri', renk: '#7a5a38' },
        baslik: { tip: 'kukuleta', renk: '#4a5a30' },
        sol: { tip: 'yay' },
        sadak: true,
        poz: 'nisan',
      }),
      0.1,
    ),
  suvari,
  kusatma: () => bak(mancinik(), 0.55),
};

/* ── Düşmanlar ─────────────────────────────────────────────────────── */

const DUSMAN: Record<string, () => Model> = {
  barbar: () =>
    bak(
      insan({
        ten: P.ten2,
        sac: '#a0582a',
        sakal: '#a0582a',
        govde: '#6b5a45',
        bacak: '#5a4a3a',
        cizme: '#6e5a44',
        kol: P.ten2,
        kurk: '#8a7a64',
        sag: { tip: 'balta' },
      }),
    ),
  barbar_sef: () =>
    bak(
      insan({
        ten: P.ten2,
        sakal: '#a0582a',
        govde: '#5a4a3a',
        bacak: '#4a3c30',
        cizme: '#6e5a44',
        kol: P.ten2,
        kurk: '#9a8a74',
        pelerin: '#5a4a3a',
        zirh: { tip: 'deri', renk: '#6b4a2e' },
        baslik: { tip: 'boynuz', renk: '#7a7a78' },
        sag: { tip: 'ciftBalta' },
        iri: 1.15,
      }),
    ),
  eskiya: () =>
    bak(
      insan({
        ten: P.ten1,
        sac: P.sac1,
        sakal: P.sac1,
        govde: '#6b5236',
        bacak: '#4a4038',
        cizme: P.deri,
        zirh: { tip: 'deri', renk: '#5a4228' },
        baslik: { tip: 'bant', renk: P.kirmiziBez },
        sag: { tip: 'balta', renk: '#8a8f94' },
        sol: { tip: 'yuvarlakKalkan', renk: '#7a5a38', ikinci: P.demir },
      }),
    ),
  eskiya_sef: () =>
    bak(
      insan({
        ten: P.ten1,
        sakal: P.sac1,
        govde: '#2f5a3a',
        etek: '#2a4a32',
        bacak: '#3a3430',
        cizme: '#2a221c',
        pelerin: '#244a2e',
        kemer: '#3a2a1a',
        baslik: { tip: 'sapka', renk: '#2f4a30', ikinci: '#e2d8c0' },
        sag: { tip: 'kilic' },
        iri: 1.08,
      }),
    ),
  haydut: () =>
    bak(
      insan({
        ten: P.ten3,
        sakal: P.sac1,
        govde: '#4a4038',
        bacak: '#3a3430',
        cizme: '#2a221c',
        zirh: { tip: 'deri', renk: '#3c332c' },
        baslik: { tip: 'kukuleta', renk: '#3a3430' },
        sag: { tip: 'cekic' },
      }),
    ),
  haydut_sef: () =>
    bak(
      insan({
        ten: P.ten3,
        govde: '#2e2b33',
        bacak: '#26232a',
        cizme: '#1d1a20',
        kol: '#3a3740',
        zirh: { tip: 'plaka', renk: '#3a3740' },
        omuz: '#3a3740',
        pelerin: '#1d1a20',
        baslik: { tip: 'kapali', renk: '#3a3740' },
        sag: { tip: 'kilic', renk: '#2e2b33', ikinci: '#5a4a6a', isik: P.ates },
        iri: 1.12,
      }),
    ),
  kultist: () =>
    bak(
      insan({
        ten: '#b8ae9a',
        govde: '#6e6a60',
        etek: '#5f5b52',
        bacak: '#5f5b52',
        cizme: '#4a463e',
        zirh: { tip: 'serit', renk: '#7a766b' },
        baslik: { tip: 'kukuleta', renk: '#5f5b52' },
        sol: { tip: 'fener', isik: P.buyu },
      }),
    ),
  kultist_sef: () =>
    bak(
      insan({
        ten: '#b8ae9a',
        govde: '#2f5a5a',
        etek: '#264a4a',
        bacak: '#264a4a',
        cizme: '#1d3a3a',
        kol: '#2f5a5a',
        pelerin: '#1d3a3a',
        kemer: P.koyuAltin,
        baslik: { tip: 'maske', renk: '#264a4a', ikinci: P.altin },
        sag: { tip: 'asa', ikinci: P.altin, isik: P.buyu },
        iri: 1.08,
      }),
    ),
  lejyoner: () =>
    bak(
      insan({
        ten: P.ten2,
        govde: P.kirmiziBez,
        bacak: P.ten2,
        cizme: P.deri,
        kol: P.ten2,
        zirh: { tip: 'serit', renk: P.celik },
        omuz: P.celik,
        baslik: { tip: 'migfer', renk: P.celik },
        sag: { tip: 'kilic' },
        sol: { tip: 'scutum', renk: P.kirmiziBez, ikinci: P.altin },
      }),
    ),
  lejyoner_sef: () =>
    bak(
      insan({
        ten: P.ten2,
        govde: P.kirmiziBez,
        bacak: P.ten2,
        cizme: P.deri,
        kol: P.ten2,
        zirh: { tip: 'plaka', renk: '#c0a060' },
        omuz: '#c0a060',
        pelerin: P.kirmiziBez,
        baslik: { tip: 'sorguc', renk: P.celik, ikinci: P.kirmiziBez },
        sag: { tip: 'sancak', renk: P.kirmiziBez, ikinci: P.altin },
        iri: 1.1,
      }),
    ),
};

/* ── Ekipman ───────────────────────────────────────────────────────── */

interface Kademe {
  renk: string;
  kenar: string;
  susu?: string;
  isik?: string;
}

const KADEME: Record<number, Kademe> = {
  1: { renk: '#77736b', kenar: P.koyuTahta },
  2: { renk: '#a8b0b8', kenar: '#7d858d' },
  3: { renk: '#4f6f9a', kenar: P.altin, susu: '#d9ccab' },
  4: { renk: P.altin, kenar: P.koyuAltin, susu: '#c0392b' },
  5: { renk: '#2e2b33', kenar: '#6a5a3a', susu: P.kor, isik: P.kor },
};

const KARA = '#1d1612';

function kalkanT(t: number): Model {
  const k = KADEME[t]!;
  const m = kalkan('kalkan', 3, k.renk, k.kenar, t === 3 || t === 4 ? k.susu : undefined, k.isik);
  // Göbek ve perçinler
  m.push(
    ...kure(
      0,
      0.3,
      0.8,
      t >= 3 ? 0.5 : 0.35,
      t >= 3 ? k.kenar : isikla(k.renk, 0.8),
      6,
      3,
      0,
      undefined,
      0.6,
    ),
  );
  if (t === 1) {
    // Kaba demir: iki kayış
    for (const z of [-0.8, 1.6]) m.push(...kutu(-1.8, 0.2, z, 3.6, 0.08, 0.4, P.deri));
  }
  return dondur(m, 'z', -Math.PI / 4 + 0.3);
}

function migferT(t: number): Model {
  const k = KADEME[t]!;
  const m: Model = [];
  if (t === 1) {
    // Burun siperli konik miğfer + deri çene kayışı
    m.push(...kubbe(0, 0, 0.3, 2, k.renk, 10, 3));
    m.push(...koni(0, 0, 1.6, 0.9, 1.4, k.renk, 10, 0.1));
    m.push(...silindir(0, 0, 0, 2.08, 0.4, isikla(k.renk, 0.85), 10));
    m.push(...kutu(-0.2, 1.9, -0.9, 0.4, 0.25, 1.1, isikla(k.renk, 0.85)));
  } else {
    // Kapalı miğfer: silindir gövde, kubbe tepe, göz yarığı
    m.push(...silindir(0, 0, -2.4, 1.9, 2.8, k.renk, 12));
    m.push(...kubbe(0, 0, 0.4, 1.9, k.renk, 12, 3));
    // Yarık silindirin görünen yüzünde kalsın: dışa taşınca çubuk gibi duruyordu.
    m.push(...kutu(-0.75, 1.62, -0.35, 1.5, 0.35, 0.32, KARA));
    m.push(...kutu(-0.15, 1.74, -2.0, 0.3, 0.28, 1.4, KARA));
    // Delikler (nefes)
    for (let i = 0; i < 3; i++) m.push(...kutu(0.5 + i * 0.35, 1.6, -1.5, 0.16, 0.3, 0.16, KARA));
    if (t >= 3) {
      m.push(...silindir(0, 0, -2.5, 1.98, 0.3, k.kenar, 12));
      m.push(...silindir(0, 0, 0.3, 1.96, 0.22, k.kenar, 12));
    }
    if (t === 4) {
      m.push(...kure(0, 1.95, 0.6, 0.3, k.susu!, 6, 3));
      m.push(...koni(0, -0.3, 2.3, 0.5, 2.2, P.kirmiziBez, 6));
    }
    if (t === 5) {
      const yarik = kutu(-0.7, 1.66, -0.33, 1.4, 0.34, 0.28, k.isik!);
      for (const y of yarik) y.isima = 1;
      m.push(...yarik);
      for (const s of [-1, 1])
        m.push(...uzuv([s * 1.4, 0, 1.2], [s * 2.2, 0.2, 3.0], 0.35, 0.05, k.kenar, 5));
    }
  }
  return dondur(m, 'z', -Math.PI / 4 + 0.35);
}

function silahT(t: number): Model {
  const k = KADEME[t]!;
  const kabza = t === 1 ? P.demir : t === 2 ? '#7d858d' : k.kenar;
  const m = kilicModeli(11, k.renk, kabza, k.isik);
  if (t === 4) m.push(...kure(0, 0, -0.1, 0.35, k.susu!, 6, 3));
  return dondur(dondur(m, 'y', 0.12), 'z', -Math.PI / 4);
}

function zirhT(t: number): Model {
  const k = KADEME[t]!;
  const m: Model = [];
  const yassi = (mm: Model) => olcekle(mm, [1, 0.62, 1]);
  m.push(...yassi(koni(0, 0, 0, 2.0, 3.6, k.renk, 10, 2.55)));
  m.push(...yassi(silindir(0, 0, 3.6, 1.1, 0.3, KARA, 10)));
  m.push(...yassi(silindir(0, 0, -0.35, 2.05, 0.45, t === 1 ? P.deri : isikla(k.renk, 0.8), 10)));
  // Omuzluklar: iki kat
  for (const s of [-1, 1]) {
    // İki kat lam: omzu saran basık kubbeler, dışa doğru kayık
    m.push(
      ...olcekle(kubbe(s * 2.2, 0, 2.3, 1.15, k.renk, 10, 3), [1, 0.9, 0.8], [s * 2.2, 0, 2.3]),
    );
    m.push(
      ...olcekle(
        kubbe(s * 2.55, 0, 1.75, 1.0, isikla(k.renk, 0.9), 10, 2),
        [1, 0.9, 0.7],
        [s * 2.55, 0, 1.75],
      ),
    );
  }
  // Göğüs sırtı (orta çizgi) ve kademe süsü
  m.push(...kutu(-0.1, 1.45, 0.3, 0.2, 0.12, 3.1, t >= 3 ? k.kenar : isikla(k.renk, 0.85)));
  if (t >= 3)
    for (const z of [0.5, 3.2])
      m.push(...yassi(koni(0, 0, z, 2.05 + z * 0.15, 0.2, k.kenar, 10, 2.07 + z * 0.15)));
  if (t === 4) m.push(...kure(0, 1.6, 2.4, 0.35, k.susu!, 6, 3));
  if (t === 5)
    for (const s of [-1, 1]) {
      const cizgi: Model = [
        {
          p: [
            [s * 0.4, 1.48, 0.6],
            [s * 1.2, 1.42, 2.6],
            [s * 1.35, 1.42, 2.5],
            [s * 0.55, 1.48, 0.5],
          ],
          renk: k.isik!,
          isima: 1,
          ciftYuz: true,
        },
      ];
      m.push(...cizgi);
    }
  return dondur(m, 'z', -Math.PI / 4 + 0.3);
}

function sancakT(t: number): Model {
  const renkler = ['#e2d8c0', P.kirmiziBez, '#e2d8c0', '#6a1f1a', P.altin];
  const armalar = [undefined, '#e2d8c0', P.maviBez, P.altin, '#2e2b33'];
  const bez = renkler[t - 1]!;
  const arma = armalar[t - 1];
  const m: Model = uzuv([0, 0, 0], [0, 0, 13], 0.18, 0.15, P.koyuTahta, 6);
  m.push(...kutu(-2.3, -0.1, 11.6, 4.6, 0.2, 0.25, P.koyuTahta));
  m.push(...koni(0, 0, 13, t >= 4 ? 0.45 : 0.3, 1, t >= 3 ? P.altin : P.demir, 5));
  const alt = t === 1 ? 5.6 : 5.2;
  const kenar: V3[] =
    t === 1
      ? [
          [-2.1, 0.05, 11.6],
          [2.1, 0.05, 11.6],
          [2.1, 0.05, alt + 0.8],
          [1.2, 0.05, alt + 0.2],
          [0.3, 0.05, alt + 0.9],
          [-0.8, 0.05, alt],
          [-2.1, 0.05, alt + 0.6],
        ]
      : [
          [-2.1, 0.05, 11.6],
          [2.1, 0.05, 11.6],
          [2.1, 0.05, alt + 1],
          [0, 0.05, alt],
          [-2.1, 0.05, alt + 1],
        ];
  m.push(...levha(kenar, bez));
  if (t >= 3)
    m.push(
      ...levha(
        [
          [-2.2, 0.08, 11.7],
          [2.2, 0.08, 11.7],
          [2.2, 0.08, 11.3],
          [-2.2, 0.08, 11.3],
        ],
        t === 5 ? '#2e2b33' : P.altin,
      ),
    );
  if (arma) {
    if (t === 2)
      m.push(
        ...levha(
          [
            [-1.6, 0.1, 8.2],
            [0, 0.1, 9.8],
            [1.6, 0.1, 8.2],
            [1.6, 0.1, 7.4],
            [0, 0.1, 9.0],
            [-1.6, 0.1, 7.4],
          ],
          arma,
        ),
      );
    else {
      const yildiz: V3[] = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const r = i % 2 ? 0.55 : 1.35;
        return [Math.cos(a) * r, 0.1, 8.9 + Math.sin(a) * r];
      });
      m.push({ p: yildiz, renk: arma, ciftYuz: true, isima: t === 5 ? 0 : undefined });
      if (t === 5) {
        const ic: V3[] = yildiz.map(([x, y, z]): V3 => [x * 0.5, y + 0.03, 8.9 + (z - 8.9) * 0.5]);
        m.push({ p: ic, renk: P.kor, ciftYuz: true, isima: 1 });
      }
    }
  }
  return dondur(m, 'z', -Math.PI / 4 + 0.25);
}

const AT_KADEME: AtAyari[] = [
  { renk: '#7a5a3a', yele: '#3a2a1c' },
  { renk: '#9a5a32', yele: '#4a2a18', eyer: P.deri },
  { renk: '#c9c4ba', yele: '#8a847a', eyer: P.deri, ortu: P.maviBez },
  { renk: '#c9a060', yele: '#e8d8a8', eyer: P.koyuAltin, ortu: '#8a2a22', zirh: P.altin },
  {
    renk: '#2e2a2a',
    yele: '#1d1a1a',
    eyer: '#3a3740',
    ortu: '#26232a',
    zirh: '#4a4650',
    alev: true,
  },
];

function atT(t: number): Model {
  return dondur(at(AT_KADEME[t - 1]!), 'z', -Math.PI / 4 + 0.45);
}

const EKIPMAN_YUVALARI = ['at', 'kalkan', 'migfer', 'sancak', 'silah', 'zirh'] as const;
const YUVA_CIZICI: Record<(typeof EKIPMAN_YUVALARI)[number], (t: number) => Model> = {
  at: atT,
  kalkan: kalkanT,
  migfer: migferT,
  sancak: sancakT,
  silah: silahT,
  zirh: zirhT,
};

/* ── Dışa açılan ───────────────────────────────────────────────────── */

export const BIRLIK_ADLARI = Object.keys(BIRLIK);
export const DUSMAN_ADLARI = Object.keys(DUSMAN);
export const EKIPMAN_ADLARI = EKIPMAN_YUVALARI.flatMap((y) =>
  [1, 2, 3, 4, 5].map((t) => `${y}_t${t}`),
);

export function birlikModeli(ad: string): Model | null {
  return BIRLIK[ad]?.() ?? null;
}

export function dusmanModeli(ad: string): Model | null {
  return DUSMAN[ad]?.() ?? null;
}

export function ekipmanModeli(ad: string): Model | null {
  const m = /^(\w+)_t([1-5])$/.exec(ad);
  if (!m) return null;
  const ciz = YUVA_CIZICI[m[1] as keyof typeof YUVA_CIZICI];
  return ciz ? ciz(Number(m[2])) : null;
}
