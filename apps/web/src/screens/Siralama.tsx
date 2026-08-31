/** Ekran 7: Sıralama — üç ayrı liste, üç ayrı oyun tarzı. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type RankingRow } from '../api/client';
import { Panel, formatSayi } from '../components/ui';

type Board = 'fame' | 'conquest' | 'elo';

const TABLAR: { key: Board; ad: string; aciklama: string }[] = [
  { key: 'fame', ad: 'Şöhret', aciklama: 'Genel toplam skor. Dengeli, uzun soluklu oyuncuyu ödüllendirir.' },
  { key: 'conquest', ad: 'Fetih', aciklama: 'Bölge seviyesi × tip çarpanı. Toprak sahibinin sıralaması.' },
  { key: 'elo', ad: 'Kılıç', aciklama: 'PvP derecesi. Bölgesiz bir lord da burada birinci olabilir.' },
];

function Satir({ r, benMi }: { r: RankingRow; benMi: boolean }) {
  return (
    <tr className={benMi ? 'bg-altin/10' : undefined}>
      <td className="py-1.5 pr-3 text-right tabular text-solgun">{r.sira}</td>
      <td className="py-1.5 pr-3">
        {r.name}
        {r.tahtSahibi && (
          <span className="ml-2 rounded bg-altin/20 px-1.5 py-0.5 text-xs text-altin">
            Diyarın Lordu
          </span>
        )}
      </td>
      <td className="py-1.5 pr-3 text-right tabular text-solgun">{r.level}</td>
      <td className="py-1.5 pr-3 text-right tabular text-solgun">{r.bolgeSayisi}</td>
      <td className="py-1.5 text-right tabular font-semibold">{formatSayi(r.deger)}</td>
    </tr>
  );
}

export function Siralama({ lordId }: { lordId: string }) {
  const [board, setBoard] = useState<Board>('fame');
  const q = useQuery({
    queryKey: ['rankings', board],
    queryFn: () => api.rankings(board),
    refetchInterval: 60_000,
  });
  const aktif = TABLAR.find((t) => t.key === board)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {TABLAR.map((t) => (
          <button
            key={t.key}
            onClick={() => setBoard(t.key)}
            className={`rounded border px-4 py-2 text-sm transition-colors ${
              board === t.key
                ? 'border-altin bg-altin/20 text-altin'
                : 'border-kenar text-solgun hover:bg-kenar/50'
            }`}
          >
            {t.ad}
          </button>
        ))}
      </div>

      <Panel title={`${aktif.ad} Sıralaması`}>
        <p className="mb-3 text-xs text-solgun">{aktif.aciklama}</p>

        {q.isLoading || !q.data ? (
          <p className="text-sm text-solgun">Yükleniyor...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kenar text-xs text-solgun uppercase">
                    <th className="py-2 pr-3 text-right font-normal">#</th>
                    <th className="py-2 pr-3 text-left font-normal">Lord</th>
                    <th className="py-2 pr-3 text-right font-normal">Sv</th>
                    <th className="py-2 pr-3 text-right font-normal">Bölge</th>
                    <th className="py-2 text-right font-normal">{aktif.ad}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kenar/50">
                  {q.data.satirlar.map((r) => (
                    <Satir key={r.lordId} r={r} benMi={r.lordId === lordId} />
                  ))}
                </tbody>
              </table>
            </div>

            {q.data.benim && !q.data.satirlar.some((r) => r.lordId === lordId) && (
              <div className="mt-3 border-t border-kenar pt-3">
                <table className="w-full text-sm">
                  <tbody>
                    <Satir r={q.data.benim} benMi />
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-3 text-xs text-solgun">
              Dünyada {q.data.toplam} lord var.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
