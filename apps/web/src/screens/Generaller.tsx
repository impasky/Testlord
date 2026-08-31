/** Ekran 6: Generaller — 12 kişilik sabit kadro, kiralama, slot yerleşimi. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type GeneralDto } from '../api/client';
import { Button, Panel, formatSayi } from '../components/ui';

const NADIRLIK: Record<string, { ad: string; renk: string; kenar: string }> = {
  bronz: { ad: 'Bronz', renk: 'text-orange-300', kenar: 'border-orange-900/60' },
  gumus: { ad: 'Gümüş', renk: 'text-slate-300', kenar: 'border-slate-500/50' },
  altin: { ad: 'Altın', renk: 'text-altin', kenar: 'border-altin/60' },
};

const ETKI_ADI: Record<string, string> = {
  ordu_saldiri: 'Ordu saldırısı',
  ordu_savunma: 'Ordu savunması',
  savunmada_ordu_savunma: 'Savunmada ordu savunması',
  okcu_saldiri: 'Okçu saldırısı',
  mizrakci_savunma: 'Mızrakçı savunması',
  kusatma_saldiri: 'Mancınık saldırısı',
  lord_savas_katkisi: 'Lord savaş katkısı',
  yagma: 'Yağma',
  bolge_geliri: 'Bölge geliri',
  ordu_bakim_maliyeti: 'Ordu bakım maliyeti',
  yuruyus_suresi: 'Yürüyüş süresi',
  kayip_geri_donus: 'Kayıpların geri dönüşü',
};

function GeneralKarti({
  g,
  slots,
  altin,
  bekliyor,
  onKirala,
  onAta,
}: {
  g: GeneralDto;
  slots: number;
  altin: number;
  bekliyor: boolean;
  onKirala: () => void;
  onAta: (slot: number | null) => void;
}) {
  const n = NADIRLIK[g.nadirlik]!;
  const yeterli = altin >= g.maliyet_altin;
  const yuzde = Math.round(g.etkinDeger * 100);

  return (
    <div className={`rounded border p-3 ${g.slotIndex !== null ? 'border-altin bg-altin/5' : n.kenar}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{g.ad}</h3>
        <span className={`text-xs ${n.renk}`}>{n.ad}</span>
      </div>

      <p className="mt-1 text-sm">
        <span className="text-solgun">{g.pasif.ad}:</span>{' '}
        {ETKI_ADI[g.pasif.etki] ?? g.pasif.etki} {yuzde >= 0 ? '+' : ''}%{yuzde}
      </p>
      <p className="mt-0.5 text-xs text-solgun">
        <span className="text-parsomen/80">{g.yetenek.ad}:</span> {g.yetenek.aciklama}
      </p>

      {g.sahipMi ? (
        <>
          <p className="mt-2 text-xs text-solgun tabular">
            Seviye {g.level}/20 · {formatSayi(g.xp)}/{formatSayi(g.xpForNext)} XP
          </p>
          {g.dinleniyor ? (
            <p className="mt-2 text-xs text-kan">
              Yaralı, {new Date(g.dinleniyor).toLocaleString('tr-TR')} tarihine kadar dinleniyor.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {Array.from({ length: slots }, (_, i) => (
                <Button
                  key={i}
                  variant={g.slotIndex === i ? 'primary' : 'ghost'}
                  onClick={() => onAta(g.slotIndex === i ? null : i)}
                  disabled={bekliyor}
                >
                  Slot {i + 1}
                </Button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-2">
          <Button onClick={onKirala} disabled={bekliyor || !yeterli}>
            Kirala · {formatSayi(g.maliyet_altin)} altın
          </Button>
          {!yeterli && <p className="mt-1 text-xs text-kan">Altının yetmiyor.</p>}
        </div>
      )}
    </div>
  );
}

export function Generaller({ onGuncelle }: { onGuncelle: () => void }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['generals'], queryFn: api.generals });

  const mut = useMutation({
    mutationFn: async (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['generals'] });
      onGuncelle();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
  });

  if (q.isLoading || !q.data) return <p className="text-solgun">Kadro çağrılıyor...</p>;

  const sahada = q.data.kadro.filter((g) => g.slotIndex !== null);

  return (
    <div className="space-y-4">
      <Panel title={`Sahadaki Generaller (${sahada.length}/${q.data.slots})`}>
        {sahada.length === 0 ? (
          <p className="text-sm text-solgun">
            Sahada general yok. Kiraladığın bir generali slota yerleştir.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {sahada.map((g) => (
              <li key={g.key} className="rounded border border-altin/50 bg-altin/10 px-3 py-1.5 text-sm">
                <span className="font-semibold">{g.ad}</span>
                <span className="ml-2 text-xs text-solgun">Lv{g.level}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-solgun">
          Slot sayısı Liderlik statına bağlıdır: 1 + Liderlik/30, en fazla 3.
        </p>
        {hata && <p className="mt-2 text-sm text-kan">{hata}</p>}
      </Panel>

      {(['altin', 'gumus', 'bronz'] as const).map((nad) => (
        <Panel key={nad} title={`${NADIRLIK[nad]!.ad} Generaller`}>
          <div className="grid gap-3 md:grid-cols-2">
            {q.data.kadro
              .filter((g) => g.nadirlik === nad)
              .map((g) => (
                <GeneralKarti
                  key={g.key}
                  g={g}
                  slots={q.data.slots}
                  altin={q.data.altin}
                  bekliyor={mut.isPending}
                  onKirala={() => mut.mutate(() => api.hireGeneral(g.key))}
                  onAta={(slot) => mut.mutate(() => api.assignGeneral(g.key, slot))}
                />
              ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
