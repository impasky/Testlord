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
 * Çıktı Prettier'dan geçmiş olarak yazılıyor; üretim sonrası fark
 * yalnız gerçekten değişen ikonlar.
 *
 * Lisans: game-icons.net — CC BY 3.0. Künye docs/LISANSLAR.md içinde.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const require = createRequire(import.meta.url);
const set = require('@iconify-json/game-icons/icons.json');

/*
 * Elle çizilmiş ikonlar: paketteki karşılıkları bir komşuyla karışıyor
 * (köy ↔ şehrin "village"ı, akın ↔ kışlanın çapraz kılıçları). `ad`
 * esinlendikleri game-icons ikonu, künye için.
 *
 * Gövdeleri BURADA duruyor, çıktı dosyasında değil: çıktı her üretimde
 * baştan yazılıyor ve oraya elle eklenen ikon bir sonraki üretimde
 * sessizce siliniyordu — `kilit` eklenirken `koy` ile `navAkin` böyle
 * gitmişti.
 */
const OZEL = {
  koy: {
    ad: 'village',
    body: '<path fill="currentColor" d="M188 92 60 208v20h28v168h200V228h28v-20zm0 44 78 72H110zm-42 116h84v40h-84zm0 72h84v72h-84z"/><path fill="currentColor" d="M360 176 268 260v14h20v122h140V274h20v-14zm0 34 56 50H304zm-32 82h64v30h-64zm0 58h64v52h-64z"/><path fill="currentColor" d="M24 420h464v24H24z"/><path fill="currentColor" d="M56 396h12v28H56zm44 0h12v28h-12zm44 0h12v28h-12zm44 0h12v28h-12zm44 0h12v28h-12zm44 0h12v28h-12zm44 0h12v28h-12zm44 0h12v28h-12zm44 0h12v28h-12z"/>',
  },
  kasa: {
    ad: 'app-grid',
    not: [
      'Uygulama kasası tutamağı: dokuz nokta. Oyuncunun istediği',
      '"Samsung uygulama kasası" — telefonlarda bütün uygulamaların',
      'ızgarası bu simgeyle açılıyor, oyuncu onu tanıyor.',
    ],
    body: '<path fill="currentColor" d="M72 72h88v88H72zm140 0h88v88h-88zm140 0h88v88h-88zM72 212h88v88H72zm140 0h88v88h-88zm140 0h88v88h-88zM72 352h88v88H72zm140 0h88v88h-88zm140 0h88v88h-88z"/>',
  },
  navAkin: {
    ad: 'sword-clash',
    not: [
      'Akın sekmesinin simgesi: kılıç darbesi.',
      '',
      'Kışla (çapraz kılıçlar) orduyu KURDUĞUN yer, akın onu KULLANDIĞIN',
      'yer. İkisi de kılıç ama biri duran biri vuran: çubuktaki iki',
      'komşunun aynı görünmemesi, 44 piksellik bir hedefte adı okumadan',
      'ayırt edebilmek demek.',
    ],
    body: '<path fill="currentColor" d="M20.28 20.28v81.44l122.19 122.19l81.44-81.44L101.72 20.28zm389.72 0L287.81 142.47l40.72 40.72L491.72 101.72V20.28zm-183.5 183.5l-40.72 40.72l122.19 122.19l40.72-40.72zM101.72 288.28L20.28 369.72v122.19h81.44l122.19-122.19zm308.56 20.28l-81.44 81.44l101.72 101.72h81.16v-81.44z"/>',
  },
};

/** Oyunda kullanılan ikonlar: anahtar -> game-icons adı (ya da OZEL'den biri) */
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
  elmas: 'cut-diamond',
  // Genel sohbet ve profil resmi
  sohbet: 'conversation',
  fotograf: 'photo-camera',
  kasa: OZEL.kasa,

  // Bölge tipleri
  koy: OZEL.koy,
  tarla: 'wheat',
  maden: 'gold-mine',
  sehir: 'village',
  kale: 'castle',
  taht: 'throne-king',

  // Gezinme
  navMalikane: 'castle',
  navKisla: 'crossed-swords',
  navHarita: 'treasure-map',
  navDemirhane: 'anvil',
  navAkin: OZEL.navAkin,
  navMenu: 'hamburger-menu',
  navLord: 'character',
  navGeneraller: 'crested-helmet',
  navSiralama: 'laurels-trophy',

  // Arayüz
  sohret: 'laurel-crown',
  kapali: 'cross-mark',
  onay: 'check-mark',
  kilit: 'padlock',
  goz: 'all-seeing-eye',
  artı: 'heart-plus',
  sancak: 'vertical-banner',
  kurnaz: 'hood',

  // Araştırma ağacının etki rozetleri (Arastirma.tsx): kutunun ne
  // verdiğini okumadan söyleyen simgeler.
  depo: 'chest',
  kitap: 'open-book',
  cekic: 'hammer-nails',
  yagma: 'swap-bag',
  taktik: 'chess-knight',
};

const W = set.width ?? 512;
const H = set.height ?? 512;

const satirlar = [];
const eksik = [];

for (const [anahtar, kaynak] of Object.entries(KULLANILAN)) {
  const ozel = typeof kaynak === 'object';
  const ad = ozel ? kaynak.ad : kaynak;
  const i = ozel ? { body: kaynak.body } : set.icons[ad];
  if (!i) {
    eksik.push(`${anahtar} -> ${ad}`);
    continue;
  }
  const not =
    ozel && kaynak.not
      ? `  /*\n${kaynak.not.map((s) => `   * ${s}`.trimEnd()).join('\n')}\n   */\n`
      : '';
  satirlar.push(
    `${not}  ${anahtar}: { ad: ${JSON.stringify(ad)}, w: ${i.width ?? W}, h: ${i.height ?? H}, body: ${JSON.stringify(i.body)} },`,
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

const yol = fileURLToPath(new URL('../apps/web/src/components/ikon-verisi.ts', import.meta.url));
const ayar = (await prettier.resolveConfig(yol)) ?? {};
writeFileSync(yol, await prettier.format(cikti, { ...ayar, filepath: yol }));

const boyut = readFileSync(yol).length;
console.log(
  `${satirlar.length} ikon çıkarıldı -> apps/web/src/components/ikon-verisi.ts (${(boyut / 1024).toFixed(1)} KB)`,
);
