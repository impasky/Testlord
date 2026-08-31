/** Ekran 5: Harita — 61 bölge, bölge detayı, garnizon ve saldırı emri. */
import { UNIT_TYPES, type Army } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type PreviewDto } from '../api/client';
import { HexHarita } from '../components/HexHarita';
import { Button, Input, Panel, formatKalan, formatSayi } from '../components/ui';

const TIP_ADI: Record<string, string> = {
  tarla: 'Tarla', maden: 'Maden', sehir: 'Şehir', kale: 'Kale', taht: 'Taht Kalesi',
};

function OrduSecici({
  mevcut,
  secim,
  onDegis,
  etiket,
}: {
  mevcut: Army;
  secim: Army;
  onDegis: (a: Army) => void;
  etiket: string;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs text-solgun uppercase">{etiket}</h4>
      <ul className="space-y-1">
        {UNIT_TYPES.filter((t) => (mevcut[t] ?? 0) > 0 || (secim[t] ?? 0) > 0).map((t) => (
          <li key={t} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{t}</span>
            <span className="text-xs text-solgun tabular">/{mevcut[t] ?? 0}</span>
            <Input
              type="number"
              min={0}
              max={mevcut[t] ?? 0}
              value={secim[t] ?? 0}
              onChange={(e) => {
                const v = Math.max(0, Math.min(mevcut[t] ?? 0, Number(e.target.value) || 0));
                onDegis({ ...secim, [t]: v });
              }}
              className="w-20"
            />
          </li>
        ))}
      </ul>
      {UNIT_TYPES.every((t) => (mevcut[t] ?? 0) === 0) && (
        <p className="text-sm text-solgun">Evde asker yok. Önce Kışla'da eğit.</p>
      )}
    </div>
  );
}

export function Harita({ onGuncelle }: { onGuncelle: () => void }) {
  const qc = useQueryClient();
  const [seciliId, setSeciliId] = useState<number | null>(null);
  const [saldiriOrdusu, setSaldiriOrdusu] = useState<Army>({});
  const [garnizon, setGarnizon] = useState<Army>({});
  const [onizleme, setOnizleme] = useState<PreviewDto | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const harita = useQuery({ queryKey: ['map'], queryFn: api.map });
  const army = useQuery({ queryKey: ['army'], queryFn: api.army });
  const marches = useQuery({ queryKey: ['marches'], queryFn: api.marches, refetchInterval: 15_000 });
  const detay = useQuery({
    queryKey: ['region', seciliId],
    queryFn: () => api.region(seciliId!),
    enabled: seciliId !== null,
  });

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['map'] });
    void qc.invalidateQueries({ queryKey: ['army'] });
    void qc.invalidateQueries({ queryKey: ['marches'] });
    if (seciliId !== null) void qc.invalidateQueries({ queryKey: ['region', seciliId] });
    onGuncelle();
  };

  const mut = useMutation({
    mutationFn: async (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      setHata(null);
      tazele();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
  });

  if (harita.isLoading || !harita.data) return <p className="text-solgun">Harita açılıyor...</p>;

  const bolge = detay.data;
  const evdeki = army.data?.home ?? {};
  const secimBos = UNIT_TYPES.every((t) => (saldiriOrdusu[t] ?? 0) === 0);

  async function onizle() {
    if (!bolge) return;
    setHata(null);
    try {
      setOnizleme(await api.preview(bolge.id, saldiriOrdusu));
    } catch (e) {
      setHata(e instanceof ApiError ? e.message : 'Önizleme alınamadı.');
    }
  }

  async function saldir() {
    if (!bolge) return;
    setHata(null);
    setBilgi(null);
    try {
      const r = await api.march(bolge.id, saldiriOrdusu);
      setBilgi(
        `Ordu yola çıktı. Varış ${formatKalan(new Date(r.arriveAt).getTime() - Date.now())} sonra.` +
          (r.uyari ? ` ${r.uyari}` : ''),
      );
      setSaldiriOrdusu({});
      setOnizleme(null);
      tazele();
    } catch (e) {
      setHata(e instanceof ApiError ? e.message : 'Saldırı başlatılamadı.');
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Panel
          title="Dünya Haritası"
          action={
            <span className="text-xs text-solgun">
              Bölgen: {harita.data.regions.filter((r) => r.isMine && r.type !== 'taht').length}/
              {harita.data.maxRegions}
            </span>
          }
        >
          <HexHarita
            regions={harita.data.regions}
            home={harita.data.home}
            seciliId={seciliId}
            onSec={(id) => {
              setSeciliId(id);
              setSaldiriOrdusu({});
              setOnizleme(null);
              setHata(null);
              setBilgi(null);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-solgun">
            <span>Çapraz tarama = senin</span>
            <span>Noktalı = başka lord</span>
            <span>Düz = sahipsiz</span>
            <span>⛨ = koruma altında</span>
          </div>
        </Panel>

        {(marches.data?.length ?? 0) > 0 && (
          <Panel title="Yürüyüşler" className="mt-4">
            <ul className="space-y-2">
              {marches.data?.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>
                    {m.kind === 'attack' ? 'Saldırı' : 'Dönüş'} →{' '}
                    {harita.data.regions.find((r) => r.id === m.toRegionId)?.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular text-solgun">
                      {formatKalan(new Date(m.arriveAt).getTime() - Date.now())}
                    </span>
                    {m.kind === 'attack' && (
                      <Button variant="ghost" onClick={() => mut.mutate(() => api.recallMarch(m.id))}>
                        Geri çağır
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <div className="lg:col-span-2">
        {!bolge ? (
          <Panel title="Bölge">
            <p className="text-sm text-solgun">Haritadan bir bölge seç.</p>
          </Panel>
        ) : (
          <Panel
            title={bolge.name}
            action={
              <span className="text-xs text-solgun">
                {TIP_ADI[bolge.type]} · Lv{bolge.level}
              </span>
            }
          >
            <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-solgun">Sahibi</dt>
                <dd>{bolge.owner ? bolge.owner.name : 'sahipsiz'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-solgun">Mesafe</dt>
                <dd className="tabular">{bolge.distance} hex</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-solgun">Tahkimat</dt>
                <dd className="tabular">+%{Math.round(bolge.fortressBonus * 100)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-solgun">Gelir çarpanı</dt>
                <dd className="tabular">×{bolge.incomeMult}</dd>
              </div>
            </dl>

            {bolge.garrisonVisible && (
              <div className="mb-3 rounded border border-kenar bg-gece/40 p-2">
                <h4 className="mb-1 text-xs text-solgun uppercase">Garnizon</h4>
                {Object.entries(bolge.garrison).filter(([, n]) => (n as number) > 0).length === 0 ? (
                  <p className="text-sm text-solgun">boş</p>
                ) : (
                  <ul className="text-sm">
                    {Object.entries(bolge.garrison)
                      .filter(([, n]) => (n as number) > 0)
                      .map(([t, n]) => (
                        <li key={t} className="flex justify-between">
                          <span>{t}</span>
                          <span className="tabular">{n as number}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
            {!bolge.garrisonVisible && (
              <p className="mb-3 rounded border border-kenar bg-gece/40 p-2 text-xs text-solgun">
                Düşman garnizonu görünmüyor. Casus Leyla kadrondayken tam bilgi alırsın.
              </p>
            )}

            {bolge.isMine ? (
              <>
                {bolge.store && (
                  <p className="mb-3 text-xs text-solgun tabular">
                    Yağmalanabilir depo: {formatSayi(bolge.store.altin)} altın ·{' '}
                    {formatSayi(bolge.store.demir)} demir · {formatSayi(bolge.store.erzak)} erzak
                  </p>
                )}
                {bolge.upgradeCost && (
                  <div className="mb-3">
                    <Button
                      onClick={() => mut.mutate(() => api.upgradeRegion(bolge.id))}
                      disabled={mut.isPending}
                    >
                      Seviye {bolge.level + 1}'e yükselt
                    </Button>
                    <p className="mt-1 text-xs text-solgun tabular">
                      {formatSayi(bolge.upgradeCost.altin)} altın ·{' '}
                      {formatSayi(bolge.upgradeCost.demir)} demir ·{' '}
                      {formatKalan(bolge.upgradeCost.sec * 1000)}
                    </p>
                  </div>
                )}
                <div className="border-t border-kenar pt-3">
                  <OrduSecici
                    mevcut={{
                      ...evdeki,
                      ...Object.fromEntries(
                        UNIT_TYPES.map((t) => [
                          t,
                          (evdeki[t] ?? 0) + ((bolge.garrison[t] as number) ?? 0),
                        ]),
                      ),
                    }}
                    secim={
                      Object.keys(garnizon).length ? garnizon : (bolge.garrison as Army)
                    }
                    onDegis={setGarnizon}
                    etiket="Garnizon"
                  />
                  <Button
                    className="mt-2"
                    onClick={() => mut.mutate(() => api.setGarrison(bolge.id, garnizon))}
                    disabled={mut.isPending || Object.keys(garnizon).length === 0}
                  >
                    Garnizonu ayarla
                  </Button>
                  <p className="mt-2 text-xs text-solgun">
                    Bu bölgeyi sadece buradaki garnizon savunur.
                  </p>
                </div>
              </>
            ) : (
              <div className="border-t border-kenar pt-3">
                <OrduSecici
                  mevcut={evdeki}
                  secim={saldiriOrdusu}
                  onDegis={(a) => {
                    setSaldiriOrdusu(a);
                    setOnizleme(null);
                  }}
                  etiket="Saldırı ordusu"
                />

                <div className="mt-2 flex gap-2">
                  <Button variant="ghost" onClick={onizle} disabled={secimBos}>
                    Önizle
                  </Button>
                  <Button onClick={saldir} disabled={secimBos}>
                    Saldır
                  </Button>
                </div>

                {onizleme && (
                  <div className="mt-3 rounded border border-kenar bg-gece/40 p-3 text-sm">
                    <p className="font-semibold">
                      Tahmin:{' '}
                      <span
                        className={
                          onizleme.tahmin.kazanan === 'attacker' ? 'text-mese' : 'text-kan'
                        }
                      >
                        {onizleme.tahmin.kazanan === 'attacker' ? 'zafer' : 'yenilgi'}
                      </span>
                      {onizleme.tahmin.eleGecirir && (
                        <span className="text-altin"> · bölge ele geçer</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-solgun">
                      Tahmini kaybın:{' '}
                      {Object.entries(onizleme.tahmin.saldiranKayip)
                        .filter(([, n]) => (n as number) > 0)
                        .map(([t, n]) => `${n} ${t}`)
                        .join(', ') || 'yok'}
                    </p>
                    <p className="mt-1 text-xs text-solgun">
                      Yürüyüş: {formatKalan(onizleme.marchSec * 1000)}
                    </p>
                    <p className={`mt-1 text-xs ${onizleme.istihbaratKesin ? 'text-mese' : 'text-kan'}`}>
                      {onizleme.not}
                    </p>
                  </div>
                )}
              </div>
            )}

            {hata && <p className="mt-3 text-sm text-kan">{hata}</p>}
            {bilgi && <p className="mt-3 text-sm text-mese">{bilgi}</p>}
          </Panel>
        )}
      </div>
    </div>
  );
}
