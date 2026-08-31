/** Ekran 4: Kışla — birim eğitimi, ordu dağılımı, komuta kapasitesi. */
import { unitName, type UnitType } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type UnitDto } from '../api/client';
import { Gorsel } from '../components/Gorsel';
import {
  BirimIkonu,
  IkonAltin,
  IkonCan,
  IkonDemir,
  IkonErzak,
  IkonHiz,
  IkonSaldiri,
  IkonSavunma,
  IkonSure,
  IkonUyari,
  IkonYer,
} from '../components/Ikonlar';
import {
  Button,
  IkonluDeger,
  Input,
  Meter,
  Panel,
  formatKalan,
  formatSayi,
} from '../components/ui';

/** Birimin oyundaki rolünü tek cümlede anlatır — sayılar rolü söylemiyor. */
const ROL: Record<string, string> = {
  milis: 'Ucuz et kalkanı. Kayıpları önce o üstlenir.',
  mizrakci: 'Savunmanın omurgası. Süvariye karşı ×1,5.',
  okcu: 'Ucuz hasar. Mızrakçıya karşı ×1,5.',
  suvari: 'Vurucu güç ve hız. Okçuya karşı ×1,5.',
  kusatma: 'Kale kırıcı. Tahkimata ×2, birime karşı ×0,5.',
};

function BirimKarti({
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
  const tip = u.type as UnitType;

  return (
    <li className="kart-kalk rounded-lg border border-kenar/70 bg-yuzey/40 p-3">
      <div className="flex gap-3">
        <div className="madalyon flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-altin/80">
          {/* İllüstrasyon varsa o, yoksa siluet. Bkz. docs/GORSEL-REHBERI.md */}
          <Gorsel
            tur="birimler"
            ad={u.type}
            alt={unitName(tip)}
            boyut={56}
            className="h-full w-full"
            yedek={<BirimIkonu tip={u.type} boyut={34} />}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="baslik text-base font-semibold text-parsomen">{unitName(tip)}</h3>
            <span className="text-xs text-solgun">
              Evde <span className="tabular text-parsomen">{formatSayi(evdeki)}</span>
            </span>
          </div>
          <p className="mt-0.5 text-xs text-solgun">{ROL[u.type]}</p>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <IkonluDeger ikon={<IkonSaldiri boyut={16} />} deger={u.saldiri} baslik="Saldırı" />
            <IkonluDeger ikon={<IkonSavunma boyut={16} />} deger={u.savunma} baslik="Savunma" />
            <IkonluDeger ikon={<IkonCan boyut={16} />} deger={u.can} baslik="Can" />
            <IkonluDeger ikon={<IkonHiz boyut={16} />} deger={u.hiz} baslik="Hız" />
            <IkonluDeger ikon={<IkonYer boyut={16} />} deger={u.yer} baslik="Komuta yeri" />
            <IkonluDeger
              ikon={<IkonErzak boyut={16} />}
              deger={`${u.bakim_erzak_saat}/sa`}
              baslik="Bakım"
              renk="text-erzak/80"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-kenar/50 pt-3">
        <Input
          type="number"
          min={1}
          max={5000}
          value={adet}
          onChange={(e) => setAdet(Math.max(1, Number(e.target.value) || 1))}
          className="w-20"
          aria-label={`${unitName(tip)} adedi`}
        />
        <Button onClick={() => onEgit(adet)} disabled={bekliyor}>
          Eğit
        </Button>

        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-solgun">
          <IkonluDeger
            ikon={<IkonAltin boyut={15} />}
            deger={formatSayi(u.maliyet.altin * adet)}
            baslik="Altın"
            renk="text-altin/75"
          />
          {u.maliyet.demir > 0 && (
            <IkonluDeger
              ikon={<IkonDemir boyut={15} />}
              deger={formatSayi(u.maliyet.demir * adet)}
              baslik="Demir"
              renk="text-demir/75"
            />
          )}
          {u.maliyet.erzak > 0 && (
            <IkonluDeger
              ikon={<IkonErzak boyut={15} />}
              deger={formatSayi(u.maliyet.erzak * adet)}
              baslik="Erzak"
              renk="text-erzak/75"
            />
          )}
          <IkonluDeger
            ikon={<IkonSure boyut={15} />}
            deger={formatKalan(u.egitim_sn * adet * 1000)}
            baslik="Eğitim süresi"
          />
        </span>
      </div>
    </li>
  );
}

function DagilimListesi({
  baslik,
  satirlar,
}: {
  baslik: string;
  satirlar: { unitType: string; count: number }[];
}) {
  if (satirlar.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs tracking-wider text-solgun uppercase">{baslik}</h3>
      <ul className="space-y-1">
        {satirlar.map((u, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="text-altin/60">
              <BirimIkonu tip={u.unitType} boyut={18} />
            </span>
            <span className="flex-1 truncate">{unitName(u.unitType as UnitType)}</span>
            <span className="tabular text-parsomen">{formatSayi(u.count)}</span>
          </li>
        ))}
      </ul>
    </div>
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

  if (army.isLoading || !army.data) {
    return <p className="text-solgun">Kışla açılıyor...</p>;
  }
  const a = army.data;

  const doluluk = a.commandCapacity > 0 ? a.usedSlots / a.commandCapacity : 0;
  const garnizonlar = a.byLocation.filter((u) => u.locationType === 'region');
  const yuruyustekiler = a.byLocation.filter((u) => u.locationType === 'march');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Asker Eğitimi">
          {hata && (
            <p className="mb-3 flex items-start gap-2 rounded border border-kan/50 bg-kan/10 px-3 py-2 text-sm">
              <span className="mt-0.5 shrink-0 text-kan">
                <IkonUyari boyut={16} />
              </span>
              <span>{hata}</span>
            </p>
          )}
          <ul className="space-y-2.5">
            {a.units.map((u) => (
              <BirimKarti
                key={u.type}
                u={u}
                evdeki={a.home[u.type as UnitType] ?? 0}
                bekliyor={mut.isPending}
                onEgit={(adet) => mut.mutate(() => api.train(u.type, adet))}
              />
            ))}
          </ul>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Komuta Kapasitesi">
          <div className="mb-2 flex items-end justify-between gap-2">
            <span className="baslik tabular text-2xl text-parsomen">
              {formatSayi(a.usedSlots)}
              <span className="text-base text-solgun"> / {formatSayi(a.commandCapacity)}</span>
            </span>
            <span className="mb-0.5 text-xs text-solgun">yer</span>
          </div>
          <Meter
            value={a.usedSlots}
            max={a.commandCapacity}
            kalin
            tone={doluluk >= 1 ? 'kan' : doluluk > 0.85 ? 'erzak' : 'altin'}
          />
          <p className="mt-2 text-xs text-solgun">
            Ordunun büyüklüğü kaynakla değil <span className="text-parsomen/80">Liderlik</span>{' '}
            statıyla sınırlıdır. Kuyruktaki askerler de yer tutar.
          </p>
        </Panel>

        <Panel title="Erzak Dengesi">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-solgun">
                <span className="text-kan/70">
                  <IkonErzak boyut={15} />
                </span>
                Ordu bakımı
              </dt>
              <dd className="tabular text-kan">−{formatSayi(a.upkeepPerHour)}/sa</dd>
            </div>
            <div className="flex items-center justify-between border-t border-kenar/60 pt-2">
              <dt className="text-solgun">Net erzak</dt>
              <dd
                className={`baslik tabular text-lg ${
                  a.netErzakPerHour < 0 ? 'text-kan' : 'text-erzak'
                }`}
              >
                {a.netErzakPerHour >= 0 ? '+' : ''}
                {formatSayi(a.netErzakPerHour)}/sa
              </dd>
            </div>
          </dl>

          {a.netErzakPerHour < 0 && (
            <p className="mt-3 flex items-start gap-2 rounded border border-kan/50 bg-kan/10 px-2.5 py-2 text-xs">
              <span className="mt-0.5 shrink-0 text-kan">
                <IkonUyari boyut={16} />
              </span>
              <span>
                Erzağın eksiliyor. Bittiğinde ordu saatte %5 firar eder. Tarla bölgesi al ya da
                ordunu küçült.
              </span>
            </p>
          )}
        </Panel>

        {(garnizonlar.length > 0 || yuruyustekiler.length > 0) && (
          <Panel title="Ordunun Dağılımı">
            <div className="space-y-3">
              <DagilimListesi baslik="Garnizonlarda" satirlar={garnizonlar} />
              <DagilimListesi baslik="Yürüyüşte" satirlar={yuruyustekiler} />
            </div>
            <p className="mt-3 border-t border-kenar/60 pt-2 text-xs text-solgun">
              Bir bölgeyi sadece oraya bıraktığın garnizon savunur. Evdeki ordun bölgeni savunmaz.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
