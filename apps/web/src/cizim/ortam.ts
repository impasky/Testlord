/**
 * Canlı sahnenin ortam katmanları (docs/24 "Hareket", "Ortam tuvali"): su
 * parıltısı, çimende rüzgâr, ışık titremesi. Desenler ve zamanlama tek
 * yerde: CSS katmanları (`Sahne.HareketKatmani`, styles.css) ve ortam
 * tuvali (`ortamIsci.ts`) aynı hareketi çiziyor. Süreler ve saydamlıklar
 * styles.css'tekilerle aynı olmalı (`.hareket-su`, `.hareket-cimen`,
 * `.hareket-isik`); biri değişirse öbürü de.
 */

/** Tohumlu rastgele: dokular her açılışta aynı. */
export function tohumlu(t: number): () => number {
  return () => (t = (t * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Tuvalin 2B çizimi: sayfada `<canvas>`, işçide `OffscreenCanvas`. */
export type Ciz2B = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Yumuşak kenarlı elips leke; karonun dört yanına sarılarak (dikişsiz). */
export function leke(
  c: Ciz2B,
  en: number,
  boy: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  renk: string,
) {
  for (const ox of [-en, 0, en])
    for (const oy of [-boy, 0, boy]) {
      c.save();
      c.translate(x + ox, y + oy);
      c.scale(rx, ry);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, renk);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 1, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
}

/** Suyun parıltısı: yatık, ince ışık çizgileri (CSS pikselinde; suyun dalgasıyla aynı boy). */
export const SU_KARO: [number, number] = [256, 128];
export function suDeseni(c: Ciz2B) {
  const r = tohumlu(7);
  for (let i = 0; i < 36; i++)
    leke(
      c,
      ...SU_KARO,
      r() * SU_KARO[0],
      r() * SU_KARO[1],
      7 + r() * 12,
      0.8 + r() * 0.7,
      `rgba(255,255,255,${(0.35 + r() * 0.45).toFixed(2)})`,
    );
}

/**
 * Çimenin rüzgâr dalgası: rüzgâra dik uzamış, iri ve çok yumuşak açık
 * bantlar (eğilen otların ışığı yakalaması), aralarında hafif gölge. Karo
 * çimen maskesinin (yer ve ot tutamları) üstünden rüzgâr yönünde kayıyor;
 * dokuyu otların kendisi veriyor. Rüzgâr dumanla aynı yönde (sola).
 */
export const RUZGAR_KARO: [number, number] = [640, 320];
export function ruzgarDeseni(c: Ciz2B) {
  const r = tohumlu(23);
  for (let i = 0; i < 9; i++) {
    const acik = i % 3 < 2;
    leke(
      c,
      ...RUZGAR_KARO,
      r() * RUZGAR_KARO[0],
      r() * RUZGAR_KARO[1],
      34 + r() * 40,
      90 + r() * 80,
      acik
        ? `rgba(246,250,196,${(0.5 + r() * 0.3).toFixed(2)})`
        : `rgba(20,40,8,${(0.3 + r() * 0.15).toFixed(2)})`,
    );
  }
}

/**
 * Işığın titreme deseni: iri, yumuşak beyaz lekeler (karonun saydamlığı).
 * Işık katmanının iki kopyası bununla ve tersiyle örtülü, ayrı ritimde
 * titriyor: yan yana iki ateş aynı anda sönüp parlamıyor.
 */
export const ISIK_KARO = 150;
export function isikLekeleri(c: Ciz2B) {
  const r = tohumlu(11);
  for (let i = 0; i < 7; i++)
    leke(
      c,
      ISIK_KARO,
      ISIK_KARO,
      r() * ISIK_KARO,
      r() * ISIK_KARO,
      26 + r() * 20,
      26 + r() * 20,
      '#fff',
    );
}

/*
 * Zamanlama (saniye) ve saydamlık — styles.css ile aynı.
 *  - Su: iki parıltı karosu; A 256×128 CSS pikseli, 16 sn'de (-256, -128)
 *    kayıyor; B aynı desen 176×88'e küçülmüş, 11 sn'de (+176, 0), kendi
 *    saydamlığı 0,8; ikisinin üstünde 0,8.
 *  - Çimen: rüzgâr karosu 640×320, 12 sn'de (-640, 0); saydamlık 0,38.
 *  - Işık: iki kopya, `ISIK_TITRE` ile; A 2,9 sn, B 3,7 sn ve 1,3 sn önde.
 */
export const SU_A = { sure: 16, karo: SU_KARO, kayma: [-256, -128] as [number, number] };
export const SU_B = {
  sure: 11,
  karo: [176, 88] as [number, number],
  kayma: [176, 0] as [number, number],
  /** Karonun başlangıcı (CSS: kutu -176 pikselden, `background-position` 60 30). */
  baslangic: [-116, 30] as [number, number],
  saydam: 0.8,
};
export const SU_SAYDAM = 0.8;
export const RUZGAR = { sure: 12, kayma: [-640, 0] as [number, number] };
export const CIMEN_SAYDAM = 0.38;
export const ISIK_A = { sure: 2.9, gecikme: 0 };
export const ISIK_B = { sure: 3.7, gecikme: -1.3 };

/** Işığın titremesi: `@keyframes isik-titre` (doğrusal). */
export const ISIK_TITRE: [number, number][] = [
  [0, 0.55],
  [0.08, 0.3],
  [0.17, 0.7],
  [0.24, 0.45],
  [0.36, 0.8],
  [0.45, 0.4],
  [0.57, 0.65],
  [0.66, 0.3],
  [0.78, 0.75],
  [0.89, 0.45],
  [1, 0.55],
];

/** `t` saniyesinde ışığın saydamlığı (CSS'teki gibi: gecikme eksiyse tur önde başlıyor). */
export function isikSaydamligi(t: number, sure: number, gecikme = 0): number {
  const p = ((((t - gecikme) / sure) % 1) + 1) % 1;
  for (let i = 1; i < ISIK_TITRE.length; i++) {
    const [b, s] = ISIK_TITRE[i]!;
    if (p <= b) {
      const [a, r] = ISIK_TITRE[i - 1]!;
      return r + ((s - r) * (p - a)) / (b - a);
    }
  }
  return ISIK_TITRE[0]![1];
}

/** Doğrusal kaymanın `t` saniyesindeki hâli (CSS piksel; tur başa sarıyor). */
export function kayma(t: number, sure: number, [x, y]: [number, number]): [number, number] {
  const p = (((t / sure) % 1) + 1) % 1;
  return [x * p, y * p];
}

/** Ortam tuvalinin katmanları: sahnenin GPU katmanları (nesne url'leri). */
export interface OrtamKatmani {
  su?: string;
  cimen?: string;
  isik?: string;
  /** Akşam: ışık daha parlak ve doygun (CSS'te `brightness(1.6) saturate(1.25)`). */
  aksam?: boolean;
}

/**
 * İşçiye giden katmanlar: resimlerin kendisi. Sayfanın `blob:` adresi
 * işçide okunamıyor (Chrome: "Failed to fetch"); Blob gönderilince kopya yok.
 */
export interface OrtamDokulari {
  su?: Blob;
  cimen?: Blob;
  isik?: Blob;
  aksam?: boolean;
}

/** Sayfadan ortam işçisine (`ortamIsci.ts`). */
export type OrtamMesaji =
  | {
      tip: 'kur';
      id: number;
      tuval: OffscreenCanvas;
      /** Tuvalin kapladığı çerçeve (CSS pikseli): karolar bu ölçüde. */
      css: [number, number];
      acik: boolean;
    }
  | { tip: 'katman'; id: number; katman: OrtamDokulari }
  | { tip: 'boyut'; id: number; css: [number, number] }
  | { tip: 'oyna'; id: number; acik: boolean }
  | { tip: 'kapat'; id: number };

/** İşçiden sayfaya: tuval çizemiyor (WebGL2 yok, bağlam düştü). */
export interface OrtamCevabi {
  tip: 'hata';
  id: number;
}
