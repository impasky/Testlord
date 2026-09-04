/**
 * Dünya haritası — 61 altıgenlik bir DİYAR.
 *
 * Oyuncunun sözleri: "harita çok kötü, neyin ne olduğu anlaşılmıyor; bir
 * zemin üstüne oturtulmuş olsa daha iyi olur; şu an bir dikdörtgende sağa
 * sola gidiyormuşum gibi ham hissettiriyor."
 *
 * Haklıydı. Önceki hâl düz renkli altıgenlerden oluşan bir ızgaraydı:
 * boşlukta duran bir tablo, bir yer değil. Üç şey değişti:
 *
 *  1. **Zemin var.** Altıgenler denizin üstünde yüzen bir kara parçası
 *     oluşturuyor; kıyı şeridi ve deniz gerçekten çiziliyor. Harita artık
 *     bir dikdörtgen değil, kenarları olan bir ada.
 *  2. **Araziyi görsel anlatıyor.** Her altıgen kendi bölge illüstrasyonuyla
 *     dolduruluyor — buğday tarlası tarla gibi, maden ocağı maden gibi
 *     görünüyor. Önceden ikisi de aynı boy gri ikondu.
 *  3. **Bölgelerin adı var.** İsimsiz altıgenler "neyin ne olduğu
 *     anlaşılmıyor" duygusunun doğrudan sebebiydi.
 *
 * Mobilde tek dokunuşla bölge seçilir. Sahiplik hem RENK hem DESEN ile
 * gösterilir (renk körü güvenliği).
 */
import { useEffect, useRef, useState } from 'react';
import type { MarchDto, RegionDto } from '../api/client';
import { IKONLAR } from './ikon-verisi';

const BOYUT = 34;
/** Kara parçası altıgenlerden bu kadar taşar; kıyı şeridi burada oluşur. */
const KIYI = 10;
const PAD = 46;

/**
 * Vilayet renkleri.
 *
 * Diyar yedi vilayete bölünmüştü (`world-map.json` → provinces) ve bu
 * bölünme haritada HİÇ görünmüyordu: 61 altıgen tek tip bir petekti.
 * Vilayet sınırı ve adı, aynı haritayı bir peteğe değil bir DİYARA
 * çeviriyor (docs/11 §1.2 H3).
 *
 * Renkler burada, `balance.json`da değil: hiçbir sayıya dokunmuyorlar.
 */
const VILAYET_RENGI: Record<string, string> = {
  kuzeymark: '#7fb2e0',
  demirvadi: '#c0c6cc',
  gunbati: '#e0b878',
  aksu: '#8fd3a8',
  karaorman: '#9ad06a',
  tasgecit: '#d69a7a',
  taht: '#f5b731',
};

const VILAYET_ADI: Record<string, string> = {
  kuzeymark: 'Kuzeymark',
  demirvadi: 'Demirvadi',
  gunbati: 'Günbatı Kıyıları',
  aksu: 'Aksu Ovası',
  karaorman: 'Karaorman',
  tasgecit: 'Taşgeçit',
  taht: 'Taht Vilayeti',
};

/**
 * Altıgen kenarlarının komşu yönleri (sivri tepeli düzen).
 *
 * i. kenar, i. ve (i+1). köşe arasındaki doğru parçası. Sıra `hexYol`un
 * köşe sırasına bağlı; ikisi birlikte değişmeli.
 */
const KENAR_YONU: readonly (readonly [number, number])[] = [
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
];

/** Altıgenin i. köşesi. */
function kose(cx: number, cy: number, s: number, i: number): [number, number] {
  const a = (Math.PI / 180) * (60 * (i % 6) - 90);
  return [cx + s * Math.cos(a), cy + s * Math.sin(a)];
}

/**
 * Kıyı taşmasının bölgeye göre küçük oynaması.
 *
 * Kara parçası kusursuz bir altıgendi — yani "burası bir ızgara" diye
 * bağıran bir siluet. Taşmayı bölge kimliğinden türeyen sabit bir sayıyla
 * oynatınca aynı harita kıyısı olan bir ada gibi duruyor. Rastgele DEĞİL:
 * her yeniden çizimde kıyının şekil değiştirmesi baş döndürürdü.
 */
function kiyiTasmasi(id: number): number {
  const h = (id * 2654435761) % 1000;
  // Aralık geniş tutuldu: ilk denemede 0.72–1.34'tü ve fark ekranda hiç
  // okunmuyordu, siluet hâlâ kusursuz bir altıgendi.
  return KIYI * (0.45 + (h / 1000) * 1.25);
}

/** Zemin rengi: illüstrasyon yüklenene kadar ve onun üstünde ton olarak. */
const TIP_ZEMIN: Record<string, string> = {
  tarla: '#4a5a2c',
  maden: '#3a4652',
  sehir: '#5c4a2a',
  kale: '#53302a',
  taht: '#6b5015',
};

/**
 * Altıgen dolgusu iki katmandan gelir:
 *
 *   harita/<tip>.webp   — tam tepeden bakan arazi KAROSU (asıl istenen)
 *   bolgeler/<tip>.webp — üç çeyrek açıdan bakan SAHNE (karo yoksa yedek)
 *
 * İkisi ayrı şeyler. Sahneyi karo olarak kullanmak haritayı bulanık bir
 * kolaja çeviriyor; o yüzden sahne yedeği 2,6 kat yakınlaştırılıp
 * ortasından kırpılıyor ki hiç değilse doku olarak okunsun.
 *
 * Taht'ın sahnesi bir İÇ MEKÂN (taht odası) ve arazi olarak hiç okunmuyor;
 * yedeğinde kaleyi ödünç alıyor. Kendi karosu geldiğinde o kullanılır.
 */
/**
 * Karo dokusunun altıgene basılma ölçeği.
 *
 * 1 = karonun tamamı sığdırılır (sahne okunmuyor, lapa oluyor).
 * 2.2 = ortadan yaklaşık yarısı gösterilir; buğday buğday, taş taş çıkıyor.
 */
const KARO_YAKINLIK = 2.2;

/** Deniz karosunun döşeme adımı (SVG kullanıcı birimi). Altıgen 34. */
const DENIZ_KARO = 190;

const TIP_SAHNE: Record<string, string> = {
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'kale',
};

const TIP_IKON: Record<string, keyof typeof IKONLAR> = {
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'taht',
};

/** Bölge tipi ikonunu altıgenin ortasına ölçekleyerek yerleştirir. */
function TipIkonu({ tip, x, y }: { tip: string; x: number; y: number }) {
  const anahtar = TIP_IKON[tip];
  if (!anahtar) return null;
  const v = IKONLAR[anahtar];
  const hedef = BOYUT * 0.72;
  const olcek = hedef / v.w;
  return (
    <g
      transform={`translate(${x - hedef / 2} ${y - hedef / 2}) scale(${olcek})`}
      className="pointer-events-none"
      dangerouslySetInnerHTML={{ __html: v.body }}
    />
  );
}

/**
 * Vilayet adlarını üst üste binmekten kurtarır.
 *
 * Ağırlık merkezi tek başına yetmiyor: bitişik iki küçük vilayetin
 * merkezleri birbirine yakın düşüyor ve "GÜNBATI KIYILARI" ile "DEMİRVADİ"
 * aynı satırda üst üste yazılıyordu — ikisi de okunmuyordu.
 *
 * Çakışanları dikey olarak ayırıyoruz: harita yatay eksende dar, dikeyde
 * oynamak için yer var.
 */
function ayirVilayetAdlari(
  adlar: { key: string; x: number; y: number }[],
): { key: string; x: number; y: number }[] {
  const DIKEY = 16;
  const YATAY = 130;
  const sirali = [...adlar].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sirali.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = sirali[j]!;
      const b = sirali[i]!;
      if (Math.abs(a.x - b.x) < YATAY && Math.abs(a.y - b.y) < DIKEY) {
        b.y = a.y + DIKEY;
      }
    }
  }
  return sirali;
}

function merkez(q: number, r: number) {
  return { x: BOYUT * Math.sqrt(3) * (q + r / 2), y: BOYUT * 1.5 * r };
}

function hexYol(cx: number, cy: number, s: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
}

/** Bölge adı: dar altıgende sığması için kısaltılır. */
function kisaAd(ad: string): string {
  return ad.length > 9 ? `${ad.slice(0, 8)}…` : ad;
}

export function HexHarita({
  regions,
  home,
  seciliId,
  yuruyusler,
  ittifakHedefiId,
  onSec,
}: {
  regions: RegionDto[];
  home: { q: number; r: number };
  seciliId: number | null;
  /** Yoldaki ordular: evden hedefe çizgi ve ilerleyen bir işaret. */
  yuruyusler: MarchDto[];
  /** İttifakın ortak hedefi. Haritada işaretli olmazsa hedef değil, nottur. */
  ittifakHedefiId?: number | null;
  onSec: (id: number) => void;
}) {
  // Yürüyüş işaretinin yeri her karede Date.now()'dan hesaplanıyor; bileşen
  // yeniden çizilmezse işaret donuyor. Yürüyüş yokken zamanlayıcı hiç
  // kurulmuyor: haritanın boşuna yeniden çizilmesi uzun oturumlarda pil yakar.
  const [, tik] = useState(0);
  useEffect(() => {
    if (yuruyusler.length === 0) return;
    const id = setInterval(() => tik((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [yuruyusler.length]);

  /**
   * Yakınlaştırma ve kaydırma.
   *
   * 61 altıgen 390 piksellik bir ekrana sığdırıldığında altıgen başına ~48
   * piksel düşüyor: her isim kısaltılıyor, her ikon minicik kalıyor ve
   * harita "bakılan" bir şey değil "bakılamayan" bir şey oluyor. Oyuncunun
   * "kısıtlayıcı hissettiriyor" dediği şeyin görsel yarısı bu (docs/11 §1.2 H4).
   *
   * Bir parmak kaydırır, iki parmak yakınlaştırır. Dokunuşun sürükleme mi
   * seçim mi olduğuna hareket miktarı karar veriyor: sürüklerken yanlışlıkla
   * bölge seçmek haritayı kullanılamaz yapardı.
   */
  const [gorunum, setGorunum] = useState({ olcek: 1, dx: 0, dy: 0 });
  const isaretciler = useRef(new Map<number, { x: number; y: number }>());
  const surukleme = useRef({ mesafe: 0, baslangicOlcek: 1, ilkAralik: 0 });
  const kutuRef = useRef<HTMLDivElement>(null);

  function sinirla(g: { olcek: number; dx: number; dy: number }) {
    const olcek = Math.min(4, Math.max(1, g.olcek));
    // Kenar payı: harita ekrandan tamamen kaçamasın. Yakınlaştırma
    // arttıkça kayabileceği alan da artıyor.
    const kutu = kutuRef.current;
    const gen = kutu?.clientWidth ?? 320;
    const yuk = kutu?.clientHeight ?? 320;
    const payX = ((olcek - 1) * gen) / 2;
    const payY = ((olcek - 1) * yuk) / 2;
    return {
      olcek,
      dx: Math.min(payX, Math.max(-payX, g.dx)),
      dy: Math.min(payY, Math.max(-payY, g.dy)),
    };
  }

  function aralik() {
    const [a, b] = [...isaretciler.current.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function isaretciIndi(e: React.PointerEvent) {
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    surukleme.current.mesafe = 0;
    if (isaretciler.current.size === 2) {
      surukleme.current.ilkAralik = aralik();
      surukleme.current.baslangicOlcek = gorunum.olcek;
    }
  }

  function isaretciHareket(e: React.PointerEvent) {
    const onceki = isaretciler.current.get(e.pointerId);
    if (!onceki) return;
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const kayma = Math.hypot(e.clientX - onceki.x, e.clientY - onceki.y);
    surukleme.current.mesafe += kayma;

    if (isaretciler.current.size >= 2) {
      const simdi = aralik();
      if (surukleme.current.ilkAralik > 0 && simdi > 0) {
        const oran = simdi / surukleme.current.ilkAralik;
        setGorunum((g) => sinirla({ ...g, olcek: surukleme.current.baslangicOlcek * oran }));
      }
      return;
    }
    // Tek parmak: yakınlaşmışken kaydırır, tam görünümdeyken bir şey yapmaz
    // (sayfanın kendi kaydırması engellenmesin).
    if (gorunum.olcek > 1) {
      setGorunum((g) =>
        sinirla({ ...g, dx: g.dx + (e.clientX - onceki.x), dy: g.dy + (e.clientY - onceki.y) }),
      );
    }
  }

  function isaretciKalkti(e: React.PointerEvent) {
    isaretciler.current.delete(e.pointerId);
    if (isaretciler.current.size < 2) surukleme.current.ilkAralik = 0;
  }

  /** Sürüklemeden sonra gelen tıklama seçim SAYILMAZ. */
  const suruklendiMi = () => surukleme.current.mesafe > 8;

  // Yakınlaşınca isimler kısaltılmadan yazılıyor: yakınlaştırmanın asıl
  // vaadi bu.
  const tamAd = gorunum.olcek >= 1.6;

  const m = regions.map((r) => ({ r, ...merkez(r.q, r.r) }));
  const xs = m.map((a) => a.x);
  const ys = m.map((a) => a.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;
  const ev = merkez(home.q, home.r);
  const tipler = [...new Set(regions.map((r) => r.type))];

  // Komşunun vilayeti: sınır çizerken her komşu için listeyi baştan
  // taramak 61 × 6 arama demekti.
  const vilayetHaritasi = new Map(regions.map((r) => [`${r.q},${r.r}`, r.province]));

  /**
   * Vilayet adının yazılacağı yer: o vilayetin altıgenlerinin ağırlık
   * merkezi. Vilayetler bitişik olduğu için merkez her zaman vilayetin
   * İÇİNE düşüyor.
   *
   * Taht Vilayeti hariç: tek altıgen ve adı zaten bölgenin kendi adı,
   * ikisi üst üste binerdi.
   */
  const vilayetMerkezleri = ayirVilayetAdlari(
    [...new Set(regions.map((r) => r.province))]
      .filter((k) => k !== 'taht')
      .map((key) => {
        const uyeler = m.filter((a) => a.r.province === key);
        return {
          key,
          x: uyeler.reduce((t, a) => t + a.x, 0) / uyeler.length,
          y: uyeler.reduce((t, a) => t + a.y, 0) / uyeler.length,
        };
      }),
  );

  return (
    <div className="relative">
      <div
        ref={kutuRef}
        className="overflow-hidden rounded-lg"
        // touch-action: none — tarayıcının kendi kaydırması bizim
        // sürüklememizi çalmasın. Yalnız yakınlaşmışken kapatıyoruz;
        // tam görünümde sayfa normal kaydırılabilmeli.
        style={{ touchAction: gorunum.olcek > 1 ? 'none' : 'pan-y' }}
        onPointerDown={isaretciIndi}
        onPointerMove={isaretciHareket}
        onPointerUp={isaretciKalkti}
        onPointerCancel={isaretciKalkti}
      >
        <svg
          viewBox={`${minX} ${minY} ${w} ${h}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Dünya haritası, ${regions.length} bölge`}
          style={{
            transform: `translate(${gorunum.dx}px, ${gorunum.dy}px) scale(${gorunum.olcek})`,
            transformOrigin: 'center',
          }}
        >
          <defs>
            {/* Her bölge tipi için doku. objectBoundingBox: illüstrasyon her
            altıgenin kendi kutusuna sığdırılır, 61 karo için 5 görsel yüklenir.
 
            patternContentUnits ŞART ve unutulmuştu. patternUnits karonun
            KUTUSUNU ölçekliyor; içindeki <image>'ın birimini ayrı bir
            öznitelik belirliyor ve varsayılanı userSpaceOnUse. Yani
            width="1" "kutunun tamamı" değil "1 piksel" demekti — görseller
            haritada hiç görünmüyordu ve altıgenler düz renk kalıyordu.
            Hata sessizdi: eksik görsel gibi görünüyordu, oysa görsel
            yüklenip 1 pikselde çiziliyordu. */}
            {tipler.map((d) => (
              <pattern
                key={d}
                id={`doku-${d}`}
                patternUnits="objectBoundingBox"
                patternContentUnits="objectBoundingBox"
                width="1"
                height="1"
              >
                {/* Altta sahne yedeği (yakınlaştırılmış), üstte gerçek karo.
                Karo dosyası varsa sahneyi tamamen örter. */}
                <image
                  href={`/gorseller/bolgeler/${TIP_SAHNE[d] ?? d}.webp`}
                  x="-0.8"
                  y="-0.8"
                  width="2.6"
                  height="2.6"
                  preserveAspectRatio="xMidYMid slice"
                />
                {/* Karo YAKINLAŞTIRILARAK basılıyor (1 değil KARO_YAKINLIK).
                Karolar birer sahne: bütün bir köy, bütün bir kale, bütün bir
                ocak. 60 piksellik bir altıgene sığdırıldığında o detay lapaya
                dönüyor ve harita gürültü oluyordu. Yakınlaştırınca altıgen
                sahnenin bir PARÇASINI gösteriyor, yani doku oluyor: buğday
                buğday, taş taş görünüyor.

                Bilgi kaybı yok, çünkü bilgi zaten dokuda değil: "burası
                maden mi tarla mı" sorusuna altıgenin üstündeki ikon cevap
                veriyor. Doku atmosfer taşıyor. */}
                <image
                  href={`/gorseller/harita/${d}.webp`}
                  x={(1 - KARO_YAKINLIK) / 2}
                  y={(1 - KARO_YAKINLIK) / 2}
                  width={KARO_YAKINLIK}
                  height={KARO_YAKINLIK}
                  preserveAspectRatio="xMidYMid slice"
                />
              </pattern>
            ))}

            {/* Deniz: boyalı karo, döşenerek. userSpaceOnUse çünkü deniz tek
            bir altıgen değil tüm tuval — objectBoundingBox olsaydı tek bir
            görsel tuvale gerilir ve dalgalar dev gibi çıkardı. */}
            <pattern
              id="deniz-doku"
              patternUnits="userSpaceOnUse"
              width={DENIZ_KARO}
              height={DENIZ_KARO}
            >
              <image href="/gorseller/harita/deniz.webp" width={DENIZ_KARO} height={DENIZ_KARO} />
            </pattern>

            {/* Karo gelmezse eski gradyan görünür; ayrıca karonun üstüne ince
            bir vinyet olarak biniyor, kenarlar ortadan koyu kalsın diye. */}
            <radialGradient id="deniz" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#1d3a4a" />
              <stop offset="100%" stopColor="#12222c" />
            </radialGradient>

            <pattern id="benim" patternUnits="userSpaceOnUse" width="7" height="7">
              <path d="M0,7 L7,0" stroke="#f5b731" strokeWidth="1.8" opacity="0.75" />
            </pattern>
            <pattern id="dusman" patternUnits="userSpaceOnUse" width="7" height="7">
              <circle cx="3.5" cy="3.5" r="1.4" fill="#e8524d" opacity="0.7" />
            </pattern>

            {/* Kara parçasının dışına düşen yumuşak gölge: adayı denizden ayırır. */}
            <filter id="kara-golge" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="3"
                stdDeviation="4"
                floodColor="#0a1419"
                floodOpacity="0.8"
              />
            </filter>
          </defs>

          {/* --- Deniz --- */}
          <rect x={minX} y={minY} width={w} height={h} fill="url(#deniz)" />
          <rect x={minX} y={minY} width={w} height={h} fill="url(#deniz-doku)" opacity="0.85" />
          <rect
            x={minX}
            y={minY}
            width={w}
            height={h}
            fill="url(#deniz)"
            opacity="0.45"
            style={{ mixBlendMode: 'multiply' }}
          />

          {/* --- Kıyı şeridi ---
          Genişletilmiş altıgenler üst üste binerek tek bir kara parçası
          oluşturuyor. Önce kıyı rengi, sonra üstüne kara: aradaki fark
          adanın etrafında bir sahil şeridi bırakıyor. */}
          <g filter="url(#kara-golge)">
            {m.map(({ r, x, y }) => (
              <path key={`k${r.id}`} d={hexYol(x, y, BOYUT + kiyiTasmasi(r.id))} fill="#b99a63" />
            ))}
          </g>
          {m.map(({ r, x, y }) => (
            <path
              key={`z${r.id}`}
              d={hexYol(x, y, BOYUT + kiyiTasmasi(r.id) * 0.45)}
              fill="#6a5334"
            />
          ))}

          {/* --- Bölgeler --- */}
          {m.map(({ r, x, y }) => {
            const secili = seciliId === r.id;
            const taht = r.type === 'taht';
            const doku = r.type;
            return (
              <g
                key={r.id}
                onClick={() => {
                  // Sürükledikten sonraki tıklama seçim değil: haritayı
                  // kaydırırken parmağın kalktığı bölge seçilirse kaydırmak
                  // imkânsız hâle gelir.
                  if (!suruklendiMi()) onSec(r.id);
                }}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSec(r.id);
                }}
              >
                <title>
                  {r.name} — {r.type}, seviye {r.level},{' '}
                  {r.owner ? `sahibi ${r.owner.name}` : 'sahipsiz'}, {r.distance} hex
                </title>

                {/* İllüstrasyon, üstüne arazi tonu: 61 karo tam parlaklıkta
                çizilirse harita gürültüye dönüyor.

                Ton 0.34'ten 0.24'e indirildi. Karolar gelmeden önce bu
                katman altıgenin RENGİYDİ, o yüzden koyu olması gerekiyordu;
                karolar gelince aynı koyuluk dokuyu çamura çeviriyor. Yazının
                okunurluğunu bu katman değil, aşağıdaki metnin kendi konturu
                koruyor (paintOrder="stroke"). */}
                <path d={hexYol(x, y, BOYUT * 0.94)} fill={`url(#doku-${doku})`} />
                <path
                  d={hexYol(x, y, BOYUT * 0.94)}
                  fill={TIP_ZEMIN[r.type] ?? '#3a3025'}
                  opacity={taht ? 0.14 : 0.24}
                />

                {r.isMine && <path d={hexYol(x, y, BOYUT * 0.94)} fill="url(#benim)" />}
                {r.owner && !r.isMine && (
                  <path d={hexYol(x, y, BOYUT * 0.94)} fill="url(#dusman)" />
                )}

                <path
                  d={hexYol(x, y, BOYUT * 0.94)}
                  fill="none"
                  stroke={secili ? '#f5b731' : taht ? '#f5b731' : '#2a2118'}
                  strokeWidth={secili ? 3.5 : taht ? 2.2 : 1}
                  opacity={secili || taht ? 1 : 0.55}
                />

                {/* İttifakın ortak hedefi: kesik çizgili halka.
                Seçili halkadan (düz, kalın) ve tahttan (altın) ayrı bir
                dil kullanıyor — üçü aynı anda görünebilir ve hangisinin
                ne olduğu birbirine karışmamalı. */}
                {ittifakHedefiId === r.id && (
                  <path
                    d={hexYol(x, y, BOYUT * 0.8)}
                    fill="none"
                    stroke="#7cc4f0"
                    strokeWidth="2.5"
                    strokeDasharray="5 4"
                    opacity="0.95"
                  />
                )}

                {/* Taht sahipliyse ikinci altın halka: haritanın tek "kimde?"
                sorusu bu altıgende sorulur, cevabı uzaktan okunabilmeli. */}
                {taht && r.owner && (
                  <path
                    d={hexYol(x, y, BOYUT * 0.68)}
                    fill="none"
                    stroke="#f5b731"
                    strokeWidth="1.5"
                    opacity="0.7"
                  />
                )}

                {/* Tip ikonu: 41 pikselde "burası maden mi tarla mı" sorusuna
                cevap veren şey doku değil siluet. Doku atmosferi, ikon
                bilgiyi taşıyor. */}
                <g
                  fill={taht ? '#ffe08a' : '#f2e7d5'}
                  opacity={taht ? 0.95 : 0.8}
                  // Karartma azalınca parlak karolarda (buğday) açık renkli
                  // siluet kayboluyordu; ince koyu kontur ikonu her dokuda
                  // ayakta tutuyor.
                  stroke="#140d08"
                  strokeWidth="1.6"
                  paintOrder="stroke"
                >
                  <TipIkonu tip={r.type} x={x} y={y - BOYUT * 0.16} />
                </g>

                {/* Bölge adı. İsimsiz altıgenler "neyin ne olduğu anlaşılmıyor"
                duygusunun doğrudan sebebiydi. */}
                <text
                  x={x}
                  y={y + BOYUT * 0.42}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#f7ecd8"
                  stroke="#140d08"
                  strokeWidth="2.2"
                  paintOrder="stroke"
                >
                  {tamAd ? r.name : kisaAd(r.name)}
                </text>

                {/* Seviye yalnızca yükseltilmişse yazılır. Her altıgende "Sv1"
                görmek haritayı yine bir sayı duvarına çeviriyordu; oyuncunun
                "sadece rakamlara bakıyorum" dediği şey buydu. */}
                {(r.level > 1 || r.shielded) && (
                  <text
                    x={x}
                    y={y + BOYUT * 0.66}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fontSize="9"
                    fontWeight="800"
                    fill={taht ? '#ffd76a' : '#e8d9bd'}
                    stroke="#140d08"
                    strokeWidth="2.4"
                    paintOrder="stroke"
                  >
                    {r.level > 1 ? `Sv${r.level}` : ''}
                    {r.shielded ? ' ⛨' : ''}
                  </text>
                )}

                {r.owner && <SahipEtiketi ad={r.owner.name} x={x} y={y} benim={r.isMine} />}
              </g>
            );
          })}

          {/* --- Vilayet sınırları ---
          Yalnız FARKLI vilayete (ya da denize) bakan kenarlar çiziliyor.
          İç kenarları da çizseydik harita yine bir petek olurdu; sınır ancak
          ayırdığı şey görünürse sınırdır. */}
          <g className="pointer-events-none">
            {m.map(({ r, x, y }) =>
              KENAR_YONU.map(([dq, dr], i) => {
                const komsu = vilayetHaritasi.get(`${r.q + dq},${r.r + dr}`);
                if (komsu === r.province) return null;
                const [x1, y1] = kose(x, y, BOYUT * 0.97, i);
                const [x2, y2] = kose(x, y, BOYUT * 0.97, i + 1);
                return (
                  <line
                    key={`v${r.id}-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={VILAYET_RENGI[r.province] ?? '#cbb894'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                );
              }),
            )}
          </g>

          {/* --- Vilayet adları ---
          Gerçek haritalardaki gibi aralıklı ve soluk. Bölgelerin ÜSTÜNE
          çiziliyor: ilk denemede altına koymuştuk ve altıgen dolguları
          yazının üstünü tamamen kapatıyordu — vilayet adları haritada hiç
          görünmüyordu. */}
          <g className="pointer-events-none select-none">
            {vilayetMerkezleri.map((v) => (
              <text
                key={v.key}
                x={v.x}
                y={v.y}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                letterSpacing="2.5"
                fill={VILAYET_RENGI[v.key] ?? '#cbb894'}
                /* Koyu kontur olmadan yazı arazi dokusunda kayboluyordu:
                   ilk denemede vilayet adları haritada HİÇ okunmuyordu. */
                stroke="#0f0a06"
                strokeWidth="3"
                paintOrder="stroke"
                opacity="0.85"
              >
                {(VILAYET_ADI[v.key] ?? v.key).toLocaleUpperCase('tr')}
              </text>
            ))}
          </g>

          {/* Yürüyüşler. Ordunun yolda olduğunu yalnızca listeden anlamak
          beklemeyi boş bir bekleyişe çeviriyordu; harita üzerinde ilerleyen
          bir işaret aynı süreyi gerilime çeviriyor. İşaretin yeri gerçek:
          yola çıkış ve varış zamanından oranlanıyor. */}
          <g className="pointer-events-none">
            {yuruyusler.map((y) => {
              const hedef = m.find((a) => a.r.id === y.toRegionId);
              if (!hedef) return null;

              const bas = new Date(y.departAt).getTime();
              const bit = new Date(y.arriveAt).getTime();
              const oran =
                bit > bas ? Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas))) : 1;

              const donus = y.kind === 'return';
              const bx = donus ? hedef.x : ev.x;
              const by = donus ? hedef.y : ev.y;
              const hx = donus ? ev.x : hedef.x;
              const hy = donus ? ev.y : hedef.y;
              const x = bx + (hx - bx) * oran;
              const yy = by + (hy - by) * oran;
              const renk = donus ? '#3ddc84' : '#e8524d';

              return (
                <g key={y.id}>
                  <line
                    x1={bx}
                    y1={by}
                    x2={hx}
                    y2={hy}
                    stroke={renk}
                    strokeWidth="1.4"
                    strokeDasharray="4 4"
                    opacity="0.6"
                  />
                  <circle cx={x} cy={yy} r={5} fill={renk} stroke="#17100c" strokeWidth="2" />
                </g>
              );
            })}
          </g>

          {/* Malikâne çıpası */}
          <g className="pointer-events-none">
            <circle cx={ev.x} cy={ev.y} r={9} fill="#f5b731" stroke="#17100c" strokeWidth="3" />
            <circle cx={ev.x} cy={ev.y} r={3.5} fill="#17100c" />
          </g>
        </svg>
      </div>

      {/* Yakınlaştırma düğmeleri: parmakla yakınlaştırmayı bilmeyen ya da
          tek eliyle oynayan oyuncu da haritaya yaklaşabilmeli. */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
        <YakinlikDugmesi
          etiket="Yakınlaştır"
          isaret="+"
          onTikla={() => setGorunum((g) => sinirla({ ...g, olcek: g.olcek * 1.5 }))}
        />
        <YakinlikDugmesi
          etiket="Uzaklaştır"
          isaret="−"
          onTikla={() => setGorunum((g) => sinirla({ ...g, olcek: g.olcek / 1.5 }))}
        />
        {gorunum.olcek > 1 && (
          <YakinlikDugmesi
            etiket="Haritayı sığdır"
            isaret="⊡"
            onTikla={() => setGorunum({ olcek: 1, dx: 0, dy: 0 })}
          />
        )}
      </div>
    </div>
  );
}

function YakinlikDugmesi({
  etiket,
  isaret,
  onTikla,
}: {
  etiket: string;
  isaret: string;
  onTikla: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTikla}
      aria-label={etiket}
      title={etiket}
      // 44px: dokunma hedefi alt sınırı (tools/gorsel-denetim.mjs bunu
      // ölçüyor ve ilk halini 36px diye yakaladı).
      className="bas flex h-11 w-11 items-center justify-center rounded-lg border border-kenar bg-gece/70 text-[16px] leading-none text-solgun backdrop-blur"
    >
      {isaret}
    </button>
  );
}

/**
 * Bölge sahibinin adı, altıgenin üst kenarına oturan küçük bir etiket.
 *
 * Ad kısaltılıyor ve arkasına koyu bir zemin konuyor: yan yana iki sahipli
 * bölge olduğunda etiketler birbirine giriyor ve ikisi de okunmaz hâle
 * geliyordu. Zemin ayrıca etiketi kendi altıgenine bağlıyor.
 */
function SahipEtiketi({ ad, x, y, benim }: { ad: string; x: number; y: number; benim: boolean }) {
  const kisa = ad.length > 8 ? `${ad.slice(0, 7)}…` : ad;
  const g = kisa.length * 4.2 + 7;
  const ty = y - BOYUT * 0.52;
  return (
    <g className="pointer-events-none select-none">
      <rect
        x={x - g / 2}
        y={ty - 6.8}
        width={g}
        height={9.5}
        rx={3}
        fill="#17100c"
        opacity="0.9"
        stroke={benim ? '#f5b731' : '#e89a5a'}
        strokeWidth="0.6"
      />
      <text
        x={x}
        y={ty}
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill={benim ? '#f5b731' : '#e89a5a'}
      >
        {kisa}
      </text>
    </g>
  );
}
