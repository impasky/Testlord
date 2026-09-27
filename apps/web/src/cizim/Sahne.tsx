/**
 * Bir 3B modeli SVG olarak çizer (docs/24).
 *
 * Model üretmek ve yansıtmak ucuz ama bedava değil; aynı çizim bir
 * listede otuz kez görünebiliyor (Demirhane'de ekipman rafı). Sonuç
 * `anahtar`a göre modül düzeyinde saklanıyor: ilk çizimden sonra her
 * görünüm yalnız bir SVG kopyası.
 */
import { memo, useEffect, useState } from 'react';
import { ciz, type Cizilmis, type Kamera, type Model } from './uc';

const ONBELLEK = new Map<string, Cizilmis>();

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
    c = ciz(uret(), kamera);
    ONBELLEK.set(anahtar, c);
  }
  return c;
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
}) {
  const bekle = ertele && kutu !== undefined && !ONBELLEK.has(anahtar);
  const [, yenile] = useState(0);
  useEffect(() => {
    if (!bekle) return;
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
  }, [bekle, anahtar, uret, kamera]);

  if (bekle)
    return (
      <svg
        viewBox={kutu.join(' ')}
        preserveAspectRatio={kirp ? KIRP : undefined}
        width={boyut}
        height={boyut}
        aria-hidden
        className={className}
        style={style}
      />
    );

  const c = cizimiAl(anahtar, uret, kamera);
  const v = kutu ?? (kare ? kareyeTamamla(c.kutu) : c.kutu);
  return (
    <svg
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
    >
      <Cokgenler c={c} />
    </svg>
  );
});
