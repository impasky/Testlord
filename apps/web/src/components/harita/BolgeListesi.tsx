/**
 * Dünya haritasının liste görünümü (docs/23 Faz 3).
 *
 * Haritanın üstünde açılan bir pano: süzgeç (Hedefler / Toprağım /
 * Hepsi) ve yakından uzağa sıralı satırlar. Satıra dokunmak haritada o
 * bölgeyi SEÇİYOR — kart açılıyor, harita oraya kayıyor, liste kapanıyor.
 * Liste haritanın yerine geçmiyor; haritada arananı bulmanın kısa yolu.
 */
import { ULKE_ADI, bolgeAdi } from '@lordlar/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegionDto } from '../../api/client';
import { AltSekmeler } from '../ui';
import {
  LISTE_TAVANI,
  bolgeListesi,
  suzgecSayilari,
  type ListeSuzgeci,
  type Rozet,
} from './bolgeListesi';

const SUZGEC_ANAHTARI = 'harita-liste-suzgec';

function kayitliSuzgec(): ListeSuzgeci {
  try {
    const s = localStorage.getItem(SUZGEC_ANAHTARI);
    if (s === 'hedef' || s === 'benim' || s === 'hepsi') return s;
  } catch {
    /* depo yoksa varsayılan */
  }
  return 'hedef';
}

const ROZET: Record<Rozet, { ad: string; renk: string }> = {
  kalkan: { ad: 'Kalkanlı', renk: 'var(--color-mavi)' },
  pakt: { ad: 'Pakt', renk: 'var(--color-solgun)' },
  muttefik: { ad: 'Müttefik', renk: 'var(--color-yesil)' },
  sinir: { ad: 'Sınır dışı', renk: 'var(--color-solgun)' },
  ulke: { ad: 'Ülke seç', renk: 'var(--color-solgun)' },
  taht: { ad: 'Taht', renk: 'var(--color-altin)' },
  garnizon: { ad: 'Garnizonun', renk: 'var(--color-altin)' },
};

export function BolgeListesi({
  regions,
  ulkem,
  seciliId,
  alt,
  onSec,
  onKapat,
}: {
  regions: RegionDto[];
  ulkem: string | null;
  seciliId: number | null;
  /** Haritanın altını kaplayan panelin yüksekliği: liste onun üstünde biter. */
  alt: number;
  onSec: (id: number) => void;
  onKapat: () => void;
}) {
  const [suzgec, setSuzgecHam] = useState<ListeSuzgeci>(kayitliSuzgec);
  const satirlar = useMemo(() => bolgeListesi(regions, suzgec, ulkem), [regions, suzgec, ulkem]);
  const sayilar = useMemo(() => suzgecSayilari(regions, ulkem), [regions, ulkem]);
  const kutuRef = useRef<HTMLDivElement>(null);

  function setSuzgec(s: ListeSuzgeci) {
    setSuzgecHam(s);
    try {
      localStorage.setItem(SUZGEC_ANAHTARI, s);
    } catch {
      /* oturum boyunca hatırlanıyor */
    }
  }

  // Açılınca odak panoda: klavye ve ekran okuyucu listeye düşsün.
  useEffect(() => {
    kutuRef.current?.focus();
  }, []);

  return (
    <div
      ref={kutuRef}
      role="dialog"
      aria-label="Bölge listesi"
      tabIndex={-1}
      data-bolge-listesi=""
      // z-10: sağdaki yakınlık sütunu ve ekran dışı okları panonun
      // köşesini (kapat düğmesini) örtüyordu.
      className="absolute inset-x-2 top-14 z-10 flex flex-col overflow-hidden rounded-2xl border border-kenar bg-panel/95 shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur outline-none"
      style={{ bottom: alt + 8 }}
      // Pano haritanın kaydırma ve yakınlık hareketlerini almasın.
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onKapat();
      }}
    >
      <div className="flex shrink-0 items-center gap-2 p-2">
        <div className="min-w-0 flex-1">
          <AltSekmeler
            sekmeler={[
              { key: 'hedef', ad: 'Hedefler', sayi: sayilar.hedef },
              { key: 'benim', ad: 'Toprağım', sayi: sayilar.benim },
              { key: 'hepsi', ad: 'Hepsi', sayi: Math.min(sayilar.hepsi, LISTE_TAVANI) },
            ]}
            etkin={suzgec}
            onSec={setSuzgec}
          />
        </div>
        <button
          type="button"
          onClick={onKapat}
          aria-label="Listeyi kapat"
          className="bas flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] text-solgun"
        >
          ✕
        </button>
      </div>

      {satirlar.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-solgun">
          {suzgec === 'hedef'
            ? 'Şu an saldırabileceğin bir toprak yok.'
            : suzgec === 'benim'
              ? 'Henüz toprağın yok. Hedefler süzgecinden en yakın boş köyü seç.'
              : 'Bu diyarda şehir yok.'}
        </p>
      ) : (
        <ul
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
          style={{ touchAction: 'pan-y' }}
        >
          {satirlar.map(({ r, rozetler }) => (
            <li key={r.id}>
              <button
                type="button"
                data-liste-bolge={r.id}
                aria-current={r.id === seciliId ? 'true' : undefined}
                onClick={() => {
                  onSec(r.id);
                  onKapat();
                }}
                className={`bas flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                  r.id === seciliId ? 'bg-altin/15' : ''
                }`}
              >
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: r.isMine
                      ? 'var(--color-altin)'
                      : r.owner
                        ? 'var(--color-kirmizi)'
                        : 'var(--color-kenar)',
                  }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="baslik truncate text-[14px] text-parsomen">{r.name}</span>
                    {rozetler.map((z) => (
                      <span
                        key={z}
                        className="shrink-0 rounded-full border border-current px-1.5 text-[10px] font-bold"
                        style={{ color: ROZET[z].renk }}
                      >
                        {ROZET[z].ad}
                      </span>
                    ))}
                  </span>
                  <span className="block truncate text-[12px] text-solgun">
                    {`${bolgeAdi(r.type)} · Sv ${r.level} · `}
                    {r.isMine ? 'Senin' : (r.owner?.name ?? 'Sahipsiz')}
                    {` · ${ULKE_ADI[r.province] ?? r.province}`}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[12px] font-bold text-mavi">
                  {/* 0 adım: kampının hemen yanı — sayı orada bir şey söylemiyor. */}
                  {r.isMine ? '' : r.distance === 0 ? 'Yanında' : `${r.distance} adım`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
