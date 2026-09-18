/**
 * MEDENİYET KATMANI — saf çekirdek (docs/16).
 *
 * Oyunun türünü değiştiren karar: bireysel 4X'ten fraksiyon savaşına.
 * Kilidi açan cümle `docs/16` §2'de:
 *
 *   > Bölge bölünemez, bölgedeki PAY bölünür.
 *
 * 121 bölgeyi on bin kişiye bölemezsin; ama bir bölgeye ortak olmayı
 * sonsuza kadar bölebilirsin. Toprak medeniyetin olur, oyuncu oraya
 * garnizon gönderir ve gönderdiği YER kadar gelir alır.
 *
 * BU DOSYA SAF. Veritabanı, saat, rastgelelik yok — sunucu ve istemci
 * aynı sayıyı üretir. `docs/16` §12'nin ilk adımı bilerek burası:
 * "kod yazmadan önce sayılar burada doğrulanır". Şema ve uçlar bunun
 * üstüne gelir.
 *
 * SAYILAR BURADA DEĞİL, `balance.json` → `medeniyetler` altında. Bir
 * sayının ikinci kopyası er ya da geç motordan sapar.
 */
import { B, WORLD_MAP } from './balance.js';
import type { Army } from './types.js';
import { unit } from './balance.js';

const M = B.medeniyetler as unknown as {
  yurt_basina_cekirdek: number;
  cekirdek_yatirim: {
    taban_maliyet: { altin: number; demir: number; erzak: number };
    seviye_carpani: number;
    azami_seviye: number;
  };
  garnizon_payi: { asgari_yer: number };
  fayda_puani: {
    garnizon_saat_basina_yer_basina: number;
    fetihe_katilim: number;
    savunmaya_katilim: number;
    cekirdek_bagis_bin_kaynak_basina: number;
  };
  liste: {
    id: string;
    ad: string;
    yurt: string;
    renk: string;
    ozet: string;
    cekirdek_bolge_id: number[];
  }[];
  cekismeli_vilayetler: string[];
  taht_vilayeti: string;
};

export type MedeniyetId = string;

export interface Medeniyet {
  id: MedeniyetId;
  ad: string;
  /** Yurt vilayeti — `world-map.json`daki `province` anahtarı. */
  yurt: string;
  renk: string;
  ozet: string;
  /** Ele geçirilemeyen, yalnız geliştirilen beş bölge. */
  cekirdekBolgeler: number[];
}

export const MEDENIYETLER: readonly Medeniyet[] = M.liste.map((m) => ({
  id: m.id,
  ad: m.ad,
  yurt: m.yurt,
  renk: m.renk,
  ozet: m.ozet,
  cekirdekBolgeler: m.cekirdek_bolge_id,
}));

export function medeniyet(id: MedeniyetId): Medeniyet | undefined {
  return MEDENIYETLER.find((m) => m.id === id);
}

/* ------------------------------------------------------------------ */
/* Çekirdek / çekişmeli ayrımı                                         */
/* ------------------------------------------------------------------ */

const CEKIRDEK_SAHIBI = new Map<number, MedeniyetId>();
for (const m of MEDENIYETLER) {
  for (const id of m.cekirdekBolgeler) CEKIRDEK_SAHIBI.set(id, m.id);
}

/**
 * Bu bölge bir medeniyetin çekirdeği mi — öyleyse hangisinin?
 *
 * Çekirdek ELE GEÇİRİLEMEZ. Sebebi `docs/09` kural 6'nın fraksiyon
 * ölçeğindeki karşılığı: kaybeden medeniyet ölmez, evine çekilir ve
 * geri döner. Çekirdek bilerek küçük (121'de 20) — harita doğduğu gün
 * karara bağlanmasın diye.
 */
export function cekirdekSahibi(mapId: number): MedeniyetId | null {
  return CEKIRDEK_SAHIBI.get(mapId) ?? null;
}

export function cekirdekMi(mapId: number): boolean {
  return CEKIRDEK_SAHIBI.has(mapId);
}

/** Taht Kalesi: kimsenin çekirdeği değil, herkesin hedefi. */
export function tahtMi(mapId: number): boolean {
  return WORLD_MAP.regions.find((r) => r.id === mapId)?.province === M.taht_vilayeti;
}

/** Çekişmeli: çekirdek de değil taht da değil — yani fethedilebilir. */
export function cekismeliMi(mapId: number): boolean {
  return !cekirdekMi(mapId) && !tahtMi(mapId);
}

/**
 * Bir bölgenin AÇILIŞ sahibi.
 *
 * Yurt vilayetindeki her bölge o medeniyetin elinde doğuyor (çekirdeği
 * olsun olmasın); çekişmeli vilayetler ve taht sahipsiz başlıyor. Yani
 * harita ilk gün dört yurt + ortada boşluk olarak açılıyor ve kavga
 * ortada başlıyor.
 */
export function baslangicSahibi(mapId: number): MedeniyetId | null {
  const bolge = WORLD_MAP.regions.find((r) => r.id === mapId);
  if (!bolge) return null;
  return MEDENIYETLER.find((m) => m.yurt === bolge.province)?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Garnizon payı (docs/16 §6)                                          */
/* ------------------------------------------------------------------ */

/** Bir ordunun kapladığı komuta YERİ — pay bunun oranında bölünüyor. */
export function orduYeri(ordu: Army): number {
  let toplam = 0;
  for (const [tur, adet] of Object.entries(ordu)) {
    if (!adet || adet <= 0) continue;
    toplam += unit(tur as Parameters<typeof unit>[0]).yer * adet;
  }
  return toplam;
}

/**
 * Bir lordun bu bölgedeki GELİR payı.
 *
 * Adı `GarnizonPayi` DEĞİL: o ad `takviye.ts`te zaten var ve başka bir
 * şeyi anlatıyor (bölgedeki bir lordun ORDUSU, savaşa giren yığın).
 * İkisi aynı adı taşıyınca `index.ts` iki kez dışa aktarıyor ve
 * derleyici hangisinin kastedildiğini bilemiyor. Burada ölçülen şey
 * ordu değil, o ordunun HAK ETTİĞİ pay.
 */
export interface GelirPayi {
  lordId: string;
  yer: number;
  /** Gelirin bu lorda düşen oranı (0-1). */
  oran: number;
}

/**
 * Bölge gelirini garnizonlar arasında YER oranında böler.
 *
 * TAVAN YOK ve bilerek yok. Tavan "kim önce doldurursa" yarışı yaratır;
 * oransal bölüşüm kendi kendini dengeliyor: kalabalık bölgede yer başına
 * kazanç düşüyor, oyuncu boş bölgeye kayıyor. Garnizonu haritaya
 * kendiliğinden yayan bir pazar.
 *
 * Balina tek bölgede baskın olamıyor — yer başına verimi düşüyor.
 * Ölçeklemek istiyorsa YAYILMAK zorunda, yani her yerde savaşa katılmak
 * zorunda. İstenen davranış tam olarak bu.
 */
export function garnizonPaylari(garnizonlar: { lordId: string; ordu: Army }[]): GelirPayi[] {
  const yerler = garnizonlar
    .map((g) => ({ lordId: g.lordId, yer: orduYeri(g.ordu) }))
    .filter((g) => g.yer >= M.garnizon_payi.asgari_yer);
  const toplam = yerler.reduce((s, g) => s + g.yer, 0);
  if (toplam <= 0) return [];
  return yerler.map((g) => ({ ...g, oran: g.yer / toplam }));
}

/**
 * Bir lordun bu bölgeden saatlik payı.
 *
 * Yuvarlama AŞAĞI: paylar toplandığında bölgenin ürettiğinden fazlası
 * dağıtılmamalı. Yukarı yuvarlamak, on kişilik bir bölgede her saat
 * yoktan dokuz altın üretirdi.
 */
export function payMiktari(gelir: number, oran: number): number {
  return Math.floor(gelir * oran);
}

/* ------------------------------------------------------------------ */
/* Çekirdek yatırımı (docs/16 §7)                                      */
/* ------------------------------------------------------------------ */

export type CekirdekBonus = 'ambar' | 'talimgah' | 'sur' | 'ocak';

export const CEKIRDEK_BONUSU: Record<CekirdekBonus, string> = {
  ambar: 'depo kapasitesi',
  talimgah: 'eğitim hızı',
  sur: 'garnizon savunması',
  ocak: 'bölge geliri',
};

/**
 * Bir sonraki çekirdek seviyesinin bedeli.
 *
 * MALİYET ÜYE SAYISIYLA ÖLÇEKLENİYOR — önerinin en önemli tek satırı.
 * Sabit maliyet olsaydı kalabalık medeniyet çekirdeğini hızlı büyütür,
 * daha çok kazanır, daha çok oyuncu çeker: kartopu fraksiyon ölçeğinde.
 * Üyeyle ölçeklenen maliyet büyük medeniyeti daha hızlı değil sadece
 * daha kalabalık yapıyor; küçük medeniyet kendi hızında ilerliyor.
 */
export function cekirdekMaliyeti(
  mevcutSeviye: number,
  aktifUye: number,
): { altin: number; demir: number; erzak: number } | null {
  const y = M.cekirdek_yatirim;
  if (mevcutSeviye >= y.azami_seviye) return null;
  const carpan = Math.pow(y.seviye_carpani, mevcutSeviye) * Math.max(1, aktifUye);
  return {
    altin: Math.round(y.taban_maliyet.altin * carpan),
    demir: Math.round(y.taban_maliyet.demir * carpan),
    erzak: Math.round(y.taban_maliyet.erzak * carpan),
  };
}

export const CEKIRDEK_AZAMI_SEVIYE = M.cekirdek_yatirim.azami_seviye;

/* ------------------------------------------------------------------ */
/* Fayda puanı (docs/16 §9)                                            */
/* ------------------------------------------------------------------ */

/**
 * FAYDA PUANI GÜÇ SATIN ALMAZ. Bu kural katı ve tek.
 *
 * Puan kimlik (unvan, arma, sancak), kolaylık ve içerik erişimi alır.
 * Güç yalnız çekirdek yatırımından gelir ve o herkese eşit işler.
 * Puanla güç satılsaydı çok oynayan daha güçlü olur, daha çok puan
 * kazanır — kartopu bireysel ölçekte, üstelik freni olmadan geri
 * dönerdi.
 */
export function garnizonFaydaPuani(yer: number, saat: number): number {
  return Math.floor(yer * saat * M.fayda_puani.garnizon_saat_basina_yer_basina);
}

export function bagisFaydaPuani(toplamKaynak: number): number {
  return Math.floor((toplamKaynak / 1000) * M.fayda_puani.cekirdek_bagis_bin_kaynak_basina);
}

export const FAYDA_FETIH = M.fayda_puani.fetihe_katilim;
export const FAYDA_SAVUNMA = M.fayda_puani.savunmaya_katilim;
