/**
 * DİYAR BİRLEŞMESİ — yaşıt diyarlar tek haritada buluşuyor.
 *
 * Kalıcı dünyada zaman tek yönlü işliyor. Oyuncular bırakıyor, yerlerine
 * kimse gelmiyor: diyar "dolu" göründüğü için kapısı kapalı, oysa içeride
 * altı kişi kalmış. Sonuç kırk hayalet şehir ve hiçbirinde oyun yok.
 *
 * Birleşme bunu tersine çeviriyor: altmış günü dolduran bir diyar, kendi
 * YAŞITIYLA birleşip tek bir kalabalık diyar oluyor.
 *
 * ── Neden yaş yakınlığı ───────────────────────────────────────────────
 *
 * Eşleri açılış tarihine göre seçmek kozmetik değil, DENGE kararı. Altmış
 * günlük bir diyarın oyuncuları Lv10-25 arasında; dört yüz günlük bir
 * diyarınkiler Lv60. İkisini birleştirmek, yeni oyuncuyu ilk gün
 * dokunulmaz komşuların arasına bırakmak olurdu — üstelik seviye farkı
 * kilidi (8+) yüzünden o komşulara saldıramadan.
 *
 * ── Neden harita taşınmıyor ───────────────────────────────────────────
 *
 * Her diyar AYNI 121 bölgelik haritayı kullanıyor. "Akçakavak Köyü" iki
 * diyarda da var ve iki ayrı lordun olabilir. İki haritayı üst üste
 * koymak mümkün değil; taşınabilen şey LORD ve — yeri boşsa — toprağı.
 *
 * Bu dosya kararı veriyor, uygulamayı `apps/api/src/services/birlesme.ts`
 * yapıyor. Burası saf: veritabanı yok, tarih aritmetiği ve kural var.
 */
import { B } from './balance.js';
import { regionIncome } from './economy.js';

export interface BirlesmeAdayi {
  id: string;
  ad: string;
  openedAt: Date;
  /** Diyarın oyuncu kapasitesi. */
  kapasite?: number;
  /** Son yedi günde oyuna girmiş lord sayısı. */
  aktifLord: number;
  /** Diyardaki toplam lord sayısı. */
  lordSayisi: number;
  /** 'open' | 'full' | 'closed' */
  durum: string;
  /** Zaten ilan edilmiş bir birleşmesi var mı. */
  planliMi?: boolean;
}

export interface BirlesmeEsi {
  evSahibi: BirlesmeAdayi;
  konuk: BirlesmeAdayi;
  /** Açılış tarihleri arasındaki fark (gün). */
  yasFarkiGun: number;
}

const GUN_MS = 86_400_000;

export const BIRLESME = B.dunya.birlesme as {
  yas_gun: number;
  azami_yas_farki_gun: number;
  ihbar_gun: number;
  gelis_kalkani_saat: number;
  kayip_bolge_tazminati_saat: number;
};

/** Diyarın gün cinsinden yaşı. */
export function diyarYasiGun(openedAt: Date, simdi: Date): number {
  return Math.floor((simdi.getTime() - openedAt.getTime()) / GUN_MS);
}

/**
 * Bu diyar birleşmeye hazır mı.
 *
 * Kapatılmış diyar dışarıda: o zaten bir birleşmenin konuğu olmuş ya da
 * elle kapatılmış. Lordu olmayan diyar da dışarıda — birleştirilecek
 * kimse yok, o `dunya-temizle`nin işi.
 */
export function birlesmeyeHazirMi(d: BirlesmeAdayi, simdi: Date): boolean {
  if (d.durum === 'closed' || d.planliMi) return false;
  if (d.lordSayisi === 0) return false;
  return diyarYasiGun(d.openedAt, simdi) >= BIRLESME.yas_gun;
}

/**
 * Ev sahibi hangisi.
 *
 * Çok AKTİF oyuncusu olan ev sahibi oluyor: taşınan oyuncu sayısı böylece
 * en az, bozulan harita da en küçük. Eşitlikte daha eski diyar — orada
 * daha uzun sürmüş bir düzen var.
 */
export function evSahibiSec(a: BirlesmeAdayi, b: BirlesmeAdayi): [BirlesmeAdayi, BirlesmeAdayi] {
  if (a.aktifLord !== b.aktifLord) return a.aktifLord > b.aktifLord ? [a, b] : [b, a];
  return a.openedAt.getTime() <= b.openedAt.getTime() ? [a, b] : [b, a];
}

/**
 * Eşleri kur — AÇILIŞ TARİHİNE GÖRE komşu olanları.
 *
 * Adaylar açılış tarihine göre sıralanıyor ve komşular eşleniyor. Böylece
 * her eş, mümkün olan en yakın yaşıtını buluyor. Aradaki fark eşikten
 * büyükse o diyar eşsiz kalıyor ve bir sonraki turu bekliyor: kötü bir
 * eş, eşsizlikten kötü.
 *
 * Tek sayıda aday varsa sonuncusu bekliyor. Üçünü bir diyara doldurmak
 * kapasiteyi aşardı; birleşme her turda İKİŞER yapılıyor.
 */
export function birlesmeEsleri(adaylar: BirlesmeAdayi[], simdi: Date): BirlesmeEsi[] {
  const uygun = adaylar
    .filter((d) => birlesmeyeHazirMi(d, simdi))
    .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());

  const esler: BirlesmeEsi[] = [];
  for (let i = 0; i + 1 < uygun.length;) {
    const a = uygun[i]!;
    const b = uygun[i + 1]!;
    const fark = Math.abs(b.openedAt.getTime() - a.openedAt.getTime()) / GUN_MS;
    if (fark > BIRLESME.azami_yas_farki_gun) {
      // a'nın yakın yaşıtı yok; b kendinden sonrakiyle denesin.
      i += 1;
      continue;
    }
    const [evSahibi, konuk] = evSahibiSec(a, b);
    /*
     * Birleşen diyar KAPASİTEYİ AŞMAMALI.
     *
     * İki diyarın aktif oyuncuları tek haritaya sığmıyorsa birleşme
     * çözüm değil sorun: 121 bölgeye kapasitenin üstünde lord yığmak,
     * kimsenin toprak tutamadığı bir diyar demek. Böyle bir çift
     * eşlenmiyor ve ikisi de bir sonraki turu bekliyor — birleşmemek,
     * yanlış birleşmekten iyi.
     */
    const tavan = evSahibi.kapasite ?? Infinity;
    if (evSahibi.aktifLord + konuk.aktifLord > tavan) {
      i += 1;
      continue;
    }
    esler.push({ evSahibi, konuk, yasFarkiGun: Math.round(fark) });
    i += 2;
  }
  return esler;
}

/** Birleşmenin ilan edildiği andan gerçekleşeceği ana. */
export function birlesmeAni(ilanAt: Date): Date {
  return new Date(ilanAt.getTime() + BIRLESME.ihbar_gun * GUN_MS);
}

/** Göçen lordun geliş kalkanı ne zamana kadar sürüyor. */
export function gelisKalkani(an: Date): Date {
  return new Date(an.getTime() + BIRLESME.gelis_kalkani_saat * 3_600_000);
}

export interface TasinacakBolge {
  mapId: number;
  type: string;
  level: number;
  incomeMult: number;
}

export interface BolgeKarari {
  mapId: number;
  /** Bölge taşındı mı, yoksa yeri dolu muydu. */
  tasindi: boolean;
  /** Taşınamadıysa lorda verilecek bir günlük gelir. */
  tazminat: { altin: number; demir: number; erzak: number };
}

/**
 * Konuk diyardaki bir bölge ev sahibine taşınabilir mi.
 *
 * Taşınabiliyorsa toprak olduğu gibi gidiyor: seviye, depo, garnizon.
 * Taşınamıyorsa — aynı bölgenin ev sahibinde zaten bir sahibi varsa —
 * lord onu kaybediyor ve bir GÜNLÜK gelirini alıyor.
 *
 * Tazminat küçük ve bilerek küçük: bölgeyi savaşta kaybetmek oyunun
 * kendisi, tazminatı yok. Ama burada kaybettiren savaş değil bizim
 * işlemimiz; sıfır bırakmak "senin emeğin bizim için bir şey ifade
 * etmiyor" demek olurdu.
 */
export function bolgeKarari(b: TasinacakBolge, evSahibindeDoluMu: boolean): BolgeKarari {
  if (!evSahibindeDoluMu) {
    return { mapId: b.mapId, tasindi: true, tazminat: { altin: 0, demir: 0, erzak: 0 } };
  }
  const saatlik = regionIncome(b.type, b.level, b.incomeMult);
  const saat = BIRLESME.kayip_bolge_tazminati_saat;
  return {
    mapId: b.mapId,
    tasindi: false,
    tazminat: {
      altin: Math.round((saatlik.altin ?? 0) * saat),
      demir: Math.round((saatlik.demir ?? 0) * saat),
      erzak: Math.round((saatlik.erzak ?? 0) * saat),
    },
  };
}
