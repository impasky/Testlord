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
import { yerel } from '@lordlar/shared';
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
  akin_kazandin: 'var(--color-yesil)',
  akin_kaybettin: 'var(--color-kirmizi)',
  baskent: 'var(--color-altin)',
  baskent_dustu: 'var(--color-turuncu)',
  saldiriya_ugradin: 'var(--color-turuncu)',
  general_seviye: 'var(--color-altin)',
  ittifak_katilim: 'var(--color-yesil)',
  ittifak_ayrilma: 'var(--color-solgun)',
  ittifak_lider: 'var(--color-altin)',
  ittifak_hedef: 'var(--color-mavi)',
  /* Moderasyon kararı: ceza değil uyarı rengi. Kırmızı bir savaş
     kaybı kadar ağır okunurdu; bu bir davranış hatırlatması. */
  moderasyon: 'var(--color-turuncu)',
  /* Komşunun toprağına bakması: tehdit değil ama haber. Turuncu, çünkü
     kırmızı "saldırıya uğradın" için ayrılmış. */
  goz_dikildi: 'var(--color-turuncu)',
  ittifak_cikarildin: 'var(--color-turuncu)',
  ittifak_basvuru: 'var(--color-mavi)',
  ittifak_basvuru_kabul: 'var(--color-yesil)',
  ittifak_basvuru_ret: 'var(--color-solgun)',
  ittifak_rutbe: 'var(--color-altin)',
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

/**
 * Olayları güne göre ayırır: "Bugün", "Dün", sonra tarih. Sıra korunuyor
 * (sunucu yeniden eskiye veriyor).
 */
function gunlereBol(olaylar: GameEvent[]): { gun: string; olaylar: GameEvent[] }[] {
  const gunAnahtari = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const bugun = new Date();
  const dun = new Date(bugun.getTime() - 86_400_000);
  const out: { gun: string; olaylar: GameEvent[] }[] = [];
  for (const e of olaylar) {
    const d = new Date(e.createdAt);
    const k = gunAnahtari(d);
    const gun =
      k === gunAnahtari(bugun)
        ? 'Bugün'
        : k === gunAnahtari(dun)
          ? 'Dün'
          : d.toLocaleDateString(yerel(), { day: 'numeric', month: 'long' });
    const son = out[out.length - 1];
    if (son?.gun === gun) son.olaylar.push(e);
    else out.push({ gun, olaylar: [e] });
  }
  return out;
}

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
          <div className="space-y-3">
            {gunlereBol(events).map(({ gun, olaylar }) => (
              <div key={gun}>
                <p className="baslik mb-1.5 text-[11px] text-sonuk">{gun}</p>
                {/*
                 * Bir gün TEK kart, olaylar satır. Önce her olay kendi
                 * kartıydı: on dokuz olay on dokuz kabartmalı kutu, üç
                 * ekran boyu, ve her kutuda aynı "24/09" tekrar ediyordu.
                 * Geçmiş kaydı bir defter gibi okunmalı; tür rengi kartın
                 * üst şeridinden satırın sol çizgisine taşındı.
                 */}
                <Kart className="divide-y divide-kenar p-0">
                  {olaylar.map((e) => {
                    // Savaş olayları raporu taşır; taşımayanlar düz satır
                    // kalır. Tıklanamayan bir satırı tıklanabilir göstermek,
                    // akışta her satırı denemeye davet ederdi.
                    const raporId =
                      typeof e.payload.battleId === 'string' ? e.payload.battleId : null;
                    const govde = (
                      <>
                        <span
                          aria-hidden
                          className="w-[3px] shrink-0 self-stretch rounded-full"
                          style={{ background: OLAY_RENGI[e.kind] ?? 'var(--color-kenar)' }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] leading-snug">
                            {typeof e.payload.mesaj === 'string' ? e.payload.mesaj : e.kind}
                          </span>
                          {raporId && (
                            <span className="baslik mt-0.5 block text-[11px] text-altin">
                              RAPORU AÇ
                            </span>
                          )}
                        </span>
                        <time
                          dateTime={e.createdAt}
                          className="tabular shrink-0 pt-0.5 text-[11px] text-sonuk"
                        >
                          {new Date(e.createdAt).toLocaleTimeString(yerel(), {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </>
                    );
                    return raporId ? (
                      <button
                        key={e.id}
                        className="bas flex min-h-11 w-full gap-2.5 px-3 py-2.5 text-left"
                        onClick={() => setRapor(raporId)}
                        aria-label="Savaş raporunu aç"
                      >
                        {govde}
                      </button>
                    ) : (
                      <div key={e.id} className="flex gap-2.5 px-3 py-2.5">
                        {govde}
                      </div>
                    );
                  })}
                </Kart>
              </div>
            ))}
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
