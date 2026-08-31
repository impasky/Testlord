/**
 * Her ekranda görünen kaynak çubuğu.
 * Tasarım ilkesi (docs/01 §9): oyuncu "param yeter mi?"yi hiç sormamalı.
 *
 * Kaynaklar sunucudan gelen değerden itibaren istemcide saniye saniye ilerler;
 * bir sonraki /me yanıtı geldiğinde sunucu değeri yeniden otorite olur.
 */
import { useEffect, useState } from 'react';
import type { LordState } from '../api/client';
import { Meter, formatSayi } from './ui';

const KAYNAKLAR = [
  { key: 'altin', ad: 'Altın', tone: 'altin', renk: 'text-altin' },
  { key: 'demir', ad: 'Demir', tone: 'demir', renk: 'text-demir' },
  { key: 'erzak', ad: 'Erzak', tone: 'erzak', renk: 'text-erzak' },
] as const;

export function KaynakCubugu({ lord }: { lord: LordState }) {
  const [tick, setTick] = useState(0);
  const [baslangic] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const gecenSaat = (Date.now() - baslangic) / 3_600_000;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {KAYNAKLAR.map(({ key, ad, tone, renk }) => {
        const saatlik =
          key === 'erzak' ? lord.netErzakPerHour : lord.hourlyIncome[key];
        const canli = Math.min(
          lord.storageCapacity,
          Math.max(0, lord.resources[key] + saatlik * gecenSaat),
        );
        const dolu = canli >= lord.storageCapacity;
        return (
          <div key={key} className="rounded border border-kenar bg-derin/60 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs tracking-wide text-solgun uppercase">{ad}</span>
              <span className={`text-xs tabular ${saatlik < 0 ? 'text-kan' : 'text-solgun'}`}>
                {saatlik >= 0 ? '+' : ''}
                {formatSayi(saatlik)}/sa
              </span>
            </div>
            <div className={`tabular text-lg font-semibold ${renk}`}>{formatSayi(canli)}</div>
            <Meter value={canli} max={lord.storageCapacity} tone={tone} />
            {dolu && <div className="mt-1 text-xs text-kan">Depo dolu — üretim durdu</div>}
          </div>
        );
      })}

      <div className="rounded border border-kenar bg-derin/60 px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs tracking-wide text-solgun uppercase">Şöhret</span>
          <span className="text-xs text-solgun tabular">ELO {lord.elo}</span>
        </div>
        <div className="tabular text-lg font-semibold text-parsomen">{formatSayi(lord.fame)}</div>
        <div className="mt-1 text-xs text-solgun">
          {lord.pvpWins}G / {lord.pvpLosses}M
        </div>
      </div>
    </div>
  );
}
