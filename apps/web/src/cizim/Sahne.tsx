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
 *
 * Geniş sahneler (`hareket`) canlı: suyun üstünde kayan parıltı, titreyen
 * ateş ve pencere ışığı, bacadan yükselen duman, dalgalanan bayrak. GPU resmi bir kez
 * çiziliyor; hareket onun üstünde CSS katmanları (yalnız dönüşüm ve
 * saydamlık: tarayıcı bunları yeniden boyamadan oynatıyor). Hareket
 * kısıtlıysa (`prefers-reduced-motion`) hiçbiri yok, duman durağan çiziliyor.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  EN_BUYUK,
  atlasDuzeni,
  glCiz,
  glKatmanlari,
  glOnYukle,
  glVarMi,
  type Katmanlar,
} from './gl';
import { ciz, kutusu, type Cizilmis, type Kamera, type Model } from './uc';

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

/**
 * Tarifli, kendi çerçevesine oturan çizimin (birlik, eşya) görüş kutusu:
 * GPU varken çokgen hesaplanmıyor, yalnız kutusu. Model küçük; kutu bir kez.
 */
const KUTULAR = new Map<string, [number, number, number, number]>();
function kutuAl(anahtar: string, uret: () => Model, kamera?: Kamera) {
  let k = KUTULAR.get(anahtar);
  if (!k) KUTULAR.set(anahtar, (k = kutusu(modelAl(anahtar, uret), kamera)));
  return k;
}

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

/** Yumrunun yarıçapı (dünya birimi); CSS'te 0,4 katından 1,9 katına büyüyor. */
const DUMAN_YARICAP = 0.85;
/** Bir yumrunun ömrü (sn) ve bir kaynaktan aynı anda kaç yumru (eşit aralıkla). */
const DUMAN_SURE = 4.8;
const DUMAN_ADET = 4;

/**
 * Hareket kısıtlı mı (işletim sistemi ayarı). Her çizimde bakılıyor;
 * ayar değişince sahne bir sonraki çizimde durağan olur.
 */
function hareketKisitli(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

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
  tarif: boolean,
  uret: () => Model,
  kamera: Kamera | undefined,
  v: [number, number, number, number],
  kirp: boolean,
  tilt: number | undefined,
  hareket: boolean,
  onceDurgun: boolean,
  ref: React.RefObject<SVGSVGElement | null>,
  basarisiz: () => void,
): string | null {
  const durgunTaban = anahtar + '|' + v.join(',') + (tilt !== undefined ? '|t' + tilt : '');
  const taban = durgunTaban + (hareket ? '|h' : '');
  // Önce durağan: canlı resim sonra, sıra boşalınca (bkz. `Sahne.onceDurgun`).
  const iki = hareket && onceDurgun;
  const [resim, setResim] = useState<string | null>(
    () => RESIMLER.get(taban)?.url ?? (iki ? (RESIMLER.get(durgunTaban)?.url ?? null) : null),
  );
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
      // Tarifliyse model işçide kuruluyor (`tarif.ts`): buradan yalnız anahtar.
      const istek = (h: boolean) => () => ({
        ...(tarif ? { tarif: anahtar } : { model: modelAl(anahtar, u) }),
        kamera: k,
        kutu: v,
        en,
        boy,
        olcek: en / (vw * cssBirim),
        tilt,
        hareket: h,
      });
      const sakla = (t: string, url: string) => {
        const simdiki = RESIMLER.get(t);
        if (!simdiki || simdiki.en < en) RESIMLER.set(t, { en, url });
        return RESIMLER.get(t)!.url;
      };
      if (!iki) {
        glCiz(`${taban}|${en}x${boy}`, istek(hareket)).then((url) => {
          if (!url) {
            if (!iptal) guncel.current.basarisiz();
            return;
          }
          const son = sakla(taban, url);
          if (!iptal) setResim(son);
        });
        return;
      }
      // Önce durağan resim (hızlı; bütün parçalar içinde), sonra canlısı.
      let canliGeldi = false;
      const durgun = RESIMLER.get(durgunTaban);
      if (durgun && durgun.en >= en) setResim(durgun.url);
      else
        glCiz(`${durgunTaban}|${en}x${boy}`, istek(false)).then((url) => {
          if (!url) {
            if (!iptal) guncel.current.basarisiz();
            return;
          }
          const son = sakla(durgunTaban, url);
          if (!iptal && !canliGeldi) setResim(son);
        });
      glCiz(`${taban}|${en}x${boy}`, istek(true), {
        sonra: true,
        istenmiyor: () => iptal,
      }).then(async (url) => {
        // Canlı gelmediyse (vazgeçildi ya da çizilemedi) durağan kalıyor.
        if (!url) return;
        const son = sakla(taban, url);
        await glOnYukle(son);
        if (iptal) return;
        canliGeldi = true;
        setResim(son);
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
  }, [etkin, taban, durgunTaban, iki, tarif, kirp, tilt, hareket, ref]);

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

/* ── Hareket ───────────────────────────────────────────────────────── */

/** Tohumlu rastgele: dokular her açılışta aynı. */
function tohumlu(t: number): () => number {
  return () => (t = (t * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/**
 * Dikişsiz bir döşeme karosu çizer (kenardan taşan leke öbür yandan
 * giriyor). Tuval yoksa (test ortamı) null: o katman çizilmiyor.
 */
function karo(en: number, boy: number, ciz: (c: CanvasRenderingContext2D) => void): string | null {
  try {
    const t = document.createElement('canvas');
    t.width = en;
    t.height = boy;
    const c = t.getContext('2d');
    if (!c) return null;
    ciz(c);
    return t.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Yumuşak kenarlı elips leke; karonun dört yanına sarılarak. */
function leke(
  c: CanvasRenderingContext2D,
  en: number,
  boy: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  renk: string,
) {
  for (const ox of [-en, 0, en])
    for (const oy of [-boy, 0, boy]) {
      c.save();
      c.translate(x + ox, y + oy);
      c.scale(rx, ry);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, renk);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 1, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
}

/** Suyun parıltısı: yatık, ince ışık çizgileri (ekran pikselinde; suyun dalgasıyla aynı boy). */
const SU_KARO: [number, number] = [256, 128];
let suKaro: string | null | undefined;
function suKarosu(): string | null {
  return (suKaro ??= karo(...SU_KARO, (c) => {
    const r = tohumlu(7);
    for (let i = 0; i < 36; i++)
      leke(
        c,
        ...SU_KARO,
        r() * SU_KARO[0],
        r() * SU_KARO[1],
        7 + r() * 12,
        0.8 + r() * 0.7,
        `rgba(255,255,255,${(0.35 + r() * 0.45).toFixed(2)})`,
      );
  }));
}

/**
 * Çimenin rüzgâr dalgası: rüzgâra dik uzamış, iri ve çok yumuşak açık
 * bantlar (eğilen otların ışığı yakalaması), aralarında hafif gölge. Karo
 * çimen maskesinin (yer ve ot tutamları) üstünden rüzgâr yönünde kayıyor;
 * dokuyu otların kendisi veriyor. Rüzgâr dumanla aynı yönde (sola).
 */
const RUZGAR_KARO: [number, number] = [640, 320];
let ruzgarKaro: string | null | undefined;
function ruzgarKarosu(): string | null {
  return (ruzgarKaro ??= karo(...RUZGAR_KARO, (c) => {
    const r = tohumlu(23);
    for (let i = 0; i < 9; i++) {
      const acik = i % 3 < 2;
      leke(
        c,
        ...RUZGAR_KARO,
        r() * RUZGAR_KARO[0],
        r() * RUZGAR_KARO[1],
        34 + r() * 40,
        90 + r() * 80,
        acik
          ? `rgba(246,250,196,${(0.5 + r() * 0.3).toFixed(2)})`
          : `rgba(20,40,8,${(0.3 + r() * 0.15).toFixed(2)})`,
      );
    }
  }));
}

/**
 * Işığın titreme deseni: iri, yumuşak lekeler ve tersi. Işık katmanının iki
 * kopyası bunlarla örtülü ve ayrı ritimde titriyor: yan yana iki ateş aynı
 * anda sönüp parlamıyor.
 */
const ISIK_KARO = 150;
let isikKarolari: [string, string] | null | undefined;
function isikKarosu(): [string, string] | null {
  if (isikKarolari !== undefined) return isikKarolari;
  const lekeler = (c: CanvasRenderingContext2D) => {
    const r = tohumlu(11);
    for (let i = 0; i < 7; i++)
      leke(
        c,
        ISIK_KARO,
        ISIK_KARO,
        r() * ISIK_KARO,
        r() * ISIK_KARO,
        26 + r() * 20,
        26 + r() * 20,
        '#fff',
      );
  };
  const a = karo(ISIK_KARO, ISIK_KARO, lekeler);
  const b = karo(ISIK_KARO, ISIK_KARO, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, ISIK_KARO, ISIK_KARO);
    c.globalCompositeOperation = 'destination-out';
    lekeler(c);
  });
  return (isikKarolari = a && b ? [a, b] : null);
}

/** CSS maskesi, önekli (Safari) ve öneksiz. */
function maske(url: string, boy: string, tekrar: string): CSSProperties {
  return {
    maskImage: `url(${url})`,
    WebkitMaskImage: `url(${url})`,
    maskSize: boy,
    WebkitMaskSize: boy,
    maskRepeat: tekrar,
    WebkitMaskRepeat: tekrar,
  };
}

/**
 * Resmin üstündeki canlı katmanlar. Kutu ölçülüyor: GPU resmi görüş
 * kutusunu doldurup taşanı kırpıyor (`kirp`) ya da içine sığıyor; katmanlar
 * aynı dikdörtgene oturuyor.
 */
function HareketKatmani({
  v,
  kirp,
  katman,
}: {
  v: [number, number, number, number];
  kirp: boolean;
  katman: Katmanlar | undefined;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [olcu, setOlcu] = useState<[number, number] | null>(null);
  const dumanlar = katman?.dumanlar ?? [];
  // Ekranda olmayan sahne durur: uzun bir listede (akın diyarları) görünmeyen
  // kapakların onlarca katmanı boşuna oynamasın.
  const [gorunur, setGorunur] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([g]) => setGorunur(g?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Boyamadan önce ölç: bayrak kumaşı ana resimde yok, bir kare bile
  // bayraksız direk görünmesin.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const olc = () => {
      const r = el.getBoundingClientRect();
      setOlcu((o) => (o && o[0] === r.width && o[1] === r.height ? o : [r.width, r.height]));
    };
    olc();
    const ro = new ResizeObserver(olc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let icerik: React.ReactNode = null;
  if (olcu && olcu[0] > 1 && olcu[1] > 1) {
    const [W, H] = olcu;
    const [vx, vy, vw, vh] = v;
    // Görüş kutusunun bir birimi kaç CSS pikseli.
    const s = kirp ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const su = katman?.su && suKarosu();
    const ruzgar = katman?.cimen && ruzgarKarosu();
    const isik = katman?.isik ? isikKarosu() : null;
    icerik = (
      <span
        className="hareket-cerceve"
        style={{ left: (W - vw * s) / 2, top: (H - vh * s) / 2, width: vw * s, height: vh * s }}
      >
        {ruzgar && (
          <span className="hareket-cimen" style={maske(katman!.cimen!, '100% 100%', 'no-repeat')}>
            <span className="hareket-cimen-a" style={{ backgroundImage: `url(${ruzgar})` }} />
          </span>
        )}
        {su && (
          <span className="hareket-su" style={maske(katman!.su!, '100% 100%', 'no-repeat')}>
            <span className="hareket-su-a" style={{ backgroundImage: `url(${su})` }} />
            <span className="hareket-su-b" style={{ backgroundImage: `url(${su})` }} />
          </span>
        )}
        {katman?.isik &&
          (isik ?? [null]).map((m, i) => (
            <img
              key={i}
              src={katman.isik}
              alt=""
              className={i ? 'hareket-isik hareket-isik-b' : 'hareket-isik'}
              style={m ? maske(m, `${ISIK_KARO}px`, 'repeat') : undefined}
            />
          ))}
        {katman?.bayrak && <Bayraklar b={katman.bayrak} o={(vw * s) / katman.bayrak.en} />}
        {dumanlar.map((d, i) =>
          Array.from({ length: DUMAN_ADET }, (_, j) => (
            <span
              key={i * DUMAN_ADET + j}
              className="hareket-duman"
              style={
                {
                  left: (d.x - vx) * s,
                  top: (d.y - vy) * s,
                  width: 2 * DUMAN_YARICAP * s,
                  height: 2 * DUMAN_YARICAP * s,
                  margin: -DUMAN_YARICAP * s,
                  '--dx': `${(d.dx * s).toFixed(1)}px`,
                  '--dy': `${(d.dy * s).toFixed(1)}px`,
                  '--renk': d.renk,
                  animationDuration: `${DUMAN_SURE}s`,
                  // Kaynaklar ayrı evrede: bütün bacalar aynı anda tütmesin.
                  animationDelay: `${(-((j / DUMAN_ADET + i * 0.37) % 1) * DUMAN_SURE).toFixed(2)}s`,
                } as CSSProperties
              }
            />
          )),
        )}
      </span>
    );
  }
  return (
    <span
      ref={ref}
      aria-hidden
      className={gorunur ? 'hareket' : 'hareket hareket-durgun'}
      style={{ gridArea: '1 / 1' }}
    >
      {icerik}
    </span>
  );
}

/**
 * Dalgalanan bayraklar, salınan sancak, ağaç ve asker: her biri kendi
 * kutusunda, atlastaki satırının kareleri adım adım kayıyor (yalnız dönüşüm).
 * `o`: çıktı pikseli başına CSS pikseli.
 *
 * Kayan katman yalnız o parçanın kare şeridi kadar: atlas arka plan olarak
 * şeridin yerinden gösteriliyor. Önceden her parça atlasın TAMAMI boyunda
 * bir katmandı; ağaçlı bir zeminde yirmi üç parça ~74 megapiksellik katman
 * demekti ve telefonun GPU belleği tükenip sayfa takılıyordu.
 */
function Bayraklar({ b, o }: { b: NonNullable<Katmanlar['bayrak']>; o: number }) {
  const duzen = atlasDuzeni(b.kutular, b.kareSayilari);
  return (
    <>
      {b.kutular.map(([x, y, w, h], i) => {
        if (!(w > 0 && h > 0)) return null;
        const k = b.kareSayilari[i]!;
        const sutun = duzen.sutun[i]!;
        const satir = k / sutun;
        const sure = b.sureler[i]!;
        // Her biri ayrı evrede: rüzgâr hepsini aynı anda savurmasın.
        const gecikme = `${(-((i * 0.29) % 1) * sure).toFixed(2)}s`;
        const serit = (
          <span
            style={
              {
                width: sutun * w * o,
                height: satir * h * o,
                backgroundImage: `url(${b.url})`,
                backgroundSize: `${duzen.en * o}px ${duzen.boy * o}px`,
                backgroundPosition: `${-duzen.yer[i]![0] * o}px ${-duzen.yer[i]![1] * o}px`,
                '--kay': `${(-sutun * w * o).toFixed(2)}px`,
                animationDuration: `${sure / satir}s`,
                animationTimingFunction: `steps(${sutun})`,
                animationDelay: gecikme,
              } as CSSProperties
            }
          />
        );
        return (
          <span
            key={i}
            className="hareket-bayrak"
            style={{ left: x * o, top: y * o, width: w * o, height: h * o }}
          >
            {satir > 1 ? (
              // Uzun tur (canlı parça) atlasta satır satır: şerit bir
              // satırın karelerini kayarken sarmalayıcı satırdan satıra iniyor.
              <span
                className="hareket-satir"
                style={
                  {
                    width: sutun * w * o,
                    height: satir * h * o,
                    '--kayY': `${(-satir * h * o).toFixed(2)}px`,
                    animationDuration: `${sure}s`,
                    animationTimingFunction: `steps(${satir})`,
                    animationDelay: gecikme,
                  } as CSSProperties
                }
              >
                {serit}
              </span>
            ) : (
              serit
            )}
          </span>
        );
      })}
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
  onceDurgun = false,
  tilt,
  hareket = false,
  tarif = false,
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
   * Hareketli sahnede önce DURAĞAN resim (hızlı: bütün parçalar içinde
   * çizili), canlı resim ve katmanları sonra: öncelikli işler bitince,
   * sayfadan çıkılmadıysa (`gl.glCiz` `sonra`); gelince çözülüp yerine
   * konuyor. Canlı kareleri ağır olan sahne için (yerleşke: talim alanı,
   * tarla): açılış onları beklemiyor, sonraki ekran da.
   */
  onceDurgun?: boolean;
  /**
   * Tilt-shift (yalnız GPU): keskin kalan odak bandının yarı yüksekliği
   * (boya oran). Geniş sahneler (bölge afişi, ekran zemini, diyar kapağı)
   * maket gibi okunuyor; figür ve bina simgesinde yok.
   */
  tilt?: number;
  /**
   * Canlı sahne (yalnız GPU, hareket kısıtlı değilse): su parıltısı, ışık
   * titremesi, yükselen duman. Kutu bir sarmalayıcıya geçiyor (katmanlar
   * resmin üstünde); `className` ve `style` sarmalayıcının.
   */
  hareket?: boolean;
  /**
   * `anahtar` bir çizim tarifi (`tarif.ts`): GPU varken model, ağ ve bayrak
   * kareleri işçide kuruluyor, çokgen hiç hesaplanmıyor. Ana iş parçacığına
   * yalnız anahtar düşüyor; resim gelene kadar kare boş. GPU yoksa (ya da
   * düşerse) çokgenler `uret`ten, eskisi gibi.
   */
  tarif?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [gpuYok, setGpuYok] = useState(false);
  const gpu = glVarMi() && !gpuYok;
  const cokgensiz = gpu && tarif;
  const bekle = !cokgensiz && ertele && kutu !== undefined && !ONBELLEK.has(anahtar);
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

  const c = bekle || cokgensiz ? null : cizimiAl(anahtar, uret, kamera);
  const kendi = kutu ?? (c ? c.kutu : kutuAl(anahtar, uret, kamera));
  const v: [number, number, number, number] = kutu ?? (kare ? kareyeTamamla(kendi) : kendi);
  const canli = hareket && gpu && !hareketKisitli();
  const resim = useGpuResmi(
    gpu,
    anahtar,
    cokgensiz,
    uret,
    kamera,
    v,
    kirp,
    tilt,
    canli,
    onceDurgun,
    ref,
    () => setGpuYok(true),
  );

  const svg = (
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
      className={canli ? 'h-full w-full' : className}
      style={canli ? { gridArea: '1 / 1' } : style}
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
  if (!canli) return svg;
  // Izgara: resim ve katmanlar aynı hücrede üst üste (konumlama yok; çağıranın
  // `absolute` gibi sınıfları sarmalayıcıda aynen çalışıyor).
  return (
    <span className={className} style={{ ...style, display: 'grid', gridTemplate: IZGARA }}>
      {svg}
      {resim && <HareketKatmani v={v} kirp={kirp} katman={glKatmanlari(resim)} />}
    </span>
  );
});

/** Tek hücre, kutuyu dolduran. */
const IZGARA = ['minmax(0,1fr)', 'minmax(0,1fr)'].join(' / ');
