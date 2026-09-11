/**
 * Akın: beş NPC haritası, her birinde on düşman grubu (docs/12 §6).
 *
 * NEDEN VAR. Dünya haritası TOPRAK veriyor ve toprak kıt: 61 bölge,
 * yüzlerce lord. Oyuncunun elinde ordu varken yapacak bir şeyi olmadığı
 * saatler bu yüzden doğuyordu — komşusu kalkanlı, önerilen hedef uzak,
 * eldeki asker bekliyor. Akın o boşluğu dolduruyor: kimseyle çakışmadan
 * saldırılacak bir hedef, kaynak ve ekipman karşılığı.
 *
 * ÜÇ KURAL, üçü de bilinçli:
 *
 * 1. **Akın toprak vermez.** Burası kaynak ve ekipman kapısı. Toprak
 *    dünya haritasından, yani başka bir oyuncudan alınır. Akından toprak
 *    çıksaydı PvP'nin tek sebebi ortadan kalkardı.
 * 2. **Savaş GERÇEK.** Aynı motor, aynı dizilim, aynı taktik, aynı
 *    kayıp ve aynı hastane. "Kolay mod" bir savaş simülasyonu değil,
 *    oyuncunun ordusunu öğrendiği yer.
 * 3. **Yenilenme oyuncuya özel.** Vurulan grup o oyuncu için gri kalır,
 *    başkası için durur. Ortak olsaydı kalabalık bir dünyada harita hep
 *    boş görünürdü.
 *
 * SAF: burada veritabanı yok. Hangi grubun açık olduğu, çağıranın
 * verdiği "son vuruş" listesinden TÜRETİLİYOR.
 */
import { AKIN_HARITALARI, AKIN_YOL, B, unit } from './balance.js';
import type { Army, Resources, UnitType } from './types.js';
import { UNIT_TYPES } from './types.js';

export interface AkinHarita {
  key: string;
  ad: string;
  dusman: string;
  /** Haritadaki figürün dosya adı: 1-9 `<key>`, 10 `<key>_sef`. */
  dusmanKey: string;
  ozet: string;
  acilisSeviyesi: number;
  azamiTier: number;
}

/**
 * On kampın diyar haritasındaki yeri — beş diyarda da AYNI.
 *
 * Diyarı ayıran şey zemin, yolun şekli değil. Oyuncu bir kez öğreniyor
 * ("1 sol altta, şef sağ üstte") ve bu beş diyarda da geçerli oluyor;
 * ayrıca zemin istemi tam bu yolu tarif ediyor, yani yol diyara göre
 * değişseydi zeminle koordine edilemezdi (`data/akinlar.json` → `_yol_notu`).
 */
export const AKIN_YOLU: { x: number; y: number }[] = AKIN_YOL;

export const AKINLAR: AkinHarita[] = AKIN_HARITALARI.map((h) => ({
  key: h.key,
  ad: h.ad,
  dusman: h.dusman,
  ozet: h.ozet,
  dusmanKey: h.dusman_key,
  acilisSeviyesi: h.acilis_seviyesi,
  azamiTier: h.azami_tier,
}));

export const AKIN_ANAHTARLARI: string[] = AKINLAR.map((h) => h.key);

/** Harita tanımı; bilinmeyen anahtarda null. */
export function akinHaritasi(key: string): (typeof AKIN_HARITALARI)[number] | null {
  return AKIN_HARITALARI.find((h) => h.key === key) ?? null;
}

/** Grup numarası geçerli mi (1..10). */
export function akinGrubuGecerliMi(grupNo: number): boolean {
  return Number.isInteger(grupNo) && grupNo >= 1 && grupNo <= B.akin.grup_sayisi;
}

/** Onuncu grup şeftir: garnizonu ağır, ödülü büyük, yenilenmesi uzun. */
export function sefMi(grupNo: number): boolean {
  return grupNo === B.akin.grup_sayisi;
}

/**
 * Bir grubun garnizonu.
 *
 * Elli garnizonu elle yazmak yerine haritanın KARIŞIMI ile grubun
 * BÜYÜKLÜĞÜ çarpılıyor: dengeyi değiştirmek için tek bir sayıyı
 * (`garnizon_taban` ya da haritanın `guc_carpani`si) oynatmak yetiyor.
 * Elle yazsaydık ilk denge turunda elli satır güncellemek gerekirdi ve
 * biri mutlaka atlanırdı.
 *
 * Yuvarlama AŞAĞI ama her birimden en az 1: karışımda payı olan bir
 * birimin ilk gruplarda sıfıra yuvarlanması, taş-kağıt-makasın erken
 * oyunda hiç görünmemesi demekti.
 */
export function akinGarnizonu(haritaKey: string, grupNo: number): Army {
  const h = akinHaritasi(haritaKey);
  if (!h || !akinGrubuGecerliMi(grupNo)) return {};
  const A = B.akin;
  let toplam = A.garnizon_taban * h.guc_carpani * Math.pow(A.garnizon_us, grupNo - 1);
  if (sefMi(grupNo)) toplam *= A.sef_carpani;

  const ordu: Army = {};
  for (const t of UNIT_TYPES) {
    const pay = h.karisim[t] ?? 0;
    if (pay <= 0) continue;
    ordu[t] = Math.max(1, Math.floor(toplam * pay));
  }
  return ordu;
}

/** Garnizonun toplam birim sayısı — arayüz "kaç kişi" diye soruyor. */
export function akinGarnizonSayisi(haritaKey: string, grupNo: number): number {
  const ordu = akinGarnizonu(haritaKey, grupNo);
  return UNIT_TYPES.reduce((t, u) => t + (ordu[u] ?? 0), 0);
}

/**
 * Akının süresi: gidiş, savaş ve dönüş TEK sayı.
 *
 * PvP yürüyüşü iki aşamalı (önce saldırı, sonra dönüş) çünkü bölge el
 * değiştiriyor ve arada bir şey oluyor. Akında bölge el değiştirmiyor;
 * iki aşama yapmak oyuncuya iki bekleyiş ve iki bildirim verip hiçbir
 * karar kazandırmazdı.
 */
export function akinSuresiSn(haritaKey: string, grupNo: number): number {
  const h = akinHaritasi(haritaKey);
  if (!h || !akinGrubuGecerliMi(grupNo)) return B.akin.sure_taban_sn;
  const A = B.akin;
  let sn = A.sure_taban_sn + A.sure_grup_basina_sn * (grupNo - 1);
  sn *= h.guc_carpani;
  if (sefMi(grupNo)) sn *= A.sef_sure_carpani;
  return Math.round(sn);
}

/** Vurulan grubun yeniden dolması: normal 4 saat, şef 12. */
export function akinYenilenmeSn(grupNo: number): number {
  return (sefMi(grupNo) ? B.akin.sef_yenilenme_saat : B.akin.yenilenme_saat) * 3600;
}

/** Grubun KESİN kaynak ödülü. */
export function akinOdulu(haritaKey: string, grupNo: number): Resources {
  const h = akinHaritasi(haritaKey);
  if (!h || !akinGrubuGecerliMi(grupNo)) return { altin: 0, demir: 0, erzak: 0 };
  const A = B.akin;
  /*
   * Harita çarpanı `odul_carpani`, `guc_carpani` DEĞİL.
   *
   * İkisi aynı sayı olsaydı beş haritanın saatlik verimi eşit çıkardı:
   * süre de `guc_carpani` ile uzuyor ve ikisi birbirini tam götürüyor.
   * İlk yazışta böyleydi ve EN KOLAY harita saatlik en çok altını
   * veriyordu — son haritaya gitmenin tek sebebi ekipman kademesi
   * kalıyordu.
   */
  const buyume =
    h.odul_carpani * Math.pow(A.odul_us, grupNo - 1) * (sefMi(grupNo) ? A.sef_carpani : 1);
  const hesap = (k: 'altin' | 'demir' | 'erzak'): number =>
    Math.round(A.odul_taban[k] * (h.odul_agirligi[k] ?? 1) * buyume);
  return { altin: hesap('altin'), demir: hesap('demir'), erzak: hesap('erzak') };
}

/** Grubun verdiği tecrübe. */
export function akinXp(grupNo: number): number {
  if (!akinGrubuGecerliMi(grupNo)) return 0;
  const A = B.akin;
  return Math.round(
    A.xp_taban * Math.pow(A.xp_us, grupNo - 1) * (sefMi(grupNo) ? A.sef_carpani : 1),
  );
}

/**
 * Ekipman düşme ihtimali ve kademesi.
 *
 * Kaynak KESİN, ekipman ŞANSA bağlı (docs/12 §6): akının bir kere daha
 * gidilecek yer olması buna bağlı. Kademe hem grubun zorluğuna hem
 * haritanın tavanına bakıyor — Kırık Sahil'in şefi asla T5 düşürmüyor,
 * yoksa ilk harita son haritayı gereksiz kılardı.
 */
export function akinEkipmanSansi(
  haritaKey: string,
  grupNo: number,
): { ihtimal: number; tier: number } {
  const h = akinHaritasi(haritaKey);
  if (!h || !akinGrubuGecerliMi(grupNo)) return { ihtimal: 0, tier: 1 };
  const A = B.akin;
  const ihtimal = sefMi(grupNo)
    ? A.sef_ekipman_ihtimali
    : A.ekipman_ihtimali_taban + A.ekipman_ihtimali_grup_basina * (grupNo - 1);

  // Eşik tablosu: tier N için gereken en küçük grup numarası.
  const esikler = A.tier_grup_esikleri as number[];
  let tier = 1;
  for (let i = 0; i < esikler.length; i++) {
    if (grupNo >= (esikler[i] ?? Infinity)) tier = i + 1;
  }
  return { ihtimal: Math.min(1, ihtimal), tier: Math.min(tier, h.azami_tier) };
}

/** Bir grubun oyuncuya göre durumu. */
export interface AkinGrupDurumu {
  grupNo: number;
  ad: string;
  sef: boolean;
  garnizon: Army;
  garnizonSayisi: number;
  sureSn: number;
  odul: Resources;
  xp: number;
  ekipmanIhtimali: number;
  ekipmanTier: number;
  /** Şu an vurulabilir mi. */
  acik: boolean;
  /** Vurulduysa ne zaman yenilenecek. */
  yenilenirAt: string | null;
}

export interface AkinHaritaDurumu extends AkinHarita {
  /** Lordun seviyesi haritayı açtı mı. */
  acik: boolean;
  /** Kapalıysa kaç seviye gerekiyor. */
  gerekenSeviye: number;
  gruplar: AkinGrupDurumu[];
  /** Şu an vurulabilir grup sayısı — kart tek bakışta bunu gösteriyor. */
  acikGrup: number;
}

/** Bir grubun son vuruluşu: `${haritaKey}:${grupNo}` → zaman. */
export type AkinVuruslari = Record<string, Date | string>;

function vurusAnahtari(haritaKey: string, grupNo: number): string {
  return `${haritaKey}:${grupNo}`;
}

/**
 * Bütün haritaların oyuncuya göre hâli.
 *
 * `vuruslar` çağıranın verdiği "bu lord hangi grubu ne zaman düşürdü"
 * tablosu. Yenilenme bundan TÜRETİLİYOR: ayrı bir "grup dolu mu" sütunu
 * tutmuyoruz, çünkü o sütunu güncelleyecek bir zamanlayıcı gerekirdi ve
 * zamanlayıcı uyuduğunda harita yanlış görünürdü.
 */
export function akinDurumlari(
  lordSeviyesi: number,
  vuruslar: AkinVuruslari,
  simdi: Date = new Date(),
): AkinHaritaDurumu[] {
  return AKIN_HARITALARI.map((h) => {
    const haritaAcik = lordSeviyesi >= h.acilis_seviyesi;
    const gruplar: AkinGrupDurumu[] = h.gruplar.map((ad, i) => {
      const grupNo = i + 1;
      const ham = vuruslar[vurusAnahtari(h.key, grupNo)];
      const vurulduAt = ham ? new Date(ham) : null;
      const yenilenir =
        vurulduAt && !Number.isNaN(vurulduAt.getTime())
          ? new Date(vurulduAt.getTime() + akinYenilenmeSn(grupNo) * 1000)
          : null;
      const bekliyor = yenilenir !== null && yenilenir > simdi;
      const sans = akinEkipmanSansi(h.key, grupNo);
      const garnizon = akinGarnizonu(h.key, grupNo);
      return {
        grupNo,
        ad,
        sef: sefMi(grupNo),
        garnizon,
        garnizonSayisi: UNIT_TYPES.reduce((t, u) => t + (garnizon[u] ?? 0), 0),
        sureSn: akinSuresiSn(h.key, grupNo),
        odul: akinOdulu(h.key, grupNo),
        xp: akinXp(grupNo),
        ekipmanIhtimali: sans.ihtimal,
        ekipmanTier: sans.tier,
        acik: haritaAcik && !bekliyor,
        yenilenirAt: bekliyor ? yenilenir.toISOString() : null,
      };
    });
    return {
      key: h.key,
      ad: h.ad,
      dusman: h.dusman,
      dusmanKey: h.dusman_key,
      ozet: h.ozet,
      acilisSeviyesi: h.acilis_seviyesi,
      azamiTier: h.azami_tier,
      acik: haritaAcik,
      gerekenSeviye: h.acilis_seviyesi,
      gruplar,
      acikGrup: gruplar.filter((g) => g.acik).length,
    };
  });
}

/**
 * Akına gönderilen ordu geçerli mi.
 *
 * Boş orduyla akın "bedava kayıp" olurdu: savaş çözülür, oyuncu kaybeder,
 * grup yine de vurulmuş sayılmaz ve oyuncu ne olduğunu anlamaz. Sunucu
 * bunu baştan reddediyor ve sebebini söylüyor (docs/09 İ1).
 */
export function akinOrdusuEngeli(ordu: Army): string | null {
  const toplam = UNIT_TYPES.reduce((t, u) => t + (ordu[u] ?? 0), 0);
  if (toplam <= 0) return 'Akına boş orduyla çıkılmaz.';
  return null;
}

/**
 * Bu garnizona karşı önerilen en küçük ordu — kabaca.
 *
 * Kesin bir söz değil, bir BÜYÜKLÜK ölçüsü: "yaklaşık bu kadar asker
 * götür". Kesin cevabı savaş önizlemesi veriyor; buradaki sayı, oyuncu
 * daha grubu seçmeden "bu bana göre mi" sorusunu cevaplıyor.
 */
export function akinOnerilenOrdu(haritaKey: string, grupNo: number): number {
  const garnizon = akinGarnizonu(haritaKey, grupNo);
  // Savunanın ham gücü kadar saldırı gücü, üstüne pay.
  const savunma = UNIT_TYPES.reduce((t, u) => t + (garnizon[u] ?? 0) * unit(u).savunma, 0);
  const ortalamaSaldiri =
    UNIT_TYPES.reduce((t, u) => t + unit(u).saldiri, 0) / Math.max(1, UNIT_TYPES.length);
  return Math.max(1, Math.ceil((savunma * 1.35) / Math.max(1, ortalamaSaldiri)));
}

/** Ordunun kapladığı komuta yeri — akın ekranı da aynı ölçüyü kullanıyor. */
export function akinOrduYeri(ordu: Army): number {
  return UNIT_TYPES.reduce((t, u) => t + (ordu[u] ?? 0) * unit(u as UnitType).yer, 0);
}
