/**
 * BİLDİRİM TERCİHLERİ (docs/12 §17 "Bildirim tercihleri").
 *
 * Push ya hep ya hiçti: oyuncu "ordun döndü"yü istiyor ama gece üçte
 * "pazar emrin eşleşmiyor" ile uyanmak istemiyorsa tek seçeneği hepsini
 * kapatmaktı — ve kapatan oyuncu saldırı uyarısını da kaçırıyordu. Şimdi
 * konu konu kapatılabiliyor ve sessiz saatler seçilebiliyor.
 *
 * Karar SAF ve burada: sunucu göndermeden önce soruyor, arayüz aynı
 * listeyi gösteriyor. Sessiz saatler oyuncunun KENDİ saat diliminde
 * (tarayıcı bildiriyor); sunucunun saati değil.
 */

/** Bildirim konuları — sunucudaki `etiket`lerle aynı (services/lord.ts). */
export const BILDIRIM_TURLERI = [
  {
    key: 'savas',
    ad: 'Saldırı ve savaş',
    aciklama: 'Toprağına saldırı, kaybedilen savaş, başkent',
  },
  { key: 'ordu', ad: 'Ordunun dönüşü', aciklama: 'Seferden ya da akından eve dönen ordu' },
  { key: 'fetih', ad: 'Fetih', aciklama: 'Ele geçirilen bölge' },
  { key: 'kuyruk', ad: 'Biten işler', aciklama: 'Eğitim, üretim, inşaat' },
  { key: 'pazar', ad: 'Pazar', aciklama: 'Satılan eşya, karşılanan ön sipariş' },
] as const;

export type BildirimTuru = (typeof BILDIRIM_TURLERI)[number]['key'];

export interface BildirimTercihi {
  /** Kapatılan konular. */
  kapali: BildirimTuru[];
  /** Sessiz saatler (oyuncunun saat diliminde, 0–23); `bas === son` kapalı. */
  sessiz: { bas: number; son: number; dilim: string } | null;
}

export const VARSAYILAN_TERCIH: BildirimTercihi = { kapali: [], sessiz: null };

/** Veritabanındaki JSON'u güvenle okur: bozuk ya da eski değer varsayılana düşüyor. */
export function tercihiCoz(ham: unknown): BildirimTercihi {
  if (!ham || typeof ham !== 'object') return VARSAYILAN_TERCIH;
  const h = ham as { kapali?: unknown; sessiz?: unknown };
  const turler = BILDIRIM_TURLERI.map((t) => t.key as string);
  const kapali = Array.isArray(h.kapali)
    ? (h.kapali.filter((k) => typeof k === 'string' && turler.includes(k)) as BildirimTuru[])
    : [];
  let sessiz: BildirimTercihi['sessiz'] = null;
  const s = h.sessiz as { bas?: unknown; son?: unknown; dilim?: unknown } | null | undefined;
  if (
    s &&
    Number.isInteger(s.bas) &&
    Number.isInteger(s.son) &&
    (s.bas as number) >= 0 &&
    (s.bas as number) <= 23 &&
    (s.son as number) >= 0 &&
    (s.son as number) <= 23 &&
    typeof s.dilim === 'string' &&
    saatDilimiGecerli(s.dilim)
  ) {
    sessiz = { bas: s.bas as number, son: s.son as number, dilim: s.dilim };
  }
  return { kapali, sessiz };
}

export function saatDilimiGecerli(dilim: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: dilim });
    return dilim.length > 0 && dilim.length <= 64;
  } catch {
    return false;
  }
}

/** O anın saati (0–23), oyuncunun saat diliminde. */
export function yerelSaat(an: Date, dilim: string): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: dilim,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(an);
  return Number(s) % 24;
}

/** Saat sessiz aralıkta mı (gece yarısını aşan aralık dahil: 23 → 8). */
export function sessizMi(saat: number, bas: number, son: number): boolean {
  if (bas === son) return false;
  return bas < son ? saat >= bas && saat < son : saat >= bas || saat < son;
}

/**
 * Bu bildirim gitsin mi. Konusuz bildirim (ör. "Deneme gönder") her
 * zaman gidiyor: oyuncunun kendi istediği.
 */
export function bildirimGitsinMi(
  tercih: BildirimTercihi,
  etiket: string | undefined,
  an: Date = new Date(),
): boolean {
  const tur = BILDIRIM_TURLERI.find((t) => t.key === etiket)?.key;
  if (!tur) return true;
  if (tercih.kapali.includes(tur)) return false;
  if (tercih.sessiz) {
    const { bas, son, dilim } = tercih.sessiz;
    if (sessizMi(yerelSaat(an, dilim), bas, son)) return false;
  }
  return true;
}
