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
import { Gorsel } from './Gorsel';
import { IkonNavGeneraller } from './Ikonlar';
// Kapatma kararı ortak modülde: "yeter, anladım" hem bu kartı hem ekranı
// karartan rehber ışığını birden susturmalı (rehberKapali.ts başına bak).
import { useRehberOturumdaKapali, useRehberiKapat } from './rehberKapali';
import { Kart } from './ui';

export function Rehber({
  adim,
  bolgeSayisi,
  gorundu,
}: {
  adim: string | null;
  bolgeSayisi: number;
  /** Lord bu rehberi daha önce kapatmış mı (sunucudan, hesaba bağlı). */
  gorundu: boolean;
}) {
  // İki kaynak birden: hesabın kalıcı kararı + bu oturumda az önce
  // basılan düğme. İkincisi olmasaydı /me tazelenene kadar kart ekranda
  // kalırdı. Kanca KOŞULSUZ çağrılıyor — `gorundu || useRehber…()` yazmak
  // kısa devre yüzünden kancayı bazı çizimlerde atlardı.
  const oturumdaKapali = useRehberOturumdaKapali();
  const kapali = gorundu || oturumdaKapali;
  const kapat = useRehberiKapat();

  const soz = rehberSozu(adim);
  if (!soz || !rehberGorunsunMu(bolgeSayisi, kapali)) return null;

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
