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
  kartopu_freni: { onde_esik: number; yagma_bonusu: number; en_az_tutulan_bolge: number };
  fayda_puani: {
    garnizon_saat_basina_yer_basina: number;
    fetihe_katilim: number;
    savunmaya_katilim: number;
    cekirdek_bagis_bin_kaynak_basina: number;
    rutbeler: { esik: number; ad: string; aciklama: string }[];
  };
  degisim: { bekleme_gun: number; fayda_sifirlanir: boolean };
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

/**
 * Fayda puanından TÜREYEN medeniyet rütbesi.
 *
 * Puan harcanmıyor, birikiyor. Bir dükkân açsaydık puanın karşılığı "ne
 * aldın" olurdu; böyle "ne yaptın" oluyor — ve §9'un katı kuralı
 * kendiliğinden korunuyor: rütbe hiçbir sayıya dokunmuyor.
 *
 * Yapı bilerek `unvan()`ın aynısı (kimlik.ts): şöhret nasıl unvana
 * dönüşüyorsa fayda puanı da rütbeye dönüşüyor. İkinci bir sayaç,
 * ikinci bir tablo yok.
 */
export interface FaydaRutbesi {
  ad: string;
  aciklama: string;
  /** Bir sonraki rütbenin eşiği — en üsttekinde null. */
  sonrakiEsik: number | null;
  sonrakiAd: string | null;
}

export function faydaRutbesi(puan: number): FaydaRutbesi {
  const k = M.fayda_puani.rutbeler;
  let i = 0;
  for (let n = 0; n < k.length; n++) if (puan >= k[n]!.esik) i = n;
  const sonraki = k[i + 1] ?? null;
  return {
    ad: k[i]!.ad,
    aciklama: k[i]!.aciklama,
    sonrakiEsik: sonraki?.esik ?? null,
    sonrakiAd: sonraki?.ad ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Medeniyet değişimi (docs/16 §13 soru 3)                             */
/* ------------------------------------------------------------------ */

export const DEGISIM_BEKLEME_GUN = M.degisim.bekleme_gun;
export const DEGISIMDE_FAYDA_SIFIRLANIR = M.degisim.fayda_sifirlanir;

/**
 * Taraf değiştirilebilir mi — değiştirilemiyorsa NEDEN?
 *
 * Önce mekanizma hiç yoktu ve oyuncuya da söylenmiyordu: sessiz bir
 * hayırdı. Sessiz kural, oyuncunun kafasında "belki vardır"ı sonsuza
 * kadar yaşatıyor.
 *
 * Üç kapı var ve üçü de aynı tasarımdan çıkıyor:
 *
 *  1. HEDEF AÇIK OLMALI — yani nüfusu ortalamanın altında. Kayıttaki
 *     kuralın aynısı (`acikMedeniyetler`). Kazanan tarafa geçiş böylece
 *     imkânsız: değişim kartopunu büyütemez, ancak dengeler.
 *  2. BEKLEME — taraf değiştirmek kimlik kararı, taktik değil. Süre
 *     olmasaydı savaş öncesi güçlüye, savaş sonrası kazanana geçilirdi.
 *  3. FAYDA SIFIRLANIR — puan ESKİ tarafa verilen hizmetin kaydı.
 *     Taşınsaydı, hiç katkı vermemiş biri üstüne rütbe giyerek gelirdi.
 *
 * Sebep dizesi kullanıcıya gösterilmek için: "olmaz" demek yetmiyor,
 * neden olmadığını söylemek gerekiyor.
 */
export interface DegisimDurumu {
  olur: boolean;
  sebep: string | null;
  /** Şu an geçilebilecek medeniyetler. */
  secenekler: MedeniyetId[];
  /** Beklemenin bitmesine kalan gün (0 ise bekleme yok). */
  kalanGun: number;
}

export function degisimDurumu(
  simdikiId: MedeniyetId | null,
  hedefId: MedeniyetId | null,
  nufus: Readonly<Record<MedeniyetId, number>>,
  sonDegisim: Date | null,
  simdi: Date,
): DegisimDurumu {
  // Kendi medeniyeti seçeneklerden düşüyor: "geçebileceğin yerler"
  // listesinde zaten olduğun yerin bulunması anlamsız.
  const secenekler = acikMedeniyetler(nufus).filter((id) => id !== simdikiId);
  const gecenGun = sonDegisim
    ? (simdi.getTime() - sonDegisim.getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY;
  const kalanGun = Math.max(0, Math.ceil(DEGISIM_BEKLEME_GUN - gecenGun));

  const temel = { secenekler, kalanGun };
  if (kalanGun > 0) {
    return {
      ...temel,
      olur: false,
      sebep: `Taraf değiştirmek için ${kalanGun} gün daha beklemelisin.`,
    };
  }
  if (!hedefId) return { ...temel, olur: false, sebep: null };
  if (hedefId === simdikiId) {
    return { ...temel, olur: false, sebep: 'Zaten bu medeniyettensin.' };
  }
  if (!medeniyet(hedefId)) return { ...temel, olur: false, sebep: 'Böyle bir medeniyet yok.' };
  if (!secenekler.includes(hedefId)) {
    return {
      ...temel,
      olur: false,
      sebep: 'O medeniyet kalabalık. Yalnız nüfusu ortalamanın altındaki bir tarafa geçebilirsin.',
    };
  }
  return { ...temel, olur: true, sebep: null };
}

/* ------------------------------------------------------------------ */
/* Kartopu freni (docs/16 §10, dördüncü risk)                          */
/* ------------------------------------------------------------------ */

/**
 * FRAKSİYON LİDER AVI — bireysel frenin medeniyet ölçeğindeki karşılığı.
 *
 * `docs/16` §10 dördüncü riskin panzehirini iki parça olarak yazmıştı:
 * üyeyle ölçeklenen çekirdek maliyeti (§7) VE "mevcut liderAvi freninin
 * fraksiyon sürümü: en çok bölge tutan medeniyet yağmalanırken daha çok
 * verir". Birinci parça büyümeyi yavaşlatıyor, ikincisi büyüyeni HEDEF
 * yapıyor. Yalnız birincisi varken ölçüm kartopunu görebiliyor ama
 * hiçbir şey frene basmıyordu.
 *
 * Ölçüt ŞÖHRET DEĞİL TOPRAK PAYI, çünkü medeniyet ölçeğinde kartopu
 * "bir lord zirvede" değil "bir taraf haritayı yutuyor" demek. Bireysel
 * lider avı (balance.json → lider_avi) olduğu gibi duruyor; ikisi üst
 * üste binebiliyor ve binmesi isteniyor.
 *
 * Bonus YALNIZ YAĞMA. Önde giden medeniyetin savaş gücüne dokunmuyoruz:
 * nerf, zirveye çıkmayı anlamsızlaştırır ve oyuncuyu cezalandırır. Ödül
 * ise herkese bir hedef verir — önde giden taraf da bunu bilerek savunma
 * kurar.
 */
export const KARTOPU_FRENI = {
  /** Toprak payı bu oranı geçince fren açılıyor. */
  esik: M.kartopu_freni.onde_esik,
  /** Fren açıkken o medeniyetin bölgelerinden yağma bu oranda artıyor. */
  yagmaBonusu: M.kartopu_freni.yagma_bonusu,
  /** Bu kadar bölge tutulmadan "önde giden" anlamsız. */
  enAzTutulan: M.kartopu_freni.en_az_tutulan_bolge,
} as const;

/**
 * Freni açık olan medeniyet — yoksa null.
 *
 * Girdi: medeniyet başına TUTULAN bölge sayısı. Anahtarların ne olduğu
 * önemsiz (denge anahtarı da olur, veritabanı satır kimliği de);
 * karşılaştırılan tek şey payların birbirine oranı.
 *
 * Beraberlikte fren AÇILMIYOR: iki taraf eşit öndeyse ortada bir
 * kartopu değil bir denge var ve ikisini birden hedef göstermek
 * "önde gideni avla" cümlesini anlamsızlaştırırdı.
 */
export function kartopuLideri(sayilar: Readonly<Record<string, number>>): string | null {
  const girdiler = Object.entries(sayilar).filter(([, n]) => n > 0);
  const toplam = girdiler.reduce((t, [, n]) => t + n, 0);
  if (toplam < KARTOPU_FRENI.enAzTutulan) return null;

  let ondeki: string | null = null;
  let enCok = -1;
  let berabere = false;
  for (const [id, n] of girdiler) {
    if (n > enCok) {
      enCok = n;
      ondeki = id;
      berabere = false;
    } else if (n === enCok) {
      berabere = true;
    }
  }
  if (!ondeki || berabere) return null;
  return enCok / toplam > KARTOPU_FRENI.esik ? ondeki : null;
}

/** Fren açıkken önde gidenin payı — arayüz "şu an %38 tutuyor" desin diye. */
export function kartopuPayi(sayilar: Readonly<Record<string, number>>): number | null {
  const ondeki = kartopuLideri(sayilar);
  if (!ondeki) return null;
  const toplam = Object.values(sayilar).reduce((t, n) => t + n, 0);
  return toplam > 0 ? (sayilar[ondeki] ?? 0) / toplam : null;
}

/**
 * Bu bölgeyi tutan medeniyet önde giden mi — yağma bonusu ne kadar?
 *
 * Sahipsiz (çekişmeli) bölge bonus vermiyor: orada yutulan bir şey yok,
 * kavganın zaten olduğu yer orası.
 */
export function kartopuYagmaBonusu(
  sayilar: Readonly<Record<string, number>>,
  bolgeninMedeniyeti: string | null,
): number {
  if (!bolgeninMedeniyeti) return 0;
  return kartopuLideri(sayilar) === bolgeninMedeniyeti ? KARTOPU_FRENI.yagmaBonusu : 0;
}

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
