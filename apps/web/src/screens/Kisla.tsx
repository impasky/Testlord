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
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { Gorsel } from '../components/Gorsel';
import { HedefSeridi } from '../components/HedefSeridi';
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
  EngelNotu,
  IkonluDeger,
  Input,
  Hap,
  Iskelet,
  Kart,
  KuyrukSeridi,
  formatKalan,
  formatSayi,
  kaynakEngeli,
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

// Dört değil üç kısayol: referansta sayı seçici hep iki-üç düğme.
// Serbest giriş kalıyor, çünkü omurga "28 Okçu" gibi tam sayılar söylüyor.
const ADETLER = [10, 50, 100];

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

  return kaynakEngeli(g.maliyet, g.kaynaklar);
}

function BirimKarti({
  u,
  evdeki,
  onerilenAdet,
  kaynaklar,
  bosYer,
  kuyrukSayisi,
  kuyruklar,
  onEgit,
  bekliyor,
}: {
  u: UnitDto;
  evdeki: number;
  /** Omurga bu birimden şu kadar istiyorsa adet hazır gelir; yoksa null. */
  onerilenAdet: number | null;
  kaynaklar: { altin: number; demir: number; erzak: number };
  bosYer: number;
  kuyrukSayisi: number;
  kuyruklar: QueueItem[];
  onEgit: (adet: number) => void;
  bekliyor: boolean;
}) {
  // Omurga "28 Okçu eğit" diyorsa oyuncu o sayıyı elle yazmak zorunda
  // kalmasın: iki ekran arasındaki bağı kopartan en küçük sürtünme bile
  // "ne yapıyordum" duygusu üretiyor.
  const [adet, setAdet] = useState(onerilenAdet ?? 10);
  const tip = u.type as UnitType;

  const kuyrukAdedi = kuyruklar.reduce(
    (t, q) => t + (typeof q.payload.count === 'number' ? q.payload.count : 0),
    0,
  );

  const [detay, setDetay] = useState(false);

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

  return (
    <Kart className="p-3" vurgu={onerilenAdet ? 'var(--color-altin)' : undefined}>
      {/*
        Kart başına görünen öğe sayısı bilerek düşük tutuldu.
        Önceden burada portre, ad, evdeki sayı, rol cümlesi, ALTI istatistik
        ikonu, beş adet düğmesi, üç maliyet ve bir buton vardı: beş birim
        kartı yan yana gelince ekran on sekiz öğelik beş bloğa dönüşüyordu
        ve oyuncu "karman çorman" diyordu.

        Şimdi varsayılan görünüm dört şey söylüyor — kim, kaç tane var,
        neye mal olur, hangi düğme. İstatistikler ve rol açıklaması
        "Detay"ın altına alındı: bilgi silinmedi, öne çıkarılmadı.
      */}
      <div className="flex items-start gap-3">
        <div className="oyuk flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-kenar text-altin">
          <Gorsel
            tur="birimler"
            ad={u.type}
            alt={unitName(tip)}
            boyut={72}
            className="h-full w-full"
            yedek={<BirimIkonu tip={u.type} boyut={42} />}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="baslik truncate text-[15px]">{unitName(tip)}</h3>
            <Hap className="shrink-0">
              Evde {formatSayi(evdeki)}
            </Hap>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Hap
              ikon={<IkonAltin boyut={13} />}
              renk={
                maliyet.altin > kaynaklar.altin
                  ? 'var(--color-kirmizi)'
                  : 'var(--color-kaynak-altin)'
              }
            >
              {formatSayi(maliyet.altin)}
            </Hap>
            {u.maliyet.demir > 0 && (
              <Hap
                ikon={<IkonDemir boyut={13} />}
                renk={
                  maliyet.demir > kaynaklar.demir
                    ? 'var(--color-kirmizi)'
                    : 'var(--color-kaynak-demir)'
                }
              >
                {formatSayi(maliyet.demir)}
              </Hap>
            )}
            {u.maliyet.erzak > 0 && (
              <Hap
                ikon={<IkonErzak boyut={13} />}
                renk={
                  maliyet.erzak > kaynaklar.erzak
                    ? 'var(--color-kirmizi)'
                    : 'var(--color-kaynak-erzak)'
                }
              >
                {formatSayi(maliyet.erzak)}
              </Hap>
            )}
            <Hap ikon={<IkonSure boyut={13} />}>{formatKalan(u.egitim_sn * adet * 1000)}</Hap>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex gap-1.5">
        {ADETLER.map((a) => (
          <button
            key={a}
            onClick={() => setAdet(a)}
            className={`bas baslik flex-1 rounded-xl border-2 py-2 text-[12px] ${
              adet === a ? 'border-altin/70 bg-altin/15 text-altin' : 'border-kenar text-solgun'
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
          className="w-16 rounded-xl border-2 py-2 text-center text-[12px]"
          aria-label={`${unitName(tip)} adedi`}
          inputMode="numeric"
        />
      </div>

      <Buton className="mt-2.5" onClick={() => onEgit(adet)} disabled={bekliyor || engel !== null} tam>
        {bekliyor ? 'Gönderiliyor…' : `${adet} ${unitName(tip)} eğit`}
      </Buton>

      {engel && <EngelNotu kisa={engel.kisa} uzun={engel.uzun} />}

      <KuyrukSeridi
        kuyruklar={kuyruklar}
        etiket={
          <>
            Eğitimde {formatSayi(kuyrukAdedi)}
            {kuyruklar.length > 1 && (
              <span className="ml-1 font-normal text-solgun">({kuyruklar.length} parti)</span>
            )}
          </>
        }
      />

      <button
        onClick={() => setDetay((d) => !d)}
        className="bas baslik mt-2 w-full text-[10px] text-sonuk"
        aria-expanded={detay}
      >
        {detay ? 'DETAYI GİZLE' : 'DETAY'}
      </button>

      {detay && (
        <div className="mt-1.5 border-t border-kenar/70 pt-2">
          <p className="text-[12px] leading-snug text-solgun">{ROL[u.type]}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
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
      )}
    </Kart>
  );
}

export function Kisla({
  lord,
  queues,
  onGuncelle,
  onHaritayaGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGuncelle: () => void;
  /** Önerilen hedefi haritada açar — "ne için asker eğitiyorum" sorusunun sonu. */
  onHaritayaGit?: (regionId: number) => void;
}) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  // Hangi birim gönderiliyor: tek bir "bekliyor" bayrağı beş kartın da
  // düğmesini birden söndürüyordu; oyuncu neyin olduğunu anlamıyordu.
  const [gonderilen, setGonderilen] = useState<string | null>(null);
  const army = useQuery({ queryKey: ['army'], queryFn: api.army });
  // Haritayla aynı sorgu anahtarı: veri paylaşılır, ikinci istek atılmaz.
  const harita = useQuery({ queryKey: ['map'], queryFn: api.map });

  const mut = useMutation({
    mutationFn: async ({ f }: { f: () => Promise<unknown>; tip: string }) => f(),
    onMutate: ({ tip }) => setGonderilen(tip),
    onSuccess: () => {
      setHata(null);
      hisOnay();
      void qc.invalidateQueries({ queryKey: ['army'] });
      onGuncelle();
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.');
    },
    onSettled: () => setGonderilen(null),
  });

  if (army.isLoading || !army.data) {
    return <Iskelet satir={5} />;
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

  const oneri = harita.data?.oneri ?? null;

  return (
    <div className="space-y-4 pt-3">
      {hata && (
        <Kart className="border-kirmizi/50 p-3">
          <p className="flex gap-2 text-[13px] text-kirmizi">
            <span className="shrink-0 pt-px">
              <IkonUyari boyut={16} />
            </span>
            {hata}
          </p>
        </Kart>
      )}

      {/* Asker eğitmenin sebebi ekranın en üstünde durur. Önceden beş kart
          beş düğmeyle yan yanaydı ve hiçbiri neden eğitim yapıldığını
          söylemiyordu. (docs/08 İ1) */}
      {oneri && (
        <HedefSeridi
          hedef={oneri}
          baslik="Ordunu ne için kuruyorsun"
          onAc={onHaritayaGit ? () => onHaritayaGit(oneri.regionId) : undefined}
        />
      )}

      {/* Malikâne'yle aynı dil: iki büyük kart yerine tek rozet satırı.
          Aynı bilgiyi bir satırda vermek, ekranın asıl işi olan birim
          kartlarına yer bırakıyor. */}
      <div className="flex flex-wrap gap-1.5">
        <Hap
          ikon={<IkonYer boyut={13} />}
          renk={doluluk >= 1 ? 'var(--color-kirmizi)' : 'var(--color-mavi)'}
        >
          {formatSayi(a.usedSlots)}/{formatSayi(a.commandCapacity)} komuta
        </Hap>
        <Hap
          ikon={<IkonErzak boyut={13} />}
          renk={a.netErzakPerHour < 0 ? 'var(--color-kirmizi)' : 'var(--color-kaynak-erzak)'}
        >
          {a.netErzakPerHour >= 0 ? '+' : ''}
          {formatSayi(a.netErzakPerHour)} erzak/sa
        </Hap>
      </div>

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
          {[...a.units]
            .sort((x, y) => {
              // Omurganın işaret ettiği birim en üstte: oyuncu listeyi
              // taramak zorunda kalmasın.
              const ox = oneri?.eksik?.birim === x.type ? -1 : 0;
              const oy = oneri?.eksik?.birim === y.type ? -1 : 0;
              return ox - oy;
            })
            .map((u) => (
            <BirimKarti
              key={u.type}
              u={u}
              evdeki={a.home[u.type as UnitType] ?? 0}
              onerilenAdet={oneri?.eksik?.birim === u.type ? oneri.eksik.adet : null}
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
