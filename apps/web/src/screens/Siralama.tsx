/** Sıralama — üç liste, üç oyun tarzı. */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type RankingRow } from '../api/client';
import { IkonNavSiralama } from '../components/Ikonlar';
import { Alan, Bolum, Buton, Input, Kart, Rozet, formatSayi } from '../components/ui';

type Board = 'fame' | 'conquest' | 'elo';

const TABLAR: { key: Board; ad: string; aciklama: string; renk: string }[] = [
  { key: 'fame', ad: 'Şöhret', aciklama: 'Genel toplam skor. Dengeli oyuncuyu ödüllendirir.', renk: 'var(--color-altin)' },
  { key: 'conquest', ad: 'Fetih', aciklama: 'Bölge seviyesi × tip çarpanı. Toprak sahibinin sıralaması.', renk: 'var(--color-yesil)' },
  { key: 'elo', ad: 'Kılıç', aciklama: 'PvP derecesi. Bölgesiz bir lord da birinci olabilir.', renk: 'var(--color-kirmizi)' },
];

const MADALYA = ['#f5b731', '#c8d1d9', '#c97b3c'];

function Satir({
  r,
  benMi,
  renk,
  onRapor,
}: {
  r: RankingRow;
  benMi: boolean;
  renk: string;
  onRapor?: (r: RankingRow) => void;
}) {
  const madalya = r.sira <= 3 ? MADALYA[r.sira - 1] : undefined;
  return (
    <Kart className={`p-2.5 ${benMi ? 'border-altin/60' : ''}`} vurgu={benMi ? 'var(--color-altin)' : undefined}>
      <div className="flex items-center gap-2.5">
        <span
          className="baslik flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px]"
          style={
            madalya
              ? { background: `color-mix(in srgb, ${madalya} 22%, transparent)`, color: madalya }
              : { background: 'var(--color-oyuk)', color: 'var(--color-sonuk)' }
          }
        >
          {r.sira}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium">{r.name}</span>
            {r.tahtSahibi && <Rozet renk="var(--color-altin)">DİYARIN LORDU</Rozet>}
          </div>
          <div className="text-[10px] text-sonuk">
            Sv {r.level} · {r.bolgeSayisi} bölge
          </div>
        </div>
        <span className="tabular shrink-0 text-[14px] font-bold" style={{ color: renk }}>
          {formatSayi(r.deger)}
        </span>

        {/* Şikâyet yalnızca başkası için: kendini şikâyet etmek anlamsız,
            sunucu da reddediyor. */}
        {onRapor && !benMi && (
          <button
            onClick={() => onRapor(r)}
            aria-label={`${r.name} adlı lordu şikâyet et`}
            className="bas shrink-0 px-1 text-[15px] leading-none text-sonuk"
            title="Şikâyet et"
          >
            ⚑
          </button>
        )}
      </div>
    </Kart>
  );
}

export function Siralama({ lordId }: { lordId: string }) {
  const [board, setBoard] = useState<Board>('fame');
  const [raporlanan, setRaporlanan] = useState<RankingRow | null>(null);
  const [sebep, setSebep] = useState('');
  const [raporBilgi, setRaporBilgi] = useState<string | null>(null);

  const raporMut = useMutation({
    mutationFn: () => api.raporEt(raporlanan!.lordId, sebep),
    onSuccess: () => {
      setRaporlanan(null);
      setSebep('');
      setRaporBilgi('Şikâyetin alındı. İnceleyeceğiz.');
    },
    onError: (e) => setRaporBilgi(e instanceof ApiError ? e.message : 'Şikâyet gönderilemedi.'),
  });
  const q = useQuery({
    queryKey: ['rankings', board],
    queryFn: () => api.rankings(board),
    refetchInterval: 60_000,
  });
  const aktif = TABLAR.find((t) => t.key === board)!;

  return (
    <div className="space-y-4 pt-3">
      <div className="oyuk flex gap-1 rounded-xl p-1">
        {TABLAR.map((t) => (
          <button
            key={t.key}
            onClick={() => setBoard(t.key)}
            className={`bas baslik flex-1 rounded-lg py-2.5 text-[12px] ${
              board === t.key ? 'text-gece' : 'text-solgun'
            }`}
            style={board === t.key ? { background: t.renk } : undefined}
          >
            {t.ad}
          </button>
        ))}
      </div>

      <Bolum
        baslik={`${aktif.ad} Sıralaması`}
        yan={
          <span className="text-[11px] text-sonuk">
            {q.data ? `${q.data.toplam} lord` : ''}
          </span>
        }
      >
        <p className="mb-2 px-1 text-[11px] text-sonuk">{aktif.aciklama}</p>

        {q.isLoading || !q.data ? (
          <Kart className="p-4">
            <p className="text-[13px] text-solgun">Yükleniyor...</p>
          </Kart>
        ) : (
          <>
            <div className="space-y-1.5">
              {q.data.satirlar.map((r) => (
                <Satir
                  key={r.lordId}
                  r={r}
                  benMi={r.lordId === lordId}
                  renk={aktif.renk}
                  onRapor={setRaporlanan}
                />
              ))}
            </div>

            {q.data.benim && !q.data.satirlar.some((r) => r.lordId === lordId) && (
              <div className="mt-3 border-t border-kenar pt-3">
                <p className="baslik mb-1.5 px-1 text-[10px] text-solgun">Senin sıran</p>
                <Satir r={q.data.benim} benMi renk={aktif.renk} />
              </div>
            )}

            {q.data.satirlar.length === 0 && (
              <Kart className="p-6 text-center">
                <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-altin/15 text-altin">
                  <IkonNavSiralama boyut={26} />
                </span>
                <p className="text-[13px] text-solgun">Bu dünyada henüz kimse yok.</p>
              </Kart>
            )}
          </>
        )}
      </Bolum>
      {raporBilgi && (
        <p className="px-1 text-center text-[12px] text-yesil">{raporBilgi}</p>
      )}

      {raporlanan && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setRaporlanan(null)}
            aria-label="Kapat"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border-t border-kenar bg-panel p-4"
            style={{ paddingBottom: 'calc(var(--alt-bar) + 16px)' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar" />
            <h2 className="baslik mb-1 text-[14px]">{raporlanan.name} şikâyet</h2>
            <p className="mb-3 text-[12px] text-solgun">
              Şikâyet edilen lorda otomatik bir ceza verilmez; kayıt insan
              tarafından incelenir.
            </p>
            <Alan etiket="Sebep" ipucu="Kısaca yaz">
              <Input
                value={sebep}
                onChange={(e) => setSebep(e.target.value)}
                placeholder="Örn. uygunsuz lord adı"
                maxLength={300}
              />
            </Alan>
            <div className="mt-3 flex gap-2">
              <Buton tur="anahat" className="flex-1" onClick={() => setRaporlanan(null)}>
                Vazgeç
              </Buton>
              <Buton
                className="flex-1"
                onClick={() => raporMut.mutate()}
                disabled={raporMut.isPending || sebep.trim().length < 3}
              >
                {raporMut.isPending ? 'Gönderiliyor…' : 'Şikâyet et'}
              </Buton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}