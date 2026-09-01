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
import { HedefGeliri } from './HedefSeridi';
import type { Sekme } from './MobilKabuk';
import { GeriSayim, Kart, formatKalan, formatSayi } from './ui';

interface Adim {
  anahtar: string;
  baslik: string;
  cumle: ReactNode;
  dugme?: string;
  git?: () => void;
  /** Döngüyü görünür kılan tek satır. */
  sonraki?: string;
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
    <Kart className="p-3.5" vurgu="var(--color-altin)">
      <h3 className="baslik mb-2 text-[11px] text-solgun">Şimdi ne yapmalısın</h3>
      <p className="baslik text-[16px] leading-tight text-altin">{adim.baslik}</p>
      <div className="mt-1.5 text-[13px] leading-snug text-parsomen">{adim.cumle}</div>

      {adim.dugme && adim.git && (
        <button
          type="button"
          onClick={adim.git}
          className="bas baslik mt-3 w-full rounded-2xl border border-altin-koyu bg-gradient-to-b from-altin to-altin-koyu px-5 py-3.5 text-[15px] text-gece shadow-[0_2px_0_rgba(0,0,0,0.35)]"
        >
          {adim.dugme}
        </button>
      )}

      {adim.sonraki && (
        <p className="mt-2 text-[11px] leading-snug text-sonuk">sonra: {adim.sonraki}</p>
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
      cumle: (
        <>
          Erzak bitti ve askerlerin saatte %5 firar ediyor. Bir <strong>tarla</strong> bölgesi al
          ya da ordunu küçült — beklemek durumu düzeltmiyor.
        </>
      ),
      dugme: 'Haritada tarla ara',
      git: () => g.onGit('harita'),
    };
  }

  // 2. Yaralı lord saldıramaz; bu bir eylem değil, bir bekleyiş.
  if (yarali) {
    return {
      anahtar: 'yarali',
      baslik: 'Lordun iyileşiyor',
      cumle: (
        <>
          <GeriSayim bitis={lord.woundedUntil!} /> sonra yeniden saldırabilirsin. Bu sürede ordunu
          büyütebilir ya da ekipman üretebilirsin.
        </>
      ),
      dugme: 'Kışlaya git',
      git: () => g.onGit('kisla'),
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
      cumle: (
        <>
          İlk birliğin <GeriSayim bitis={ilk.finishAt} /> sonra hazır olacak.
          {oneri && ` Hazır olunca ${oneri.name} üzerine yürüyeceksin.`}
        </>
      ),
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
      cumle: (
        <>
          {donus ? 'Ordun eve varmasına' : 'Ordun hedefe varmasına'}{' '}
          <strong>
            <GeriSayim bitis={ilk.arriveAt} />
          </strong>{' '}
          kaldı. Bu sürede ekipman üretebilir ya da bölgeni yükseltebilirsin.
        </>
      ),
      dugme: 'Demirhaneye git',
      git: () => g.onGit('demirhane'),
      sonraki: oneri ? `${eYonelme(oneri.name)} saldır` : 'yeni bir hedef seç',
    };
  }

  // 5. Ordu yok ya da yetmiyor: oyunun somut cevabı var, onu söyle.
  if (oneri && !oneri.kazanir) {
    const eksik = oneri.eksik;
    return {
      anahtar: 'ordu-kur',
      baslik: oneri.orduVar ? 'Ordunu büyüt' : 'Ordunu kur',
      cumle: eksik ? (
        <>
          <strong>{oneri.name}</strong> bölgesini almak için{' '}
          <strong className="text-altin">
            {eksik.adet} {unitName(eksik.birim as UnitType)}
          </strong>{' '}
          daha gerekiyor ({formatSayi(eksik.maliyet.altin)} altın).
          {!eksik.karsilanabilir && (
            <span className="text-turuncu"> Altının şu an yetmiyor; gelirini biriktir.</span>
          )}
          <br />
          <span className="text-solgun">
            Bölge senin olunca <HedefGeliri hedef={oneri} /> kazanırsın.
          </span>
        </>
      ) : (
        <>
          <strong>{oneri.name}</strong> bölgesini {toplamBirim(oneri.garrison)} birim savunuyor ve
          komuta kapasiten dolsa bile yetmiyor. Önce Lord ekranından <strong>Liderlik</strong>{' '}
          yükselt.
        </>
      ),
      dugme: eksik ? `Kışlada ${unitName(eksik.birim as UnitType)} eğit` : 'Lord ekranı',
      git: () => g.onGit(eksik ? 'kisla' : 'lord'),
      sonraki: `${eYonelme(oneri.name)} saldır`,
    };
  }

  // 6. Ordu hazır ve hedef alınabilir: oyunun asıl anı.
  if (oneri?.kazanir) {
    return {
      anahtar: 'saldir',
      baslik: `${oneri.name} üzerine yürü`,
      cumle: (
        <>
          Ordun yetiyor. Bölge senin olunca <HedefGeliri hedef={oneri} /> ve{' '}
          <strong className="text-yesil">+{formatSayi(oneri.sohretFarki)} şöhret</strong>{' '}
          kazanırsın.
          <br />
          <span className="text-solgun">
            Yürüyüş {formatKalan(oneri.marchSec * 1000)}
            {oneri.ilkSaldiri && ' — ilk saldırın hızlandırıldı'}.
          </span>
        </>
      ),
      dugme: `${eYonelme(oneri.name)} saldır`,
      git: () => g.onHedefeGit(oneri.regionId),
      sonraki: lord.equippedItems.length === 0 ? 'Demirhanede ekipman üret' : 'bölgeni yükselt',
    };
  }

  // 7. Bölge var, ekipman yok: lordun savaş katkısı büyütülebilir.
  if (lord.equippedItems.length === 0 && uretimde.length === 0) {
    return {
      anahtar: 'ekipman',
      baslik: 'Lorduna ekipman kuşan',
      cumle: (
        <>
          Lordun savaşa <strong>{formatSayi(lord.lordContribution)}</strong> güç katıyor. Ekipman
          bu sayıyı büyütür; büyüdükçe aynı savaştan daha az kayıpla çıkarsın.
        </>
      ),
      dugme: 'Demirhaneye git',
      git: () => g.onGit('demirhane'),
      sonraki: generalVar ? 'bölgeni yükselt' : 'general kirala',
    };
  }

  // 8. General: ordunun tamamına çarpan etkisi.
  if (!generalVar) {
    return {
      anahtar: 'general',
      baslik: 'General kirala',
      cumle: (
        <>
          General bütün ordunu birden güçlendirir ve savaşta yetenek kullanır. Tek bir ekipman
          parçasından daha büyük fark yaratır.
        </>
      ),
      dugme: 'Generallere git',
      git: () => g.onGit('generaller'),
      sonraki: 'bölgeni yükselt',
    };
  }

  // 9. Döngü kurulmuş: oyuncu artık kendi hedefini seçiyor.
  if (oneri) {
    return {
      anahtar: 'devam',
      baslik: 'Diyarı büyüt',
      cumle: (
        <>
          Şöhrette <strong>{formatSayi(lord.fame)}</strong> puandasın. Sıradaki hedefin{' '}
          <strong>{oneri.name}</strong>; alırsan <HedefGeliri hedef={oneri} /> eklenir.
        </>
      ),
      dugme: `${iBelirtme(oneri.name)} incele`,
      git: () => g.onHedefeGit(oneri.regionId),
      sonraki: 'Taht Kalesi — diyarın tek sahibi olabilirsin',
    };
  }

  return null;
}

function toplamBirim(a: Record<string, number | undefined>): number {
  return Object.values(a).reduce<number>((s, n) => s + (n ?? 0), 0);
}
