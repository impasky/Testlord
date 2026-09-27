/**
 * GENERALLER, LORD VE PORTRELER (docs/24).
 *
 * Generaller ve lordun beş kuşam aşaması, askerlerle aynı insan
 * kurucusundan (`figur.ts`) çıkıyor: aynı oran, aynı ışık. Portre ayrı
 * bir çizim değil — aynı figürün baş ve omuzlarına kurulmuş bir kadraj
 * (`PORTRE_KUTUSU`). Profil resmi, rehber kâhyası ve düşman şefinin yüzü
 * böylece tam boy hâliyle birebir aynı kişi.
 */
import { dusmanModeli } from './birlikler';
import { insan, type Insan } from './figur';
import { P } from './renk';
import { dondur, yansitici, type Model } from './uc';

const bak = (m: Model, aci = 0.35): Model => dondur(m, 'z', -Math.PI / 4 + aci);

const GENERAL: Record<string, Insan> = {
  casus_leyla: {
    ten: P.ten1,
    sac: P.sac1,
    kadin: true,
    govde: '#2e3a30',
    bacak: '#262a24',
    cizme: '#1d1a16',
    kol: '#2e3a30',
    pelerin: '#26382a',
    baslik: { tip: 'kukuleta', renk: '#2f4430' },
    sag: { tip: 'hancer' },
  },
  demirci_yusuf: {
    ten: P.ten2,
    sac: P.sac1,
    sakal: P.sac1,
    govde: '#6b6660',
    bacak: '#4a4038',
    cizme: P.deri,
    kol: P.ten2,
    tabard: '#6b4526',
    sag: { tip: 'cekic', renk: P.demir },
    iri: 1.1,
  },
  erzakci_meryem: {
    ten: P.ten1,
    sac: P.sac2,
    kadin: true,
    elbise: true,
    govde: '#6b4a32',
    etek: '#5a3e2a',
    bacak: '#5a3e2a',
    cizme: P.deri,
    tabard: '#c9b894',
    sol: { tip: 'kitap' },
  },
  kahya_sinan: {
    ten: P.ten2,
    sac: '#8a8680',
    elbise: true,
    govde: '#3a2228',
    etek: '#2e1a20',
    bacak: '#2e1a20',
    cizme: '#2a221c',
    pelerin: '#1d1416',
    kemer: P.koyuAltin,
    sol: { tip: 'tomar' },
  },
  kale_bekcisi_sarya: {
    ten: P.ten1,
    sac: P.sac4,
    kadin: true,
    govde: P.celik,
    bacak: '#8a8f94',
    cizme: '#6f757c',
    kol: P.celik,
    zirh: { tip: 'plaka', renk: P.celik },
    omuz: P.celik,
    sag: { tip: 'kilic' },
    sol: { tip: 'kalkan', renk: '#6f7f94', ikinci: '#e2d8c0' },
  },
  kumandan_alparslan: {
    ten: P.ten2,
    sac: '#8a8680',
    sakal: '#8a8680',
    govde: '#c0a060',
    bacak: '#8a7040',
    cizme: P.deri,
    kol: '#c0a060',
    zirh: { tip: 'plaka', renk: '#c0a060' },
    omuz: P.altin,
    kurk: '#d8d0c0',
    pelerin: '#6a1f1a',
    sag: { tip: 'kilic', ikinci: P.altin },
    iri: 1.1,
  },
  kusatmaci_tarik: {
    ten: P.ten2,
    sac: P.sac2,
    sakal: P.sac2,
    govde: '#4a5560',
    bacak: '#4a4038',
    cizme: P.deri,
    zirh: { tip: 'deri', renk: '#6b4a2e' },
    tabard: '#c9b894',
    sol: { tip: 'tomar' },
    sag: { tip: 'cekic', renk: P.koyuTahta },
  },
  mizrakci_kadir: {
    ten: P.ten2,
    sac: P.sac1,
    sakal: P.sac1,
    govde: '#8a8f94',
    bacak: '#4a4038',
    cizme: P.deri,
    kol: '#8a8f94',
    zirh: { tip: 'zincir', renk: '#8a8f94' },
    tabard: '#d9ccab',
    sag: { tip: 'mizrak' },
  },
  okcubasi_elif: {
    ten: P.ten3,
    sac: P.sac1,
    kadin: true,
    govde: '#5a4a38',
    bacak: '#4a3c30',
    cizme: P.deri,
    kol: '#6b5a40',
    zirh: { tip: 'deri', renk: '#6b4a2e' },
    sol: { tip: 'yay' },
    sadak: true,
    poz: 'nisan',
  },
  sovalye_doruk: {
    ten: P.ten1,
    sac: P.sac3,
    govde: P.celik,
    bacak: '#8a8f94',
    cizme: '#6f757c',
    kol: P.celik,
    zirh: { tip: 'plaka', renk: P.celik },
    omuz: P.celik,
    tabard: '#b0602a',
    sag: { tip: 'sancak', renk: P.kirmiziBez, ikinci: P.altin },
  },
  suvari_bora: {
    ten: P.ten1,
    sac: P.sac2,
    govde: '#8a8f94',
    bacak: '#5a4a38',
    cizme: P.deri,
    kol: '#8a8f94',
    zirh: { tip: 'plaka', renk: '#8a8f94' },
    pelerin: '#6b4526',
    sag: { tip: 'kilic' },
  },
  vaiz_bertan: {
    ten: P.ten1,
    sac: '#c9c4ba',
    sakal: '#c9c4ba',
    elbise: true,
    govde: '#77736b',
    etek: '#6b675f',
    bacak: '#6b675f',
    cizme: P.deri,
    kemer: '#5a4a3a',
    sag: { tip: 'hac' },
  },
};

/** Lordun beş kuşam aşaması: köylü → zırhlı soylu. */
const LORD: Insan[] = [
  {
    ten: P.ten2,
    sac: P.sac2,
    govde: '#7a6448',
    bacak: '#5a4a38',
    cizme: P.deri,
    kemer: P.deri,
    sag: { tip: 'kilic', renk: '#77736b', ikinci: P.demir },
  },
  {
    ten: P.ten2,
    sac: P.sac2,
    govde: '#8a8a82',
    bacak: '#5a4a38',
    cizme: P.deri,
    kol: '#8a8a82',
    zirh: { tip: 'zincir', renk: '#8a8f94' },
    baslik: { tip: 'kukuleta', renk: '#8a8f94' },
    sag: { tip: 'kilic' },
  },
  {
    ten: P.ten2,
    sac: P.sac1,
    sakal: P.sac1,
    govde: '#8a8f94',
    bacak: '#4a4038',
    cizme: P.deri,
    kol: '#8a8f94',
    zirh: { tip: 'plaka', renk: '#8a8f94' },
    omuz: P.celik,
    tabard: P.maviBez,
    sag: { tip: 'kilic' },
  },
  {
    ten: P.ten2,
    sac: P.sac1,
    sakal: P.sac1,
    govde: '#4f6f9a',
    bacak: '#3a4a5a',
    cizme: '#2a2a2a',
    kol: '#4f6f9a',
    zirh: { tip: 'plaka', renk: '#4f6f9a' },
    omuz: '#4f6f9a',
    pelerin: '#2a3a52',
    sag: { tip: 'kilic', ikinci: P.altin },
    sol: { tip: 'kalkan', renk: '#4f6f9a', ikinci: P.altin },
  },
  {
    ten: P.ten2,
    sac: P.sac1,
    sakal: P.sac1,
    govde: P.altin,
    bacak: '#8a7040',
    cizme: '#5a3a1a',
    kol: P.altin,
    zirh: { tip: 'plaka', renk: P.altin },
    omuz: P.koyuAltin,
    pelerin: '#6a1f1a',
    kurk: '#d8d0c0',
    sag: { tip: 'kilic', renk: P.celik, ikinci: P.altin },
    iri: 1.08,
  },
];

export const GENERAL_ADLARI = Object.keys(GENERAL);
export const LORD_ADLARI = LORD.map((_, i) => `lord_${i + 1}`);
const SEF_ADLARI = ['barbar_sef', 'eskiya_sef', 'haydut_sef', 'kultist_sef', 'lejyoner_sef'];
/** Profil resmi olarak seçilebilen bütün portreler (shared `HAZIR_PORTRELER`). */
export const PORTRE_ADLARI = [...GENERAL_ADLARI, ...LORD_ADLARI, ...SEF_ADLARI];

export function generalModeli(ad: string): Model | null {
  const g = GENERAL[ad];
  return g ? bak(insan(g)) : null;
}

export function lordModeli(ad: string): Model | null {
  const i = Number(/^lord_(\d)$/.exec(ad)?.[1]) - 1;
  const l = LORD[i];
  return l ? bak(insan(l)) : null;
}

/** Portre: aynı figür, baş ve omuz kadrajında. */
export function portreModeli(ad: string): Model | null {
  return generalModeli(ad) ?? lordModeli(ad) ?? (SEF_ADLARI.includes(ad) ? dusmanModeli(ad) : null);
}

/**
 * Baş ve omuz kadrajı: başın merkezi (dünya 0, 0, 7.1) ekrana yansıyor,
 * kare onun biraz altına ortalanıyor — omuzlar da girsin, miğferin sorgucu
 * taşabilir.
 */
const [, BAS_Y] = yansitici()([0, 0, 7.1]);
export const PORTRE_KUTUSU: [number, number, number, number] = [-2.9, BAS_Y - 2.6, 5.8, 5.8];
