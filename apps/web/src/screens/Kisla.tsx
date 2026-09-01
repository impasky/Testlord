/**
 * Kışla — birim eğitimi, komuta kapasitesi, ordu dağılımı.
 *
 * Ekranın tasarım kuralı: oyuncu bastığı her düğmenin sonucunu BU ekranda
 * görmeli. Eğitim başlattığında kuyruk düğmenin hemen altında beliriyor,
 * eğitim yapılamıyorsa düğme kapalı ve sebebi yazılı. Önceden ikisi de
 * yoktu: oyuncu düğmeye basıyor, bütün kartlar bir an sönüyor ve askerin
 * eğitime girip girmediğini anlamak için Malikâne'ye gitmesi gerekiyordu.
 */
import { B, unitName, type UnitType } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type LordState, type QueueItem, type UnitDto } from '../api/client';
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
  GeriSayim,
  IkonluDeger,
  Ilerleme,
  Input,
  Kart,
  formatKalan,
  formatSayi,
} from '../components/ui';

/** Aynı anda kaç eğitim kuyruğu açılabilir. Sunucu da bu sayıyı kullanıyor. */
const EGITIM_LIMITI = B.kuyruklar.es_zamanli.train;

const ROL: Record<string, string> = {
  milis: 'Ucuz et kalkanı. Kayıpları önce o üstlenir.',
  mizrakci: 'Savunmanın omurgası. Süvariye karşı ×1,5.',
  okcu: 'Ucuz hasar. Mızrakçıya karşı ×1,5.',
  suvari: 'Vurucu güç ve hız. Okçuya karşı ×1,5.',
  kusatma: 'Kale kırıcı. Tahkimata ×2, birime karşı ×0,5.',
};

const ADETLER = [1, 10, 50, 100];

type Engel = { kisa: string; uzun: string };

/**
 * Eğitimin neden yapılamadığını söyler; yapılabiliyorsa null döner.
 *
 * Kontrol sırası sunucudakiyle aynı (routes/army.ts): önce kuyruk, sonra
 * komuta yeri, sonra kaynak. Sıra farklı olsaydı arayüz bir sebep gösterip
 * sunucu başka bir sebeple reddedebilir, oyuncu da neyi düzelteceğini
 * bilemezdi.
 */
function egitimEngeli(g: {
  kuyrukSayisi: number;
  gerekenYer: number;
  bosYer: number;
  maliyet: { altin: number; demir: number; erzak: number };
  kaynaklar: { altin: number; demir: number; erzak: number };
}): Engel | null {
  if (g.kuyrukSayisi >= EGITIM_LIMITI) {
    return {
      kisa: 'Eğitim kuyruğu dolu',
      uzun: `Aynı anda en fazla ${EGITIM_LIMITI} eğitim yapabilirsin. Biri bitmeden yenisi başlamaz.`,
    };
  }

  if (g.gerekenYer > g.bosYer) {
    return {
      kisa: 'Komuta yerin yetmiyor',
      uzun: `Boş yer ${formatSayi(g.bosYer)}, gereken ${formatSayi(g.gerekenYer)}. Liderlik statını artır ya da daha az birim eğit.`,
    };
  }

  const eksik = (['altin', 'demir', 'erzak'] as const)
    .map((k) => ({ k, fark: g.maliyet[k] - g.kaynaklar[k] }))
    .filter((x) => x.fark > 0);

  if (eksik.length > 0) {
    const ad = { altin: 'altın', demir: 'demir', erzak: 'erzak' };
    return {
      kisa: eksik.length === 1 ? `${ad[eksik[0]!.k]} yetmiyor` : 'Kaynağın yetmiyor',
      uzun: eksik.map((x) => `${formatSayi(x.fark)} ${ad[x.k]}`).join(', ') + ' eksik.',
    };
  }

  return null;
}

/** Bu birimin eğitim kuyruğu: kaç asker, ne zaman biter. */
function KuyrukSeridi({ kuyruklar }: { kuyruklar: QueueItem[] }) {
  const toplam = kuyruklar.reduce(
    (t, q) => t + (typeof q.payload.count === 'number' ? q.payload.count : 0),
    0,
  );
  // En erken biten öne çıkar: oyuncunun beklediği ilk sonuç o.
  const ilk = [...kuyruklar].sort(
    (a, b) => new Date(a.finishAt).getTime() - new Date(b.finishAt).getTime(),
  )[0]!;
  const bas = new Date(ilk.startedAt).getTime();
  const bit = new Date(ilk.finishAt).getTime();
  const gecen = bit > bas ? Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas))) : 1;

  return (
    <div className="mt-2 rounded-xl border border-altin/35 bg-altin/10 p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
        <span className="baslik text-altin">
          Eğitimde {formatSayi(toplam)}
          {kuyruklar.length > 1 && (
            <span className="ml-1 font-normal text-solgun">({kuyruklar.length} parti)</span>
          )}
        </span>
        <span className="text-altin">
          <GeriSayim bitis={ilk.finishAt} />
        </span>
      </div>
      <Ilerleme deger={gecen} max={1} renk="var(--color-altin)" boy="ince" />
    </div>
  );
}

function BirimKarti({
  u,
  evdeki,
  kaynaklar,
  bosYer,
  kuyrukSayisi,
  kuyruklar,
  onEgit,
  bekliyor,
}: {
  u: UnitDto;
  evdeki: number;
  kaynaklar: { altin: number; demir: number; erzak: number };
  bosYer: number;
  kuyrukSayisi: number;
  kuyruklar: QueueItem[];
  onEgit: (adet: number) => void;
  bekliyor: boolean;
}) {
  const [adet, setAdet] = useState(10);
  const tip = u.type as UnitType;

  const maliyet = {
    altin: u.maliyet.altin * adet,
    demir: u.maliyet.demir * adet,
    erzak: u.maliyet.erzak * adet,
  };
  const engel = egitimEngeli({
    kuyrukSayisi,
    gerekenYer: u.yer * adet,
    bosYer,
    maliyet,
    kaynaklar,
  });

  /** Yetmeyen kaynağı kırmızı gösterir: sebebi okumadan da göze çarpsın. */
  const kaynakRengi = (k: 'altin' | 'demir' | 'erzak', varsayilan: string) =>
    maliyet[k] > kaynaklar[k] ? 'text-kirmizi' : varsayilan;

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
            deger={formatSayi(maliyet.altin)}
            baslik="Altın"
            renk={kaynakRengi('altin', 'text-kaynak-altin/80')}
          />
          {u.maliyet.demir > 0 && (
            <IkonluDeger
              ikon={<IkonDemir boyut={13} />}
              deger={formatSayi(maliyet.demir)}
              baslik="Demir"
              renk={kaynakRengi('demir', 'text-kaynak-demir/80')}
            />
          )}
          {u.maliyet.erzak > 0 && (
            <IkonluDeger
              ikon={<IkonErzak boyut={13} />}
              deger={formatSayi(maliyet.erzak)}
              baslik="Erzak"
              renk={kaynakRengi('erzak', 'text-kaynak-erzak/80')}
            />
          )}
          <IkonluDeger
            ikon={<IkonSure boyut={13} />}
            deger={formatKalan(u.egitim_sn * adet * 1000)}
            baslik="Eğitim süresi"
          />
        </div>

        <Buton onClick={() => onEgit(adet)} disabled={bekliyor || engel !== null} tam>
          {bekliyor ? 'Gönderiliyor…' : `${adet} ${unitName(tip)} eğit`}
        </Buton>

        {engel && (
          <p className="mt-1.5 flex gap-1.5 text-[11px] leading-snug text-kirmizi">
            <span className="shrink-0">
              <IkonUyari boyut={13} />
            </span>
            <span>
              <strong className="font-bold">{engel.kisa}.</strong>{' '}
              <span className="text-solgun">{engel.uzun}</span>
            </span>
          </p>
        )}

        {kuyruklar.length > 0 && <KuyrukSeridi kuyruklar={kuyruklar} />}
      </div>
    </Kart>
  );
}

export function Kisla({
  lord,
  queues,
  onGuncelle,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGuncelle: () => void;
}) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  // Hangi birim gönderiliyor: tek bir "bekliyor" bayrağı beş kartın da
  // düğmesini birden söndürüyordu; oyuncu neyin olduğunu anlamıyordu.
  const [gonderilen, setGonderilen] = useState<string | null>(null);
  const army = useQuery({ queryKey: ['army'], queryFn: api.army });

  const mut = useMutation({
    mutationFn: async ({ f }: { f: () => Promise<unknown>; tip: string }) => f(),
    onMutate: ({ tip }) => setGonderilen(tip),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['army'] });
      onGuncelle();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
    onSettled: () => setGonderilen(null),
  });

  if (army.isLoading || !army.data) {
    return <p className="pt-6 text-center text-solgun">Kışla açılıyor...</p>;
  }
  const a = army.data;
  const doluluk = a.commandCapacity > 0 ? a.usedSlots / a.commandCapacity : 0;
  const garnizon = a.byLocation.filter((u) => u.locationType === 'region');
  const yuruyus = a.byLocation.filter((u) => u.locationType === 'march');

  const egitimKuyruklari = queues.filter((q) => q.kind === 'train');

  /** Kuyruktakiler de komuta yeri tutar — sunucu da böyle hesaplıyor. */
  const kuyruktakiYer = egitimKuyruklari.reduce((t, q) => {
    const birim = a.units.find((u) => u.type === q.payload.unitType);
    const adet = typeof q.payload.count === 'number' ? q.payload.count : 0;
    return t + (birim ? birim.yer * adet : 0);
  }, 0);
  const bosYer = Math.max(0, a.commandCapacity - a.usedSlots - kuyruktakiYer);

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

      <Bolum
        baslik="Asker Eğitimi"
        yan={
          <span
            className={`tabular text-[11px] ${
              egitimKuyruklari.length >= EGITIM_LIMITI ? 'text-kirmizi' : 'text-solgun'
            }`}
          >
            Kuyruk {egitimKuyruklari.length}/{EGITIM_LIMITI}
          </span>
        }
      >
        <div className="space-y-2.5">
          {a.units.map((u) => (
            <BirimKarti
              key={u.type}
              u={u}
              evdeki={a.home[u.type as UnitType] ?? 0}
              kaynaklar={lord.resources}
              bosYer={bosYer}
              kuyrukSayisi={egitimKuyruklari.length}
              kuyruklar={egitimKuyruklari.filter((q) => q.payload.unitType === u.type)}
              bekliyor={gonderilen === u.type}
              onEgit={(adet) =>
                mut.mutate({ tip: u.type, f: () => api.train(u.type, adet) })
              }
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
