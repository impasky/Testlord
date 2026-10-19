/**
 * Bina yükseltmesi bitince geçiş (docs/13 "Yükseltme geçişi").
 *
 * İnşaat süresince binanın üstünde bir iskele duruyordu; iş bitince iskele
 * bir karede kayboluyor, yeni aşamanın çizimi de birkaç yüz milisaniye
 * sonra sessizce yerine oturuyordu. Oyuncu dakikalarca beklediği anı
 * kaçırıyordu: "bitti mi, değişti mi?" Geçiş o anı işaretliyor — tabandan
 * bir toz bulutu kalkıyor, altın bir halka açılıyor, "Sv 3" yükselip
 * sönüyor; bir de zafer sesi ve titreşimi. Toz, yeni çizimin gelişini de
 * örtüyor.
 *
 * Hareket azaltılmışsa yalnız etiket görünüyor (styles.css).
 */
import { useEffect, useRef, useState } from 'react';
import type { BinaDurumu } from '../api/client';
import { hisZafer } from './hisGeriBildirimi';

/** Geçişin süresi: etiket bu kadar kalıyor, sonra bileşen kalkıyor. */
export const GECIS_MS = 2400;

/*
 * Son görülen seviyeler MODÜL düzeyinde: oyuncu iş sürerken başka bir
 * sekmeye geçip döndüğünde de (bileşen yeniden kuruluyor) yükselme
 * kutlanıyor. Bileşende tutulsaydı dönüşte "ilk açılış" sayılır, an
 * kaçardı. Sayfa yenilenince sıfırlanıyor — ilk açılışta kutlanacak
 * bir şey yok.
 */
let sonGorulen: Map<string, number> | null = null;

/** Yalnız testler için: modül durumunu sıfırlar. */
export function yukselmeDurumunuSifirla(): void {
  sonGorulen = null;
}

/**
 * Az önce seviye atlayan (ya da arsada dikilen) yapılar: anahtar → yeni
 * seviye, geçiş süresince.
 */
export function yukselenleriBul(
  onceki: ReadonlyMap<string, number> | null,
  simdi: ReadonlyMap<string, number>,
): [string, number][] {
  if (!onceki) return [];
  return [...simdi].filter(([k, s]) => s > (onceki.get(k) ?? 0));
}

export function useYukselenler(
  binalar: BinaDurumu[] | undefined,
  /**
   * Şehir ekranda mı. Şehir başka sekmedeyken de kurulu (App.tsx); orada
   * biten yükseltme görülmeden oynayıp geçerdi. Görünmüyorken değişiklik
   * BEKLİYOR, oyuncu dönünce oynuyor.
   */
  gorunur = true,
): Map<string, number> {
  const [yukselen, setYukselen] = useState<Map<string, number>>(() => new Map());
  const canli = useRef(true);
  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);
  useEffect(() => {
    if (!binalar || !gorunur) return;
    const simdi = new Map(binalar.map((b) => [b.key, b.seviye]));
    const yeni = yukselenleriBul(sonGorulen, simdi);
    sonGorulen = simdi;
    if (!yeni.length) return;
    hisZafer();
    setYukselen((m) => new Map([...m, ...yeni]));
    // Temizlik bilerek effect'e bağlı değil: veri geçiş bitmeden yeniden
    // gelirse (başka bir iş bitti) bu geçiş yarıda kesilmemeli.
    setTimeout(() => {
      if (!canli.current) return;
      setYukselen((m) => {
        const n = new Map(m);
        for (const [k, s] of yeni) if (n.get(k) === s) n.delete(k);
        return n;
      });
    }, GECIS_MS);
  }, [binalar, gorunur]);
  return yukselen;
}

/** Toz tanecikleri: tabandan dışarı ve yukarı (yüzde). */
const TOZ: [number, number][] = [
  [-46, -10],
  [-34, -30],
  [-14, -40],
  [12, -42],
  [34, -28],
  [46, -8],
  [-24, 4],
  [26, 6],
];

export function YukselmeGecisi({ seviye }: { seviye: number }) {
  return (
    <span
      aria-hidden="true"
      data-yukselme={seviye}
      className="pointer-events-none absolute inset-0 z-30"
    >
      <span className="yukselme-parilti absolute inset-[8%] rounded-full" />
      <span className="yukselme-halka absolute bottom-[-4%] left-1/2 h-[30%] w-[96%] rounded-[50%] border-2 border-altin" />
      {TOZ.map(([dx, dy], i) => (
        <span
          key={i}
          className="yukselme-toz absolute bottom-[4%] left-1/2 h-[16%] w-[16%] rounded-full"
          style={
            {
              '--dx': `${dx * 2.2}%`,
              '--dy': `${dy * 2.2}%`,
              animationDelay: `${(i % 3) * 60}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="yukselme-etiket baslik absolute top-[18%] left-1/2 rounded-full border border-altin/80 bg-gece/90 px-1.5 text-[12px] leading-tight whitespace-nowrap text-altin">
        {seviye === 1 ? 'Dikildi!' : `Sv ${seviye}`}
      </span>
    </span>
  );
}
