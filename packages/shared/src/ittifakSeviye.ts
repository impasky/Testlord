/**
 * İttifak seviyesi, bağış ve haftalık katkı.
 *
 * İttifak kurulduktan sonra BİRLİKTE büyüyecek hiçbir şey yoktu: üyeler
 * katılıyor, birbirine saldıramıyor, kaynak gönderiyor — ama ittifakın
 * kendisi hiç ilerlemiyordu. Türün standart klan döngüsü tam olarak bunu
 * çözüyor: üyeler bağış yapar, ittifak seviye atlar, herkes kazanır.
 *
 * **Neden gelir ve savaş bonusu YOK.** Türün çoğu oyunu klan seviyesini
 * doğrudan güce bağlıyor. Biz bağlamıyoruz ve bu bilinçli bir sapma:
 * örgütlü bir gruba güç çarpanı vermek, oyunun en çok uğraştığı şeyi —
 * kartopunu (docs/09 K5) — ittifak ölçeğinde geri getirirdi. Önde giden
 * ittifak daha çok bağış yapar, daha çok bonus alır, daha çok öne geçer.
 *
 * Bunun yerine seviye YARDIMLAŞMAYI büyütüyor: daha çok kaynak
 * gönderebilirsin, takviyen daha hızlı varır, keşif daha ucuz, daha çok
 * pakt yapabilirsin. Hiçbiri tek başına savaş kazandırmıyor; hepsi
 * birlikte oynamayı kolaylaştırıyor.
 */
import { B } from './balance.js';
import type { Resources } from './types.js';

export function azamiIttifakSeviyesi(): number {
  return B.ittifak.seviye.azami;
}

/**
 * Bir seviyeden diğerine geçmek için gereken XP.
 *
 * Üstel: her seviye bir öncekinden %55 pahalı. Doğrusal olsaydı Sv8 bir
 * haftada gelir ve "aylarca sürecek ortak hedef" diye bir şey kalmazdı.
 */
export function ittifakSeviyeXp(seviye: number): number {
  const s = B.ittifak.seviye;
  return Math.round(s.xp_taban * Math.pow(s.xp_carpani, Math.max(0, seviye - 1)));
}

/** Verilen seviyeye ulaşmak için gereken TOPLAM XP. */
export function ittifakToplamXp(seviye: number): number {
  let t = 0;
  for (let i = 1; i < seviye; i++) t += ittifakSeviyeXp(i);
  return t;
}

export interface IttifakSeviyeDurumu {
  seviye: number;
  xp: number;
  /** Bu seviyenin içinde biriken XP. */
  seviyedeXp: number;
  /** Sonraki seviye için gereken XP; azamideyse null. */
  sonrakiEsik: number | null;
}

/**
 * Toplam XP'den seviye türetiliyor.
 *
 * XP saklanıyor ama SEVİYE saklanmıyor: iki sayıyı birden tutmak, bir gün
 * birinin diğerinden sapması demek. Seviye her zaman XP'nin bir sonucu.
 */
export function ittifakSeviyesi(toplamXp: number): IttifakSeviyeDurumu {
  const azami = azamiIttifakSeviyesi();
  let seviye = 1;
  let kalan = Math.max(0, toplamXp);
  while (seviye < azami && kalan >= ittifakSeviyeXp(seviye)) {
    kalan -= ittifakSeviyeXp(seviye);
    seviye++;
  }
  return {
    seviye,
    xp: Math.max(0, toplamXp),
    seviyedeXp: seviye >= azami ? 0 : kalan,
    sonrakiEsik: seviye >= azami ? null : ittifakSeviyeXp(seviye),
  };
}

/* ------------------------------------------------------------------ *
 *  Bağış
 * ------------------------------------------------------------------ */

/** Bir bağışın lorda maliyeti. Seviyeyle büyüyor. */
export function bagisMaliyeti(lordSeviyesi: number): Resources {
  const t = B.ittifak.bagis.maliyet_taban;
  const a = B.ittifak.bagis.maliyet_seviye_basina;
  return {
    altin: t.altin + a.altin * lordSeviyesi,
    demir: t.demir + a.demir * lordSeviyesi,
    erzak: t.erzak + a.erzak * lordSeviyesi,
  };
}

/**
 * Bir bağışın ittifaka kazandırdığı XP.
 *
 * Maliyetle birlikte büyüyor: yüksek seviyeli lord daha çok ödüyor, daha
 * çok katkı sağlıyor. Sabit XP verseydik, büyümüş bir lordun bağışı
 * kendisine pahalı ama ittifaka değersiz olurdu.
 */
export function bagisXp(lordSeviyesi: number): number {
  const b = B.ittifak.bagis;
  return b.xp_taban + b.xp_seviye_basina * lordSeviyesi;
}

export function gunlukBagisHakki(): number {
  return B.ittifak.bagis.gunluk_hak;
}

/**
 * Bağış yapana dönen ödül.
 *
 * ŞÖHRET VERMİYORUZ ve bu iki kere düşünülmüş bir karar. İlk hâlinde
 * veriyordu; test yakaladı çünkü şöhret saklanmıyor, `calculateFame` ile
 * türetiliyor — kolona yazılan artış bir sonraki tick'te siliniyordu.
 *
 * Düzeltirken asıl sorun görüldü: şöhret sıralama puanı, ve kaynakla
 * doğrudan şöhret satın almak savaşmadan sıralamada yükselmek demekti.
 * Lord XP bu kapıyı kapatıyor: ilerletiyor ama şöhrete ancak gerçek
 * seviye atlayarak dönüşüyor.
 */
export function bagisOdulu(): { xp: number } {
  return { xp: B.ittifak.bagis.bagisciya_lord_xp };
}

/* ------------------------------------------------------------------ *
 *  Seviyenin getirdikleri
 * ------------------------------------------------------------------ */

export interface IttifakAyricaliklari {
  /** Günlük kaynak gönderme tavanı (altın karşılığı). */
  ticaretTavani: number;
  /** Takviye yürüyüşünde süre indirimi (0–1). */
  takviyeHizi: number;
  /** Keşif maliyetinde indirim (0–1). */
  kesifIndirimi: number;
  /** Aynı anda tutulabilecek pakt sayısı. */
  paktSlotu: number;
}

export function ittifakAyricaliklari(seviye: number): IttifakAyricaliklari {
  const s = B.ittifak.seviye;
  const ustu = Math.max(0, seviye - 1);
  // Pakt slotu eşiklerle artıyor, seviye başına değil: her seviyede bir
  // pakt daha, sekiz seviyede dokuz pakt demekti ve haritada saldırılamaz
  // bir blok oluştururdu (pakt.ts'teki tavanın gerekçesi).
  const ekPakt = (s.pakt_slotu_esikleri as number[]).filter((e) => seviye >= e).length;
  return {
    ticaretTavani: B.ticaret.gunluk_gonderim_tavani + s.ticaret_tavani_seviye_basina * ustu,
    takviyeHizi: Math.min(s.takviye_hizi_azami, s.takviye_hizi_seviye_basina * ustu),
    kesifIndirimi: Math.min(s.kesif_indirimi_azami, s.kesif_indirimi_seviye_basina * ustu),
    paktSlotu: B.ittifak.pakt.azami + ekPakt,
  };
}

/* ------------------------------------------------------------------ *
 *  Haftalık katkı
 * ------------------------------------------------------------------ */

export interface KatkiSayimlari {
  bagis: number;
  sevkiyat: number;
  takviye: number;
}

/**
 * Üyenin bu haftaki katkı puanı.
 *
 * TÜRETİLİYOR: bağış, gönderilen sevkiyat ve gönderilen takviye zaten
 * kayıtlı. Yeni bir sayaç tutmuyoruz — tutsaydık bir gün kayıtlarla
 * sayacın birbirini tutmadığı bir hâl çıkardı.
 *
 * Liderin tek sorusunu cevaplıyor: kim taşıyor, kim taşınıyor.
 */
export function haftalikKatki(s: KatkiSayimlari): number {
  const p = B.ittifak.haftalik_katki;
  return s.bagis * p.bagis_puani + s.sevkiyat * p.sevkiyat_puani + s.takviye * p.takviye_puani;
}

/* ------------------------------------------------------------------ *
 *  Rütbe
 * ------------------------------------------------------------------ */

export type IttifakRutbe = 'lider' | 'yasli' | 'uye';

export const RUTBE_ADI: Record<IttifakRutbe, string> = {
  lider: 'Lider',
  yasli: 'Yaşlı',
  uye: 'Üye',
};

export function azamiYasli(): number {
  return B.ittifak.rutbeler.azami_yasli;
}

/**
 * Bu rütbe üye yönetebilir mi (çıkarma, hedef işaretleme)?
 *
 * Pakt ve ittifak dağıtma LİDERE özel kalıyor: ikisi de ittifakın
 * tamamını bağlayan kararlar ve geri alınması pahalı.
 */
export function yonetebilirMi(rutbe: IttifakRutbe): boolean {
  return rutbe === 'lider' || rutbe === 'yasli';
}

export function duyuruEnFazlaHarf(): number {
  return B.ittifak.duyuru_en_fazla_harf;
}
