/**
 * Profil görseli — sohbette, profil kartında ve üst çubukta aynı daire.
 *
 * Üç hâl (shared `ProfilResmi`):
 *   - arma: resim seçmemiş oyuncu. Boş bir daire değil kendi arması — arma
 *     addan türetildiği için herkesinki farklı.
 *   - hazir: oyunun kendi portrelerinden biri — generalin, lordun ya da
 *     düşman şefinin koddan çizilen baş-omuz kadrajı (cizim/kisiler.ts).
 *   - yuklenen: oyuncunun yüklediği, denetimden geçmiş resim.
 *
 * Resim yüklenemezse (silinmiş, ağ yok) armaya düşüyor: kırık resim
 * simgesi bir oyuncunun yüzü olmamalı.
 */
import { useState } from 'react';
import type { ProfilResmi } from '@lordlar/shared';
import { profilResmiAdresi, type ArmaDto } from '../api/client';
import { Arma } from './Arma';
import { PortreCizimi, portreCizimiVar } from '../cizim/Cizimler';

/** Yüklenen resmin adresi. Hazır portreler dosya değil, çizim (docs/24). */
export function profilGorselAdresi(resim: ProfilResmi): string | null {
  if (resim.tur === 'yuklenen') return profilResmiAdresi(resim.id);
  return null;
}

export function ProfilGorseli({
  resim,
  arma,
  boyut = 32,
  className = '',
}: {
  resim: ProfilResmi;
  arma: ArmaDto;
  boyut?: number;
  className?: string;
}) {
  const adres = profilGorselAdresi(resim);
  const [kirik, setKirik] = useState<string | null>(null);
  const goster = adres && kirik !== adres;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-kenar-acik bg-[radial-gradient(circle_at_50%_40%,#3a2b1b,#1a120c)] ${className}`}
      style={{ width: boyut, height: boyut }}
      data-portre={resim.tur === 'hazir' ? resim.key : undefined}
      aria-hidden
    >
      {resim.tur === 'hazir' && portreCizimiVar(resim.key) ? (
        <PortreCizimi ad={resim.key} className="h-full w-full" />
      ) : goster ? (
        <img
          src={adres}
          alt=""
          width={boyut}
          height={boyut}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setKirik(adres)}
        />
      ) : (
        <Arma arma={arma} boyut={Math.round(boyut * 0.72)} />
      )}
    </span>
  );
}
