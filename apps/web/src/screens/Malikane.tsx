/** Malikâne — durum özeti, kuyruklar, olay akışı. Mobil ana ekran. */
import { useEffect, useState } from 'react';
import type { GameEvent, LordState, QueueItem } from '../api/client';
import type { Sekme } from '../components/MobilKabuk';
import {
  IkonKale,
  IkonNavDemirhane,
  IkonNavHarita,
  IkonNavKisla,
  IkonSancak,
  IkonSure,
  IkonUyari,
  IkonYer,
} from '../components/Ikonlar';
import { SavasRaporu } from '../components/SavasRaporu';
import { Bolum, Buton, DegerKarti, Ilerleme, Kart, formatKalan, formatSayi } from '../components/ui';

const KUYRUK_ADI: Record<string, string> = {
  train: 'Asker eğitimi',
  craft: 'Ekipman üretimi',
  upgrade_item: 'Ekipman yükseltme',
  upgrade_gear: 'Ordu donanımı',
  upgrade_region: 'Bölge yükseltme',
};

const OLAY_RENGI: Record<string, string> = {
  bolge_aldin: 'var(--color-yesil)',
  savas_kazandin: 'var(--color-yesil)',
  bolge_kaybettin: 'var(--color-kirmizi)',
  savas_kaybettin: 'var(--color-kirmizi)',
  saldiriya_ugradin: 'var(--color-turuncu)',
  aclik: 'var(--color-kirmizi)',
};

function GeriSayim({ bitis }: { bitis: string }) {
  const [, tik] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tik((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular">{formatKalan(new Date(bitis).getTime() - Date.now())}</span>;
}

function KuyrukSatiri({ q }: { q: QueueItem }) {
  const bas = new Date(q.startedAt).getTime();
  const bit = new Date(q.finishAt).getTime();
  const gecen = Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas)));
  return (
    <Kart className="p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate">
          {KUYRUK_ADI[q.kind] ?? q.kind}
          {typeof q.payload.count === 'number' && (
            <span className="ml-1.5 text-solgun">×{q.payload.count as number}</span>
          )}
        </span>
        <span className="shrink-0 text-[12px] text-altin">
          <GeriSayim bitis={q.finishAt} />
        </span>
      </div>
      <Ilerleme deger={gecen} max={1} renk="var(--color-altin)" boy="ince" />
    </Kart>
  );
}

export function Malikane({
  lord,
  queues,
  events,
  onGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  events: GameEvent[];
  onGit: (s: Sekme) => void;
}) {
  const [rapor, setRapor] = useState<string | null>(null);
  const yarali = lord.woundedUntil && new Date(lord.woundedUntil) > new Date();
  const korumali = lord.protectionUntil && new Date(lord.protectionUntil) > new Date();

  return (
    <div className="space-y-4 pt-3">
      {lord.starving && (
        <Kart className="border-kirmizi/60 p-3" vurgu="var(--color-kirmizi)">
          <div className="flex gap-2.5">
            <span className="shrink-0 text-kirmizi">
              <IkonUyari boyut={20} />
            </span>
            <div className="text-[13px]">
              <strong className="baslik text-kirmizi">Ordun aç</strong>
              <p className="mt-0.5 text-solgun">
                Erzak bitti, askerler saatte %5 firar ediyor. Tarla bölgesi al ya da ordunu küçült.
              </p>
            </div>
          </div>
        </Kart>
      )}

      {yarali && (
        <Kart className="border-turuncu/50 p-3" vurgu="var(--color-turuncu)">
          <div className="text-[13px]">
            <strong className="baslik text-turuncu">Lordun yaralı</strong>
            <p className="mt-0.5 text-solgun">
              İyileşmesine <GeriSayim bitis={lord.woundedUntil!} /> kaldı. Bu sürede saldıramazsın.
            </p>
          </div>
        </Kart>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <DegerKarti
          ikon={<IkonKale boyut={20} />}
          etiket="Bölgeler"
          deger={
            <>
              {lord.regionCount}
              <span className="text-sm text-solgun">/{lord.maxRegions}</span>
              {lord.ownsThrone && <span className="ml-1 text-[11px] text-altin">+Taht</span>}
            </>
          }
          renk="var(--color-altin)"
        />
        <DegerKarti
          ikon={<IkonYer boyut={20} />}
          etiket="Komuta"
          deger={
            <>
              {formatSayi(lord.usedSlots)}
              <span className="text-sm text-solgun">/{formatSayi(lord.commandCapacity)}</span>
            </>
          }
          renk="var(--color-mavi)"
          alt={<Ilerleme deger={lord.usedSlots} max={lord.commandCapacity} renk="var(--color-mavi)" boy="ince" />}
        />
        <DegerKarti
          ikon={<IkonSancak boyut={20} />}
          etiket="Seviye"
          deger={lord.level}
          renk="var(--color-yesil)"
          alt={
            <>
              <Ilerleme deger={lord.xp} max={lord.xpForNext} renk="var(--color-yesil)" boy="ince" />
              <div className="tabular mt-1 text-[10px] text-sonuk">
                {formatSayi(lord.xp)}/{formatSayi(lord.xpForNext)} XP
              </div>
            </>
          }
        />
        <DegerKarti
          ikon={<IkonSure boyut={20} />}
          etiket="Günlük saldırı"
          deger={
            <>
              {lord.dailyAttacks}
              <span className="text-sm text-solgun">/12</span>
            </>
          }
          renk="var(--color-turuncu)"
        />
      </div>

      {lord.statPoints > 0 && (
        <Kart className="p-3" vurgu="var(--color-yesil)">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-[13px]">
              <strong className="baslik text-yesil">{lord.statPoints} stat puanı</strong>
              <p className="text-solgun">Dağıtılmayı bekliyor.</p>
            </div>
            <Buton tur="yesil" boy="kucuk" onClick={() => onGit('lord')}>
              Dağıt
            </Buton>
          </div>
        </Kart>
      )}

      {korumali && (
        <Kart className="border-yesil/40 p-3">
          <p className="text-[12px] text-solgun">
            <span className="baslik text-yesil">Yeni lord kalkanı</span> —{' '}
            <GeriSayim bitis={lord.protectionUntil!} /> kaldı. İlk saldırında kalkan düşer.
          </p>
        </Kart>
      )}

      <Bolum baslik={`Kuyruklar${queues.length ? ` · ${queues.length}` : ''}`}>
        {queues.length === 0 ? (
          <Kart className="p-4">
            <p className="mb-3 text-[13px] text-solgun">Kuyruk boş. Bir şeyler başlat.</p>
            <div className="flex gap-2">
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('kisla')}>
                <span className="mr-1.5 inline-block align-[-2px]">
                  <IkonNavKisla boyut={13} />
                </span>
                Kışla
              </Buton>
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('demirhane')}>
                <span className="mr-1.5 inline-block align-[-2px]">
                  <IkonNavDemirhane boyut={13} />
                </span>
                Demirhane
              </Buton>
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('harita')}>
                <span className="mr-1.5 inline-block align-[-2px]">
                  <IkonNavHarita boyut={13} />
                </span>
                Harita
              </Buton>
            </div>
          </Kart>
        ) : (
          <div className="space-y-2">
            {queues.map((q) => (
              <KuyrukSatiri key={q.id} q={q} />
            ))}
          </div>
        )}
      </Bolum>

      <Bolum baslik="Olay Akışı">
        {events.length === 0 ? (
          <Kart className="p-4">
            <p className="text-[13px] text-solgun">Henüz bir şey olmadı.</p>
          </Kart>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 12).map((e) => {
              // Savaş olayları raporu taşır; taşımayanlar düz kart kalır.
              // Tıklanamayan bir kartı tıklanabilir göstermek, olay akışında
              // her satırı denemeye davet ederdi.
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
        <SavasRaporu battleId={rapor} benimId={lord.id} onKapat={() => setRapor(null)} />
      )}
    </div>
  );
}
