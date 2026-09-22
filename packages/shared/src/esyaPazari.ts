/**
 * EŞYA PAZARI — oyuncular arası ekipman alım satımı (docs/19).
 *
 * Satıcı ilan açıyor, alıcı ön sipariş veriyor; ikisi fiyatta
 * buluşunca sunucu eşleştiriyor. Kimse kiminle alışveriş ettiğini
 * görmüyor, seçemiyor da: eşleşmeyi kural yapıyor.
 *
 * Fiyat SERBEST DEĞİL. Her ürün grubunun bir TABAN fiyatı var ve emir
 * yalnız tabanın etrafındaki dar bantta verilebiliyor. Taban da işlem
 * ve defter baskısıyla basamak basamak kayıyor. Serbest fiyat küçük bir
 * diyarda iki kötü sonuç verirdi: tek bir satıcı fiyatı istediği yere
 * çekerdi ve şişirilmiş fiyatlı "satış" iki hesap arasında altın
 * taşımanın en kolay yolu olurdu.
 *
 * ── Fiyatlar bir BASAMAK dizisi ────────────────────────────────────
 *
 * Fiyat altın olarak değil basamak numarası (k) olarak tutuluyor:
 * fiyat(k) = 1,01^k. Taban da bir basamak. Taban bir adım oynayınca
 * eski emirlerin hepsi yine bir basamakta duruyor; emir defteri "103,
 * 104,6, 105" gibi yarım fiyatlara bölünmüyor ve iki fiyatı
 * karşılaştırmak tam sayı karşılaştırması.
 *
 * SAF: veritabanı yok, zaman ve zar dışarıdan geliyor.
 */
import {
  B,
  craftCost,
  craftRarityTable,
  rarityMultiplier,
  tierUnlockLevel,
  upgradeSuccessChance,
} from './balance.js';
import { sellValue, upgradeCost } from './equipment.js';
import { birimKuru } from './pazar.js';
import { EQUIP_SLOTS, RARITIES, type EquipSlot, type Rarity } from './types.js';

const P = B.esya_pazari;

/** Fiyatı belirleyen üçlü. Yuva fiyatı etkilemiyor: kılıç da kalkan da aynı güçte. */
export interface EsyaGrubu {
  tier: number;
  rarity: Rarity;
  upgradeLevel: number;
}

/**
 * Alınıp satılan şey. Yuva ürünün parçası: kalkan arayan alıcıya kılıç
 * satılamaz. Fiyat ise yuvadan bağımsız (`EsyaGrubu`), altı yuva aynı
 * tabanı paylaşıyor — işlemler altı ayrı deftere bölünse taban hiç
 * kıpırdamazdı.
 */
export interface Urun extends EsyaGrubu {
  slot: EquipSlot;
}

export const YUVA_ADI: Record<EquipSlot, string> = {
  silah: 'Silah',
  kalkan: 'Kalkan',
  zirh: 'Zırh',
  migfer: 'Miğfer',
  at: 'At',
  sancak: 'Sancak',
};

export const NADIRLIK_ADI: Record<Rarity, string> = {
  siradan: 'Sıradan',
  usta: 'Usta işi',
  nadir: 'Nadir',
  efsanevi: 'Efsanevi',
  kadim: 'Kadim',
};

/** "T3 Nadir Kalkan +2" — hem ekranda hem olay metninde aynı ad. */
export function urunAdi(u: Urun): string {
  const arti = u.upgradeLevel > 0 ? ` +${u.upgradeLevel}` : '';
  return `T${u.tier} ${NADIRLIK_ADI[u.rarity]} ${YUVA_ADI[u.slot]}${arti}`;
}

/** Ürünün tek satırlık anahtarı: gruplamak ve karşılaştırmak için. */
export function urunAnahtari(u: Urun): string {
  return `${u.slot}:${u.tier}:${u.rarity}:${u.upgradeLevel}`;
}

export function urunGecerli(u: {
  slot: unknown;
  tier: unknown;
  rarity: unknown;
  upgradeLevel: unknown;
}): u is Urun {
  return (
    (EQUIP_SLOTS as readonly unknown[]).includes(u.slot) &&
    (RARITIES as readonly unknown[]).includes(u.rarity) &&
    Number.isInteger(u.tier) &&
    (u.tier as number) >= 1 &&
    (u.tier as number) <= 5 &&
    Number.isInteger(u.upgradeLevel) &&
    (u.upgradeLevel as number) >= 0 &&
    (u.upgradeLevel as number) <= B.ekipman.max_yukseltme
  );
}

/* ── Basamaklar ──────────────────────────────────────────────────── */

const ADIM = 1 + P.adim_orani;
const LN_ADIM = Math.log(ADIM);

/** k. basamağın altın fiyatı. */
export function basamakFiyati(k: number): number {
  return Math.round(Math.pow(ADIM, k));
}

/** Fiyatı `altin`ı AŞMAYAN en yüksek basamak. */
export function basamakAltta(altin: number): number {
  return Math.floor(Math.log(altin) / LN_ADIM + 1e-9);
}

/** Fiyatı `altin`ın ALTINA inmeyen en düşük basamak. */
export function basamakUstte(altin: number): number {
  return Math.ceil(Math.log(altin) / LN_ADIM - 1e-9);
}

/* ── Formül değeri ve sert sınırlar ──────────────────────────────── */

function altinKarsiligi(r: { altin: number; demir: number; erzak?: number }): number {
  return (
    r.altin * birimKuru('altin') +
    r.demir * birimKuru('demir') +
    (r.erzak ?? 0) * birimKuru('erzak')
  );
}

/**
 * Formül değeri: eşyayı ELDE ETMENİN ortalama bedeli, altın karşılığı.
 *
 * İki parça:
 *
 * 1. Dövme. Üretim bedeli, nadirliğin gücüyle o kademenin ORTALAMA
 *    gücüne bölünerek dağıtılıyor. Nadirliğin çıkma ihtimaline bölmek
 *    ("kadim yüzde 4 çıkıyor, o hâlde bedeli 25 kat") T1 efsaneviyi T3
 *    sıradandan pahalı yapardı — daha zayıf olduğu hâlde. Değer GÜCE
 *    bağlı; kıtlık fiyatını pazar kendisi bulur (sert üst sınır 3 kat).
 *
 * 2. Yükseltme. +N'ye kadar harcanan malzeme, başarı ihtimaline bölünerek
 *    (başarısız deneme de malzeme yakıyor). Yükseltme seviyesi ürünün
 *    parçası, çünkü +5'e kadar olan basamaklar bile T5'te dövme bedelinin
 *    birkaç katı; +0 ile +5'i aynı fiyata koymak, emek verilmiş eşyayı
 *    pazardan silmek olurdu.
 */
export function formulDegeri(g: EsyaGrubu): number {
  const tablo = craftRarityTable(g.tier);
  const ortalamaCarpan = RARITIES.reduce((s, r) => s + (tablo[r] ?? 0) * rarityMultiplier(r), 0);
  let deger = (altinKarsiligi(craftCost(g.tier)) * rarityMultiplier(g.rarity)) / ortalamaCarpan;
  for (let n = 0; n < g.upgradeLevel; n++) {
    deger += altinKarsiligi(upgradeCost(g.tier, n)) / upgradeSuccessChance(n);
  }
  return Math.round(deger);
}

export interface FiyatSinirlari {
  /** Formül değeri, altın. */
  formul: number;
  /** Formül değerine en yakın basamak — ilk taban ve çapanın hedefi. */
  formulBasamak: number;
  /** Tabanın inebileceği en düşük basamak. */
  altBasamak: number;
  /** Tabanın çıkabileceği en yüksek basamak. */
  ustBasamak: number;
}

/**
 * Tabanın hiçbir zaman çıkamayacağı SERT sınırlar.
 *
 * Alt sınır NPC satış değeri: oraya düşen eşyayı pazarda satmanın anlamı
 * kalmaz, demirhane aynı parayı veriyor. Formülün bir kesri DEĞİL — pazar
 * fazla yükseltilmiş ucuz bir eşyanın gerçek değerini bulabilmeli; T1
 * +10'a harcanan malzeme, onu T5 sıradandan değerli yapmıyor.
 */
export function fiyatSinirlari(g: EsyaGrubu): FiyatSinirlari {
  const formul = formulDegeri(g);
  const npc = sellValue({ slot: 'silah', ...g });
  const altBasamak = basamakUstte(Math.max(npc, P.en_dusuk_fiyat));
  const ustBasamak = basamakAltta(formul * P.ust_sinir_carpani);
  const formulBasamak = Math.min(
    ustBasamak,
    Math.max(altBasamak, Math.round(Math.log(formul) / LN_ADIM)),
  );
  return { formul, formulBasamak, altBasamak, ustBasamak };
}

/* ── Bant ────────────────────────────────────────────────────────── */

export interface Bant {
  taban: number;
  alt: number;
  ust: number;
}

/** Emrin verilebileceği aralık: tabanın iki yanına `bant_adimi` basamak, sert sınırla kırpılmış. */
export function bantHesapla(taban: number, s: FiyatSinirlari): Bant {
  return {
    taban,
    alt: Math.max(s.altBasamak, taban - P.bant_adimi),
    ust: Math.min(s.ustBasamak, taban + P.bant_adimi),
  };
}

export function bantta(basamak: number, b: Bant): boolean {
  return basamak >= b.alt && basamak <= b.ust;
}

/** Bantın basamakları, pahalıdan ucuza — emir defterinin satırları. */
export function bantBasamaklari(b: Bant): number[] {
  const satirlar: number[] = [];
  for (let k = b.ust; k >= b.alt; k--) satirlar.push(k);
  return satirlar;
}

export function tabanUygula(taban: number, adim: number, s: FiyatSinirlari): number {
  return Math.min(s.ustBasamak, Math.max(s.altBasamak, taban + adim));
}

/* ── Eşleşme ─────────────────────────────────────────────────────── */

/** Defterde bekleyen bir emir: ilan ya da ön sipariş. */
export interface DefterEmri {
  id: string;
  lordId: string;
  basamak: number;
  /** Sıraya girdiği an (ms). Fiyat güncellenince yenileniyor. */
  sira: number;
}

function ilkGelen<T extends DefterEmri>(liste: T[]): T {
  return liste.reduce((a, b) => (b.sira < a.sira ? b : a));
}

/**
 * Yeni ilanın karşısına düşen ön sipariş.
 *
 * En yüksek fiyatlı olan kazanıyor ve işlem ONUN fiyatından yapılıyor:
 * satıcı istediğinden fazlasını alabiliyor, hiçbir zaman azını değil.
 * Eşit fiyatta ilk gelen kazanıyor — bekleyenin hakkı. Tek istisna
 * bandın tavanı: orada fiyat daha fazla yükselemediği için sıra bir
 * yarışa dönüyor (ilan açıldığı anda sipariş veren bot her seferinde
 * kazanırdı) ve kazananı kura seçiyor.
 */
export function ilanaSiparisSec<T extends DefterEmri>(
  siparisler: T[],
  ilanBasamak: number,
  b: Bant,
  zar: () => number,
  saticiId: string,
): T | null {
  const uygun = siparisler.filter(
    (s) => bantta(s.basamak, b) && s.basamak >= ilanBasamak && s.lordId !== saticiId,
  );
  if (uygun.length === 0) return null;
  const enYuksek = Math.max(...uygun.map((s) => s.basamak));
  const enIyiler = uygun.filter((s) => s.basamak === enYuksek);
  if (enYuksek >= b.ust) return enIyiler[Math.floor(zar() * enIyiler.length)] ?? null;
  return ilkGelen(enIyiler);
}

/**
 * Yeni ön siparişin karşısına düşen ilan: en ucuzu, eşitse ilk gelen.
 * İşlem İLANIN fiyatından: alıcı yazdığından azını ödeyebiliyor.
 * Kayıt kuyruğundaki ilanlar buraya hiç gelmemeli — onları kura dağıtıyor.
 */
export function sipariseIlanSec<T extends DefterEmri>(
  ilanlar: T[],
  siparisBasamak: number,
  b: Bant,
  aliciId: string,
): T | null {
  const uygun = ilanlar.filter(
    (i) => bantta(i.basamak, b) && i.basamak <= siparisBasamak && i.lordId !== aliciId,
  );
  if (uygun.length === 0) return null;
  const enDusuk = Math.min(...uygun.map((i) => i.basamak));
  return ilkGelen(uygun.filter((i) => i.basamak === enDusuk));
}

/**
 * Kayıt kuyruğu bitince ilanı kim alıyor: uygun siparişlerin en yüksek
 * fiyatlıları arasından KURA. Sıra burada sayılmıyor — kuyruğun bütün
 * amacı, ilan açıldığı anda dokunanın kazanmasını önlemek.
 */
export function kuyrukKurasi<T extends DefterEmri>(
  siparisler: T[],
  ilanBasamak: number,
  b: Bant,
  zar: () => number,
  saticiId: string,
): T | null {
  const uygun = siparisler.filter(
    (s) => bantta(s.basamak, b) && s.basamak >= ilanBasamak && s.lordId !== saticiId,
  );
  if (uygun.length === 0) return null;
  const enYuksek = Math.max(...uygun.map((s) => s.basamak));
  const enIyiler = uygun.filter((s) => s.basamak === enYuksek);
  return enIyiler[Math.floor(zar() * enIyiler.length)] ?? null;
}

/** Değerli eşya ilana girince önce kayıt kuyruğunda bekler (docs/19 §6). */
export function kayitKuyruguGerekir(g: EsyaGrubu): boolean {
  return (
    (P.kuyruk_nadirlikleri as readonly string[]).includes(g.rarity) ||
    formulDegeri(g) >= P.kuyruk_esik_degeri
  );
}

/* ── Tabanın hareketi ────────────────────────────────────────────── */

/**
 * Bandın kenarında gerçekleşen işlem tabanı bir basamak iter.
 *
 * Tavanda alınan eşya "bu fiyata da alıcı var", tabanda satılan "bu
 * fiyata da satıcı var" diyor. Ortada gerçekleşen işlem fiyatın doğru
 * yerde olduğunu söylüyor ve tabana dokunmuyor.
 */
export function kenarAdimi(islemBasamak: number, b: Bant): -1 | 0 | 1 {
  if (islemBasamak >= b.ust) return 1;
  if (islemBasamak <= b.alt) return -1;
  return 0;
}

/**
 * Saatlik defter baskısı — işlem olmadan da fiyatın kıpırdayabilmesi için.
 *
 * Bantta hiç ilan yokken tabanın üstünde bekleyen bir sipariş, satıcıyı
 * çekmek için fiyatın yükselmesi gerektiğini söylüyor; tersi de düşmesi
 * gerektiğini. İki taraf da doluysa (aradaki makas) baskı yok: fiyat
 * doğru yerde, sadece henüz buluşulmadı.
 *
 * Yalnız en az `baski_bekleme_dk` bekleyen emir sayılıyor: fiyatını
 * durmadan değiştiren bir emir, tabanı her saat sürüklemesin.
 * Bandın dışında kalmış emir de sayılmıyor — eşleşemeyen bir emrin fiyat
 * hakkında söyleyeceği bir şey yok.
 */
export function baskiAdimi(g: {
  ilanlar: { basamak: number; sira: number }[];
  siparisler: { basamak: number; sira: number }[];
  bant: Bant;
  simdi: number;
}): -1 | 0 | 1 {
  const esik = g.simdi - P.baski_bekleme_dk * 60_000;
  const ilanlar = g.ilanlar.filter((i) => bantta(i.basamak, g.bant));
  const siparisler = g.siparisler.filter((s) => bantta(s.basamak, g.bant));
  if (ilanlar.length === 0 && siparisler.some((s) => s.basamak >= g.bant.taban && s.sira <= esik))
    return 1;
  if (siparisler.length === 0 && ilanlar.some((i) => i.basamak <= g.bant.taban && i.sira <= esik))
    return -1;
  return 0;
}

/**
 * Çapa: uzun süre işlem görmeyen ürünün tabanı formül değerine döner.
 *
 * Ölü bir defterde bir kez yanlış yere gitmiş fiyat başka türlü hiç
 * düzelmezdi. Günde bir basamak — yavaş, çünkü işlem olmaması
 * fiyatın yanlış olduğunu KANITLAMIYOR.
 */
export function capaAdimi(g: {
  taban: number;
  formulBasamak: number;
  /** Son işlemin anı; hiç işlem yoksa grubun açıldığı an. */
  sonIslem: number;
  sonCapa: number | null;
  simdi: number;
}): -1 | 0 | 1 {
  if (g.simdi - g.sonIslem < P.capa_kuraklik_gun * 86_400_000) return 0;
  if (g.sonCapa !== null && g.simdi - g.sonCapa < P.capa_araligi_saat * 3_600_000) return 0;
  return g.formulBasamak > g.taban ? 1 : g.formulBasamak < g.taban ? -1 : 0;
}

/* ── Vergi ───────────────────────────────────────────────────────── */

/**
 * Satıcının eline geçen. Yuvarlama AŞAĞI: vergi yoktan küçülmesin —
 * en ucuz eşyanın çok sayıda satışı vergiyi yiyemesin.
 */
export function vergiHesapla(fiyat: number): { vergi: number; net: number } {
  const net = Math.floor(fiyat * (1 - P.vergi) + 1e-9);
  return { vergi: fiyat - net, net };
}

/* ── Engeller ────────────────────────────────────────────────────── */

export interface PazarEngeli {
  kod: string;
  mesaj: string;
}

function bantMetni(b: Bant): string {
  return `${basamakFiyati(b.alt).toLocaleString('tr-TR')} ile ${basamakFiyati(b.ust).toLocaleString('tr-TR')} altın`;
}

/** Fiyat bantta mı — yeni emir de fiyat güncellemesi de buradan geçiyor. */
export function bantEngeli(basamak: number, b: Bant): PazarEngeli | null {
  if (!Number.isInteger(basamak) || !bantta(basamak, b)) {
    return { kod: 'BANT_DISI', mesaj: `Fiyat ${bantMetni(b)} arasında olmalı.` };
  }
  return null;
}

/** İki emir türünün ortak sınırları: bant, aynı ürün, tavanlar. */
function ortakEngel(g: {
  basamak: number;
  bant: Bant;
  ayniUrundeIlan: boolean;
  ayniUrundeSiparis: boolean;
  bugunYeniEmir: number;
}): PazarEngeli | null {
  const bant = bantEngeli(g.basamak, g.bant);
  if (bant) return bant;
  if (g.ayniUrundeIlan && g.ayniUrundeSiparis) {
    return {
      kod: 'IKI_YON',
      mesaj: 'Aynı ürünü hem satıp hem alamazsın. Önce öteki emrini geri çek.',
    };
  }
  if (g.bugunYeniEmir >= P.gunluk_yeni_emir) {
    return {
      kod: 'GUNLUK_EMIR',
      mesaj: `Bugün en fazla ${P.gunluk_yeni_emir} yeni emir verebilirsin. Yarın yenilenir.`,
    };
  }
  return null;
}

/**
 * İlan açılabilir mi? Açılamıyorsa SEBEBİ.
 *
 * Metin motorda: arayüz düğmeyi kapatırken ve sunucu isteği reddederken
 * aynı cümleyi kullanıyor.
 */
export function ilanEngeli(g: {
  esya: { equipped: boolean; pazarda: boolean; yukseltiliyor: boolean };
  basamak: number;
  bant: Bant;
  acikIlan: number;
  bugunYeniEmir: number;
  /** Bu üründe zaten bir ilanı var mı. */
  ayniUrundeIlan: boolean;
  /** Bu üründe bir ön siparişi var mı. */
  ayniUrundeSiparis: boolean;
}): PazarEngeli | null {
  if (g.esya.pazarda) return { kod: 'ZATEN_PAZARDA', mesaj: 'Bu eşya zaten pazarda.' };
  if (g.esya.equipped) {
    return { kod: 'KUSANIK', mesaj: 'Kuşandığın eşyayı satamazsın. Önce çıkar.' };
  }
  if (g.esya.yukseltiliyor) {
    return {
      kod: 'YUKSELTILIYOR',
      mesaj: 'Bu eşya demirhanede yükseltiliyor. İş bitince satabilirsin.',
    };
  }
  if (g.ayniUrundeIlan) {
    return {
      kod: 'AYNI_URUN',
      mesaj: 'Bu ürünün zaten bir ilanın var. Önce o satılsın ya da geri çek.',
    };
  }
  const ortak = ortakEngel({ ...g, ayniUrundeIlan: true });
  if (ortak) return ortak;
  if (g.acikIlan >= P.azami_ilan) {
    return { kod: 'ILAN_TAVANI', mesaj: `Aynı anda en fazla ${P.azami_ilan} ilan açabilirsin.` };
  }
  return null;
}

/**
 * Ön sipariş verilebilir mi?
 *
 * `odenecek`: bu emrin ŞİMDİ bağlayacağı altın. Hemen bir ilanla
 * eşleşiyorsa ilanın fiyatı, eşleşmiyorsa siparişin kendi fiyatı —
 * sunucu eşleşmeyi bulduktan sonra çağırıyor.
 */
export function siparisEngeli(g: {
  urun: Urun;
  lordSeviyesi: number;
  basamak: number;
  bant: Bant;
  acikSiparis: number;
  bugunYeniEmir: number;
  ayniUrundeIlan: boolean;
  ayniUrundeSiparis: boolean;
  odenecek: number;
  /** Eşleşmeyip deftere girecek mi (emanet tavanına sayılır). */
  bekleyecek: boolean;
  /** Kasadaki ve depodaki altın. */
  eldeki: number;
  /** Açık ön siparişlerde zaten bağlı altın. */
  emanette: number;
  depoTavani: number;
}): PazarEngeli | null {
  const gerekli = tierUnlockLevel(g.urun.tier);
  if (g.lordSeviyesi < gerekli) {
    return {
      kod: 'KADEME_KILITLI',
      mesaj: `T${g.urun.tier} eşya almak için ${gerekli}. seviye gerekiyor.`,
    };
  }
  if (g.ayniUrundeSiparis) {
    return {
      kod: 'AYNI_URUN',
      mesaj: 'Bu ürüne zaten bir ön siparişin var. Fiyatını güncelleyebilirsin.',
    };
  }
  const ortak = ortakEngel({ ...g, ayniUrundeSiparis: true });
  if (ortak) return ortak;
  if (g.acikSiparis >= P.azami_siparis) {
    return {
      kod: 'SIPARIS_TAVANI',
      mesaj: `Aynı anda en fazla ${P.azami_siparis} ön sipariş verebilirsin.`,
    };
  }
  return odemeEngeli(g);
}

/**
 * Altını yetiyor mu, emanet tavanını aşıyor mu — ön sipariş ve fiyat
 * yükseltme ikisi de buradan geçiyor.
 *
 * Emanet tavanı = depo tavanı. Tavansız olsaydı ön sipariş sınırsız bir
 * kasa olurdu: depoyu taşıracak altını siparişe bağla, işin bitince geri
 * çek. Depo tavanı zaten "elinde tutabileceğin altın"ın sınırı.
 */
export function odemeEngeli(g: {
  odenecek: number;
  bekleyecek: boolean;
  eldeki: number;
  emanette: number;
  depoTavani: number;
}): PazarEngeli | null {
  if (g.bekleyecek && g.emanette + g.odenecek > g.depoTavani) {
    const kalan = Math.max(0, g.depoTavani - g.emanette);
    return {
      kod: 'EMANET_TAVANI',
      mesaj: `Ön siparişlerde bekleyen altın depo tavanını aşamaz. En fazla ${kalan.toLocaleString('tr-TR')} altın daha bağlayabilirsin.`,
    };
  }
  if (g.eldeki < g.odenecek) {
    return {
      kod: 'ALTIN_YETERSIZ',
      mesaj: `${g.odenecek.toLocaleString('tr-TR')} altın gerekiyor; kasanda ve deponda ${g.eldeki.toLocaleString('tr-TR')} var.`,
    };
  }
  return null;
}

/* ── Emir defteri ────────────────────────────────────────────────── */

export interface DefterSatiri {
  basamak: number;
  fiyat: number;
  /** O fiyatta bekleyen ilan sayısı. */
  satici: number;
  /** O fiyatta bekleyen ön sipariş sayısı. */
  alici: number;
  taban: boolean;
}

/**
 * Oyuncunun gördüğü defter: bantın her basamağı, kaç satıcı ve kaç alıcı.
 * Kim olduğu YOK — pazar anonim; ad görünseydi fiyat yerine kişi
 * pazarlığı başlardı.
 */
export function defterSatirlari(
  b: Bant,
  ilanlar: { basamak: number }[],
  siparisler: { basamak: number }[],
): DefterSatiri[] {
  return bantBasamaklari(b).map((k) => ({
    basamak: k,
    fiyat: basamakFiyati(k),
    satici: ilanlar.filter((i) => i.basamak === k).length,
    alici: siparisler.filter((s) => s.basamak === k).length,
    taban: k === b.taban,
  }));
}
