/**
 * Bir 3B modeli SVG olarak çizer (docs/24).
 *
 * Model üretmek ve yansıtmak ucuz ama bedava değil; aynı çizim bir
 * listede otuz kez görünebiliyor (Demirhane'de ekipman rafı). Sonuç
 * `anahtar`a göre modül düzeyinde saklanıyor: ilk çizimden sonra her
 * görünüm yalnız bir SVG kopyası.
 *
 * WebGL2 varsa aynı model GPU'da da çiziliyor (`gl.ts`): yumuşak ışık,
 * kenar yumuşatma, gölge. Önce çokgenler görünüyor, GPU resmi hazır
 * olunca aynı SVG'nin içine yerleşiyor — yer değişmiyor, erişilebilir ad
 * aynı. GPU yoksa ya da düşerse çokgenler kalıyor.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { EN_BUYUK, glCiz, glVarMi } from './gl';
import { ciz, type Cizilmis, type Kamera, type Model } from './uc';

const ONBELLEK = new Map<string, Cizilmis>();
/**
 * Model de kısa süre saklanıyor: GPU çizimi çokgeni değil modelin kendisini
 * istiyor ve aynı sahne önce SVG'ye, sonra GPU'ya (belki iki boyda) gidiyor.
 * Yalnız son birkaçı: büyük bir şeridin modeli megabaytlar tutuyor, resim
 * çizildikten sonra ona gerek yok; gerekirse yeniden üretiliyor.
 */
const MODELLER = new Map<string, Model>();
const MODEL_SINIRI = 8;

function modelAl(anahtar: string, uret: () => Model): Model {
  let m = MODELLER.get(anahtar);
  if (m) MODELLER.delete(anahtar);
  else m = uret();
  MODELLER.set(anahtar, m);
  if (MODELLER.size > MODEL_SINIRI) MODELLER.delete(MODELLER.keys().next().value!);
  return m;
}

/**
 * Kutuyu doldur, taşanı kırp (CSS `object-cover` karşılığı). Afiş kısa
 * şeritte (yarım kart) 3:2 çizimin ortasını gösteriyor. Değer iki
 * parçadan birleşiyor: boşluklu bir dizge metin çıkarıcısına "çevrilecek
 * cümle" gibi görünüyordu.
 */
const KIRP = ['xMidYMid', 'slice'].join(' ');

export function cizimiAl(anahtar: string, uret: () => Model, kamera?: Kamera): Cizilmis {
  let c = ONBELLEK.get(anahtar);
  if (!c) {
    c = ciz(modelAl(anahtar, uret), kamera);
    ONBELLEK.set(anahtar, c);
  }
  return c;
}

/** GPU resmi görüş kutusunu birebir kaplıyor; oranı zaten kutunun oranı. */
const YAYILMA = 'none';

/** Hazır GPU resimleri: çizim + görüş kutusu → çizilmiş en büyük resim. */
const RESIMLER = new Map<string, { en: number; url: string }>();

/**
 * Boy kovası: çıktı eni 1,25'in kuvvetlerine yuvarlanıyor. Alt sayfa
 * kayarken ya da ekran dönerken öğe her karede biraz büyüyor; her piksel
 * için yeniden çizmek yerine bir basamak büyüğü bir kez çiziliyor.
 */
const kova = (x: number) => Math.pow(1.25, Math.ceil(Math.log(Math.max(x, 8)) / Math.log(1.25)));

/**
 * GPU resmini ister; hazır olunca url, yoksa null. Öğe ölçülüyor: resim
 * ekrandaki boyun piksel yoğunluğu kadar çiziliyor, ne eksik ne fazla.
 */
function useGpuResmi(
  etkin: boolean,
  anahtar: string,
  uret: () => Model,
  kamera: Kamera | undefined,
  v: [number, number, number, number],
  kirp: boolean,
  tilt: number | undefined,
  ref: React.RefObject<SVGSVGElement | null>,
  basarisiz: () => void,
): string | null {
  const taban = anahtar + '|' + v.join(',') + (tilt !== undefined ? '|t' + tilt : '');
  const [resim, setResim] = useState<string | null>(() => RESIMLER.get(taban)?.url ?? null);
  // Kapanıştaki güncel işlevler: etki her çizimde yeniden kurulmasın.
  const guncel = useRef({ uret, kamera, basarisiz });
  guncel.current = { uret, kamera, basarisiz };

  useEffect(() => {
    const el = ref.current;
    if (!etkin || !el) return;
    let iptal = false;
    const [, , vw, vh] = v;
    const iste = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const cssBirim = kirp
        ? Math.max(r.width / vw, r.height / vh)
        : Math.min(r.width / vw, r.height / vh);
      let en = Math.min(EN_BUYUK, kova(vw * cssBirim * dpr));
      let boy = (en * vh) / vw;
      if (boy > EN_BUYUK) {
        en *= EN_BUYUK / boy;
        boy = EN_BUYUK;
      }
      en = Math.round(en);
      boy = Math.max(1, Math.round(boy));
      const var_ = RESIMLER.get(taban);
      if (var_ && var_.en >= en) {
        setResim(var_.url);
        return;
      }
      const { uret: u, kamera: k } = guncel.current;
      glCiz(`${taban}|${en}x${boy}`, () => ({
        model: modelAl(anahtar, u),
        kamera: k,
        kutu: v,
        en,
        boy,
        olcek: en / (vw * cssBirim),
        tilt,
      })).then((url) => {
        if (!url) {
          if (!iptal) guncel.current.basarisiz();
          return;
        }
        const simdiki = RESIMLER.get(taban);
        if (!simdiki || simdiki.en < en) RESIMLER.set(taban, { en, url });
        if (!iptal) setResim(RESIMLER.get(taban)!.url);
      });
    };
    iste();
    const ro = new ResizeObserver(iste);
    ro.observe(el);
    return () => {
      iptal = true;
      ro.disconnect();
    };
    // `v` içerik olarak `taban`da; dizi kimliği her çizimde değişiyor.
  }, [etkin, taban, kirp, tilt, ref]);

  return etkin ? resim : null;
}

/** Çokgen listesini SVG gövdesine döker; çevre bileşenler (sahne, portre) de kullanıyor. */
export function Cokgenler({ c }: { c: Cizilmis }) {
  return (
    <>
      {c.cokgenler.map((p, i) => (
        // Kenar: yüzün bir tık koyusu, ekran pikselinde sabit incelik.
        // Komşu yüzler arasında kıl gibi boşluk da kalmıyor.
        <polygon
          key={i}
          points={p.n}
          fill={p.renk}
          fillOpacity={p.saydam}
          stroke={p.kenar ?? p.renk}
          strokeOpacity={p.saydam}
          strokeWidth={p.kenar ? 0.7 : 0.4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

function kareyeTamamla([x, y, w, h]: [number, number, number, number]): [
  number,
  number,
  number,
  number,
] {
  const s = Math.max(w, h);
  return [x - (s - w) / 2, y - (s - h) / 2, s, s];
}

export const Sahne = memo(function Sahne({
  anahtar,
  uret,
  kamera,
  boyut,
  alt,
  className = '',
  kutu,
  style,
  kirp = false,
  kare = false,
  ertele = false,
  tilt,
}: {
  anahtar: string;
  uret: () => Model;
  kamera?: Kamera;
  boyut?: number;
  alt: string;
  className?: string;
  /** Sabit görüş kutusu; verilmezse modelin kendisine oturuyor. */
  kutu?: [number, number, number, number];
  style?: React.CSSProperties;
  /** Kutuyu doldur, taşanı kırp (afiş). */
  kirp?: boolean;
  /**
   * Modelin kendi çerçevesini kareye tamamla (ortalı). Birlik ve eşya
   * çizimleri kare yuvalarda duruyor; uzun bir mızrakçı ile geniş bir
   * mancınık aynı yuvada ortalanıyor.
   */
  kare?: boolean;
  /**
   * Önbellekte yoksa çizimi ilk boyamadan SONRAYA bırak. Ekran şeridi
   * gibi büyük bir sahne (binlerce yüz) açılan ekranın ilk karesini onlarca
   * milisaniye geciktiriyordu; ekranın asıl içeriği (düğmeler, sayılar)
   * önce çıksın, manzara bir kare sonra gelsin. Yalnız sabit `kutu` ile:
   * boş kare aynı görüş kutusunu taşıyor, yer değişmiyor.
   */
  ertele?: boolean;
  /**
   * Tilt-shift (yalnız GPU): keskin kalan odak bandının yarı yüksekliği
   * (boya oran). Geniş sahneler (bölge afişi, ekran zemini, diyar kapağı)
   * maket gibi okunuyor; figür ve bina simgesinde yok.
   */
  tilt?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [gpuYok, setGpuYok] = useState(false);
  const gpu = glVarMi() && !gpuYok;
  const bekle = ertele && kutu !== undefined && !ONBELLEK.has(anahtar);
  const [, yenile] = useState(0);
  // Ertelenen sahne GPU ile çiziliyorsa çokgen hiç hesaplanmıyor: resim
  // gelene kadar boş kare. GPU yoksa (ya da düştüyse) çokgen boyamadan sonra.
  useEffect(() => {
    if (!bekle || gpu) return;
    // rAF + setTimeout: önce boyama, sonra çizim.
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const cerceve = requestAnimationFrame(() => {
      zaman = setTimeout(() => {
        cizimiAl(anahtar, uret, kamera);
        yenile((n) => n + 1);
      }, 0);
    });
    return () => {
      cancelAnimationFrame(cerceve);
      clearTimeout(zaman);
    };
  }, [bekle, gpu, anahtar, uret, kamera]);

  const c = bekle ? null : cizimiAl(anahtar, uret, kamera);
  const v: [number, number, number, number] = kutu ?? (kare ? kareyeTamamla(c!.kutu) : c!.kutu);
  const resim = useGpuResmi(gpu, anahtar, uret, kamera, v, kirp, tilt, ref, () => setGpuYok(true));

  return (
    <svg
      ref={ref}
      viewBox={v.join(' ')}
      preserveAspectRatio={kirp ? KIRP : undefined}
      width={boyut}
      height={boyut}
      // Boş `alt`: süs — yanında zaten adı yazan bir çizim (liste simgesi).
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={className}
      style={style}
      data-gl={resim ? '' : undefined}
    >
      {resim ? (
        <image
          href={resim}
          x={v[0]}
          y={v[1]}
          width={v[2]}
          height={v[3]}
          preserveAspectRatio={YAYILMA}
        />
      ) : c ? (
        <Cokgenler c={c} />
      ) : null}
    </svg>
  );
});
