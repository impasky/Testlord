/**
 * Kullanılan game-icons ikonlarını tek bir TS dosyasına çıkarır.
 *
 * Neden: @iconify-json/game-icons paketi 4134 ikon ve ~6,5 MB. Tamamını
 * içe aktarmak arayüz paketini şişirir. Burada SADECE kullandıklarımız
 * çıkarılıp gömülür; npm paketi devDependency olarak kalır, çalışma anında
 * bağımlılık olmaz.
 *
 * Yeni ikon eklemek: aşağıdaki KULLANILAN listesine adını yaz, sonra
 *   node tools/ikon-uret.mjs
 *
 * Lisans: game-icons.net — CC BY 3.0. Künye docs/LISANSLAR.md içinde.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const set = require('@iconify-json/game-icons/icons.json');

/** Oyunda kullanılan ikonlar: anahtar -> game-icons adı */
const KULLANILAN = {
  // Birimler
  milis: 'pitchfork',
  mizrakci: 'spears',
  okcu: 'archer',
  suvari: 'cavalry',
  kusatma: 'catapult',

  // Savaş nitelikleri
  saldiri: 'broadsword',
  savunma: 'shield',
  can: 'health-normal',
  hiz: 'wingfoot',
  yer: 'flying-flag',

  // Kaynaklar
  altin: 'two-coins',
  demir: 'metal-bar',
  erzak: 'wheat',
  sure: 'hourglass',
  uyari: 'hazard-sign',

  // Bölge tipleri
  tarla: 'wheat',
  maden: 'gold-mine',
  sehir: 'village',
  kale: 'castle',
  taht: 'throne-king',
};

const W = set.width ?? 512;
const H = set.height ?? 512;

const satirlar = [];
const eksik = [];

for (const [anahtar, ad] of Object.entries(KULLANILAN)) {
  const i = set.icons[ad];
  if (!i) {
    eksik.push(`${anahtar} -> ${ad}`);
    continue;
  }
  satirlar.push(
    `  ${anahtar}: { ad: ${JSON.stringify(ad)}, w: ${i.width ?? W}, h: ${i.height ?? H}, body: ${JSON.stringify(i.body)} },`,
  );
}

if (eksik.length) {
  console.error('Bulunamayan ikonlar:', eksik.join(', '));
  process.exit(1);
}

const cikti = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. Kaynak: tools/ikon-uret.mjs
 *
 * game-icons.net ikonları (CC BY 3.0). Sadece oyunda kullanılanlar gömülüdür;
 * paketin tamamı 4134 ikon ve ~6,5 MB, bu dosya onun küçük bir alt kümesi.
 *
 * Künye: docs/LISANSLAR.md
 */

export interface IkonVerisi {
  ad: string;
  w: number;
  h: number;
  body: string;
}

export const IKONLAR = {
${satirlar.join('\n')}
} as const satisfies Record<string, IkonVerisi>;

export type IkonAnahtari = keyof typeof IKONLAR;
`;

const yol = new URL('../apps/web/src/components/ikon-verisi.ts', import.meta.url);
writeFileSync(yol, cikti);

const boyut = readFileSync(yol).length;
console.log(
  `${satirlar.length} ikon çıkarıldı -> apps/web/src/components/ikon-verisi.ts (${(boyut / 1024).toFixed(1)} KB)`,
);
