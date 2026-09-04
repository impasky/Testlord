/**
 * Olaylar — "ne oldu" sayfası.
 *
 * Malikâne'nin içindeydi ve orada olmaması gerekiyordu: Malikâne
 * "şimdi ne yapmalısın"ı anlatan sayfa, olay akışı ise geçmişi. Aynı
 * sayfada durdukları için Malikâne iki buçuk ekran uzunluğundaydı ve
 * oyuncunun "her şey iç içe, karman çorman" dediği şeyin en büyük
 * parçasıydı.
 *
 * Kendi sayfasına çıkınca akış uzun olabiliyor — bir geçmiş kaydı uzun
 * OLMALI. Kural uzunluk değil: bir sayfa bir iş.
 */
import { useState } from 'react';
import type { GameEvent, LordState } from '../api/client';
import type { Sekme } from '../components/MobilKabuk';
import { BosHal } from '../components/BosHal';
import { SavasRaporu } from '../components/SavasRaporu';
import { Bolum, Kart } from '../components/ui';
import { Zemin } from '../components/Zemin';

/** Olay türüne göre kartın üst şeridi. Renk, okumadan önce tonu veriyor. */
export const OLAY_RENGI: Record<string, string> = {
  bolge_aldin: 'var(--color-yesil)',
  savas_kazandin: 'var(--color-yesil)',
  bolge_kaybettin: 'var(--color-kirmizi)',
  savas_kaybettin: 'var(--color-kirmizi)',
  saldiriya_ugradin: 'var(--color-turuncu)',
  general_seviye: 'var(--color-altin)',
  ittifak_katilim: 'var(--color-yesil)',
  ittifak_ayrilma: 'var(--color-solgun)',
  ittifak_lider: 'var(--color-altin)',
  ittifak_hedef: 'var(--color-mavi)',
  ittifak_cikarildin: 'var(--color-turuncu)',
  kesif_raporu: 'var(--color-mavi)',
  casus_yakalandi: 'var(--color-turuncu)',
  casus_yakaladin: 'var(--color-yesil)',
  general_dinleniyor: 'var(--color-turuncu)',
  aclik: 'var(--color-kirmizi)',
  sevkiyat_geldi: 'var(--color-yesil)',
  takviye_vardi: 'var(--color-yesil)',
  pakt_teklifi: 'var(--color-mavi)',
  pakt_kuruldu: 'var(--color-yesil)',
  pakt_feshi: 'var(--color-turuncu)',
  pakt_reddedildi: 'var(--color-solgun)',
};

export function Olaylar({
  lord,
  events,
  onGit,
  onBolgeyiAc,
}: {
  lord: LordState;
  events: GameEvent[];
  onGit: (s: Sekme) => void;
  onBolgeyiAc: (bolgeId: number) => void;
}) {
  const [rapor, setRapor] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Zemin ad="olaylar" baslik="Olaylar" altyazi="Diyarında ne oldu" />

      <Bolum
        baslik={`Olay Akışı${events.length ? ` · ${events.length}` : ''}`}
        sakin={events.length === 0}
      >
        {events.length === 0 ? (
          <BosHal
            mesaj="Henüz bir şey olmadı. Bir saldırı yaptığında ya da bölgen geliştiğinde burada okursun."
            eylemler={[
              { etiket: 'Haritaya git', onTikla: () => onGit('harita') },
              { etiket: 'Kışla', onTikla: () => onGit('kisla') },
            ]}
          />
        ) : (
          <div className="space-y-2">
            {events.map((e) => {
              // Savaş olayları raporu taşır; taşımayanlar düz kart kalır.
              // Tıklanamayan bir kartı tıklanabilir göstermek, olay
              // akışında her satırı denemeye davet ederdi.
              const raporId = typeof e.payload.battleId === 'string' ? e.payload.battleId : null;
              const govde = (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 flex-1 text-[13px]">
                    {typeof e.payload.mesaj === 'string' ? e.payload.mesaj : e.kind}
                  </p>
                  <time className="shrink-0 text-[10px] text-sonuk">
                    {new Date(e.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              );
              return (
                <Kart key={e.id} className="p-3" vurgu={OLAY_RENGI[e.kind]}>
                  {raporId ? (
                    <button
                      className="bas w-full text-left"
                      onClick={() => setRapor(raporId)}
                      aria-label="Savaş raporunu aç"
                    >
                      {govde}
                      <span className="baslik mt-1 block text-[10px] text-altin">RAPORU AÇ</span>
                    </button>
                  ) : (
                    govde
                  )}
                </Kart>
              );
            })}
          </div>
        )}
      </Bolum>

      {rapor && (
        <SavasRaporu
          battleId={rapor}
          benimId={lord.id}
          onKapat={() => setRapor(null)}
          onKarsiSaldiri={(bolgeId) => {
            setRapor(null);
            onBolgeyiAc(bolgeId);
          }}
        />
      )}
    </div>
  );
}
