/** Ekran 4: Kışla — birim eğitimi, ordu dağılımı, komuta kapasitesi. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type UnitDto } from '../api/client';
import { Button, Input, Meter, Panel, Sayi, formatKalan, formatSayi } from '../components/ui';

function BirimSatiri({
  u,
  evdeki,
  onEgit,
  bekliyor,
}: {
  u: UnitDto;
  evdeki: number;
  onEgit: (adet: number) => void;
  bekliyor: boolean;
}) {
  const [adet, setAdet] = useState(10);
  return (
    <li className="border-b border-kenar/60 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{u.ad}</span>
        <span className="text-sm text-solgun">
          Evde <Sayi>{formatSayi(evdeki)}</Sayi>
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-solgun tabular">
        <span>Sld {u.saldiri}</span>
        <span>Sav {u.savunma}</span>
        <span>Can {u.can}</span>
        <span>Hız {u.hiz}</span>
        <span>{u.yer} yer</span>
        <span className="text-erzak">{u.bakim_erzak_saat} erzak/sa</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          max={5000}
          value={adet}
          onChange={(e) => setAdet(Math.max(1, Number(e.target.value) || 1))}
          className="w-20"
        />
        <Button onClick={() => onEgit(adet)} disabled={bekliyor}>
          Eğit
        </Button>
        <span className="text-xs text-solgun tabular">
          {formatSayi(u.maliyet.altin * adet)} altın
          {u.maliyet.demir > 0 && ` · ${formatSayi(u.maliyet.demir * adet)} demir`}
          {u.maliyet.erzak > 0 && ` · ${formatSayi(u.maliyet.erzak * adet)} erzak`} ·{' '}
          {formatKalan(u.egitim_sn * adet * 1000)}
        </span>
      </div>
    </li>
  );
}

export function Kisla({ onGuncelle }: { onGuncelle: () => void }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const army = useQuery({ queryKey: ['army'], queryFn: api.army });

  const mut = useMutation({
    mutationFn: async (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['army'] });
      onGuncelle();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
  });

  if (army.isLoading || !army.data) return <p className="text-solgun">Kışla açılıyor...</p>;
  const a = army.data;

  const garnizonlar = a.byLocation.filter((u) => u.locationType === 'region');
  const yuruyustekiler = a.byLocation.filter((u) => u.locationType === 'march');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Asker Eğitimi">
          <ul>
            {a.units.map((u) => (
              <BirimSatiri
                key={u.type}
                u={u}
                evdeki={a.home[u.type as keyof typeof a.home] ?? 0}
                bekliyor={mut.isPending}
                onEgit={(adet) => mut.mutate(() => api.train(u.type, adet))}
              />
            ))}
          </ul>
          {hata && <p className="mt-3 text-sm text-kan">{hata}</p>}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Komuta Kapasitesi">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="tabular text-lg">
              {formatSayi(a.usedSlots)} / {formatSayi(a.commandCapacity)}
            </span>
            <span className="text-xs text-solgun">yer</span>
          </div>
          <Meter
            value={a.usedSlots}
            max={a.commandCapacity}
            tone={a.usedSlots >= a.commandCapacity ? 'kan' : 'altin'}
          />
          <p className="mt-2 text-xs text-solgun">
            Ordunun büyüklüğü kaynakla değil Liderlik statıyla sınırlıdır. Kuyruktaki askerler de
            yer tutar.
          </p>
        </Panel>

        <Panel title="Erzak Dengesi">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-solgun">Ordu bakımı</dt>
              <dd className="tabular text-kan">−{formatSayi(a.upkeepPerHour)}/sa</dd>
            </div>
            <div className="flex justify-between border-t border-kenar pt-1.5">
              <dt className="text-solgun">Net erzak</dt>
              <dd className={`tabular ${a.netErzakPerHour < 0 ? 'text-kan' : 'text-erzak'}`}>
                {a.netErzakPerHour >= 0 ? '+' : ''}
                {formatSayi(a.netErzakPerHour)}/sa
              </dd>
            </div>
          </dl>
          {a.netErzakPerHour < 0 && (
            <p className="mt-2 rounded border border-kan/50 bg-kan/10 px-2 py-1.5 text-xs">
              Erzağın eksiliyor. Bittiğinde ordu saatte %5 firar eder. Tarla bölgesi al ya da
              ordunu küçült.
            </p>
          )}
        </Panel>

        {(garnizonlar.length > 0 || yuruyustekiler.length > 0) && (
          <Panel title="Ordunun Dağılımı">
            {garnizonlar.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-1 text-xs text-solgun uppercase">Garnizonlarda</h3>
                <ul className="space-y-0.5 text-sm">
                  {garnizonlar.map((u, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{u.unitType}</span>
                      <span className="tabular">{u.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {yuruyustekiler.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs text-solgun uppercase">Yürüyüşte</h3>
                <ul className="space-y-0.5 text-sm">
                  {yuruyustekiler.map((u, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{u.unitType}</span>
                      <span className="tabular">{u.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 border-t border-kenar pt-2 text-xs text-solgun">
              Bir bölgeyi sadece oraya bıraktığın garnizon savunur. Evdeki ordun bölgeni savunmaz.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
