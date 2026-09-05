/**
 * Omurga — "şimdi ne yapmalısın".
 *
 * Oyunun ilk gerçek testinde oyuncu şunu yazdı: "karman çorman hissettiriyor,
 * sanki her şey iç içe gibi, bir şeyler yapıyorum ama ne yaptığımı
 * anlamıyorum."
 *
 * Sebebi yedi ekranın alt çubukta eşit seviyede durması. Oyunun bir döngüsü
 * var — kaynak → asker → saldırı → bölge → gelir → daha büyük ordu — ama bu
 * döngü tasarımda vardı, arayüzde hiçbir yerde yazmıyordu. Oyuncu döngüyü
 * kendi kurmak zorundaydı.
 *
 * Bu blok her an TEK bir birincil eylem gösterir ve o eylemi ekran adıyla
 * değil KARŞILIĞIYLA adlandırır: "Kışla" değil, "Demirkapı'yı almak için 15
 * okçu daha gerekiyor". Altındaki tek satır bir sonraki adımı söyler, böylece
 * döngü görünür olur. (docs/08 İ4)
 *
 * Durum saklamaz: adım tamamen oyun durumundan türetilir. Cihaz değiştiren ya
 * da tarayıcı verisini silen oyuncu ilerlemesini kaybetmez, sunucuya yeni bir
 * alan da gerekmez. Türetme adımın geri açılabilmesi anlamına da gelir:
 * ordusu kırılan lord yeniden "ordunu kur" adımını görür — kusur değil, o an
 * gerçekten yapması gereken şey odur.
 */
import { unitName, type UnitType } from '@lordlar/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  api,
  type HedefOnerisiDto,
  type LordState,
  type MarchDto,
  type QueueItem,
} from '../api/client';
import { eYonelme, iBelirtme } from './ekler';
import {
  BirimIkonu,
  IkonAltin,
  IkonDemir,
  IkonErzak,
  IkonSaldiri,
  IkonSohret,
  IkonSure,
  IkonYer,
} from './Ikonlar';
import type { Sekme } from './MobilKabuk';
import { Buton, GeriSayim, Hap, Kart, formatKalan, formatSayi } from './ui';

interface Adim {
  anahtar: string;
  baslik: string;
  /** Tek satır. Uzun açıklama yerine rozetler kullanılır. */
  cumle?: ReactNode;
  /** Sayılar cümlenin içinde değil, rozetlerde durur. */
  rozetler?: ReactNode[];
  dugme?: string;
  git?: () => void;
  /** Döngüyü görünür kılan tek satır. */
  sonraki?: string;
  /** Eylemin götürdüğü sekme; alt çubukta işaretlemek için. */
  hedefSekme?: Sekme;
}

/**
 * Omurganın gösterdiği adımı hesaplar.
 *
 * Hem kartın kendisi hem de alt çubuk aynı hesabı okuyor: alt çubuktaki
 * işaret, omurganın söylediği yere gitmeyi ekranın her yerinden mümkün
 * kılıyor. İki ayrı öncelik zinciri yazmak, ikisinin er ya da geç
 * ayrışması demekti.
 *
 * Sorgular TanStack önbelleğinden geliyor; iki çağrı ikinci bir istek
 * üretmiyor.
 */
export function useOmurgaAdimi(
  // Lord henüz yüklenmemiş olabilir: hook'lar erken dönüşten önce
  // çağrılmak zorunda, bu yüzden eksik durumu burada karşılanıyor.
  lord: LordState | undefined,
  queues: QueueItem[],
): Adim | null {
  const harita = useQuery({ queryKey: ['map'], queryFn: api.map, enabled: Boolean(lord) });
  const yuruyusler = useQuery({ queryKey: ['marches'], queryFn: api.marches, enabled: Boolean(lord) });
  const generaller = useQuery({ queryKey: ['generals'], queryFn: api.generals, enabled: Boolean(lord) });

  if (!lord) return null;
  return siradakiAdim({
    lord,
    oneri: harita.data?.oneri ?? null,
    egitimde: queues.filter((q) => q.kind === 'train'),
    uretimde: queues.filter((q) => q.kind === 'craft'),
    generalVar: (generaller.data?.kadro ?? []).some((x) => x.sahipMi),
    yarali: lord.woundedUntil ? new Date(lord.woundedUntil) > new Date() : false,
    yoldaki: yuruyusler.data ?? [],
    onGit: () => {},
    onHedefeGit: () => {},
  });
}

export function Omurga({
  lord,
  queues,
  onGit,
  onHedefeGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGit: (s: Sekme) => void;
  /** Bir bölgeyi doğrudan haritada açar. */
  onHedefeGit: (regionId: number) => void;
}) {
  const harita = useQuery({ queryKey: ['map'], queryFn: api.map });
  const yuruyusler = useQuery({ queryKey: ['marches'], queryFn: api.marches });
  // Generaller /me içinde dönmüyor; yalnızca gerekince çekiliyor.
  const generaller = useQuery({ queryKey: ['generals'], queryFn: api.generals });

  const oneri = harita.data?.oneri ?? null;
  const egitimde = queues.filter((q) => q.kind === 'train');
  const uretimde = queues.filter((q) => q.kind === 'craft');
  const generalVar = (generaller.data?.kadro ?? []).some((g) => g.sahipMi);
  const yarali = lord.woundedUntil ? new Date(lord.woundedUntil) > new Date() : false;

  const adim = siradakiAdim({
    lord,
    oneri,
    egitimde,
    uretimde,
    generalVar,
    yarali,
    yoldaki: yuruyusler.data ?? [],
    onGit,
    onHedefeGit,
  });
  if (!adim) return null;

  return (
    <Kart className="p-4" vurgu="var(--color-altin)">
      <h3 className="baslik mb-1.5 text-[11px] text-sonuk">Şimdi ne yapmalısın</h3>
      <p className="baslik text-[19px] leading-tight text-altin">{adim.baslik}</p>

      {/* Tek satır cümle + rozetler. Önceden burada dört satırlık düz yazı
          vardı; aynı bilgiyi rozetlerle vermek okuma yükünü düşürüyor ve
          referanstaki "sayı cümlenin içinde durmaz" kuralına uyuyor. */}
      {adim.cumle && (
        <p className="mt-1.5 text-[13px] leading-snug text-parsomen">{adim.cumle}</p>
      )}
      {adim.rozetler && adim.rozetler.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{adim.rozetler}</div>
      )}

      {adim.dugme && adim.git && (
        <Buton className="mt-3" boy="buyuk" tam onClick={adim.git}>
          {adim.dugme}
        </Buton>
      )}

      {adim.sonraki && (
        <p className="mt-2.5 text-[11px] leading-snug text-sonuk">sonra: {adim.sonraki}</p>
      )}
    </Kart>
  );
}

function siradakiAdim(g: {
  lord: LordState;
  oneri: HedefOnerisiDto | null;
  egitimde: QueueItem[];
  uretimde: QueueItem[];
  generalVar: boolean;
  yarali: boolean;
  yoldaki: MarchDto[];
  onGit: (s: Sekme) => void;
  onHedefeGit: (regionId: number) => void;
}): Adim | null {
  const { lord, oneri, egitimde, uretimde, generalVar, yarali, yoldaki } = g;

  // 1. Aç ordu her şeyin önünde: saatte %5 firar veriyor ve beklemek
  //    durumu kötüleştiriyor.
  if (lord.starving) {
    return {
      anahtar: 'aclik',
      baslik: 'Ordun aç',
      cumle: 'Erzak bitti, askerlerin kaçıyor. Bir tarla bölgesi al ya da ordunu küçült.',
      rozetler: [
        <Hap key="firar" ikon={<IkonErzak boyut={13} />} renk="var(--color-kirmizi)">
          saatte %5 firar
        </Hap>,
      ],
      dugme: 'Haritada tarla ara',
      git: () => g.onGit('harita'),
      hedefSekme: 'harita',
    };
  }

  // 2. Yaralı lord saldıramaz; bu bir eylem değil, bir bekleyiş.
  if (yarali) {
    return {
      anahtar: 'yarali',
      baslik: 'Lordun iyileşiyor',
      cumle: 'Bu sürede ordunu büyütebilir ya da ekipman üretebilirsin.',
      rozetler: [
        <Hap key="sure" ikon={<IkonSure boyut={13} />} renk="var(--color-turuncu)">
          <GeriSayim bitis={lord.woundedUntil!} />
        </Hap>,
      ],
      dugme: 'Kışlaya git',
      git: () => g.onGit('kisla'),
      hedefSekme: 'kisla',
      sonraki: 'iyileşince saldır',
    };
  }

  // 3. Eğitim sürüyorsa yapılacak şey beklemek — üstüne bir iş daha
  //    yığmak "her şey iç içe" duygusunu büyütür.
  if (egitimde.length > 0 && lord.usedSlots === 0) {
    const ilk = [...egitimde].sort(
      (a, b) => new Date(a.finishAt).getTime() - new Date(b.finishAt).getTime(),
    )[0]!;
    return {
      anahtar: 'egitim-bekle',
      baslik: 'Askerlerin eğitiliyor',
      cumle: oneri ? `Hazır olunca ${oneri.name} üzerine yürüyeceksin.` : undefined,
      rozetler: [
        <Hap key="sure" ikon={<IkonSure boyut={13} />} renk="var(--color-altin)">
          <GeriSayim bitis={ilk.finishAt} />
        </Hap>,
      ],
      sonraki: oneri ? `${eYonelme(oneri.name)} saldır` : undefined,
    };
  }

  // 4. Ordu yolda: yeni bir ordu kurmasını söylemek yanlış olurdu — ordusu
  //    var, sadece evde değil. Dönüş anı bu oyunda en önemli anlardan biri;
  //    oyuncuya ne zaman döneceğini söylemek beklemeyi bir plana çeviriyor.
  if (lord.usedSlots > 0 && yoldaki.length > 0 && (!oneri || !oneri.kazanir)) {
    const ilk = [...yoldaki].sort(
      (a, b) => new Date(a.arriveAt).getTime() - new Date(b.arriveAt).getTime(),
    )[0]!;
    const donus = ilk.kind === 'return';
    return {
      anahtar: 'ordu-yolda',
      baslik: donus ? 'Ordun dönüyor' : 'Ordun yolda',
      cumle: 'Bu sürede ekipman üretebilir ya da bölgeni yükseltebilirsin.',
      rozetler: [
        <Hap key="sure" ikon={<IkonSure boyut={13} />} renk="var(--color-altin)">
          <GeriSayim bitis={ilk.arriveAt} />
        </Hap>,
      ],
      dugme: 'Demirhaneye git',
      git: () => g.onGit('demirhane'),
      hedefSekme: 'demirhane',
      sonraki: oneri ? `${eYonelme(oneri.name)} saldır` : 'yeni bir hedef seç',
    };
  }

  // 5. Ordu yok ya da yetmiyor: oyunun somut cevabı var, onu söyle.
  if (oneri && !oneri.kazanir) {
    const eksik = oneri.eksik;
    if (!eksik) {
      return {
        anahtar: 'liderlik',
        baslik: 'Komuta kapasiten yetmiyor',
        cumle: `${oneri.name} kapasiten dolsa bile alınmıyor. Lord ekranından Liderlik yükselt.`,
        rozetler: [
          <Hap key="sav" ikon={<IkonYer boyut={13} />} renk="var(--color-turuncu)">
            {toplamBirim(oneri.garrison)} savunan
          </Hap>,
        ],
        dugme: 'Lord ekranı',
        git: () => g.onGit('lord'),
        hedefSekme: 'lord',
      };
    }
    return {
      anahtar: 'ordu-kur',
      baslik: oneri.orduVar ? 'Ordunu büyüt' : 'Ordunu kur',
      cumle: `${oneri.name} için ordun henüz yetmiyor.`,
      rozetler: [
        <Hap key="ordu" ikon={<BirimIkonu tip={eksik.birim} boyut={13} />} renk="var(--color-altin)">
          {eksik.adet} {unitName(eksik.birim as UnitType)}
        </Hap>,
        <Hap
          key="mal"
          ikon={<IkonAltin boyut={13} />}
          renk={
            eksik.karsilanabilir ? 'var(--color-kaynak-altin)' : 'var(--color-kirmizi)'
          }
        >
          {formatSayi(eksik.maliyet.altin)}
        </Hap>,
        ...gelirRozetleri(oneri),
      ],
      dugme: `Kışlada ${unitName(eksik.birim as UnitType)} eğit`,
      git: () => g.onGit('kisla'),
      hedefSekme: 'kisla',
      sonraki: `${eYonelme(oneri.name)} saldır`,
    };
  }

  // 6. Ordu hazır ve hedef alınabilir: oyunun asıl anı.
  if (oneri?.kazanir) {
    return {
      anahtar: 'saldir',
      baslik: `${oneri.name} üzerine yürü`,
      cumle: 'Ordun yetiyor. Bölge senin olunca kazanacakların:',
      rozetler: [
        ...gelirRozetleri(oneri),
        <Hap key="soh" ikon={<IkonSohret boyut={13} />} renk="var(--color-yesil)">
          +{formatSayi(oneri.sohretFarki)}
        </Hap>,
        <Hap key="sure" ikon={<IkonSure boyut={13} />}>
          {formatKalan(oneri.marchSec * 1000)}
        </Hap>,
      ],
      dugme: `${eYonelme(oneri.name)} saldır`,
      git: () => g.onHedefeGit(oneri.regionId),
      hedefSekme: 'harita',
      sonraki: lord.equippedItems.length === 0 ? 'Demirhanede ekipman üret' : 'bölgeni yükselt',
    };
  }

  // 7. Bölge var, ekipman yok: lordun savaş katkısı büyütülebilir.
  if (lord.equippedItems.length === 0 && uretimde.length === 0) {
    return {
      anahtar: 'ekipman',
      baslik: 'Lorduna ekipman kuşan',
      cumle: 'Ekipman lordun savaş katkısını büyütür; aynı savaştan daha az kayıpla çıkarsın.',
      rozetler: [
        <Hap key="katki" ikon={<IkonSaldiri boyut={13} />}>
          şu an {formatSayi(lord.lordContribution)} katkı
        </Hap>,
      ],
      dugme: 'Demirhaneye git',
      git: () => g.onGit('demirhane'),
      hedefSekme: 'demirhane',
      sonraki: generalVar ? 'bölgeni yükselt' : 'general kirala',
    };
  }

  // 8. General: ordunun tamamına çarpan etkisi.
  if (!generalVar) {
    return {
      anahtar: 'general',
      baslik: 'General kirala',
      cumle: 'General bütün ordunu birden güçlendirir — tek bir ekipmandan büyük fark yaratır.',
      dugme: 'Generallere git',
      git: () => g.onGit('generaller'),
      hedefSekme: 'generaller',
      sonraki: 'bölgeni yükselt',
    };
  }

  // 9. Döngü kurulmuş: oyuncu artık kendi hedefini seçiyor.
  if (oneri) {
    return {
      anahtar: 'devam',
      baslik: 'Diyarı büyüt',
      cumle: `Sıradaki hedefin ${oneri.name}.`,
      rozetler: [
        <Hap key="soh" ikon={<IkonSohret boyut={13} />}>
          {formatSayi(lord.fame)} şöhret
        </Hap>,
        ...gelirRozetleri(oneri),
      ],
      dugme: `${iBelirtme(oneri.name)} incele`,
      git: () => g.onHedefeGit(oneri.regionId),
      hedefSekme: 'harita',
      sonraki: 'Taht Kalesi — diyarın tek sahibi olabilirsin',
    };
  }

  return null;
}

/** Bölgenin saatlik gelirini rozetlere çevirir; sıfır olanlar atlanır. */
function gelirRozetleri(hedef: HedefOnerisiDto): ReactNode[] {
  const g = hedef.saatlikGelir;
  return (
    [
      { v: g.altin, ikon: <IkonAltin boyut={13} />, ad: 'altin' },
      { v: g.demir, ikon: <IkonDemir boyut={13} />, ad: 'demir' },
      { v: g.erzak, ikon: <IkonErzak boyut={13} />, ad: 'erzak' },
    ] as const
  )
    .filter((k) => k.v > 0)
    .map((k) => (
      <Hap key={k.ad} ikon={k.ikon} renk="var(--color-yesil)">
        +{formatSayi(k.v)}/sa
      </Hap>
    ));
}

function toplamBirim(a: Record<string, number | undefined>): number {
  return Object.values(a).reduce<number>((s, n) => s + (n ?? 0), 0);
}
