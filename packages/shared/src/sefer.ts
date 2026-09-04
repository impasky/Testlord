/**
 * Haftalık sefer: "bu hafta neden gireyim?"
 *
 * Günlük görevler (gunluk.ts) yarını, sefer haftayı tutuyor. Aradaki fark
 * sadece süre değil: günlük görev üç küçük iş, sefer TEK bir tema — bu
 * hafta diyar neyle meşgul.
 *
 * İki tasarım kararı bütün dosyayı belirliyor:
 *
 * 1. **Tema saklanmıyor, TÜRETİLİYOR.** Hangi seferin açık olduğu hafta
 *    numarasından çıkıyor. Böylece "şu an hangi etkinlik açık" diye bir
 *    tablo, onu döndüren bir zamanlayıcı ve o zamanlayıcının bozulma
 *    ihtimali hiç doğmuyor. Sunucu yeniden başlasa, veritabanı taşınsa,
 *    iki sunucu birden çalışsa da hepsi aynı haftayı görüyor.
 *
 * 2. **Sıralama değil hedef.** Türün klasik etkinliği bir tablodur: en çok
 *    yağmalayan ilk 10 ödül alır. Bilerek yapmıyoruz — sıralamalı etkinlik
 *    zaten önde olanı daha ilerletir, yani docs/09 §3.4'te kırmaya
 *    çalıştığımız kartopunun haftalık hâli olur ve geç başlayan oyuncu
 *    hiçbir hafta ödül göremez. Hedef herkes için aynı: ulaşan alır.
 */
import { SEFERLER, SEFER_ODUL } from './balance.js';
import { malikaneIncome } from './economy.js';
import { gunNumarasi } from './gunluk.js';
import type { Resources } from './types.js';

export interface SeferTanimi {
  key: string;
  ad: string;
  aciklama: string;
  /** Hangi sayacın okunacağı. */
  olcut: string;
  hedef: number;
  birim: string;
}

export interface SeferSayaclari {
  saldiri: number;
  kazanilan_savas: number;
  fetih: number;
  egitilen_asker: number;
  imar: number;
  kesif: number;
}

export interface Sefer extends SeferTanimi {
  simdi: number;
  tamam: boolean;
  /** Haftanın kaçıncı günündeyiz (0-6) — "3 günün kaldı" için. */
  gecenGun: number;
  kalanGun: number;
}

/**
 * Hafta numarası — UTC gününden.
 *
 * Gün numarası 1970-01-01'den sayıyor ve o gün PERŞEMBE. Ham `gun / 7`
 * haftaları perşembe başlatırdı; +3 kaydırma PAZARTESİ'ye çekiyor,
 * çünkü "bu hafta" derken herkesin anladığı şey o. Sayı testle
 * kilitli: elle atılan bir kaydırma sessizce yanlış olmaya en müsait
 * şeydir.
 */
const PAZARTESI_KAYDIRMA = 3;

export function haftaNumarasi(t: Date): number {
  return Math.floor((gunNumarasi(t) + PAZARTESI_KAYDIRMA) / 7);
}

/** Haftanın kaçıncı günü (0 = pazartesi). */
export function haftaninGunu(t: Date): number {
  return (gunNumarasi(t) + PAZARTESI_KAYDIRMA) % 7;
}

/** Bu haftanın seferi. Tamamen türetilmiş: sunucu bir şey saklamıyor. */
export function haftaninSeferi(t: Date): SeferTanimi {
  const liste = SEFERLER;
  return liste[haftaNumarasi(t) % liste.length]!;
}

/** Sefer + oyuncunun bu haftaki ilerlemesi. */
export function seferDurumu(s: SeferSayaclari, t: Date): Sefer {
  const tanim = haftaninSeferi(t);
  const simdi = s[tanim.olcut as keyof SeferSayaclari] ?? 0;
  const gecenGun = haftaninGunu(t);
  return {
    ...tanim,
    simdi,
    tamam: simdi >= tanim.hedef,
    gecenGun,
    kalanGun: 7 - gecenGun,
  };
}

/**
 * Seferin ödülü. Günlük ödülle aynı ilke: sabit sayı değil, malikâne
 * saatlik gelirinin katı — Lv1 için de Lv60 için de aynı anlamı taşısın
 * ve malikâne gelirini değiştiren biri burayı düzeltmeyi unutamasın.
 *
 * Seri çarpanı YOK. Günlük ödülde seri, "her gün gel" demenin karşılığı;
 * seferde aynı çarpanı uygulamak iki kez ödüllendirmek olurdu.
 */
export function seferOdulu(lordSeviyesi: number): Resources {
  const gelir = malikaneIncome(lordSeviyesi);
  const k = SEFER_ODUL.malikane_saati;
  return {
    altin: Math.round(gelir.altin * k),
    demir: Math.round(gelir.demir * k),
    erzak: Math.round(gelir.erzak * k),
  };
}

/** Ödül bu hafta alınmış mı? */
export function seferOduluAlindiMi(sonAlim: Date | null, simdi: Date): boolean {
  return sonAlim !== null && haftaNumarasi(sonAlim) === haftaNumarasi(simdi);
}

/** Haftanın başlangıcı — sayımların alt sınırı. */
export function haftaBasi(t: Date): Date {
  const gun = gunNumarasi(t) - haftaninGunu(t);
  return new Date(gun * 86_400_000);
}
