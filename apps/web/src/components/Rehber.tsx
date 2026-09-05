/**
 * Rehber kartı — ilk oturumda omurganın üstünde duran kâhya.
 *
 * Gerekçesi `packages/shared/src/rehber.ts` başında. Kısacası: öğreticimiz
 * "oku, sonra dene" diyordu; oyuncunun istediği "şimdi şuna bas, oldu mu
 * bak" idi.
 *
 * Bu bileşen KENDİ ADIMINI TUTMUYOR. Omurganın hesapladığı adımı alıyor ve
 * yalnızca sesini ekliyor. İkinci bir senaryo yazsaydık senaryo ile oyun
 * durumu ayrışırdı — öğreticilerin klasik hatası.
 *
 * Görünürlük döngünün kapanmasına bağlı: ilk bölge alınınca kâhya susuyor.
 * Kapatma kararı oyuncunun; zorunlu bir tur değil.
 */
import { REHBER, rehberGorunsunMu, rehberSozu } from '@lordlar/shared';
import { useState } from 'react';
import { Gorsel } from './Gorsel';
import { IkonNavGeneraller } from './Ikonlar';
import { Kart } from './ui';

const KAPALI_ANAHTARI = 'lordlar_rehber_kapali';

function kapaliMi(): boolean {
  try {
    return localStorage.getItem(KAPALI_ANAHTARI) === '1';
  } catch {
    // Gizli sekmede depo kapalı olabilir; rehber görünsün, oyun çalışsın.
    return false;
  }
}

export function Rehber({ adim, bolgeSayisi }: { adim: string | null; bolgeSayisi: number }) {
  const [kapali, setKapali] = useState(kapaliMi);

  const soz = rehberSozu(adim);
  if (!soz || !rehberGorunsunMu(bolgeSayisi, kapali)) return null;

  const kapat = () => {
    try {
      localStorage.setItem(KAPALI_ANAHTARI, '1');
    } catch {
      /* depo kapalıysa yalnız bu oturumda kapanır */
    }
    setKapali(true);
  };

  return (
    <Kart className="p-3" vurgu="var(--color-mavi)">
      <div className="flex items-start gap-3">
        <div className="oyuk h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-kenar">
          <Gorsel
            tur="generaller"
            ad={REHBER.key}
            alt={REHBER.ad}
            boyut={48}
            yedek={
              <span className="flex h-full w-full items-center justify-center text-solgun">
                <IkonNavGeneraller boyut={24} />
              </span>
            }
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="baslik text-[11px] text-mavi">{REHBER.ad}</span>
            <button
              type="button"
              onClick={kapat}
              className="bas shrink-0 text-[11px] text-sonuk underline"
            >
              yeter, anladım
            </button>
          </div>
          {/* Kâhyanın sözü EYLEMİ değil sebebi söyler; eylemin kendisi
              hemen altındaki omurga düğmesinde yazıyor. */}
          <p className="mt-0.5 text-[13px] leading-snug text-parsomen">{soz}</p>
        </div>
      </div>
    </Kart>
  );
}
