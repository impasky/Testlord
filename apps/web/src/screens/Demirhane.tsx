/** Ekran 3: Demirhane — ekipman üretimi, yükseltme, ordu donanım hatları. */
import { EQUIP_SLOTS } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type ItemDto } from '../api/client';
import { Button, Panel, Sayi, formatKalan, formatSayi } from '../components/ui';

const SLOT_ADI: Record<string, string> = {
  silah: 'Silah', kalkan: 'Kalkan', zirh: 'Zırh',
  migfer: 'Miğfer', at: 'At', sancak: 'Sancak',
};

const NADIRLIK: Record<string, { ad: string; renk: string }> = {
  siradan: { ad: 'Sıradan', renk: 'text-solgun' },
  usta: { ad: 'Usta işi', renk: 'text-mese' },
  nadir: { ad: 'Nadir', renk: 'text-demir' },
  efsanevi: { ad: 'Efsanevi', renk: 'text-purple-400' },
  kadim: { ad: 'Kadim', renk: 'text-altin' },
};

function EsyaKarti({
  item,
  onEquip,
  onUpgrade,
  onSell,
  bekliyor,
}: {
  item: ItemDto;
  onEquip: () => void;
  onUpgrade: () => void;
  onSell: () => void;
  bekliyor: boolean;
}) {
  const n = NADIRLIK[item.rarity] ?? NADIRLIK.siradan!;
  return (
    <div
      className={`rounded border p-3 ${
        item.equipped ? 'border-altin/70 bg-altin/5' : 'border-kenar bg-derin/50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {SLOT_ADI[item.slot]} <span className="text-solgun">T{item.tier}</span>
          {item.upgradeLevel > 0 && <span className="text-altin"> +{item.upgradeLevel}</span>}
        </span>
        <span className={`text-xs ${n.renk}`}>{n.ad}</span>
      </div>
      <div className="mt-1 text-sm">
        Güç <Sayi>{formatSayi(item.power)}</Sayi>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Button variant={item.equipped ? 'ghost' : 'primary'} onClick={onEquip} disabled={bekliyor}>
          {item.equipped ? 'Çıkar' : 'Kuşan'}
        </Button>
        {item.upgradeCost && (
          <Button variant="ghost" onClick={onUpgrade} disabled={bekliyor}>
            +{item.upgradeLevel + 1} (%{Math.round((item.upgradeChance ?? 0) * 100)})
          </Button>
        )}
        {!item.equipped && (
          <Button variant="ghost" onClick={onSell} disabled={bekliyor}>
            Sat {formatSayi(item.sellValue)}
          </Button>
        )}
      </div>
      {item.upgradeCost && (
        <p className="mt-1.5 text-xs text-solgun tabular">
          {formatSayi(item.upgradeCost.altin)} altın · {formatSayi(item.upgradeCost.demir)} demir
          {(item.upgradeChance ?? 1) < 1 && (
            <span className="text-kan"> · başarısızsa malzeme gider, eşya sağlam kalır</span>
          )}
        </p>
      )}
    </div>
  );
}

export function Demirhane({ onGuncelle }: { onGuncelle: () => void }) {
  const qc = useQueryClient();
  const [tier, setTier] = useState(1);
  const [slot, setSlot] = useState<string>('silah');
  const [hata, setHata] = useState<string | null>(null);

  const items = useQuery({ queryKey: ['items'], queryFn: api.items });
  const gear = useQuery({ queryKey: ['gear'], queryFn: api.gear });

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['items'] });
    void qc.invalidateQueries({ queryKey: ['gear'] });
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

  if (items.isLoading || gear.isLoading) return <p className="text-solgun">Demirhane açılıyor...</p>;

  const secili = items.data?.tiers.find((t) => t.tier === tier);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel title="Ekipman Üretimi">
          <div className="mb-3 flex flex-wrap gap-1">
            {items.data?.tiers.map((t) => (
              <button
                key={t.tier}
                onClick={() => t.unlocked && setTier(t.tier)}
                disabled={!t.unlocked}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  tier === t.tier
                    ? 'border-altin bg-altin/20 text-altin'
                    : t.unlocked
                      ? 'border-kenar text-parsomen hover:bg-kenar/50'
                      : 'border-kenar/50 text-solgun/50'
                }`}
                title={t.unlocked ? undefined : `Seviye ${t.unlockLevel} gerekiyor`}
              >
                T{t.tier}
                {!t.unlocked && <span className="ml-1 text-xs">Lv{t.unlockLevel}</span>}
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap gap-1">
            {EQUIP_SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                  slot === s
                    ? 'border-altin bg-altin/20 text-altin'
                    : 'border-kenar text-solgun hover:bg-kenar/50'
                }`}
              >
                {SLOT_ADI[s]}
              </button>
            ))}
          </div>

          {secili && (
            <>
              <div className="mb-3 rounded border border-kenar bg-gece/40 p-3">
                <p className="text-sm tabular">
                  {formatSayi(secili.cost.altin)} altın · {formatSayi(secili.cost.demir)} demir ·{' '}
                  {formatKalan(secili.durationSec * 1000)}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {Object.entries(secili.rarityTable)
                    .filter(([, p]) => p > 0)
                    .map(([r, p]) => (
                      <span key={r} className={NADIRLIK[r]?.renk}>
                        {NADIRLIK[r]?.ad} %{Math.round(p * 100)}
                      </span>
                    ))}
                </div>
                <p className="mt-2 text-xs text-solgun">
                  Nadirlik üretim anında rastgele belirlenir. Yüksek tier iyi nadirlik şansını
                  artırır ama hiçbir zaman garanti etmez.
                </p>
              </div>
              <Button
                onClick={() => mut.mutate(() => api.craft(tier, slot))}
                disabled={mut.isPending}
              >
                T{tier} {SLOT_ADI[slot]} üret
              </Button>
            </>
          )}
          {hata && <p className="mt-3 text-sm text-kan">{hata}</p>}
        </Panel>

        <Panel title={`Envanter (${items.data?.items.length ?? 0})`}>
          {items.data?.items.length === 0 ? (
            <p className="text-sm text-solgun">Henüz ekipmanın yok.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {items.data?.items.map((i) => (
                <EsyaKarti
                  key={i.id}
                  item={i}
                  bekliyor={mut.isPending}
                  onEquip={() => mut.mutate(() => api.equip(i.id))}
                  onUpgrade={() => mut.mutate(() => api.upgradeItem(i.id))}
                  onSell={() => mut.mutate(() => api.sellItem(i.id))}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Ordu Donanımı">
        <p className="mb-3 text-xs text-solgun">
          Tek tek birime değil, ordunun tamamına yüzde bonusu verir. Geç oyunun ana altın deliği
          burasıdır.
        </p>
        <ul className="space-y-3">
          {gear.data?.map((g) => (
            <li key={g.line} className="border-b border-kenar/60 pb-3 last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{g.ad}</span>
                <span className="tabular text-sm">
                  {g.level}/{g.maxLevel}
                </span>
              </div>
              <p className="text-xs text-solgun">
                {g.etki.replace('ordu_', 'Ordu ')} +%{Math.round(g.bonus * 100)}
              </p>
              {g.nextCost ? (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    onClick={() => mut.mutate(() => api.upgradeGear(g.line))}
                    disabled={mut.isPending}
                  >
                    Seviye {g.level + 1}
                  </Button>
                  <p className="mt-1 text-xs text-solgun tabular">
                    {formatSayi(g.nextCost.altin)} altın · {formatSayi(g.nextCost.demir)} demir ·{' '}
                    {formatKalan(g.nextCost.sec * 1000)}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-altin">En üst seviye</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
