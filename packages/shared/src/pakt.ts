/**
 * Saldırmazlık paktı — ittifaklar ARASI tek kural.
 *
 * İttifak "üyeler birbirine saldıramaz" diyordu ve o kadar. İttifaklar
 * arasında hiçbir şey yoktu: iki ittifak anlaşmak istese sohbette söz
 * verebiliyordu, oyunun bundan haberi olmuyordu (docs/09 §2.1). Türün
 * diplomasi katmanının resmî aracı bu.
 *
 * Üç kural sistemin tamamını taşıyor:
 *
 * 1. **İki taraf da onaylar.** Tek taraflı pakt, güçlü bir ittifağa karşı
 *    bedavaya kalkan çıkarmak olurdu.
 * 2. **Fesih ANINDA değil.** İhbar süresi olmasaydı pakt bir kalkana
 *    dönerdi: zayıfken paktla, saldıracağın gün feshet, aynı saat saldır.
 *    İhbar, sözün bedelini geri veriyor.
 * 3. **Pakt sayısı sınırlı.** Herkes herkesle paktlanırsa PvP durur.
 *
 * Burada yalnız saf karar var; veritabanı api tarafında.
 */
import { B } from './balance.js';

export type PaktDurumu = 'teklif' | 'yururlukte' | 'feshediliyor' | 'bitti';

export function azamiPakt(): number {
  return B.ittifak.pakt.azami;
}

export function fesihIhbarSaat(): number {
  return B.ittifak.pakt.fesih_ihbar_saat;
}

/**
 * Paktın iki tarafını KANONİK sıraya koyar.
 *
 * X–Y ile Y–X aynı pakt. Sıralamadan geçirmeden saklarsak veritabanındaki
 * benzersizlik kısıtı yön değiştiren bir teklifi yeni bir pakt sanar ve
 * aynı iki ittifak arasında iki pakt oluşur.
 */
export function paktTaraflari(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface PaktSatiri {
  durum: PaktDurumu;
  /** Fesih ihbarı verildiyse paktın sona ereceği an. */
  biterAt: Date | null;
}

/**
 * Pakt ŞU AN saldırıyı engelliyor mu?
 *
 * Feshedilen bir pakt, ihbar süresi dolana kadar HÂLÂ yürürlükte —
 * mekaniğin bütün değeri bu satırda. `bitti` durumu ve süresi geçmiş
 * `feshediliyor` satırları engellemiyor.
 *
 * Süresi dolmuş paktı silmiyoruz, geçersiz sayıyoruz: "biten pakt"
 * kayıtlarını temizlemek için bir işçiye ihtiyaç kalmıyor ve iki
 * ittifakın geçmişte anlaşmış olduğu bilgisi kaybolmuyor.
 */
export function paktKoruyorMu(p: PaktSatiri, simdi: Date = new Date()): boolean {
  if (p.durum === 'yururlukte') return true;
  if (p.durum === 'feshediliyor') return p.biterAt !== null && p.biterAt > simdi;
  return false;
}

export interface PaktDenetimi {
  uygun: boolean;
  sebep?: string;
  kod?: string;
}

/**
 * Yeni pakt teklif edilebilir mi?
 *
 * `mevcutPaktSayisi` teklif edenin YÜRÜRLÜKTEKİ pakt sayısı; bekleyen
 * teklifler sayılmıyor. Sayılsaydı bir ittifak üç teklif gönderip hiçbiri
 * kabul edilmeden kendi kotasını kilitlerdi.
 */
export function paktTeklifDenetle(
  benimId: string | null,
  hedefId: string,
  mevcutPaktSayisi: number,
  hedefPaktSayisi: number,
): PaktDenetimi {
  if (!benimId) {
    return { uygun: false, sebep: 'Pakt için bir ittifakın olması gerekiyor.', kod: 'ITTIFAK_YOK' };
  }
  if (benimId === hedefId) {
    return { uygun: false, sebep: 'Kendi ittifakınla pakt yapamazsın.', kod: 'KENDI_ITTIFAKIN' };
  }
  const azami = azamiPakt();
  if (mevcutPaktSayisi >= azami) {
    return {
      uygun: false,
      sebep: `En fazla ${azami} paktın olabilir. Yenisi için birini feshetmen gerekiyor.`,
      kod: 'PAKT_LIMITI',
    };
  }
  if (hedefPaktSayisi >= azami) {
    return {
      uygun: false,
      sebep: `Karşı ittifakın pakt kotası dolu (${azami}).`,
      kod: 'PAKT_LIMITI',
    };
  }
  return { uygun: true };
}

/** Fesih ihbarı verildiğinde paktın sona ereceği an. */
export function paktBitisi(ihbarAni: Date): Date {
  return new Date(ihbarAni.getTime() + fesihIhbarSaat() * 3_600_000);
}
