/** Ekran 1: Malikâne — kaynaklar, kuyruklar, olay akışı. */
import { useEffect, useState } from 'react';
import type { GameEvent, LordState, QueueItem } from '../api/client';
import { Panel, Sayi, formatKalan, formatSayi } from '../components/ui';

const KUYRUK_ADI: Record<string, string> = {
  train: 'Asker eğitimi',
  craft: 'Ekipman üretimi',
  upgrade_item: 'Ekipman yükseltme',
  upgrade_gear: 'Ordu donanımı',
  upgrade_region: 'Bölge yükseltme',
};

const OLAY_ADI: Record<string, string> = {
  saldiriya_ugradin: 'Saldırıya uğradın',
  bolge_kaybettin: 'Bölge kaybettin',
  bolge_aldin: 'Bölge aldın',
  kuyruk_bitti: 'Kuyruk tamamlandı',
  seviye_atladin: 'Seviye atladın',
  aclik: 'Açlık',
};

function GeriSayim({ finishAt }: { finishAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular">{formatKalan(new Date(finishAt).getTime() - Date.now())}</span>;
}

export function Malikane({
  lord,
  queues,
  events,
}: {
  lord: LordState;
  queues: QueueItem[];
  events: GameEvent[];
}) {
  const yarali = lord.woundedUntil && new Date(lord.woundedUntil) > new Date();
  const korumali = lord.protectionUntil && new Date(lord.protectionUntil) > new Date();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {lord.starving && (
          <div className="rounded border border-kan/60 bg-kan/15 px-4 py-3">
            <strong className="text-kan">Ordun aç.</strong>{' '}
            <span className="text-sm text-parsomen/90">
              Erzak bitti, askerler saatte %5 firar ediyor. Tarla bölgesi al ya da ordunu küçült.
            </span>
          </div>
        )}
        {yarali && (
          <div className="rounded border border-kan/40 bg-kan/10 px-4 py-3 text-sm">
            <strong>Lordun yaralı.</strong> İyileşmesine{' '}
            <GeriSayim finishAt={lord.woundedUntil!} /> kaldı. Bu sürede saldıramazsın.
          </div>
        )}

        <Panel title="Malikâne">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-solgun uppercase">Lord</dt>
              <dd className="text-base">{lord.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-solgun uppercase">Seviye</dt>
              <dd className="text-base">
                <Sayi>{lord.level}</Sayi>
                <span className="ml-2 text-xs text-solgun">
                  <Sayi>
                    {formatSayi(lord.xp)}/{formatSayi(lord.xpForNext)}
                  </Sayi>{' '}
                  XP
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-solgun uppercase">Bölge</dt>
              <dd className="text-base">
                <Sayi>
                  {lord.regionCount}/{lord.maxRegions}
                </Sayi>
                {lord.ownsThrone && <span className="ml-2 text-altin">+ Taht Kalesi</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-solgun uppercase">Komuta</dt>
              <dd className="text-base">
                <Sayi>
                  {formatSayi(lord.usedSlots)}/{formatSayi(lord.commandCapacity)}
                </Sayi>{' '}
                yer
              </dd>
            </div>
            <div>
              <dt className="text-xs text-solgun uppercase">Ordu bakımı</dt>
              <dd className="text-base">
                <Sayi>{formatSayi(lord.upkeepPerHour)}</Sayi> erzak/sa
              </dd>
            </div>
            <div>
              <dt className="text-xs text-solgun uppercase">Günlük saldırı</dt>
              <dd className="text-base">
                <Sayi>{lord.dailyAttacks}/12</Sayi>
              </dd>
            </div>
          </dl>

          {korumali && (
            <p className="mt-4 rounded border border-mese/40 bg-mese/10 px-3 py-2 text-xs">
              Yeni lord kalkanın açık — <GeriSayim finishAt={lord.protectionUntil!} /> kaldı. İlk
              saldırını yaptığında kalkan düşer.
            </p>
          )}
        </Panel>

        <Panel title={`Kuyruklar (${queues.length})`}>
          {queues.length === 0 ? (
            <p className="text-sm text-solgun">
              Kuyruk boş. Kışlada asker eğit ya da Demirhane'de ekipman üret.
            </p>
          ) : (
            <ul className="divide-y divide-kenar">
              {queues.map((q) => (
                <li key={q.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {KUYRUK_ADI[q.kind] ?? q.kind}
                    {typeof q.payload.count === 'number' && (
                      <span className="ml-2 text-solgun">×{q.payload.count as number}</span>
                    )}
                  </span>
                  <GeriSayim finishAt={q.finishAt} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Olay Akışı" className="lg:col-span-1">
        {events.length === 0 ? (
          <p className="text-sm text-solgun">Henüz bir şey olmadı.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="border-b border-kenar/60 pb-2 text-sm last:border-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span>{OLAY_ADI[e.kind] ?? e.kind}</span>
                  <time className="shrink-0 text-xs text-solgun">
                    {new Date(e.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                {typeof e.payload.mesaj === 'string' && (
                  <p className="mt-0.5 text-xs text-solgun">{e.payload.mesaj}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
