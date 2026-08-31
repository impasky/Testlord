/** Ekran 2: Lord — statlar, puan dağıtımı, ekipman slotları. */
import { EQUIP_SLOTS, STAT_KEYS, type StatKey } from '@lordlar/shared';
import { useState } from 'react';
import { ApiError, api, type LordState } from '../api/client';
import { Button, Panel, Sayi, formatSayi } from '../components/ui';

const STAT_BILGI: Record<StatKey, { ad: string; etki: (n: number) => string }> = {
  guc: { ad: 'Güç', etki: (n) => `Savaş katkısı +${n * 3}` },
  dayaniklilik: { ad: 'Dayanıklılık', etki: (n) => `Can +${n * 25}, yaralanma -%${Math.min(50, n)}` },
  liderlik: { ad: 'Liderlik', etki: (n) => `Komuta ${50 + n * 8} yer` },
  kurnazlik: { ad: 'Kurnazlık', etki: (n) => `Yağma +%${Math.min(100, n)}` },
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

  function degistir(k: StatKey, delta: number) {
    setDagitim((d) => {
      const yeni = Math.max(0, d[k] + delta);
      if (delta > 0 && kalan <= 0) return d;
      return { ...d, [k]: yeni };
    });
  }

  async function onayla() {
    setHata(null);
    setBekliyor(true);
    try {
      await api.spendStats(dagitim);
      setDagitim({ guc: 0, dayaniklilik: 0, liderlik: 0, kurnazlik: 0 });
      onGuncelle();
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : 'İşlem başarısız.');
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Statlar"
        action={
          lord.statPoints > 0 ? (
            <span className="rounded bg-altin/20 px-2 py-0.5 text-xs text-altin">
              {kalan} puan dağıtılmayı bekliyor
            </span>
          ) : undefined
        }
      >
        <ul className="space-y-3">
          {STAT_KEYS.map((k) => {
            const mevcut = lord.stats[k];
            const eklenen = dagitim[k];
            const bilgi = STAT_BILGI[k];
            return (
              <li key={k} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{bilgi.ad}</span>
                    <span className="tabular text-lg">
                      {mevcut}
                      {eklenen > 0 && <span className="text-altin"> +{eklenen}</span>}
                    </span>
                  </div>
                  <p className="text-xs text-solgun">{bilgi.etki(mevcut + eklenen)}</p>
                </div>
                {lord.statPoints > 0 && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" onClick={() => degistir(k, -1)} disabled={eklenen === 0}>
                      −
                    </Button>
                    <Button variant="ghost" onClick={() => degistir(k, 1)} disabled={kalan <= 0}>
                      +
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {hata && <p className="mt-3 text-sm text-kan">{hata}</p>}

        {harcanan > 0 && (
          <div className="mt-4 flex gap-2">
            <Button onClick={onayla} disabled={bekliyor}>
              {bekliyor ? 'Kaydediliyor...' : `${harcanan} puanı dağıt`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDagitim({ guc: 0, dayaniklilik: 0, liderlik: 0, kurnazlik: 0 })}
            >
              Sıfırla
            </Button>
          </div>
        )}

        <p className="mt-4 border-t border-kenar pt-3 text-xs text-solgun">
          Puan dağıtımı kalıcıdır. Liderlik ordunun büyüklüğünü ve general slotunu belirler;
          Güç ve ekipman lordun savaştaki payını.
        </p>
      </Panel>

      <div className="space-y-4">
        <Panel title="Ekipman">
          <div className="grid grid-cols-3 gap-2">
            {EQUIP_SLOTS.map((slot) => (
              <div
                key={slot}
                className="flex aspect-square flex-col items-center justify-center rounded border border-dashed border-kenar bg-gece/40 p-2 text-center"
              >
                <span className="text-xs text-solgun">{SLOT_ADI[slot]}</span>
                <span className="mt-1 text-xs text-solgun/60">boş</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-solgun">
            Ekipman Demirhane'de üretilir. (M3'te açılacak)
          </p>
        </Panel>

        <Panel title="Savaş Gücü">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-solgun">Ekipman gücü</dt>
              <dd>
                <Sayi>{formatSayi(lord.equipmentPower)}</Sayi>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-solgun">Lord savaş katkısı</dt>
              <dd>
                <Sayi>{formatSayi(lord.lordContribution)}</Sayi>
              </dd>
            </div>
            <div className="flex justify-between border-t border-kenar pt-2">
              <dt className="text-solgun">Ordu donanımı</dt>
              <dd className="text-xs">
                Saldırı +%{Math.round(lord.gearBonus.saldiri * 100)} · Savunma +%
                {Math.round(lord.gearBonus.savunma * 100)} · Can +%
                {Math.round(lord.gearBonus.can * 100)}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
