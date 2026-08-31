/** Demirhane — ekipman üretimi, envanter, ordu donanımı. */
import { EQUIP_SLOTS } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type ItemDto } from '../api/client';
import { IkonAltin, IkonDemir, IkonSure, IkonNavDemirhane } from '../components/Ikonlar';
import {
  Bolum,
  Buton,
  Ilerleme,
  Kart,
  NADIRLIK,
  Rozet,
  formatKalan,
  formatSayi,
  nadirlikRengi,
  type Nadirlik,
} from '../components/ui';

const SLOT_ADI: Record<string, string> = {
  silah: 'Silah',
  kalkan: 'Kalkan',
  zirh: 'Zırh',
  migfer: 'Miğfer',
  at: 'At',
  sancak: 'Sancak',
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
  const renk = nadirlikRengi(item.rarity);
  const n = NADIRLIK[item.rarity as Nadirlik] ?? NADIRLIK.siradan;

  return (
    <Kart className="p-3" vurgu={renk}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="baslik truncate text-[13px]">
            {SLOT_ADI[item.slot]}
            <span className="ml-1.5 text-solgun">T{item.tier}</span>
            {item.upgradeLevel > 0 && <span className="ml-1 text-altin">+{item.upgradeLevel}</span>}
          </h3>
          <Rozet renk={renk} className="mt-1">
            {n.ad}
          </Rozet>
        </div>
        <div className="shrink-0 text-right">
          <div className="baslik text-[9px] text-solgun">GÜÇ</div>
          <div className="tabular text-lg leading-none font-bold" style={{ color: renk }}>
            {formatSayi(item.power)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Buton tur={item.equipped ? 'sessiz' : 'altin'} boy="kucuk" onClick={onEquip} disabled={bekliyor}>
          {item.equipped ? 'Çıkar' : 'Kuşan'}
        </Buton>
        {item.upgradeCost && (
          <Buton tur="sessiz" boy="kucuk" onClick={onUpgrade} disabled={bekliyor}>
            +{item.upgradeLevel + 1} · %{Math.round((item.upgradeChance ?? 0) * 100)}
          </Buton>
        )}
        {!item.equipped && (
          <Buton tur="anahat" boy="kucuk" onClick={onSell} disabled={bekliyor}>
            Sat {formatSayi(item.sellValue)}
          </Buton>
        )}
      </div>

      {item.upgradeCost && (
        <p className="tabular mt-1.5 text-[10px] text-sonuk">
          {formatSayi(item.upgradeCost.altin)} altın · {formatSayi(item.upgradeCost.demir)} demir
          {(item.upgradeChance ?? 1) < 1 && ' · başarısızsa eşya sağlam kalır'}
        </p>
      )}
    </Kart>
  );
}

export function Demirhane({ onGuncelle }: { onGuncelle: () => void }) {
  const qc = useQueryClient();
  const [tier, setTier] = useState(1);
  const [slot, setSlot] = useState<string>('silah');
  const [hata, setHata] = useState<string | null>(null);

  const items = useQuery({ queryKey: ['items'], queryFn: api.items });
  const gear = useQuery({ queryKey: ['gear'], queryFn: api.gear });

  const mut = useMutation({
    mutationFn: async (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['items'] });
      void qc.invalidateQueries({ queryKey: ['gear'] });
      onGuncelle();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
  });

  if (items.isLoading || gear.isLoading) {
    return <p className="pt-6 text-center text-solgun">Demirhane açılıyor...</p>;
  }
  const secili = items.data?.tiers.find((t) => t.tier === tier);

  return (
    <div className="space-y-4 pt-3">
      {hata && (
        <Kart className="border-kirmizi/50 p-3">
          <p className="text-[13px] text-kirmizi">{hata}</p>
        </Kart>
      )}

      <Bolum baslik="Ekipman Üretimi">
        <Kart className="p-3">
          <div className="gizli-kaydirma mb-2 flex gap-1.5 overflow-x-auto">
            {items.data?.tiers.map((t) => (
              <button
                key={t.tier}
                onClick={() => t.unlocked && setTier(t.tier)}
                disabled={!t.unlocked}
                className={`bas baslik shrink-0 rounded-lg border px-3 py-2 text-[12px] ${
                  tier === t.tier
                    ? 'border-altin/60 bg-altin/15 text-altin'
                    : t.unlocked
                      ? 'border-kenar text-solgun'
                      : 'border-kenar/50 text-sonuk/50'
                }`}
              >
                T{t.tier}
                {!t.unlocked && <span className="ml-1 text-[10px]">Sv{t.unlockLevel}</span>}
              </button>
            ))}
          </div>

          <div className="gizli-kaydirma mb-3 flex gap-1.5 overflow-x-auto">
            {EQUIP_SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={`bas baslik shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  slot === s ? 'border-altin/60 bg-altin/15 text-altin' : 'border-kenar text-solgun'
                }`}
              >
                {SLOT_ADI[s]}
              </button>
            ))}
          </div>

          {secili && (
            <>
              <div className="oyuk mb-3 rounded-xl p-3">
                <div className="tabular mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-solgun">
                  <span className="text-kaynak-altin">
                    <IkonAltin boyut={13} /> {formatSayi(secili.cost.altin)}
                  </span>
                  <span className="text-kaynak-demir">
                    <IkonDemir boyut={13} /> {formatSayi(secili.cost.demir)}
                  </span>
                  <span>
                    <IkonSure boyut={13} /> {formatKalan(secili.durationSec * 1000)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px]">
                  {Object.entries(secili.rarityTable)
                    .filter(([, p]) => p > 0)
                    .map(([r, p]) => (
                      <span key={r} style={{ color: nadirlikRengi(r) }}>
                        {NADIRLIK[r as Nadirlik]?.ad} %{Math.round(p * 100)}
                      </span>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-sonuk">
                  Nadirlik üretim anında rastgele belirlenir.
                </p>
              </div>

              <Buton onClick={() => mut.mutate(() => api.craft(tier, slot))} disabled={mut.isPending} tam boy="buyuk">
                T{tier} {SLOT_ADI[slot]} üret
              </Buton>
            </>
          )}
        </Kart>
      </Bolum>

      <Bolum baslik={`Envanter · ${items.data?.items.length ?? 0}`}>
        {items.data?.items.length === 0 ? (
          <Kart className="p-4">
            <p className="text-[13px] text-solgun">Henüz ekipmanın yok.</p>
          </Kart>
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
      </Bolum>

      <Bolum baslik="Ordu Donanımı">
        <div className="space-y-2">
          {gear.data?.map((g) => (
            <Kart key={g.line} className="p-3">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-altin/15 text-altin">
                  <IkonNavDemirhane boyut={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="baslik text-[13px]">{g.ad}</span>
                    <span className="tabular text-[12px] text-solgun">
                      {g.level}/{g.maxLevel}
                    </span>
                  </div>
                  <p className="text-[11px] text-solgun">
                    {g.etki.replace('ordu_', 'Ordu ')} +%{Math.round(g.bonus * 100)}
                  </p>
                </div>
              </div>
              <Ilerleme deger={g.level} max={g.maxLevel} renk="var(--color-altin)" boy="ince" />
              {g.nextCost ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <Buton tur="sessiz" boy="kucuk" onClick={() => mut.mutate(() => api.upgradeGear(g.line))} disabled={mut.isPending}>
                    Seviye {g.level + 1}
                  </Buton>
                  <span className="tabular text-[10px] text-sonuk">
                    {formatSayi(g.nextCost.altin)} altın · {formatSayi(g.nextCost.demir)} demir ·{' '}
                    {formatKalan(g.nextCost.sec * 1000)}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-altin">En üst seviye</p>
              )}
            </Kart>
          ))}
        </div>
      </Bolum>
    </div>
  );
}
