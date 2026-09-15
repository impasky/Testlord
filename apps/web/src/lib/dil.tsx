/**
 * Dil seçimi — arayüz tarafı.
 *
 * Çeviri işlevinin kendisi motorda (`packages/shared/src/dil.ts`);
 * burada yalnız SEÇİM ve PAKETİN İNDİRİLMESİ var.
 *
 * ── Akış ────────────────────────────────────────────────────────────
 *
 *   1. Motor açılışta `localStorage`dan sözlüğü EŞZAMANLI okuyor
 *      (gerekçesi dil.ts'te: modül düzeyindeki sabitler beklemiyor).
 *   2. Oyuncu dili değiştirince paket indiriliyor, depoya yazılıyor,
 *      sayfa bir kez yenileniyor. Yenilemeden sonra 1. adım çalışıyor.
 *   3. Paket depoda yoksa (temizlenmiş, ilk kez) aynı şey açılışta
 *      kendiliğinden oluyor — bir kez, döngüye girmeden.
 *
 * Yenileme bilerek: sözlüğü sonradan yerleştirmek, modül düzeyinde
 * hesaplanmış sabitleri Türkçe bırakır ve ekran yarı yarıya olur.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KALIP_ANAHTARI,
  SOZLUK_ANAHTARI,
  VARSAYILAN_DIL,
  aktifSozlukVar,
  dilGecerli,
  t as cevirMotor,
  type DilKodu,
} from '@lordlar/shared';

/*
 * `t` ve `ts` MOTORDA duruyor ve buradan yeniden dışa aktarılıyor:
 * çağıranın hangi katmanda olduğunu bilmesi gerekmiyor.
 */
export { t, ts } from '@lordlar/shared';

const DIL = 'lordlar_dil';

/** Cihaz başına kayıt. Hesaba değil TARAYICIYA bağlı. */
export function kayitliDil(): DilKodu {
  try {
    const d = localStorage.getItem(DIL);
    if (d && dilGecerli(d)) return d;
  } catch {
    // Gizli sekme ya da kapalı site verisi: varsayılana düş.
  }
  return VARSAYILAN_DIL;
}

/**
 * Paketi indirir ve depoya yazar.
 *
 * Sözlük çalışan sayfaya YERLEŞTİRİLMİYOR — yalnız depoya yazılıyor ve
 * çağıran sayfayı yeniliyor. Dosyanın başındaki gerekçe.
 */
async function paketiIndir(dil: DilKodu): Promise<boolean> {
  try {
    const [s, k] = await Promise.all([
      import(`../ceviri/${dil}.json`),
      import(`../ceviri/${dil}-kaliplar.json`),
    ]);
    localStorage.setItem(`${SOZLUK_ANAHTARI}_${dil}`, JSON.stringify(s.default));
    localStorage.setItem(`${KALIP_ANAHTARI}_${dil}`, JSON.stringify(k.default));
    return true;
  } catch {
    // İndirilemedi ya da depo dolu: oyun Türkçe kalıyor, kırılmıyor.
    return false;
  }
}

/* ------------------------------------------------------------------ */

interface DilDurumu {
  dil: DilKodu;
  /** Sözlük yerinde mi. Türkçede her zaman true. */
  hazir: boolean;
  degistir: (d: DilKodu) => void;
}

const Baglam = createContext<DilDurumu>({
  dil: VARSAYILAN_DIL,
  hazir: true,
  degistir: () => {},
});

export function DilSaglayici({ children }: { children: ReactNode }) {
  const [dil] = useState<DilKodu>(kayitliDil);
  const [gecis, setGecis] = useState(false);

  useEffect(() => {
    document.documentElement.lang = dil;
  }, [dil]);

  /*
   * Dil İngilizce ama sözlük yoksa: paketi indirip BİR KEZ yenile.
   * `aktifSozlukVar()` yenileme sonrası true olduğu için döngü yok —
   * indirme başarısız olursa da bayrak bir daha denemiyor.
   */
  useEffect(() => {
    if (dil === VARSAYILAN_DIL || aktifSozlukVar() || gecis) return;
    setGecis(true);
    void paketiIndir(dil).then((oldu) => {
      if (oldu) location.reload();
    });
  }, [dil, gecis]);

  const deger = useMemo<DilDurumu>(
    () => ({
      dil,
      hazir: dil === VARSAYILAN_DIL || aktifSozlukVar(),
      degistir: (d) => {
        if (d === dil) return;
        try {
          localStorage.setItem(DIL, d);
        } catch {
          // Yazılamıyorsa seçim tutmaz; yine de yenilemeye gerek yok.
          return;
        }
        if (d === VARSAYILAN_DIL) {
          location.reload();
          return;
        }
        void paketiIndir(d).then(() => location.reload());
      },
    }),
    [dil],
  );

  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

export function useDil(): DilDurumu {
  return useContext(Baglam);
}

/**
 * Bileşen içinde çeviri.
 *
 * Çoğu yerde gerekmiyor — derleme eklentisi metinleri zaten sarıyor.
 * Eklentinin göremediği yerler için duruyor (dinamik kurulan cümleler).
 */
export function useT(): (tr: string, ...args: unknown[]) => string {
  const { hazir } = useDil();
  return useMemo(() => {
    void hazir;
    return (tr: string, ...args: unknown[]) => cevirMotor(tr, ...args);
  }, [hazir]);
}
