/**
 * General pasiflerini ve yeteneklerini tek bir bonus nesnesine toplar.
 *
 * Tamamen veri güdümlü: generals.json'daki `pasif.etki` alanı hangi bonusa
 * yazılacağını belirler. Yeni bir etki eklemek = switch'e bir satır.
 */
import { GENERAL_INJURY, GENERAL_LEVEL, GENERAL_UZMANLIK, generalDef } from './balance.js';
import type { GeneralBonus, GeneralUzmanligi } from './types.js';
import { bosGeneralBonus } from './types.js';

export interface EquippedGeneral {
  key: string;
  level: number;
  /** Seçilmiş uzmanlık yolu (anahtar); yoksa null. */
  uzmanlik?: string | null;
}

/*
 * UZMANLIK (generals.json `uzmanlik`, docs/09 §2.3).
 *
 * Her general 10. seviyede iki yoldan birini seçiyor: pasifini
 * derinleştiren ya da ona yan bir etki ekleyen. Yeni general değil,
 * mevcut kadroda bir karar: aynı Demirci Yusuf'u biri savunma duvarına,
 * öteki zırh ustasına çeviriyor. Etki pasif gibi seviyeyle büyüyor.
 */
export const UZMANLIK_SEVIYESI: number = GENERAL_UZMANLIK.seviye;

export function uzmanlikAcikMi(level: number): boolean {
  return level >= UZMANLIK_SEVIYESI;
}

export function uzmanlikTanimi(
  key: string,
  uzmanlik: string | null | undefined,
): GeneralUzmanligi | null {
  if (!uzmanlik) return null;
  return generalDef(key)?.uzmanliklar?.find((u) => u.key === uzmanlik) ?? null;
}

/** Yolu değiştirmenin bedeli: generalin kiralama fiyatının bir oranı. İlk seçim bedava. */
export function uzmanlikDegistirmeBedeli(key: string): number {
  const def = generalDef(key);
  return def ? Math.round(def.maliyet_altin * GENERAL_UZMANLIK.degistirme_orani) : 0;
}

/** Bir pasif etkisini bonusa yazar — general pasifi ve uzmanlık aynı yoldan. */
function etkiEkle(b: GeneralBonus, etki: string, v: number): void {
  switch (etki) {
    case 'ordu_saldiri':
      b.orduSaldiri += v;
      break;
    case 'ordu_savunma':
      b.orduSavunma += v;
      break;
    case 'ordu_can':
      b.orduCan += v;
      break;
    case 'savunmada_ordu_savunma':
      b.savunmadaOrduSavunma += v;
      break;
    case 'okcu_saldiri':
      b.birimSaldiri.okcu = (b.birimSaldiri.okcu ?? 0) + v;
      break;
    case 'kusatma_saldiri':
      b.birimSaldiri.kusatma = (b.birimSaldiri.kusatma ?? 0) + v;
      break;
    case 'mizrakci_savunma':
      b.birimSavunma.mizrakci = (b.birimSavunma.mizrakci ?? 0) + v;
      break;
    case 'lord_savas_katkisi':
      b.lordSavasKatkisi += v;
      break;
    case 'yagma':
      b.yagma += v;
      break;
    case 'bolge_geliri':
      b.bolgeGeliri += v;
      break;
    case 'ordu_bakim_maliyeti':
      b.bakimMaliyeti += v;
      break;
    case 'yuruyus_suresi':
      b.yuruyusSuresi += v;
      break;
    case 'kayip_geri_donus':
      b.kayipGeriDonus += v;
      break;
  }
}

/** Seviye çarpanı: her seviye pasifi %2 güçlendirir (Lv20 -> ×1.38). */
export function generalLevelMultiplier(level: number): number {
  return 1 + 0.02 * Math.max(0, level - 1);
}

export function generalXpForLevel(level: number): number {
  if (level >= GENERAL_LEVEL.max) return Infinity;
  return Math.round(GENERAL_LEVEL.xp_katsayi * Math.pow(level, GENERAL_LEVEL.xp_us));
}

export function generalLevelFromXp(totalXp: number): { level: number; xpIntoLevel: number } {
  let level = 1;
  let remaining = totalXp;
  while (level < GENERAL_LEVEL.max) {
    const need = generalXpForLevel(level);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return { level, xpIntoLevel: level >= GENERAL_LEVEL.max ? 0 : remaining };
}

/**
 * Seviye + seviyedeki ilerlemeden TOPLAM XP'ye. generalLevelFromXp'in tersi.
 *
 * Kayıtta iki alan tutuluyor (level, xp) ama generalLevelFromXp toplam XP
 * bekliyor; savaş sonunda XP eklemek için önce toplama dönmek gerekiyor.
 * Bu çevrim api tarafında elle yazılmıştı ve eğriyi (200 * n^1.4) kod
 * içinde ikinci kez tanımlıyordu. generals.json'daki katsayılar bir gün
 * değişse motor sessizce sapardı: aynı generalin XP'si eklenirken bir
 * eğriye, seviyesi okunurken başka bir eğriye göre hesaplanırdı. Tek
 * kaynak generalXpForLevel olsun diye buraya taşındı.
 */
export function generalToplamXp(level: number, xpIntoLevel: number): number {
  let toplam = Math.max(0, xpIntoLevel);
  for (let n = 1; n < level; n++) toplam += generalXpForLevel(n);
  return toplam;
}

/** Bir savaşın generale ne kadar XP kazandırdığı: lordun kazandığının payı. */
export function generalSavasXp(lordXp: number): number {
  return Math.round(lordXp * GENERAL_LEVEL.xp_pay);
}

/** Kaybedilen savaşta generalin yaralanma ihtimali ve dinlenme süresi. */
export function generalYaralanma(): { ihtimal: number; saat: number } {
  return { ihtimal: GENERAL_INJURY.ihtimal, saat: GENERAL_INJURY.saat };
}

/**
 * Savaştan sonra generalin yeni hâli. Saf: rastgelelik ve saat dışarıda.
 *
 * `atlanan` savaşın kendisinde kaç seviye atlandığını söylüyor. Motor bunu
 * zaten hesaplıyordu ama kimseye söylemiyordu: oyuncu generalini sahaya
 * sürüp XP çubuğunun dolduğunu görüyor, seviye atladığı ANI hiç görmüyordu.
 * Güçlenme hissinin en görünür olması gereken yer orası (docs/09 §2.3).
 */
export interface GeneralSavasSonucu {
  level: number;
  xpIntoLevel: number;
  atlanan: number;
  kazanilanXp: number;
}

/** Bu savaşta seviye atlayan bir general — rapor ve olay akışı için. */
export interface GeneralYukselisi {
  key: string;
  ad: string;
  onceki: number;
  sonraki: number;
  kazanilanXp: number;
}

export function generalSavasSonrasi(
  level: number,
  xpIntoLevel: number,
  lordXp: number,
): GeneralSavasSonucu {
  const kazanilanXp = generalSavasXp(lordXp);
  const yeni = generalLevelFromXp(generalToplamXp(level, xpIntoLevel) + kazanilanXp);
  return {
    level: yeni.level,
    xpIntoLevel: yeni.xpIntoLevel,
    atlanan: Math.max(0, yeni.level - level),
    kazanilanXp,
  };
}

/** Sahadaki generallerin toplam etkisi. */
export function aggregateGeneralBonus(equipped: EquippedGeneral[]): GeneralBonus {
  const b = bosGeneralBonus();

  for (const g of equipped) {
    const def = generalDef(g.key);
    if (!def) continue;
    const mult = generalLevelMultiplier(g.level);
    etkiEkle(b, def.pasif.etki, def.pasif.deger * mult);
    // Uzmanlık yalnız açıldığı seviyeden sonra sayılıyor: seviyesi düşük
    // bir kayıtta (veri düzeltmesi, eski hesap) seçim duruyor ama etkisizdir.
    const u = uzmanlikAcikMi(g.level) ? uzmanlikTanimi(g.key, g.uzmanlik) : null;
    if (u) etkiEkle(b, u.etki, u.deger * mult);

    // Yeteneklerin mekanik karşılıkları
    const ek = def.ek_etki as Record<string, number | boolean> | undefined;
    if (ek) {
      if (typeof ek.komuta_kapasitesi === 'number') b.komutaKapasitesi += ek.komuta_kapasitesi;
      if (typeof ek.kale_delme === 'number') b.kaleDelme += ek.kale_delme;
    }
  }

  return b;
}

/** Bir generalin belirli bir ek etkisi var mı? */
export function hasAbility(equipped: EquippedGeneral[], ability: string): boolean {
  return equipped.some((g) => {
    const ek = generalDef(g.key)?.ek_etki as Record<string, unknown> | undefined;
    return ek ? ek[ability] === true || typeof ek[ability] === 'number' : false;
  });
}

export function abilityValue(equipped: EquippedGeneral[], ability: string): number {
  let total = 0;
  for (const g of equipped) {
    const ek = generalDef(g.key)?.ek_etki as Record<string, unknown> | undefined;
    const v = ek?.[ability];
    if (typeof v === 'number') total += v;
  }
  return total;
}

/** Savaş raporunda bir generalin ne yaptığını anlatan satır. */
export interface GeneralKatkisi {
  key: string;
  ad: string;
  nadirlik: string;
  level: number;
  /** Pasifin adı ve bu seviyedeki gerçek değeri (ör. %11 ordu savunma). */
  pasifAd: string;
  pasifEtki: string;
  pasifDeger: number;
  /** Yeteneği varsa adı ve açıklaması; yoksa null. */
  yetenekAd: string | null;
  yetenekAciklama: string | null;
  /** Seçilmiş ve açık uzmanlık: adı, etkisi, bu seviyedeki değeri. */
  uzmanlik?: { ad: string; etki: string; deger: number } | null;
}

/**
 * Sahadaki generallerin katkısını rapor için özetler.
 *
 * Neden ayrı bir fonksiyon: aggregateGeneralBonus tek bir toplam üretiyor ve
 * hangi generalin ne kattığı orada kayboluyor. Oyuncu generali sahaya
 * sürüyor, XP kazandığını görüyor ama savaşa ne kattığını göremiyordu —
 * güçlenme hissinin en görünür olması gereken yer burası.
 */
export function generalKatkilari(equipped: EquippedGeneral[]): GeneralKatkisi[] {
  const sonuc: GeneralKatkisi[] = [];
  for (const g of equipped) {
    const def = generalDef(g.key);
    if (!def) continue;
    sonuc.push({
      key: g.key,
      ad: def.ad,
      nadirlik: def.nadirlik,
      level: g.level,
      pasifAd: def.pasif.ad,
      pasifEtki: def.pasif.etki,
      pasifDeger: def.pasif.deger * generalLevelMultiplier(g.level),
      yetenekAd: def.yetenek?.ad ?? null,
      yetenekAciklama: def.yetenek?.aciklama ?? null,
      uzmanlik: (() => {
        const u = uzmanlikAcikMi(g.level) ? uzmanlikTanimi(g.key, g.uzmanlik) : null;
        return u
          ? { ad: u.ad, etki: u.etki, deger: u.deger * generalLevelMultiplier(g.level) }
          : null;
      })(),
    });
  }
  return sonuc;
}
