/** Lord — statlar, puan dağıtımı, kuşanılan ekipman. */
import { EQUIP_SLOTS, STAT_KEYS, type StatKey } from '@lordlar/shared';
import { useState } from 'react';
import { ApiError, api, type LordState } from '../api/client';
import { IkonCan, IkonKurnaz, IkonSaldiri, IkonYer } from '../components/Ikonlar';
import { Bolum, Buton, Kart, Rozet, formatSayi, nadirlikRengi } from '../components/ui';
import { Gorsel } from '../components/Gorsel';
import { OrduSahnesi } from '../components/OrduSahnesi';

const STAT: Record<StatKey, { ad: string; renk: string; etki: (n: number) => string }> = {
  guc: { ad: 'Güç', renk: 'var(--color-kirmizi)', etki: (n) => `Savaş katkısı +${n * 3}` },
  dayaniklilik: {
    ad: 'Dayanıklılık',
    renk: 'var(--color-yesil)',
    etki: (n) => `Can +${n * 25} · yaralanma −%${Math.min(50, n)}`,
  },
  liderlik: { ad: 'Liderlik', renk: 'var(--color-mavi)', etki: (n) => `Komuta ${50 + n * 8} yer` },
  kurnazlik: { ad: 'Kurnazlık', renk: 'var(--color-mor)', etki: (n) => `Yağma +%${Math.min(100, n)}` },
};

const STAT_IKONU: Record<StatKey, typeof IkonSaldiri> = {
  guc: IkonSaldiri,
  dayaniklilik: IkonCan,
  liderlik: IkonYer,
  kurnazlik: IkonKurnaz,
};

const SLOT_ADI: Record<string, string> = {
  silah: 'Silah',
  kalkan: 'Kalkan',
  zirh: 'Zırh',
  migfer: 'Miğfer',
  at: 'At',
  sancak: 'Sancak',
};

export function LordEkrani({ lord, onGuncelle }: { lord: LordState; onGuncelle: () => void }) {
  const [dagitim, setDagitim] = useState<Record<StatKey, number>>({
    guc: 0,
    dayaniklilik: 0,
    liderlik: 0,
    kurnazlik: 0,
  });
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const harcanan = STAT_KEYS.reduce((s, k) => s + dagitim[k], 0);
  const kalan = lord.statPoints - harcanan;

  async function onayla() {
    setHata(null);
    setBekliyor(true);
    try {
      await api.spendStats(dagitim);
      setDagitim({ guc: 0, dayaniklilik: 0, liderlik: 0, kurnazlik: 0 });
      onGuncelle();
    } catch (e) {
      setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.');
    } finally {
      setBekliyor(false);
    }
  }

  const kusanilan = new Map(lord.equippedItems?.map((i) => [i.slot, i]) ?? []);

  return (
    <div className="space-y-4">
      {/* Ekranın tepesi artık bir sahne: lordun ordusu. Nitelik kartlarıyla
          açılmak, bu ekranı bir karakter sayfası değil bir form yapıyordu. */}
      <OrduSahnesi
        army={lord.homeArmy}
        komutaTavani={lord.commandCapacity}
        kusanilan={lord.equippedItems}
      />

      <Bolum
        baslik="Nitelikler"
        yan={
          lord.statPoints > 0 ? (
            <Rozet renk="var(--color-yesil)">{kalan} PUAN</Rozet>
          ) : undefined
        }
      >
        <div className="space-y-2">
          {STAT_KEYS.map((k) => {
            const Ikon = STAT_IKONU[k];
            const bilgi = STAT[k];
            const mevcut = lord.stats[k];
            const eklenen = dagitim[k];
            return (
              <Kart key={k} className="p-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${bilgi.renk} 20%, transparent)`,
                      color: bilgi.renk,
                    }}
                  >
                    <Ikon boyut={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="baslik text-[13px]">{bilgi.ad}</span>
                      <span className="tabular text-lg leading-none font-bold">
                        {mevcut}
                        {eklenen > 0 && <span className="text-yesil"> +{eklenen}</span>}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-solgun">{bilgi.etki(mevcut + eklenen)}</p>
                  </div>
                  {lord.statPoints > 0 && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => setDagitim((d) => ({ ...d, [k]: Math.max(0, d[k] - 1) }))}
                        disabled={eklenen === 0}
                        className="bas baslik h-9 w-9 rounded-lg border border-kenar text-solgun disabled:opacity-30"
                      >
                        −
                      </button>
                      <button
                        onClick={() => setDagitim((d) => ({ ...d, [k]: d[k] + 1 }))}
                        disabled={kalan <= 0}
                        className="bas baslik h-9 w-9 rounded-lg bg-yesil-koyu text-white disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </Kart>
            );
          })}
        </div>

        {hata && <p className="mt-2 text-[13px] text-kirmizi">{hata}</p>}

        {harcanan > 0 && (
          <div className="mt-3 flex gap-2">
            <Buton onClick={onayla} disabled={bekliyor} tam boy="buyuk">
              {bekliyor ? 'Kaydediliyor...' : `${harcanan} puanı dağıt`}
            </Buton>
            <Buton
              tur="anahat"
              boy="buyuk"
              onClick={() => setDagitim({ guc: 0, dayaniklilik: 0, liderlik: 0, kurnazlik: 0 })}
            >
              Sıfırla
            </Buton>
          </div>
        )}
        <p className="mt-2 px-1 text-[11px] text-sonuk">
          Puan dağıtımı kalıcıdır. Liderlik ordunun büyüklüğünü ve general slotunu belirler.
        </p>
      </Bolum>

      <Bolum baslik="Kuşanılan Ekipman">
        <div className="grid grid-cols-3 gap-2">
          {EQUIP_SLOTS.map((slot) => {
            const it = kusanilan.get(slot);
            if (!it) {
              return (
                <Kart
                  key={slot}
                  className="flex aspect-square flex-col items-center justify-center p-2"
                >
                  <span className="baslik text-[10px] text-sonuk">{SLOT_ADI[slot]}</span>
                  <span className="mt-1 text-[10px] text-sonuk/70">boş</span>
                </Kart>
              );
            }
            const renk = nadirlikRengi(it.rarity);
            return (
              // Dolu yuva bir VİTRİN: kuşandığın şey görünüyor, adı ve tier'ı
              // altındaki şeritte duruyor. Oyuncunun ilk oturumdaki
              // şikâyetlerinden biri buydu — "gücümü en yüksek olanı kuşan
              // dedim, gücüm arttı, eee ne oldu şimdi". Sayı arttığını
              // görmek, bir şey kuşandığını görmekle aynı şey değil.
              <Kart key={slot} className="relative aspect-square p-0" vurgu={renk}>
                <Gorsel
                  tur="ekipman"
                  ad={`${slot}_t${it.tier}`}
                  alt={`${SLOT_ADI[slot]} T${it.tier}`}
                  boyut={128}
                  className="h-full w-full"
                  yedek={
                    <span className="baslik flex h-full w-full items-center justify-center text-[20px]" style={{ color: renk }}>
                      T{it.tier}
                    </span>
                  }
                />
                {/* Şerit görselin üstüne biner; kare zaten küçük, altına
                    ayrı bir satır koymak illüstrasyona kalan yeri yarıya
                    indiriyordu. */}
                <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-1 bg-gradient-to-t from-gece via-gece/85 to-transparent px-1.5 pt-3 pb-1">
                  <span className="baslik truncate text-[9px] text-solgun">{SLOT_ADI[slot]}</span>
                  <span className="baslik shrink-0 text-[12px] text-altin">
                    T{it.tier}
                    {it.upgradeLevel > 0 && `+${it.upgradeLevel}`}
                  </span>
                </div>
              </Kart>
            );
          })}
        </div>
      </Bolum>

      <Bolum baslik="Savaş Gücü">
        <Kart className="divide-y divide-kenar/70 p-0">
          {[
            ['Ekipman gücü', formatSayi(lord.equipmentPower)],
            ['Lord savaş katkısı', formatSayi(lord.lordContribution)],
            [
              'Ordu donanımı',
              `Sld +%${Math.round(lord.gearBonus.saldiri * 100)} · Sav +%${Math.round(
                lord.gearBonus.savunma * 100,
              )} · Can +%${Math.round(lord.gearBonus.can * 100)}`,
            ],
            ['ELO', `${lord.elo} · ${lord.pvpWins}G ${lord.pvpLosses}M`],
          ].map(([ad, deger]) => (
            <div key={ad} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-[13px] text-solgun">{ad}</span>
              <span className="tabular text-[13px] font-bold">{deger}</span>
            </div>
          ))}
        </Kart>
      </Bolum>
    </div>
  );
}
