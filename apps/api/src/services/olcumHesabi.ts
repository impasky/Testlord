/**
 * Yönetici ölçüm panosu (docs/05 §7): günlük aktif oyuncu ve
 * 1./7. gün tutundurma.
 *
 * Yayından sonraki her karar ("öğretici kısalsın mı", "ilk akın kolay
 * mı") bir sayıya dayanmalı. `/olcum` ucu bu sayıları `lastSeenAt`ten
 * TAHMİN ediyordu: "kayıttan en az bir gün sonra görülmüş" — üç hafta
 * sonra bir kez dönen de "ertesi gün döndü" sayılıyordu. Günlük aktif
 * oyuncunun ise hiç geçmişi yoktu. Pano artık `GunlukAktiflik`
 * satırlarından GERÇEK sayıları veriyor:
 *
 *   - Günlük aktif (son 30 gün) ve o gün kaydolan.
 *   - Haftalık / aylık aktif ve yapışkanlık (dünkü aktif ÷ aylık aktif).
 *   - Kohort tutundurması: N. gün kaydolanların kaçı N+1. ve N+7. gün
 *     oyunu açtı. Gün bitmeden oran yazılmıyor ("olgun" kohort) — yarım
 *     günün oranı her zaman düşük çıkar ve yanlış alarm verir.
 *
 * Bu dosya SAF hesap (test edilebilir). Veritabanı `olcumPanosu.ts`de
 * okunuyor; NPC lordlar oradan hiç gelmiyor.
 */

/** Gösterilen günlük seri. */
export const PANO_GUN = 30;
/** Tutundurma eşikleri: ertesi gün ve yedinci gün. */
const ESIKLER = [1, 7] as const;

export interface PanoGirdisi {
  /** Kohortlar için: gerçek oyuncu lordlarının kayıt günü. */
  lordlar: { id: string; kayitGunu: number }[];
  /** Pencere içindeki aktiflik satırları. */
  aktiflik: { gun: number; lordId: string }[];
  bugun: number;
}

export interface Kohort {
  gun: number;
  kayit: number;
  /** null: o gün henüz bitmedi ya da kohort boş. */
  d1: number | null;
  d7: number | null;
}

export interface OlcumPanosu {
  bugun: number;
  gunluk: { gun: number; aktif: number; yeni: number }[];
  ozet: {
    bugunAktif: number;
    dunAktif: number;
    haftalikAktif: number;
    aylikAktif: number;
    /** Dünkü aktif ÷ son 30 günün aktifi. Oyun alışkanlık mı? */
    yapiskanlik: number | null;
  };
  tutundurma: {
    /** Olgun kohortların ağırlıklı ortalaması (kayıt sayısıyla). */
    d1: { oran: number | null; kohort: number; donen: number };
    d7: { oran: number | null; kohort: number; donen: number };
  };
  kohortlar: Kohort[];
}

export function panoHesapla({ lordlar, aktiflik, bugun }: PanoGirdisi): OlcumPanosu {
  const ilk = bugun - (PANO_GUN - 1);
  const gunun = new Map<number, Set<string>>();
  for (const a of aktiflik) {
    const s = gunun.get(a.gun) ?? new Set<string>();
    s.add(a.lordId);
    gunun.set(a.gun, s);
  }
  const aktifMi = (lordId: string, gun: number) => gunun.get(gun)?.has(lordId) ?? false;
  const kayitlar = new Map<number, string[]>();
  for (const l of lordlar) {
    const k = kayitlar.get(l.kayitGunu) ?? [];
    k.push(l.id);
    kayitlar.set(l.kayitGunu, k);
  }

  const gunluk: OlcumPanosu['gunluk'] = [];
  for (let g = ilk; g <= bugun; g++) {
    gunluk.push({ gun: g, aktif: gunun.get(g)?.size ?? 0, yeni: kayitlar.get(g)?.length ?? 0 });
  }

  const tekil = (bas: number) => {
    const s = new Set<string>();
    for (let g = bas; g <= bugun; g++) for (const id of gunun.get(g) ?? []) s.add(id);
    return s.size;
  };
  const dunAktif = gunun.get(bugun - 1)?.size ?? 0;
  const aylikAktif = tekil(ilk);

  // Kohortlar: yeniden eskiye. Bugün kaydolanın ertesi günü yok.
  const kohortlar: Kohort[] = [];
  const toplam = { 1: { kohort: 0, donen: 0 }, 7: { kohort: 0, donen: 0 } };
  for (let g = bugun - 1; g >= ilk; g--) {
    const uyeler = kayitlar.get(g) ?? [];
    const k: Kohort = { gun: g, kayit: uyeler.length, d1: null, d7: null };
    for (const n of ESIKLER) {
      // Hedef gün tamamen geçmiş olmalı: bugün hâlâ sürüyor.
      if (uyeler.length === 0 || g + n >= bugun) continue;
      const donen = uyeler.filter((id) => aktifMi(id, g + n)).length;
      if (n === 1) k.d1 = donen / uyeler.length;
      else k.d7 = donen / uyeler.length;
      toplam[n].kohort += uyeler.length;
      toplam[n].donen += donen;
    }
    kohortlar.push(k);
  }
  const oran = (t: { kohort: number; donen: number }) => ({
    oran: t.kohort === 0 ? null : t.donen / t.kohort,
    ...t,
  });

  return {
    bugun,
    gunluk,
    ozet: {
      bugunAktif: gunun.get(bugun)?.size ?? 0,
      dunAktif,
      haftalikAktif: tekil(bugun - 6),
      aylikAktif,
      yapiskanlik: aylikAktif === 0 ? null : dunAktif / aylikAktif,
    },
    tutundurma: { d1: oran(toplam[1]), d7: oran(toplam[7]) },
    kohortlar,
  };
}
