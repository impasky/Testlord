/** Kışla — birim eğitimi, komuta kapasitesi, ordu dağılımı. */
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
  Bolum,
  Buton,
  DegerKarti,
  IkonluDeger,
  Ilerleme,
  Input,
  Kart,
  formatKalan,
  formatSayi,
} from '../components/ui';

const ROL: Record<string, string> = {
  milis: 'Ucuz et kalkanı. Kayıpları önce o üstlenir.',
  mizrakci: 'Savunmanın omurgası. Süvariye karşı ×1,5.',
  okcu: 'Ucuz hasar. Mızrakçıya karşı ×1,5.',
  suvari: 'Vurucu güç ve hız. Okçuya karşı ×1,5.',
  kusatma: 'Kale kırıcı. Tahkimata ×2, birime karşı ×0,5.',
};

const ADETLER = [1, 10, 50, 100];

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
    <Kart className="p-3">
      <div className="flex gap-3">
        <div className="oyuk flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-kenar text-altin">
          <Gorsel
            tur="birimler"
            ad={u.type}
            alt={unitName(tip)}
            boyut={64}
            className="h-full w-full"
            yedek={<BirimIkonu tip={u.type} boyut={38} />}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="baslik truncate text-[14px]">{unitName(tip)}</h3>
            <span className="shrink-0 text-[11px] text-solgun">
              Evde <span className="tabular font-bold text-parsomen">{formatSayi(evdeki)}</span>
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-solgun">{ROL[u.type]}</p>

          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px]">
            <IkonluDeger ikon={<IkonSaldiri boyut={14} />} deger={u.saldiri} baslik="Saldırı" />
            <IkonluDeger ikon={<IkonSavunma boyut={14} />} deger={u.savunma} baslik="Savunma" />
            <IkonluDeger ikon={<IkonCan boyut={14} />} deger={u.can} baslik="Can" />
            <IkonluDeger ikon={<IkonHiz boyut={14} />} deger={u.hiz} baslik="Hız" />
            <IkonluDeger ikon={<IkonYer boyut={14} />} deger={u.yer} baslik="Komuta yeri" />
            <IkonluDeger
              ikon={<IkonErzak boyut={14} />}
              deger={`${u.bakim_erzak_saat}/sa`}
              baslik="Bakım"
              renk="text-kaynak-erzak/80"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-kenar/70 pt-3">
        <div className="mb-2 flex gap-1.5">
          {ADETLER.map((a) => (
            <button
              key={a}
              onClick={() => setAdet(a)}
              className={`bas baslik flex-1 rounded-lg border py-1.5 text-[11px] ${
                adet === a ? 'border-altin/60 bg-altin/15 text-altin' : 'border-kenar text-solgun'
              }`}
            >
              {a}
            </button>
          ))}
          <Input
            type="number"
            min={1}
            max={5000}
            value={adet}
            onChange={(e) => setAdet(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 py-1.5 text-center text-[12px]"
            aria-label={`${unitName(tip)} adedi`}
            inputMode="numeric"
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-solgun">
          <IkonluDeger
            ikon={<IkonAltin boyut={13} />}
            deger={formatSayi(u.maliyet.altin * adet)}
            baslik="Altın"
            renk="text-kaynak-altin/80"
          />
          {u.maliyet.demir > 0 && (
            <IkonluDeger
              ikon={<IkonDemir boyut={13} />}
              deger={formatSayi(u.maliyet.demir * adet)}
              baslik="Demir"
              renk="text-kaynak-demir/80"
            />
          )}
          {u.maliyet.erzak > 0 && (
            <IkonluDeger
              ikon={<IkonErzak boyut={13} />}
              deger={formatSayi(u.maliyet.erzak * adet)}
              baslik="Erzak"
              renk="text-kaynak-erzak/80"
            />
          )}
          <IkonluDeger
            ikon={<IkonSure boyut={13} />}
            deger={formatKalan(u.egitim_sn * adet * 1000)}
            baslik="Eğitim süresi"
          />
        </div>

        <Buton onClick={() => onEgit(adet)} disabled={bekliyor} tam>
          {adet} {unitName(tip)} eğit
        </Buton>
      </div>
    </Kart>
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
    return <p className="pt-6 text-center text-solgun">Kışla açılıyor...</p>;
  }
  const a = army.data;
  const doluluk = a.commandCapacity > 0 ? a.usedSlots / a.commandCapacity : 0;
  const garnizon = a.byLocation.filter((u) => u.locationType === 'region');
  const yuruyus = a.byLocation.filter((u) => u.locationType === 'march');

  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-2 gap-2.5">
        <DegerKarti
          ikon={<IkonYer boyut={20} />}
          etiket="Komuta"
          deger={
            <>
              {formatSayi(a.usedSlots)}
              <span className="text-sm text-solgun">/{formatSayi(a.commandCapacity)}</span>
            </>
          }
          renk={doluluk >= 1 ? 'var(--color-kirmizi)' : 'var(--color-mavi)'}
          alt={
            <Ilerleme
              deger={a.usedSlots}
              max={a.commandCapacity}
              renk={doluluk >= 1 ? 'var(--color-kirmizi)' : 'var(--color-mavi)'}
              boy="ince"
            />
          }
        />
        <DegerKarti
          ikon={<IkonErzak boyut={20} />}
          etiket="Net erzak"
          deger={
            <span className={a.netErzakPerHour < 0 ? 'text-kirmizi' : 'text-kaynak-erzak'}>
              {a.netErzakPerHour >= 0 ? '+' : ''}
              {formatSayi(a.netErzakPerHour)}
            </span>
          }
          renk={a.netErzakPerHour < 0 ? 'var(--color-kirmizi)' : 'var(--color-kaynak-erzak)'}
          alt={
            <div className="tabular text-[10px] text-sonuk">
              bakım −{formatSayi(a.upkeepPerHour)}/sa
            </div>
          }
        />
      </div>

      {a.netErzakPerHour < 0 && (
        <Kart className="border-kirmizi/50 p-3" vurgu="var(--color-kirmizi)">
          <div className="flex gap-2.5 text-[12px]">
            <span className="shrink-0 text-kirmizi">
              <IkonUyari boyut={18} />
            </span>
            <p className="text-solgun">
              Erzağın eksiliyor. Bittiğinde ordu saatte %5 firar eder. Tarla bölgesi al ya da
              ordunu küçült.
            </p>
          </div>
        </Kart>
      )}

      {hata && (
        <Kart className="border-kirmizi/50 p-3">
          <p className="text-[13px] text-kirmizi">{hata}</p>
        </Kart>
      )}

      <Bolum baslik="Asker Eğitimi">
        <div className="space-y-2.5">
          {a.units.map((u) => (
            <BirimKarti
              key={u.type}
              u={u}
              evdeki={a.home[u.type as UnitType] ?? 0}
              bekliyor={mut.isPending}
              onEgit={(adet) => mut.mutate(() => api.train(u.type, adet))}
            />
          ))}
        </div>
      </Bolum>

      {(garnizon.length > 0 || yuruyus.length > 0) && (
        <Bolum baslik="Ordunun Dağılımı">
          <Kart className="p-3">
            {[
              { ad: 'Garnizonlarda', satirlar: garnizon },
              { ad: 'Yürüyüşte', satirlar: yuruyus },
            ]
              .filter((g) => g.satirlar.length > 0)
              .map((g) => (
                <div key={g.ad} className="mb-3 last:mb-0">
                  <h3 className="baslik mb-1.5 text-[10px] text-solgun">{g.ad}</h3>
                  <ul className="space-y-1">
                    {g.satirlar.map((u, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13px]">
                        <span className="text-altin/70">
                          <BirimIkonu tip={u.unitType} boyut={18} />
                        </span>
                        <span className="flex-1 truncate">{unitName(u.unitType as UnitType)}</span>
                        <span className="tabular font-bold">{formatSayi(u.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            <p className="mt-2 border-t border-kenar/70 pt-2 text-[11px] text-sonuk">
              Bir bölgeyi sadece oraya bıraktığın garnizon savunur.
            </p>
          </Kart>
        </Bolum>
      )}
    </div>
  );
}
