/**
 * Rehberin kapatılma durumu — kart ve ışık aynı kararı okusun.
 *
 * Kâhya iki yerde görünüyor: Malikâne'deki kart (Rehber.tsx) ve ekranı
 * karartıp tek düğmeyi açıkta bırakan ışık (RehberIsigi.tsx). Oyuncu
 * "yeter, anladım" dediğinde İKİSİ birden susmalı. Karar tek bir yerde
 * durmazsa kart kapanır, ışık kalır ve oyuncu ekranın yarısında kilitli
 * kalır — bu modülün varlık sebebi tam olarak o hâli imkânsız kılmak.
 *
 * Depo kalıcı hâfıza, dinleyici listesi ise aynı oturumdaki iki bileşeni
 * anında haberdar etmek için: localStorage aynı sekmede olay üretmez.
 */
import { useEffect, useState } from 'react';

const ANAHTAR = 'lordlar_rehber_kapali';
const dinleyiciler = new Set<() => void>();

export function rehberKapaliMi(): boolean {
  try {
    return localStorage.getItem(ANAHTAR) === '1';
  } catch {
    // Gizli sekmede depo kapalı olabilir; rehber görünsün, oyun çalışsın.
    return false;
  }
}

export function rehberiKapat(): void {
  try {
    localStorage.setItem(ANAHTAR, '1');
  } catch {
    /* depo kapalıysa yalnız bu oturumda kapanır */
  }
  for (const d of [...dinleyiciler]) d();
}

/** Kapatma durumunu okuyan ve değişince yeniden çizilen kanca. */
export function useRehberKapali(): boolean {
  const [kapali, setKapali] = useState(rehberKapaliMi);
  useEffect(() => {
    const d = () => setKapali(rehberKapaliMi());
    dinleyiciler.add(d);
    return () => {
      dinleyiciler.delete(d);
    };
  }, []);
  return kapali;
}
