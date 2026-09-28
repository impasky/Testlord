/**
 * EKRAN ZEMİNLERİ — her sekmenin tepesindeki manzara şeridi (docs/24).
 *
 * Şerit ekranı bir mekâna oturtuyor: Kışla bir talim avlusu, Demirhane
 * ocağın başı, Generaller harita masası (docs/08 İ11). Her sahne o
 * ekranın şehirdeki BİNASI (binalar.ts, en üst aşaması) ve önünde o
 * ekranın insanlarından kuruluyor — şehirde gördüğün yapı, kapısından
 * girince açılan ekranın tepesinde de aynı.
 *
 * Kadraj 60×23 (şerit ~2.6:1). Şeridin alt üçte ikisi başlığın arkasında
 * koyulaşıyor; asıl konu üst yarıda duruyor.
 */
import { arazi, ekrandanYere, gurultu, type Nokta } from './arazi';
import { ates, binaModeli, kukla, mizrakSehpasi, ocak, ors } from './binalar';
import { birlikModeli } from './birlikler';
import { insan } from './figur';
import { araba, tezgah } from './kir';
import { generalModeli, lordModeli } from './kisiler';
import { agac, bayrak, cadir, cam, duman, fici } from './parca';
import { P, karistir } from './renk';
import { rastgele } from './rastgele';
import { dondur, kutu, levha, olcekle, tasi, type Model } from './uc';

export const ZEMIN_ADLARI = [
  'malikane',
  'kisla',
  'demirhane',
  'generaller',
  'siralama',
  'gorevler',
  'olaylar',
  'arastirma',
  'akin',
  'ittifak',
  'pazar',
] as const;
export type ZeminAdi = (typeof ZEMIN_ADLARI)[number];

export const ZEMIN_KUTUSU: [number, number, number, number] = [-30, -15, 60, 23];
const yer = ekrandanYere(ZEMIN_KUTUSU);

/** Şehir binası, plakasız (zemin sahnenin kendi arazisi), ayak izi merkezi `p`de. */
function bina(ad: string, p: Nokta): Model {
  return tasi(
    binaModeli(ad).filter((f) => f.katman !== -2),
    [p[0] - 8, p[1] - 8, 0],
  );
}

/** Figür: binalara göre küçültülmüş. */
function figur(m: Model | null, p: Nokta, s = 0.78): Model {
  return m ? tasi(olcekle(m, s), [p[0], p[1], 0]) : [];
}

/** Altın heykel: lordun beşinci kuşamı, baştan ayağa altın, kaide üstünde. */
function heykel(p: Nokta): Model {
  const altin = P.altin;
  const m = insan({
    ten: altin,
    govde: altin,
    bacak: altin,
    cizme: altin,
    kol: altin,
    zirh: { tip: 'plaka', renk: altin },
    omuz: P.koyuAltin,
    pelerin: P.koyuAltin,
    sag: { tip: 'kilic', renk: altin, ikinci: P.koyuAltin },
  });
  // Heykel kıpırdamıyor.
  for (const y of m) delete y.bez;
  return [
    ...kutu(p[0] - 1.6, p[1] - 1.6, 0, 3.2, 3.2, 2, P.acikTas),
    ...tasi(olcekle(dondur(m, 'z', -Math.PI / 4 + 0.35), 0.8), [p[0], p[1], 2]),
  ];
}

/** Harita masası: ayaklı tahta, üstünde parşömen harita ve piyonlar. */
function haritaMasasi(p: Nokta): Model {
  const [x, y] = p;
  const m = kutu(x - 3, y - 2, 1.6, 6, 4, 0.3, P.koyuTahta);
  for (const [dx, dy] of [
    [-2.7, -1.7],
    [2.4, -1.7],
    [-2.7, 1.4],
    [2.4, 1.4],
  ])
    m.push(...kutu(x + dx!, y + dy!, 0, 0.3, 0.3, 1.6, P.koyuTahta));
  m.push(
    ...levha(
      [
        [x - 2.6, y - 1.6, 1.92],
        [x + 2.6, y - 1.6, 1.92],
        [x + 2.6, y + 1.6, 1.92],
        [x - 2.6, y + 1.6, 1.92],
      ],
      '#d9c8a0',
    ),
  );
  for (const [dx, dy, renk] of [
    [-1.2, -0.5, P.kirmiziBez],
    [0.6, 0.4, P.maviBez],
    [1.5, -0.8, P.kirmiziBez],
    [-0.2, 0.9, P.maviBez],
  ] as [number, number, string][])
    m.push(...kutu(x + dx - 0.18, y + dy - 0.18, 1.92, 0.36, 0.36, 0.5, renk));
  return m;
}

interface Sahne {
  /** Arazi rengi: iki çayır tonu. */
  cayir?: [string, string];
  /** Ağaçlardan boş tutulacak ekran bölgeleri (yüzde: x0, y0, x1, y1). */
  bos: [number, number, number, number][];
  kur: (r: () => number) => Model;
}

const ASKER = (ad: string, p: Nokta, s = 0.78) => figur(birlikModeli(ad), p, s);
const GENERAL = (ad: string, p: Nokta, s = 0.78) => figur(generalModeli(ad), p, s);

const SAHNELER: Record<ZeminAdi, Sahne> = {
  malikane: {
    bos: [[24, 20, 70, 100]],
    kur: () => [
      ...bina('malikane_5', yer(46, 78)),
      ...ASKER('mizrakci', yer(28, 88)),
      ...ASKER('mizrakci', yer(66, 90)),
      ...bayrak(...yer(22, 72), 0, 7, P.kirmiziBez),
      ...bayrak(...yer(72, 72), 0, 7, P.kirmiziBez),
    ],
  },
  kisla: {
    bos: [[10, 20, 92, 100]],
    kur: () => [
      ...bina('kisla_5', yer(28, 78)),
      ...ASKER('mizrakci', yer(52, 84)),
      ...ASKER('mizrakci', yer(58, 90)),
      ...ASKER('mizrakci', yer(64, 96)),
      ...ASKER('milis', yer(68, 82)),
      ...ASKER('okcu', yer(76, 88)),
      ...kukla(...yer(86, 78)),
      ...mizrakSehpasi(...yer(46, 70)),
    ],
  },
  demirhane: {
    bos: [[20, 20, 82, 100]],
    kur: (r) => [
      ...bina('demirhane_5', yer(40, 78)),
      ...ors(...yer(62, 86)),
      ...ocak(...yer(70, 78)),
      ...duman(...yer(71, 77), 3.5, r, 3),
      ...GENERAL('demirci_yusuf', yer(56, 92)),
      ...fici(...yer(76, 90)),
    ],
  },
  generaller: {
    bos: [[12, 20, 86, 100]],
    kur: () => [
      ...bina('karargah_5', yer(28, 78)),
      ...haritaMasasi(yer(64, 84)),
      ...GENERAL('kumandan_alparslan', yer(56, 94)),
      ...GENERAL('sovalye_doruk', yer(76, 92)),
      ...GENERAL('casus_leyla', yer(70, 76)),
    ],
  },
  siralama: {
    bos: [[18, 20, 84, 100]],
    kur: () => [
      ...bina('onur_meydani', yer(50, 80)),
      ...heykel(yer(28, 80)),
      ...heykel(yer(72, 80)),
      ...bayrak(...yer(38, 66), 0, 8, P.altin),
      ...bayrak(...yer(62, 66), 0, 8, P.altin),
    ],
  },
  gorevler: {
    bos: [[24, 20, 84, 100]],
    kur: () => [
      ...bina('gorev_panosu', yer(46, 80)),
      ...ASKER('okcu', yer(38, 92)),
      ...ASKER('milis', yer(58, 92)),
      ...araba(...yer(74, 84), 0, 'x', P.saman),
    ],
  },
  olaylar: {
    bos: [[22, 20, 84, 100]],
    kur: () => [...bina('haberci_kulesi', yer(40, 78)), ...ASKER('suvari', yer(68, 88), 0.62)],
  },
  arastirma: {
    bos: [[20, 20, 82, 100]],
    kur: () => [
      ...bina('kutuphane_5', yer(40, 78)),
      ...GENERAL('vaiz_bertan', yer(62, 90)),
      ...GENERAL('erzakci_meryem', yer(72, 82)),
    ],
  },
  akin: {
    cayir: ['#6b7248', '#8a8a58'],
    bos: [[16, 20, 90, 100]],
    kur: (r) => [
      ...tasi(cadir(...yer(24, 74), 6.5, 5, 4.6, P.kirmiziBez, 'x'), [0, 0, 0]),
      ...tasi(cadir(...yer(40, 64), 6.5, 5, 4.6, '#d9ccab', 'y'), [0, 0, 0]),
      ...ates(...yer(40, 84)),
      ...duman(...yer(41, 83), 2.4, r, 2),
      ...ASKER('suvari', yer(58, 86), 0.62),
      ...ASKER('mizrakci', yer(68, 92)),
      ...ASKER('okcu', yer(74, 84)),
      ...ASKER('milis', yer(82, 92)),
      ...bayrak(...yer(50, 70), 0, 7, P.kirmiziBez),
    ],
  },
  ittifak: {
    bos: [[16, 20, 84, 100]],
    kur: () => [
      ...bina('elcilik_5', yer(46, 78)),
      ...bayrak(...yer(22, 72), 0, 7, P.maviBez),
      ...bayrak(...yer(30, 82), 0, 7, P.kirmiziBez),
      ...bayrak(...yer(64, 82), 0, 7, P.bakir),
      ...bayrak(...yer(72, 72), 0, 7, P.altin),
      ...figur(lordModeli('lord_4'), yer(38, 94)),
      ...figur(lordModeli('lord_5'), yer(56, 94)),
    ],
  },
  pazar: {
    bos: [[14, 20, 84, 100]],
    kur: () => [
      ...bina('pazar_5', yer(32, 78)),
      ...tezgah(...yer(56, 80), 0, P.kirmiziBez),
      ...tezgah(...yer(66, 88), 0, P.maviBez),
      ...tezgah(...yer(74, 78), 0, '#b0753a'),
      ...GENERAL('erzakci_meryem', yer(60, 94)),
      ...ASKER('milis', yer(72, 96)),
    ],
  },
};

export function zeminModeli(ad: string): Model | null {
  const s = SAHNELER[ad as ZeminAdi];
  if (!s) return null;
  const g = gurultu('zemin:' + ad);
  const r = rastgele('zemin:' + ad);
  const [c1, c2] = s.cayir ?? ['#56753a', '#8f9e4e'];
  const m = arazi({
    cerceve: ZEMIN_KUTUSU,
    adim: 3,
    h: (x, y) => (g(x, y, 14, 2) - 0.5) * 0.5,
    renk: (x, y) => karistir(c1, c2, g(x + 30, y - 10, 10, 2)),
    r: rastgele('zemin-arazi:' + ad),
  });
  m.push(...s.kur(r));
  // Kenarlara ağaç: boş tutulan bölgelerin dışına
  let kalan = 14;
  let d = 0;
  while (kalan > 0 && d++ < 400) {
    const px = r() * 104 - 2;
    const py = 10 + r() * 90;
    if (s.bos.some(([x0, y0, x1, y1]) => px > x0 && px < x1 && py > y0 && py < y1)) continue;
    const [x, y] = yer(px, py);
    m.push(...(r() < 0.35 ? cam(x, y, 0, r, 0.9) : agac(x, y, 0, r, 0.9 + r() * 0.3)));
    kalan--;
  }
  return m;
}
