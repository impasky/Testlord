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
    seviye_basina: Record<CekirdekBonus, number>;
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
 * Bir çekirdek bölgenin TAŞIDIĞI bonus.
 *
 * Eşleme veritabanında DEĞİL, burada: `balance.json`daki çekirdek
 * listesinin sırasına göre türüyor. Sütun olsaydı veri ile kod
 * ayrışabilirdi — bir bölgenin bonusu iki yerde yazılı olurdu ve
 * biri diğerinden habersiz değişirdi.
 *
 * Beş çekirdeğin DÖRDÜ bonus taşıyor; beşincisi medeniyetin başkenti
 * (docs/16 §7-8) ve bonus yerine kimlik taşıyor. `null` dönmesi
 * "burada yatırım yok" değil, "burası başkent" demek.
 */
export function cekirdekBonusu(mapId: number): CekirdekBonus | null {
  const m = MEDENIYETLER.find((x) => x.cekirdekBolgeler.includes(mapId));
  if (!m) return null;
  const sira = m.cekirdekBolgeler.indexOf(mapId);
  const bonuslar: CekirdekBonus[] = ['ambar', 'talimgah', 'sur', 'ocak'];
  return bonuslar[sira] ?? null;
}

/** Bu medeniyetin BAŞKENTİ olan çekirdek — bonus taşımayan beşincisi. */
export function baskentCekirdegi(id: MedeniyetId): number | null {
  const m = medeniyet(id);
  if (!m) return null;
  return m.cekirdekBolgeler[4] ?? null;
}

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

/* ------------------------------------------------------------------ */
/* Nüfus dengesi (docs/16 §10, birinci risk)                           */
/* ------------------------------------------------------------------ */

/**
 * Yurdun bütün bölgeleri — kampın kurulabileceği yer burası.
 *
 * `docs/16` §8: oyuncunun başkenti KENDİ medeniyetinin yurdunda.
 * Kampın dokunulmazlığı zaten vardı; değişen tek şey nerede doğduğu.
 */
export function yurtBolgeleri(id: MedeniyetId): number[] {
  const m = medeniyet(id);
  if (!m) return [];
  return WORLD_MAP.regions.filter((r) => r.province === m.yurt).map((r) => r.id);
}

/**
 * Kayda AÇIK medeniyetler: aktif nüfusu ortalamanın üstünde olan kapalı.
 *
 * `docs/16` §10'un birinci riski "herkes kazanan tarafa yazılır". Serbest
 * seçim bu riski kesin gerçekleştirir: bir medeniyet öne geçtiği an
 * yenileri oraya akar ve fark kendi kendini büyütür.
 *
 * Kural bilerek ORTALAMAYA bakıyor, en aza değil. En az nüfuslu tek
 * medeniyeti açık tutmak, dört seçenekli bir oyunu tek seçeneğe
 * indirirdi — oyuncu hep aynı yere düşerdi. Ortalama ölçütü genelde
 * ikisini üçünü açık bırakıyor, yani seçim var ama kartopu yok.
 *
 * Liste ASLA boş dönmez: en az bir sayı her zaman ortalamanın altında
 * ya da ona eşittir. Hepsi eşitse (ilk gün) dördü de açık.
 */
export function acikMedeniyetler(nufus: Readonly<Record<MedeniyetId, number>>): MedeniyetId[] {
  const sayilar = MEDENIYETLER.map((m) => nufus[m.id] ?? 0);
  const ortalama = sayilar.reduce((s, n) => s + n, 0) / MEDENIYETLER.length;
  return MEDENIYETLER.filter((m) => (nufus[m.id] ?? 0) <= ortalama).map((m) => m.id);
}

/**
 * Yeni oyuncuya atanacak medeniyet: açık olanların EN AZ nüfuslusu.
 *
 * Eşitlikte `balance.json` sırası belirliyor — rastgelelik değil. Aynı
 * girdi aynı sonucu versin ki test edilebilsin; dengeyi zaten sayım
 * sağlıyor, zar atmaya gerek yok.
 */
export function atanacakMedeniyet(nufus: Readonly<Record<MedeniyetId, number>>): MedeniyetId {
  const acik = acikMedeniyetler(nufus);
  let secilen = acik[0]!;
  for (const id of acik) if ((nufus[id] ?? 0) < (nufus[secilen] ?? 0)) secilen = id;
  return secilen;
}

/**
 * Çekirdek yatırımlarının medeniyete kattığı bonuslar.
 *
 * Dört çekirdek dört ayrı şeyi büyütüyor ve HEPSİ o medeniyetteki
 * herkese işliyor (docs/16 §7) — yatırım yapmayan da yararlanıyor.
 * Bedavacılığı bonusu kısıtlayarak değil FAYDA PUANIYLA çözüyoruz
 * (§9): bonus herkese, puan yalnız katkı verene.
 */
export interface MedeniyetBonusu {
  /** Depo kapasitesi oranı (0.15 = +%15). */
  ambar: number;
  /** Eğitim hızı oranı. */
  talimgah: number;
  /** Garnizon savunması oranı. */
  sur: number;
  /** Bölge geliri oranı. */
  ocak: number;
}

export const BOS_MEDENIYET_BONUSU: MedeniyetBonusu = { ambar: 0, talimgah: 0, sur: 0, ocak: 0 };

/**
 * Yatırım seviyelerinden bonus oranlarına.
 *
 * Girdi `mapId -> seviye`: hangi çekirdeğin kaçıncı seviyede olduğu.
 * Bonus TÜRÜ veritabanında değil, `cekirdekBonusu(mapId)` ile haritadan
 * türüyor — sütun olsaydı bir bölgenin bonusu iki yerde yazılı olurdu.
 *
 * Başkent çekirdeği (beşincisi) bonus taşımıyor; ona yapılan yatırım
 * hiçbir orana eklenmiyor ve bu bilerek: başkent kimlik taşıyor.
 */
export function medeniyetBonusu(seviyeler: Readonly<Record<number, number>>): MedeniyetBonusu {
  const b: MedeniyetBonusu = { ...BOS_MEDENIYET_BONUSU };
  const basina = M.cekirdek_yatirim.seviye_basina;
  for (const [ham, seviye] of Object.entries(seviyeler)) {
    const tur = cekirdekBonusu(Number(ham));
    if (!tur) continue;
    const kademe = Math.max(0, Math.min(M.cekirdek_yatirim.azami_seviye, Math.floor(seviye)));
    b[tur] += basina[tur] * kademe;
  }
  return b;
}
