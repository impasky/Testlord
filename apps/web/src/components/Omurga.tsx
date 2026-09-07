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
import { B, unitName, type UnitType } from '@lordlar/shared';
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
import type { Kapi } from '@lordlar/shared';
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
  /**
   * Eylem bir KAPI açıyorsa (Demirhane, Generaller gibi) hangisi.
   *
   * Kapılar sekme değil: ait oldukları sekmenin içinde panel olarak
   * açılıyorlar. Alt çubuktaki altın nokta yine `hedefSekme`ye konuyor —
   * oyuncunun gideceği YER o sekme, kapı orada açılıyor.
   */
  hedefKapi?: Kapi;
  /**
   * Eylem AYNI ekranda bir bölüme kaydırıyorsa o bölümün kimliği.
   * Sekme değil, kapı değil — bulunulan sayfanın içinde bir yer.
   */
  hedefBolum?: string;
  /**
   * Eylem doğrudan bir bölge paneli açıyorsa o bölgenin kimliği.
   *
   * Yalnız önden veri çekmek için: haritada bölge paneli kendi sorgusunu
   * atıyor ve yavaş sunucuda düğmeye basmakla panelin dolması arasında
   * boşluk kalıyordu.
   */
  hedefBolge?: number;
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
  const yuruyusler = useQuery({
    queryKey: ['marches'],
    queryFn: api.marches,
    enabled: Boolean(lord),
  });
  const generaller = useQuery({
    queryKey: ['generals'],
    queryFn: api.generals,
    enabled: Boolean(lord),
  });
  const arastirma = useQuery({
    queryKey: ['arastirma'],
    queryFn: api.arastirma,
    enabled: Boolean(lord),
  });

  if (!lord) return null;
  // Bölge geliştirme durumu: haritadan türetiliyor, yeni bir alan yok.
  // Taht Kalesi dışarıda — o zaten geliştirilemez.
  const benimBolgeler = (harita.data?.regions ?? []).filter((r) => r.isMine && r.type !== 'taht');
  const gelismisBolgeVar = benimBolgeler.some((r) => r.level > 1);
  const gelistirilebilirBolge =
    benimBolgeler.find((r) => r.level < B.bolgeler.max_bolge_seviyesi)?.id ?? null;
  // Araştırma "başlamış" sayılıyorsa: ya biri bitmiş ya biri sürüyor.
  const arastirmaBasladi =
    (arastirma.data?.ilerleme.biten ?? 0) > 0 || (arastirma.data?.surenler?.length ?? 0) > 0;
  // Depo dolu mu: türetiliyor, sunucuda yeni bir alan açılmadı.
  // Üç kaynağın da tavana dayanması aranıyor; biri doluyken diğeri
  // akıyorsa oyuncunun kaybettiği şey henüz bir sorun değil.
  const depoTavani = lord.storageCapacity;
  const hepsiDolu =
    lord.resources.altin >= depoTavani &&
    lord.resources.demir >= depoTavani &&
    lord.resources.erzak >= depoTavani;
  const depoArastirmasiVar = (arastirma.data?.dallar ?? []).some(
    (d) => 'depo_carpani' in (d.etki ?? {}) && !d.tamamlandi,
  );
  return siradakiAdim({
    lord,
    depoDolu: hepsiDolu && depoArastirmasiVar,
    gelistirilebilirBolge,
    gelismisBolgeVar,
    arastirmaBasladi,
    oneriBekliyor: harita.isPending,
    oneri: harita.data?.oneri ?? null,
    egitimde: queues.filter((q) => q.kind === 'train'),
    uretimde: queues.filter((q) => q.kind === 'craft'),
    generalVar: (generaller.data?.kadro ?? []).some((x) => x.sahipMi),
    yarali: lord.woundedUntil ? new Date(lord.woundedUntil) > new Date() : false,
    yoldaki: yuruyusler.data ?? [],
    onGit: () => {},
    onKapiAc: () => {},
    onHedefeGit: () => {},
    onBolumeGit: () => {},
  });
}

export function Omurga({
  lord,
  queues,
  onGit,
  onKapiAc,
  onHedefeGit,
  onBolumeGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGit: (s: Sekme) => void;
  /** Bir kapıyı (panel sayfayı) açar. */
  onKapiAc: (k: Kapi) => void;
  /** Bir bölgeyi doğrudan haritada açar. */
  onHedefeGit: (regionId: number) => void;
  /** Aynı ekrandaki bir bölüme götürür (sekmeyi değiştirip kaydırarak). */
  onBolumeGit: (bolumId: string) => void;
}) {
  const harita = useQuery({ queryKey: ['map'], queryFn: api.map });
  const yuruyusler = useQuery({ queryKey: ['marches'], queryFn: api.marches });
  // Generaller /me içinde dönmüyor; yalnızca gerekince çekiliyor.
  const generaller = useQuery({ queryKey: ['generals'], queryFn: api.generals });
  const arastirma = useQuery({ queryKey: ['arastirma'], queryFn: api.arastirma });

  const oneri = harita.data?.oneri ?? null;
  const egitimde = queues.filter((q) => q.kind === 'train');
  const uretimde = queues.filter((q) => q.kind === 'craft');
  const generalVar = (generaller.data?.kadro ?? []).some((g) => g.sahipMi);
  const yarali = lord.woundedUntil ? new Date(lord.woundedUntil) > new Date() : false;

  // Depo dolu mu: türetiliyor, sunucuda yeni bir alan açılmadı.
  // Üç kaynağın da tavana dayanması aranıyor; biri doluyken diğeri
  // akıyorsa oyuncunun kaybettiği şey henüz bir sorun değil.
  const depoTavani = lord.storageCapacity;
  const hepsiDolu =
    lord.resources.altin >= depoTavani &&
    lord.resources.demir >= depoTavani &&
    lord.resources.erzak >= depoTavani;
  const depoArastirmasiVar = (arastirma.data?.dallar ?? []).some(
    (d) => 'depo_carpani' in (d.etki ?? {}) && !d.tamamlandi,
  );

  // Bölge geliştirme durumu: haritadan türetiliyor, yeni bir alan yok.
  // Taht Kalesi dışarıda — o zaten geliştirilemez.
  const benimBolgeler = (harita.data?.regions ?? []).filter((r) => r.isMine && r.type !== 'taht');
  const gelismisBolgeVar = benimBolgeler.some((r) => r.level > 1);
  const gelistirilebilirBolge =
    benimBolgeler.find((r) => r.level < B.bolgeler.max_bolge_seviyesi)?.id ?? null;
  // Araştırma "başlamış" sayılıyorsa: ya biri bitmiş ya biri sürüyor.
  const arastirmaBasladi =
    (arastirma.data?.ilerleme.biten ?? 0) > 0 || (arastirma.data?.surenler?.length ?? 0) > 0;

  const adim = siradakiAdim({
    lord,
    depoDolu: hepsiDolu && depoArastirmasiVar,
    gelistirilebilirBolge,
    gelismisBolgeVar,
    arastirmaBasladi,
    oneriBekliyor: harita.isPending,
    oneri,
    egitimde,
    uretimde,
    generalVar,
    yarali,
    yoldaki: yuruyusler.data ?? [],
    onGit,
    onKapiAc,
    onHedefeGit,
    onBolumeGit,
  });

  /*
   * Sorgular gelmeden HİÇBİR ŞEY çizmemek, kartı yaklaşık 250 ms sonra
   * yoktan var ediyordu ve altındaki her şeyi birden aşağı itiyordu:
   * ölçülen ilk yükleme kayması bu tek kartın eseriydi (CLS 0,10 — eşik
   * 0,10). Oyuncunun "görsel kaymalar var" dediği şeyin ta kendisi.
   *
   * Yerini ŞİMDİDEN tutuyoruz. Yükseklik elle yazılmıyor: iskelet gerçek
   * kartın kendi işaretlemesini kullanıyor, ölçüyü tarayıcı hesaplıyor.
   * (Daha önce `GorevOzeti`'ne tahmini bir `h-[52px]` yazmıştım ve yazı
   * boyu değişince kayma 0,014'ten 0,361'e fırlamıştı — aynı hatayı iki
   * kez yapmayalım.)
   */
  if (!adim) {
    const bekliyor = harita.isPending || yuruyusler.isPending || generaller.isPending;

    // Sorgular OTURDU ve yine de adım yoksa gerçekten gösterilecek bir şey
    // yok demektir; orada boş bir iskelet asılı bırakmak yalan olurdu.
    if (!bekliyor) return null;
    return <OmurgaIskeleti />;
  }

  return (
    <Kart className="p-4" vurgu="var(--color-altin)">
      <h3 className="baslik mb-1.5 text-[11px] text-sonuk">Şimdi ne yapmalısın</h3>
      <p className="baslik text-[19px] leading-tight text-altin">{adim.baslik}</p>

      {/* Tek satır cümle + rozetler. Önceden burada dört satırlık düz yazı
          vardı; aynı bilgiyi rozetlerle vermek okuma yükünü düşürüyor ve
          referanstaki "sayı cümlenin içinde durmaz" kuralına uyuyor. */}
      {adim.cumle && <p className="mt-1.5 text-[13px] leading-snug text-parsomen">{adim.cumle}</p>}
      {adim.rozetler && adim.rozetler.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{adim.rozetler}</div>
      )}

      {adim.dugme && adim.git && (
        <Buton className="mt-3" boy="buyuk" tam onClick={adim.git} isaret="omurga-dugme">
          {adim.dugme}
        </Buton>
      )}

      {adim.sonraki && (
        <p className="mt-2.5 text-[11px] leading-snug text-sonuk">sonra: {adim.sonraki}</p>
      )}
    </Kart>
  );
}

/**
 * Omurga kartının yer tutucusu.
 *
 * Gerçek kartla AYNI iskeleti kuruyor — aynı `Kart`, aynı `p-4`, aynı
 * başlık, aynı `boy="buyuk"` düğme — yalnız metinlerin yerinde soluk
 * bloklar var. Böylece yükseklik tahmin edilmiyor, gerçek bileşenlerin
 * kendi ölçüsünden çıkıyor ve içerik geldiğinde sayfa zıplamıyor.
 */
function OmurgaIskeleti() {
  return (
    <Kart className="p-4" vurgu="var(--color-altin)">
      <h3 className="baslik mb-1.5 text-[11px] text-sonuk">Şimdi ne yapmalısın</h3>
      <div aria-busy="true" aria-label="Yükleniyor" className="motion-safe:animate-pulse">
        {/* Başlık satırı: gerçek kartta text-[19px] leading-tight. */}
        <p className="baslik text-[19px] leading-tight text-transparent">
          <span className="oyuk rounded">Ordunu kur</span>
        </p>
        {/* Cümle satırı: text-[13px] leading-snug, TEK satır. Yer tutucu
            metin uzun tutulunca ikinci satıra taşıyor ve iskelet gerçek
            karttan 18 piksel yüksek kalıyordu — kayma tam o kadardı. */}
        <p className="mt-1.5 text-[13px] leading-snug text-transparent">
          <span className="oyuk rounded">Ordun henüz yetmiyor.</span>
        </p>
        {/* Rozet sırası ve birincil düğme: yüksekliği veren asıl parçalar. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Hap>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Hap>
          <Hap>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Hap>
        </div>
        <Buton className="mt-3" boy="buyuk" tam disabled>
          &nbsp;
        </Buton>
        <p className="mt-2.5 text-[11px] leading-snug text-transparent">
          <span className="oyuk rounded">sonra: sıradaki adım</span>
        </p>
      </div>
    </Kart>
  );
}

export function siradakiAdim(g: {
  lord: LordState;
  /**
   * Hedef önerisi HENÜZ GELMEDİ mi?
   *
   * Bunu ayırt etmek şart: "öneri yok" ile "öneri daha gelmedi" aynı şey
   * değil. Ayırt edilmediğinde yepyeni lord için zincir 5. ve 6. adımları
   * atlayıp 7'ye düşüyordu ve oyuncu ~80 ms boyunca YANLIŞ adımı
   * okuyordu: "Lorduna ekipman kuşan" yazıyor, harita cevabı gelince
   * "Ordunu kur"a dönüyordu. Görünen sonucu kartın boy değiştirmesi
   * (kayma) ama asıl sorun oyunun bir an yanlış şeyi söylemesiydi —
   * üstelik artık rehber ışığı da o düğmeyi aydınlatıyor olurdu.
   */
  oneriBekliyor: boolean;
  oneri: HedefOnerisiDto | null;
  egitimde: QueueItem[];
  uretimde: QueueItem[];
  generalVar: boolean;
  yarali: boolean;
  yoldaki: MarchDto[];
  /**
   * Depo dolu VE hâlâ alınabilecek bir depo araştırması var mı.
   *
   * İkisi birden şart: depo doluysa ama Ambarlar zaten bitmişse omurga
   * çözümü olmayan bir sorunu tekrar tekrar söylerdi — kâhyanın işi
   * hatırlatmak değil yol göstermek.
   */
  depoDolu: boolean;
  /**
   * Geliştirilebilecek bir bölgenin kimliği (varsa).
   *
   * Bölge SAHİPLİĞİ değil GELİŞTİRİLEBİLİRLİĞİ aranıyor: en üst seviyeye
   * çıkmış tek bölgesi olan oyuncuyu geliştirmeye yollamak, kapalı bir
   * düğmeye yollamak olurdu.
   */
  gelistirilebilirBolge: number | null;
  /** Hiç bölge geliştirmiş mi (herhangi biri 1. seviyenin üstünde). */
  gelismisBolgeVar: boolean;
  /** Hiç araştırma başlatmış ya da bitirmiş mi. */
  arastirmaBasladi: boolean;
  onGit: (s: Sekme) => void;
  onKapiAc: (k: Kapi) => void;
  onHedefeGit: (regionId: number) => void;
  /**
   * AYNI ekrandaki bir bölüme götürür (gerekirse sekmeyi değiştirip
   * kaydırarak).
   *
   * Omurga yalnız Lord ekranında duruyor. "Lord ekranı" düğmesi, zaten
   * Lord ekranında olan oyuncuyu hiçbir yere götürmüyordu — oyuncunun
   * kendi sözüyle: "lord ekranındayım ama bana kocaman lord ekranına git
   * diyor". Adım artık ekrana değil, işin YAPILDIĞI bölüme yolluyor.
   */
  onBolumeGit: (bolumId: string) => void;
}): Adim | null {
  const { lord, oneri, egitimde, uretimde, generalVar, yarali, yoldaki } = g;

  // 0. Açlık ve yara oyun durumundan doğrudan okunuyor; onlar için harita
  //    cevabını beklemeye gerek yok. Gerisi hedefe bağlı, o yüzden öneri
  //    gelmeden karar verilmiyor.
  if (g.oneriBekliyor && !lord.starving && !yarali) return null;

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
      git: () => g.onKapiAc('demirhane'),
      hedefSekme: 'lord',
      hedefKapi: 'demirhane',
      sonraki: oneri ? `${eYonelme(oneri.name)} saldır` : 'yeni bir hedef seç',
    };
  }

  /*
   * 4b. Akın SAHADA: bu bir eylem değil, bir bekleyiş.
   *
   * `ordu-yolda` ile aynı gerekçe. Olmasaydı omurga "ilk akınına çık"
   * demeye devam ederdi ve oyuncu zaten çıkmış olduğu akına tekrar
   * yollanırdı — rehber ışığı da onu Akın sekmesinde kilitlerdi.
   */
  if (lord.akindaOrduVar) {
    return {
      anahtar: 'akin-yolda',
      baslik: 'Akının sürüyor',
      cumle: 'Ordun kampa iniyor. Dönünce ganimeti ve raporu görürsün.',
      rozetler: [
        <Hap key="risk" ikon={<IkonYer boyut={13} />}>
          toprağın güvende
        </Hap>,
      ],
      sonraki: 'ilk bölgeni al',
    };
  }

  /*
   * 4c. Ordu var ama HENÜZ AKINA ÇIKMADI: ilk savaş bir kampta öğrenilir.
   *
   * Sıra bilerek böyle (docs/12 §8): yeni oyuncunun ilk yenilgisi bir
   * komşuyla ömürlük husumet değil, bir kamptan dönen yaralılar olsun.
   * Akın toprak almıyor, toprak da vermiyor — öğrenmenin en ucuz yeri.
   *
   * Yalnız BİR KEZ görünüyor: damga (`Lord.ilkAkinAt`) konunca adım bir
   * daha çıkmıyor. Her akından sonra tekrar çıksaydı omurga oyuncuyu
   * sonsuza kadar aynı yere yollar, "şimdi ne yapmalısın" sorusunun tek
   * cevabı akın olurdu.
   *
   * SIRA ÖNEMLİ: bu adım "ordunu büyüt" adımından ÖNCE geliyor. Sonra
   * koymuştum ve hiç görünmedi — bölge hedefi için ordu neredeyse hiçbir
   * zaman ilk seferde yetmiyor, omurga da hep kışlayı gösteriyordu.
   * Oysa akının ilk grubu bir bölgeden çok daha zayıf: eldeki ordu ona
   * zaten yetiyor.
   */
  if (!lord.akinYapti && lord.usedSlots > 0) {
    return {
      anahtar: 'akin',
      baslik: 'İlk akınına çık',
      cumle:
        'Ordun ayakta. Önce bir düşman kampına in: kaybetsen bile toprağın gitmez, ' +
        'kazanırsan ilk demirini savaşarak alırsın.',
      rozetler: [
        <Hap key="ganimet" ikon={<IkonDemir boyut={13} />} renk="var(--color-altin)">
          kaynak ve ekipman
        </Hap>,
        <Hap key="risk" ikon={<IkonYer boyut={13} />}>
          toprak riski yok
        </Hap>,
      ],
      dugme: 'Akına git',
      git: () => g.onGit('akin'),
      hedefSekme: 'akin',
      sonraki: 'ilk bölgeni al',
    };
  }

  // 5. Ordu yok ya da yetmiyor: oyunun somut cevabı var, onu söyle.
  if (oneri && !oneri.kazanir) {
    const eksik = oneri.eksik;
    if (!eksik) {
      return {
        anahtar: 'liderlik',
        baslik: 'Komuta kapasiten yetmiyor',
        // Cümle EKRAN ADI vermiyor. Omurga yalnız Lord ekranında
        // duruyor; "Lord ekranından Liderlik yükselt" demek, zaten orada
        // olan oyuncuya bulunduğu yeri tarif etmekti.
        cumle: `${oneri.name} kapasiten dolsa bile alınmıyor. Liderlik statını yükseltmen gerek.`,
        rozetler: [
          <Hap key="sav" ikon={<IkonYer boyut={13} />} renk="var(--color-turuncu)">
            {toplamBirim(oneri.garrison)} savunan
          </Hap>,
        ],
        dugme: 'Niteliklere git',
        git: () => g.onBolumeGit('nitelikler'),
        hedefSekme: 'lord',
        hedefBolum: 'nitelikler',
      };
    }
    return {
      anahtar: 'ordu-kur',
      baslik: oneri.orduVar ? 'Ordunu büyüt' : 'Ordunu kur',
      cumle: `${oneri.name} için ordun henüz yetmiyor.`,
      rozetler: [
        <Hap
          key="ordu"
          ikon={<BirimIkonu tip={eksik.birim} boyut={13} />}
          renk="var(--color-altin)"
        >
          {eksik.adet} {unitName(eksik.birim as UnitType)}
        </Hap>,
        <Hap
          key="mal"
          ikon={<IkonAltin boyut={13} />}
          renk={eksik.karsilanabilir ? 'var(--color-kaynak-altin)' : 'var(--color-kirmizi)'}
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
      hedefBolge: oneri.regionId,
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
      git: () => g.onKapiAc('demirhane'),
      hedefSekme: 'lord',
      hedefKapi: 'demirhane',
      sonraki: generalVar ? 'bölgeni yükselt' : 'general kirala',
    };
  }

  // 7b. Depo dolu: üretilen her şey buharlaşıyor.
  //
  // Denetimde çıkan çıkmaz sokak buydu: ekranda üç kırmızı "depo dolu"
  // uyarısı yanıyor ve hiçbirinin altında oyuncunun basabileceği bir şey
  // yok. Araştırma ağacındaki Ambarlar o uyarının cevabı — omurga artık
  // oraya yolluyor.
  //
  // Generalden ÖNCE, çünkü depo doluyken biriktirilen her saat boşa
  // gidiyor; general kiralamak beklenebilir, kaynak israfı beklemiyor.
  if (g.depoDolu) {
    return {
      anahtar: 'depo',
      baslik: 'Deponun taşıyor',
      cumle:
        'Depon dolduğu için ürettiğin her şey boşa gidiyor. Ambarlar araştırması depoyu büyütür.',
      dugme: 'Araştırmaya git',
      git: () => g.onKapiAc('arastirma'),
      hedefSekme: 'lord',
      hedefKapi: 'arastirma',
      sonraki: 'general kirala',
    };
  }

  // 8. General: ordunun tamamına çarpan etkisi.
  if (!generalVar) {
    return {
      anahtar: 'general',
      baslik: 'General kirala',
      cumle: 'General bütün ordunu birden güçlendirir — tek bir ekipmandan büyük fark yaratır.',
      dugme: 'Generallere git',
      git: () => g.onKapiAc('generaller'),
      hedefSekme: 'lord',
      hedefKapi: 'generaller',
      sonraki: 'bölgeni yükselt',
    };
  }

  /*
   * 8b/8c — İLK KEZ adımları.
   *
   * Bu ikisi omurgada yoktu ve bu bir boşluktu: zorunlu rehber omurganın
   * ÜSTÜNE biniyor, yani omurganın uğramadığı bir mekaniği rehber de
   * öğretemiyor. Bölge geliştirme ve araştırma, oyuncunun kendi başına
   * bulması gereken iki büyük sistemdi.
   *
   * "İlk kez" olmaları kasıtlı: koşul bir kez yapılınca sonsuza kadar
   * kapanıyor. Kıdemli oyuncuya her oturumda "bölgeni geliştir" demek
   * omurgayı bir hatırlatıcıya çevirirdi; omurganın işi SIRADAKİ adımı
   * söylemek, yapılabilecek her şeyi listelemek değil.
   *
   * Saldırıdan SONRA duruyorlar: hedef alınabiliyorken oyuncuyu
   * geliştirmeye yollamak, oyunun asıl anını geciktirmek olurdu.
   */

  // 8b. Hiç bölge geliştirmemiş: gelir seviyeyle büyüyor ve bunu kimse söylemiyor.
  if (g.gelistirilebilirBolge && !g.gelismisBolgeVar) {
    return {
      anahtar: 'bolge-gelistir',
      baslik: 'Bölgeni geliştir',
      cumle:
        'Bölgenin seviyesi geliri de savunmayı da büyütür. Yeni toprak almadan da güçlenebilirsin.',
      dugme: 'Bölgeye git',
      git: () => g.onHedefeGit(g.gelistirilebilirBolge!),
      hedefSekme: 'harita',
      hedefBolge: g.gelistirilebilirBolge,
      sonraki: 'bir araştırma başlat',
    };
  }

  // 8c. Hiç araştırma yapmamış: diyarını şekillendiren tek katman.
  if (!g.arastirmaBasladi) {
    return {
      anahtar: 'arastirma',
      baslik: 'Bir araştırma başlat',
      cumle:
        'Araştırma kalıcıdır ve diyarını senin seçimlerinle şekillendirir — iki lord aynı seviyede aynı olmaz.',
      dugme: 'Araştırmaya git',
      git: () => g.onKapiAc('arastirma'),
      hedefSekme: 'lord',
      hedefKapi: 'arastirma',
      sonraki: 'diyarı büyütmeye devam et',
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
      hedefBolge: oneri.regionId,
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
