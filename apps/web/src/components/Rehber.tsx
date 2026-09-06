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
 * Görünürlük BÜTÜN aşamaların kapanmasına bağlı (`rehberGorunsunMu`).
 * Eskiden ilk bölge alınınca susuyordu ve zorunlu tur oyunun altıda birini
 * gösterip bitiyordu; dizilim, ekipman, general, bölge geliştirme ve
 * araştırma oyuncunun kendi bulmasına kalıyordu.
 *
 * Kapatma düğmesi yok — tur zorunlu. Kaçış olmadığı için sayaç var:
 * oyuncu turun bitmek bilmeyen bir şey olmadığını görüyor.
 */
import {
  REHBER,
  rehberGorunsunMu,
  rehberIlerlemesi,
  rehberSozu,
  type RehberDurumu,
} from '@lordlar/shared';
import { Gorsel } from './Gorsel';
import { IkonNavGeneraller } from './Ikonlar';
import { Kart } from './ui';

export function Rehber({
  adim,
  durum,
  gorundu,
}: {
  adim: string | null;
  /** Rehberin aşamalarını kapatan oyun durumu. */
  durum: RehberDurumu;
  /** Lord rehberi TAMAMLADI mı (sunucudan, hesaba bağlı). */
  gorundu: boolean;
}) {
  const soz = rehberSozu(adim);
  const ilerleme = rehberIlerlemesi(durum);
  if (!soz || !rehberGorunsunMu(durum, gorundu)) return null;

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
          {/* Kapatma düğmesi YOK.
              Oyuncu ayrımı net koydu: "öğretici ile zorunlu yaptırmayı
              ayır, oyuncu okusa da okumasa da yaptırmalı." Sekiz sayfalık
              tanıtım geçilebilir, bu bölüm geçilemez.
              Kaçış yoksa oyuncu SONUNU görmeli: sayaç turun bitmek
              bilmeyen bir şey olmadığını söylüyor. */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="baslik text-[11px] text-mavi">{REHBER.ad}</span>
            <span className="tabular shrink-0 text-[11px] text-sonuk">
              {ilerleme.biten}/{ilerleme.toplam} adım
            </span>
          </div>
          {/* Kâhyanın sözü EYLEMİ değil sebebi söyler; eylemin kendisi
              hemen altındaki omurga düğmesinde yazıyor. */}
          <p className="mt-0.5 text-[13px] leading-snug text-parsomen">{soz}</p>
        </div>
      </div>
    </Kart>
  );
}
