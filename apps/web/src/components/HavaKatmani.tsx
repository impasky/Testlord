/**
 * Şehir'in üstündeki hava (docs/24 "Hava"): ara sıra hafif yağmur, sis ya
 * da kar. Yalnız görsel — dokunuşları geçiriyor, ekran okuyucuya bir şey
 * söylemiyor, oyunun hiçbir sayısına dokunmuyor.
 *
 * Hava ekrana sabit (sahneyle kaymıyor): yağmur yerleşkenin değil
 * pencerenin içinde yağıyor. Dilim bitince (`havaDilimSonu`) kendiliğinden
 * yenileniyor. `localStorage['hava-zorla']` havayı sabitliyor — görsel
 * denetim ve ekran görüntüsü için.
 */
import { useEffect, useState } from 'react';
import { HAVALAR, havaDilimSonu, havaDurumu, type Hava } from '../cizim/hava';

function havaSecimi(): Hava {
  try {
    const z = localStorage.getItem('hava-zorla');
    if (z && (HAVALAR as readonly string[]).includes(z)) return z as Hava;
  } catch {
    /* depo yoksa saate göre */
  }
  return havaDurumu();
}

export function useHava(): Hava {
  const [hava, setHava] = useState(havaSecimi);
  useEffect(() => {
    let zaman: ReturnType<typeof setTimeout>;
    const kur = () => {
      // Dilim sonuna kadar bekle; saat ileri alınmışsa en geç bir saatte bak.
      const kalan = Math.min(3_600_000, Math.max(1000, havaDilimSonu() - Date.now() + 500));
      zaman = setTimeout(() => {
        setHava(havaSecimi());
        kur();
      }, kalan);
    };
    kur();
    return () => clearTimeout(zaman);
  }, []);
  return hava;
}

export function HavaKatmani() {
  const hava = useHava();
  if (hava === 'acik') return null;
  return (
    <div aria-hidden className={`hava hava-${hava}`} data-hava={hava}>
      <span className={`hava-${hava}-a`} />
      <span className={`hava-${hava}-b`} />
    </div>
  );
}
