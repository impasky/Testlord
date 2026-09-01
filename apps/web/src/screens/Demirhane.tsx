/**
 * Demirhane — ekipman üretimi, envanter, ordu donanımı.
 *
 * Kışla ile aynı kural: oyuncu bastığı her düğmenin sonucunu bu ekranda
 * görmeli. Üretim ve yükseltme kuyrukları düğmelerin altında beliriyor,
 * yapılamayan işlemin düğmesi kapalı ve sebebi yazılı.
 */
import { EQUIP_SLOTS, B } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type ItemDto, type LordState, type QueueItem } from '../api/client';
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { IkonAltin, IkonDemir, IkonSure, IkonNavDemirhane } from '../components/Ikonlar';
import {
  Bolum,
  Buton,
  EngelNotu,
  Ilerleme,
  Iskelet,
  Kart,
  KuyrukSeridi,
  NADIRLIK,
  Rozet,
  formatKalan,
  formatSayi,
  kaynakEngeli,
  nadirlikRengi,
  type Nadirlik,
} from '../components/ui';

const URETIM_LIMITI = B.kuyruklar.es_zamanli.craft;
const YUKSELTME_LIMITI = B.kuyruklar.es_zamanli.upgrade_item;
const DONANIM_LIMITI = B.kuyruklar.es_zamanli.upgrade_gear;

/** Kuyruk doluysa sebebini söyler. Üç bölümde de aynı cümle kuruluyordu. */
function kuyrukEngeli(acik: number, limit: number, ad: string) {
  if (acik < limit) return null;
  return {
    kisa: `${ad} kuyruğu dolu`,
    uzun: `Aynı anda en fazla ${limit} ${ad.toLocaleLowerCase('tr')} işi yapılabilir. Biri bitmeden yenisi başlamaz.`,
  };
}

const SLOT_ADI: Record<string, string> = {
  silah: 'Silah',
  kalkan: 'Kalkan',
  zirh: 'Zırh',
  migfer: 'Miğfer',
  at: 'At',
  sancak: 'Sancak',
};

/**
 * Kuşanık eşyayla farkı.
 *
 * "Bu daha mı iyi" sorusunu oyuncu kafadan hesaplıyordu: iki kartı yan yana
 * koyup güç sayılarını çıkarmak gerekiyordu. Fark artık kartın üstünde.
 */
function GucFarki({ fark }: { fark: number }) {
  if (fark === 0) {
    return <span className="text-[11px] text-sonuk">kuşanıkla aynı</span>;
  }
  const iyi = fark > 0;
  return (
    <span className={`tabular text-[11px] font-bold ${iyi ? 'text-yesil' : 'text-kirmizi'}`}>
      {iyi ? '+' : ''}
      {formatSayi(fark)} güç
    </span>
  );
}

function EsyaKarti({
  item,
  kusanikGuc,
  kaynaklar,
  yukseltmeKuyrugu,
  bunuYukseltiyor,
  onEquip,
  onUpgrade,
  onSell,
  bekleyenEylem,
}: {
  item: ItemDto;
  /** Aynı slottaki kuşanık eşyanın gücü; yoksa null. */
  kusanikGuc: number | null;
  kaynaklar: { altin: number; demir: number; erzak: number };
  yukseltmeKuyrugu: QueueItem[];
  bunuYukseltiyor: QueueItem[];
  onEquip: () => void;
  onUpgrade: () => void;
  onSell: () => void;
  /** Bu kartta hangi eylem gönderiliyor; diğer kartlar etkilenmez. */
  bekleyenEylem: 'equip' | 'upgrade' | 'sell' | null;
}) {
  const yukseltmeEngeli =
    item.upgradeCost === null
      ? { kisa: 'Yükseltme sonuna geldi', uzun: 'Bu eşya daha fazla yükseltilemez.' }
      : (kuyrukEngeli(yukseltmeKuyrugu.length, YUKSELTME_LIMITI, 'Yükseltme') ??
        kaynakEngeli(item.upgradeCost, kaynaklar));
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
          {/* Karşılaştırma yalnızca kuşanık OLMAYAN eşyada: kuşanık olanın
              kendisiyle farkı sıfır ve satır gürültü olurdu. */}
          {!item.equipped && kusanikGuc !== null && (
            <div className="mt-0.5">
              <GucFarki fark={item.power - kusanikGuc} />
            </div>
          )}
          {!item.equipped && kusanikGuc === null && (
            <div className="mt-0.5 text-[11px] text-yesil">slot boş</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Buton
          tur={item.equipped ? 'sessiz' : 'altin'}
          boy="kucuk"
          onClick={onEquip}
          disabled={bekleyenEylem !== null}
        >
          {item.equipped ? 'Çıkar' : 'Kuşan'}
        </Buton>
        {item.upgradeCost && (
          <Buton
            tur="sessiz"
            boy="kucuk"
            onClick={onUpgrade}
            disabled={bekleyenEylem !== null || yukseltmeEngeli !== null}
          >
            +{item.upgradeLevel + 1} · %{Math.round((item.upgradeChance ?? 0) * 100)}
          </Buton>
        )}
        {!item.equipped && (
          <Buton
            tur="anahat"
            boy="kucuk"
            onClick={onSell}
            disabled={bekleyenEylem !== null}
          >
            Sat {formatSayi(item.sellValue)}
          </Buton>
        )}
      </div>

      {item.upgradeCost && (
        <p className="tabular mt-1.5 text-[10px] text-sonuk">
          <span className={item.upgradeCost.altin > kaynaklar.altin ? 'text-kirmizi' : ''}>
            {formatSayi(item.upgradeCost.altin)} altın
          </span>
          {' · '}
          <span className={item.upgradeCost.demir > kaynaklar.demir ? 'text-kirmizi' : ''}>
            {formatSayi(item.upgradeCost.demir)} demir
          </span>
          {(item.upgradeChance ?? 1) < 1 && ' · başarısızsa eşya sağlam kalır'}
        </p>
      )}

      {/* Engeli yalnızca yükseltilebilir eşyada gösteriyoruz: sonuna gelmiş
          bir eşyada "yükseltilemez" uyarısı her karta kırmızı satır ekler. */}
      {item.upgradeCost && yukseltmeEngeli && (
        <EngelNotu kisa={yukseltmeEngeli.kisa} uzun={yukseltmeEngeli.uzun} />
      )}

      <KuyrukSeridi kuyruklar={bunuYukseltiyor} etiket="Yükseltiliyor" />
    </Kart>
  );
}

export function Demirhane({
  lord,
  queues,
  onGuncelle,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGuncelle: () => void;
}) {
  const qc = useQueryClient();
  const [tier, setTier] = useState(1);
  const [slot, setSlot] = useState<string>('silah');
  const [hata, setHata] = useState<string | null>(null);
  // Hangi eylem gönderiliyor. Tek bir bayrak ekrandaki BÜTÜN düğmeleri
  // birden söndürüyordu; oyuncu hangi işin sürdüğünü göremiyordu.
  const [gonderilen, setGonderilen] = useState<string | null>(null);

  const items = useQuery({ queryKey: ['items'], queryFn: api.items });
  const gear = useQuery({ queryKey: ['gear'], queryFn: api.gear });

  const mut = useMutation({
    mutationFn: async ({ f }: { f: () => Promise<unknown>; anahtar: string }) => f(),
    onMutate: ({ anahtar }) => setGonderilen(anahtar),
    onSuccess: () => {
      setHata(null);
      hisOnay();
      void qc.invalidateQueries({ queryKey: ['items'] });
      void qc.invalidateQueries({ queryKey: ['gear'] });
      onGuncelle();
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.');
    },
    onSettled: () => setGonderilen(null),
  });

  const uretimKuyrugu = queues.filter((q) => q.kind === 'craft');
  const yukseltmeKuyrugu = queues.filter((q) => q.kind === 'upgrade_item');
  const donanimKuyrugu = queues.filter((q) => q.kind === 'upgrade_gear');

  if (items.isLoading || gear.isLoading) {
    return <Iskelet satir={4} />;
  }
  const secili = items.data?.tiers.find((t) => t.tier === tier);
  const uretimEngeli = secili
    ? (kuyrukEngeli(uretimKuyrugu.length, URETIM_LIMITI, 'Üretim') ??
      kaynakEngeli(secili.cost, lord.resources))
    : null;

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
                  <span
                    className={
                      secili.cost.altin > lord.resources.altin ? 'text-kirmizi' : 'text-kaynak-altin'
                    }
                  >
                    <IkonAltin boyut={13} /> {formatSayi(secili.cost.altin)}
                  </span>
                  <span
                    className={
                      secili.cost.demir > lord.resources.demir ? 'text-kirmizi' : 'text-kaynak-demir'
                    }
                  >
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

              <Buton
                onClick={() =>
                  mut.mutate({ anahtar: 'craft', f: () => api.craft(tier, slot) })
                }
                disabled={gonderilen === 'craft' || uretimEngeli !== null}
                tam
                boy="buyuk"
              >
                {gonderilen === 'craft'
                  ? 'Gönderiliyor…'
                  : `T${tier} ${SLOT_ADI[slot]} üret`}
              </Buton>

              {uretimEngeli && (
                <EngelNotu kisa={uretimEngeli.kisa} uzun={uretimEngeli.uzun} />
              )}

              <KuyrukSeridi
                kuyruklar={uretimKuyrugu}
                etiket={
                  <>
                    Üretimde
                    {uretimKuyrugu.length > 1 && (
                      <span className="ml-1 font-normal text-solgun">
                        ({uretimKuyrugu.length} parça)
                      </span>
                    )}
                  </>
                }
              />
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
                kusanikGuc={
                  items.data?.items.find((x) => x.equipped && x.slot === i.slot)?.power ?? null
                }
                kaynaklar={lord.resources}
                yukseltmeKuyrugu={yukseltmeKuyrugu}
                bunuYukseltiyor={yukseltmeKuyrugu.filter((q) => q.payload.itemId === i.id)}
                bekleyenEylem={
                  gonderilen === `equip:${i.id}`
                    ? 'equip'
                    : gonderilen === `upgrade:${i.id}`
                      ? 'upgrade'
                      : gonderilen === `sell:${i.id}`
                        ? 'sell'
                        : null
                }
                onEquip={() => mut.mutate({ anahtar: `equip:${i.id}`, f: () => api.equip(i.id) })}
                onUpgrade={() =>
                  mut.mutate({ anahtar: `upgrade:${i.id}`, f: () => api.upgradeItem(i.id) })
                }
                onSell={() => mut.mutate({ anahtar: `sell:${i.id}`, f: () => api.sellItem(i.id) })}
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
                (() => {
                  const engel =
                    kuyrukEngeli(donanimKuyrugu.length, DONANIM_LIMITI, 'Donanım') ??
                    kaynakEngeli(g.nextCost, lord.resources);
                  const anahtar = `gear:${g.line}`;
                  return (
                    <>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Buton
                          tur="sessiz"
                          boy="kucuk"
                          onClick={() =>
                            mut.mutate({ anahtar, f: () => api.upgradeGear(g.line) })
                          }
                          disabled={gonderilen === anahtar || engel !== null}
                        >
                          Seviye {g.level + 1}
                        </Buton>
                        <span className="tabular text-[10px] text-sonuk">
                          <span
                            className={
                              g.nextCost.altin > lord.resources.altin ? 'text-kirmizi' : ''
                            }
                          >
                            {formatSayi(g.nextCost.altin)} altın
                          </span>
                          {' · '}
                          <span
                            className={
                              g.nextCost.demir > lord.resources.demir ? 'text-kirmizi' : ''
                            }
                          >
                            {formatSayi(g.nextCost.demir)} demir
                          </span>
                          {' · '}
                          {formatKalan(g.nextCost.sec * 1000)}
                        </span>
                      </div>
                      {engel && <EngelNotu kisa={engel.kisa} uzun={engel.uzun} />}
                      <KuyrukSeridi
                        kuyruklar={donanimKuyrugu.filter((q) => q.payload.line === g.line)}
                        etiket="Yükseltiliyor"
                      />
                    </>
                  );
                })()
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
