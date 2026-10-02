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
  aoYaricapi,
  atlasDuzeni,
  glBirak,
  glCiz,
  glKalici,
  glKaydet,
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

/** Gösterilen resmin piksel eni (yakınlık yamasının ölçüsü). */
function resimEni(url: string | null): number | undefined {
  if (!url) return undefined;
  for (const r of RESIMLER.values()) if (r.url === url) return r.en;
  return undefined;
}

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
  sicak: number | undefined,
  hareket: boolean,
  onceDurgun: boolean,
  kalici: boolean,
  ref: React.RefObject<SVGSVGElement | null>,
  basarisiz: () => void,
): string | null {
  const durgunTaban =
    anahtar +
    '|' +
    v.join(',') +
    (tilt !== undefined ? '|t' + tilt : '') +
    (sicak !== undefined ? '|s' + sicak : '');
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
        sicak,
        hareket: h,
      });
      const sakla = (t: string, url: string) => {
        const simdiki = RESIMLER.get(t);
        if (!simdiki || simdiki.en < en) RESIMLER.set(t, { en, url });
        return RESIMLER.get(t)!.url;
      };
      if (!iki) {
        glCiz(`${taban}|${en}x${boy}`, istek(hareket), { kalici }).then((url) => {
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
        glCiz(`${durgunTaban}|${en}x${boy}`, istek(false), { kalici }).then((url) => {
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
        kalici,
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
  }, [etkin, taban, durgunTaban, iki, tarif, kirp, tilt, sicak, hareket, kalici, ref]);

  return etkin ? resim : null;
}

/* ── Yakınlık yaması ───────────────────────────────────────────────── */

type Kutu = [number, number, number, number];

/** Yamanın görünen bölgenin her yanından taşan payı (bölgenin boyuna oran). */
const YAMA_PAYI = 0.15;
/** Yama ancak ana resimden bu kat yoğunsa çiziliyor: azı göze görünmüyor. */
const YAMA_KAZANC = 1.25;

interface Yama {
  /** `glCiz` anahtarı: yerine yenisi konunca bellekten bırakılıyor. */
  is: string;
  url: string;
  kutu: Kutu;
  /** Canlı sahnenin ana resmi gibi mi (salınan parçasız); bkz. `GlIstek.yama`. */
  hareketli: boolean;
  /** İkinci aşama: yamaya giren salınan parçaların kendi kare atlası. */
  katman?: Katmanlar;
  /** Ekrandaki bir CSS pikseline düşen resim pikseli (çizildiği yakınlıkta). */
  yogunluk: number;
}

/** Bir yama oturumu: aynı bölgenin önce durağan, sonra parçalı resmi. */
interface YamaOturumu {
  iptal: boolean;
  anahtar: string;
  kutu: Kutu;
  yogunluk: number;
  hareketli: boolean;
  /** Bu oturumun istediği işler: vazgeçilen eski oturum onları bırakmasın. */
  isler: Set<string>;
}

/**
 * Sahne kapanınca son yama bırakılmıyor, burada bekliyor (tek tane): Şehir'e
 * dönen oyuncu aynı yerde ve yakınlıkta (`yerleskeYakinligi.sonGorunum`),
 * yama yeniden çizilmeden hemen keskin. Başka bir yama buraya girince ya
 * da bu yama yeniden gösterilip yerine yenisi gelince bırakılıyor.
 */
let SAKLI: { yama: Yama; oturum: YamaOturumu | null } | null = null;
const sakliMi = (anahtar: string) =>
  SAKLI !== null && SAKLI.yama.is.startsWith(anahtar + '|yama|') ? SAKLI : null;

/** Biten yamanın oturumu (parçalı aşaması gelmediyse yok: yeni oturum ister). */
function bitmisOturum(y: Yama): YamaOturumu | null {
  if (y.hareketli && y.katman === undefined) return null;
  return {
    iptal: false,
    anahtar: y.is.slice(0, y.is.indexOf('|yama|')),
    kutu: y.kutu,
    yogunluk: y.yogunluk,
    hareketli: y.hareketli,
    isler: new Set([y.is]),
  };
}

/** Kalıcı yamanın cihazdaki yuvası: sahne başına bir (son yama). */
const yamaYuvasi = (anahtar: string) => 'yama|' + anahtar;
/** Son yazılan yama, yuvaya göre: aynısı yeniden yazılmasın. */
const KAYDEDILEN = new Map<string, string>();

/** Kalıcı yamanın eki: hangi bölge, hangi yoğunlukta, nasıl. */
interface YamaEki {
  kutu: Kutu;
  yogunluk: number;
  hareketli: boolean;
}
/** Cihazdan okunan eki denetler (eski biçimli kayıt sessizce yok). */
function yamaEki(ek: unknown): YamaEki | null {
  const e = ek as Partial<YamaEki> | null;
  if (!e || !Array.isArray(e.kutu) || e.kutu.length !== 4) return null;
  if (!e.kutu.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  if (typeof e.yogunluk !== 'number' || typeof e.hareketli !== 'boolean') return null;
  return { kutu: e.kutu as Kutu, yogunluk: e.yogunluk, hareketli: e.hareketli };
}

const icinde = (a: Kutu, b: Kutu) =>
  b[0] >= a[0] - 1e-6 &&
  b[1] >= a[1] - 1e-6 &&
  b[0] + b[2] <= a[0] + a[2] + 1e-6 &&
  b[1] + b[3] <= a[1] + a[3] + 1e-6;

/**
 * Görünen bölgenin keskin resmi (bkz. `Sahne.yama`). Bölge ana resimden
 * belirgin daha yoğun çizilebiliyorsa, payıyla birlikte ekrandaki boyunun
 * piksel yoğunluğunda çiziliyor (en fazla `EN_BUYUK`).
 *
 * Canlı sahnede iki aşama: önce durağan resim (hızlı; salınan parça yok,
 * sahnenin katmanı onları ana resmin çözünürlüğünde oynatıyor), sonra
 * aynı bölge yamaya giren köylü ve bayrakların kare atlasıyla — onlar da
 * yamanın çözünürlüğünde oynuyor, sahnedeki kopyaları gizleniyor.
 *
 * Bölge eldeki (ya da yolda olan) yamanın içinde kaldıkça ve yoğunluk
 * yetiyorsa yeniden istenmiyor: küçük kaydırmalar bedava. Yenisi gelince
 * eskisi bellekten bırakılıyor; vazgeçilen yama sırası gelince çizilmiyor.
 */
function useYama(
  etkin: boolean,
  anahtar: string,
  tarif: boolean,
  uret: () => Model,
  kamera: Kamera | undefined,
  v: Kutu,
  gorunen: Kutu | undefined,
  tabanEn: number | undefined,
  hareketli: boolean,
  /** Canlı ana resim bekleniyor (durağanı gösteriliyor). */
  canliBekleniyor: boolean,
  tilt: number | undefined,
  sicak: number | undefined,
  kalici: boolean,
  ref: React.RefObject<SVGSVGElement | null>,
): Yama | null {
  // Saklı yama bu sahnenin ise oradan başla (okuma saf; sahiplik etkide).
  const [yama, setYama] = useState<Yama | null>(() => sakliMi(anahtar)?.yama ?? null);
  const guncel = useRef({ uret, kamera, yama, anahtar, kalici });
  guncel.current = { uret, kamera, yama, anahtar, kalici };
  const oturum = useRef<YamaOturumu | null>(sakliMi(anahtar)?.oturum ?? null);
  /** Sahne kapandı: yolda olan yama gelince de bırakılıyor. */
  const kapandi = useRef(false);
  const gorunenAnahtar = gorunen?.map((x) => x.toFixed(2)).join(',') ?? '';
  /**
   * Cihazdaki son yamaya bakıldı mı (kalıcıysa). Bakılmadan yeni oturum
   * açılmıyor: açılışta görünen bölge cihazdan okumadan önce bildirilirse
   * yeni bir yama çizilmeye başlıyor, saklı olan boşa gidiyordu.
   */
  const [bakildi, setBakildi] = useState(() => !kalici || sakliMi(anahtar) !== null);

  useEffect(() => {
    const el = ref.current;
    const vazgec = () => {
      if (oturum.current) oturum.current.iptal = true;
      oturum.current = null;
    };
    // Görünen bölge henüz bildirilmediyse (açılış) eldeki yama kalıyor;
    // cihazdaki yamaya da bakılmadıysa bekleniyor.
    if (!etkin || !el || !gorunen || !tabanEn || !bakildi) return;
    // Canlı ana resim gelmek üzere ve eldeki yama canlı: onu bekle (durağan
    // resme göre yeni bir yama çizilip hemen atılmasın).
    if (canliBekleniyor && guncel.current.yama?.hareketli) return;
    const [vx, vy, vw, vh] = v;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || vw <= 0) return;
    // Ekrandaki (dönüşüm dahil) ve düzendeki (dönüşümsüz) birim boyu.
    const ekranBirim = Math.min(r.width / vw, r.height / vh);
    const duzenBirim = Math.min(
      (el.clientWidth || r.width) / vw,
      (el.clientHeight || r.height) / vh,
    );
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const tabanYogunluk = tabanEn / (vw * ekranBirim);
    // Görünen bölge, sahneye kırpılmış; yama payıyla.
    const gx = Math.max(vx, gorunen[0]);
    const gy = Math.max(vy, gorunen[1]);
    const g: Kutu = [
      gx,
      gy,
      Math.min(vx + vw, gorunen[0] + gorunen[2]) - gx,
      Math.min(vy + vh, gorunen[1] + gorunen[3]) - gy,
    ];
    if (g[2] <= 0 || g[3] <= 0) return;
    const px = Math.max(vx, g[0] - g[2] * YAMA_PAYI);
    const py = Math.max(vy, g[1] - g[3] * YAMA_PAYI);
    const k: Kutu = [
      px,
      py,
      Math.min(vx + vw, g[0] + g[2] * (1 + YAMA_PAYI)) - px,
      Math.min(vy + vh, g[1] + g[3] * (1 + YAMA_PAYI)) - py,
    ];
    let en = k[2] * ekranBirim * dpr;
    let boy = k[3] * ekranBirim * dpr;
    const sigdir = Math.min(1, EN_BUYUK / Math.max(en, boy));
    en = Math.max(1, Math.round(en * sigdir));
    boy = Math.max(1, Math.round(boy * sigdir));
    const yogunluk = en / (k[2] * ekranBirim);
    if (yogunluk < tabanYogunluk * YAMA_KAZANC) {
      // Uzaktan ana resim yetiyor.
      vazgec();
      setYama(null);
      return;
    }
    const o = oturum.current;
    if (
      o &&
      o.anahtar === anahtar &&
      o.hareketli === hareketli &&
      icinde(o.kutu, g) &&
      o.yogunluk >= yogunluk * 0.85
    )
      return;
    vazgec();
    const yeni: YamaOturumu = {
      iptal: false,
      anahtar,
      kutu: k,
      yogunluk,
      hareketli,
      isler: new Set(),
    };
    oturum.current = yeni;
    const { uret: u, kamera: kam } = guncel.current;
    const taban = `${anahtar}|yama|${k.map((x) => x.toFixed(2)).join(',')}|${en}x${boy}|${sicak ?? ''}|${tilt ?? ''}`;
    const iste = async (parcali: boolean): Promise<boolean> => {
      const is = taban + (parcali ? '|parcali' : hareketli ? '|h' : '');
      yeni.isler.add(is);
      const url = await glCiz(
        is,
        () => ({
          ...(tarif ? { tarif: anahtar } : { model: modelAl(anahtar, u) }),
          kamera: kam,
          kutu: k,
          en,
          boy,
          // Kenar çizgisi düzen pikselinde: yakınlaşınca ana resimle aynı oranda kalınlaşıyor.
          olcek: en / (k[2] * duzenBirim),
          ao: aoYaricapi(v),
          tilt,
          sicak,
          yama: hareketli,
          hareket: parcali,
        }),
        { istenmiyor: () => yeni.iptal },
      );
      if (url) await glOnYukle(url);
      if (!url || yeni.iptal || kapandi.current) {
        // Gösterilmeyecek: başka bir canlı oturum aynı işi beklemiyorsa bırak.
        const bekleyen = !kapandi.current && oturum.current?.isler.has(is);
        if (url && !bekleyen && guncel.current.yama?.is !== is) glBirak(is);
        return false;
      }
      setYama({
        is,
        url,
        kutu: k,
        hareketli,
        katman: parcali ? glKatmanlari(url) : undefined,
        yogunluk,
      });
      return true;
    };
    void (async () => {
      if (!(await iste(false)) || !hareketli) return;
      await iste(true);
    })();
    // `v` ve `gorunen` içerik olarak anahtarlarda. Oturum etkiyle değil,
    // yerine yenisi gelince ya da sahne kapanınca bitiyor.
  }, [etkin, anahtar, tarif, gorunenAnahtar, tabanEn, hareketli, tilt, sicak, bakildi, ref]);

  // Kalıcı: uygulama yeniden açıldıysa son yama cihazdan (bellekte saklı
  // yoksa). Görünen bölge bildirilmeden, eldeki oturum ve yama yokken
  // gelirse gösteriliyor; değilse bırakılıyor.
  useEffect(() => {
    if (!etkin || !kalici || sakliMi(anahtar) || guncel.current.yama) {
      setBakildi(true);
      return;
    }
    void glKalici(yamaYuvasi(anahtar)).then(async (r) => {
      const ek = r && yamaEki(r.ek);
      if (!r) return setBakildi(true);
      if (ek) await glOnYukle(r.url);
      setBakildi(true);
      const kullan =
        ek &&
        !kapandi.current &&
        !oturum.current &&
        !guncel.current.yama &&
        r.anahtar.startsWith(guncel.current.anahtar + '|yama|');
      if (!kullan) {
        if (!oturum.current?.isler.has(r.anahtar) && guncel.current.yama?.is !== r.anahtar)
          glBirak(r.anahtar);
        return;
      }
      const y: Yama = { is: r.anahtar, url: r.url, ...ek, katman: glKatmanlari(r.url) };
      oturum.current = bitmisOturum(y);
      setYama(y);
    });
  }, [etkin, kalici, anahtar]);

  // Yerine yenisi geçen yama bırakılıyor; sahne kapanınca sonuncusu da.
  const gosterilen = useRef<Yama | null>(null);
  useEffect(() => {
    const o = gosterilen.current;
    if (o && o.is !== yama?.is) glBirak(o.is);
    gosterilen.current = yama;
  }, [yama]);
  useEffect(() => {
    kapandi.current = false;
    // Saklı yama yeniden gösteriliyor: artık bu sahnenin.
    if (SAKLI && SAKLI.yama.is === gosterilen.current?.is) SAKLI = null;
    // Kalıcı: gösterilen yama cihaza, uygulama arka plana geçince (telefonda
    // kapatılmadan önceki son an) ve sahne kapanınca.
    const kaydet = () => {
      const y = gosterilen.current;
      const { anahtar: a, kalici: k } = guncel.current;
      if (!k || !y || !y.is.startsWith(a + '|yama|')) return;
      const yuva = yamaYuvasi(a);
      if (KAYDEDILEN.get(yuva) === y.is) return;
      KAYDEDILEN.set(yuva, y.is);
      const ek: YamaEki = { kutu: y.kutu, yogunluk: y.yogunluk, hareketli: y.hareketli };
      glKaydet(yuva, y.is, y.url, ek);
    };
    const gizlenince = () => {
      if (document.visibilityState === 'hidden') kaydet();
    };
    document.addEventListener('visibilitychange', gizlenince);
    window.addEventListener('pagehide', kaydet);
    return () => {
      document.removeEventListener('visibilitychange', gizlenince);
      window.removeEventListener('pagehide', kaydet);
      kaydet();
      kapandi.current = true;
      const o = oturum.current;
      oturum.current = null;
      const y = gosterilen.current;
      gosterilen.current = null;
      if (!y) {
        if (o) o.iptal = true;
        return;
      }
      // Son yama bekliyor (bkz. `SAKLI`). Bitmişse oturumu da onun
      // bölgesiyle; parçalı aşaması gelmeden kapandıysa dönüşte yeni oturum
      // (durağan aşama önbellekten hemen, sonra parçalı).
      if (SAKLI && SAKLI.yama.is !== y.is) glBirak(SAKLI.yama.is);
      SAKLI = { yama: y, oturum: bitmisOturum(y) };
      if (o) o.iptal = true;
    };
  }, []);
  // Sahne değişti (yeni yapı): eski yama ona ait değil.
  return etkin && yama && yama.is.startsWith(anahtar + '|yama|') ? yama : null;
}

/**
 * Çokgen listesini SVG gövdesine döker; çevre bileşenler (sahne, portre) de
 * kullanıyor. Çizim önbellekte tek nesne: sahne başka sebeple yeniden
 * çizilince (yerleşkede görünen bölge değişti) binlerce çokgen yeniden
 * karşılaştırılmıyor.
 */
export const Cokgenler = memo(function Cokgenler({ c }: { c: Cizilmis }) {
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
});

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
  yama,
}: {
  v: [number, number, number, number];
  kirp: boolean;
  katman: Katmanlar | undefined;
  /**
   * Yakınlık yamasının parça atlası (bkz. `useYama`): yamaya giren parçalar
   * onun çözünürlüğünde oynuyor, sahnedeki kopyaları gizli.
   */
  yama?: { kutu: Kutu; bayrak: NonNullable<Katmanlar['bayrak']> };
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
  // Düzen boyu (dönüşümsüz): sahne CSS ile büyütülüyorsa (yakınlaşan
  // yerleşke) katmanlar da onunla birlikte büyüyor, ölçü büyümüş hâli değil.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const olc = (w: number, h: number) =>
      setOlcu((o) => (o && o[0] === w && o[1] === h ? o : [w, h]));
    olc(el.offsetWidth, el.offsetHeight);
    const ro = new ResizeObserver(([g]) => {
      if (g) olc(g.contentRect.width, g.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Yamanın atlasında yeri olan parçalar sahnede gizli (aynı model, aynı sıra).
  const gizli = yama?.bayrak.kutular.map(([, , w, h]) => w > 0 && h > 0);
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
        {katman?.bayrak && (
          <Bayraklar b={katman.bayrak} o={(vw * s) / katman.bayrak.en} gizli={gizli} />
        )}
        {yama && (
          // Yamanın dikdörtgeni: parça yamanın dışına taşarsa orada kesiliyor
          // (yama görünen bölgeden geniş; taşan yer ekranın dışında).
          <span
            className="hareket-yama"
            style={{
              left: (yama.kutu[0] - vx) * s,
              top: (yama.kutu[1] - vy) * s,
              width: yama.kutu[2] * s,
              height: yama.kutu[3] * s,
            }}
          >
            <Bayraklar b={yama.bayrak} o={(yama.kutu[2] * s) / yama.bayrak.en} />
          </span>
        )}
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
function Bayraklar({
  b,
  o,
  gizli,
}: {
  b: NonNullable<Katmanlar['bayrak']>;
  o: number;
  /** Gizlenen parçalar (yamada oynayanlar): kurulu kalıyor, evresi kaymıyor. */
  gizli?: boolean[];
}) {
  const duzen = atlasDuzeni(b.kutular, b.kareSayilari);
  // Evre sayfanın saatinden: aynı parçanın sahnedeki ve yamadaki kopyası
  // (ya da yerine gelen yeni yama) aynı karede; yama değişince köylü sıçramıyor.
  const [t0] = useState(() => performance.now() / 1000);
  return (
    <>
      {b.kutular.map(([x, y, w, h], i) => {
        if (!(w > 0 && h > 0)) return null;
        const k = b.kareSayilari[i]!;
        const sutun = duzen.sutun[i]!;
        const satir = k / sutun;
        const sure = b.sureler[i]!;
        // Her biri ayrı evrede: rüzgâr hepsini aynı anda savurmasın.
        const gecikme = `${(-((t0 + ((i * 0.29) % 1) * sure) % sure)).toFixed(3)}s`;
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
            style={{
              left: x * o,
              top: y * o,
              width: w * o,
              height: h * o,
              visibility: gizli?.[i] ? 'hidden' : undefined,
            }}
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
  sicak,
  hareket = false,
  tarif = false,
  yama,
  kalici = false,
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
   * Sıcak gün ışığı (yalnız GPU, 0–1): biraz daha canlı renk, güneşte
   * altın, gölgede serin. Şehir'in yerleşkesi; öbür çizimler eskisi gibi.
   */
  sicak?: number;
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
  /**
   * Yakınlık yaması (yalnız GPU): ekranda görünen bölge (görüş kutusu
   * biriminde). Sahne CSS ile büyütülünce (yerleşke yakınlaşınca) ana
   * resim `EN_BUYUK`la sınırlı kalıp bulanıklaşıyor; bu bölge, ekrandaki
   * boyunun piksel yoğunluğunda ayrıca çizilip ana resmin üstüne oturuyor
   * (`useYama`). Hareket katmanları yine en üstte.
   */
  yama?: [number, number, number, number];
  /**
   * Kalıcı (yalnız GPU): çizilen resim ve katmanları cihazda saklanıyor
   * (`kalici.ts`), uygulama yeniden açılınca çizilmeden geliyor; son
   * yakınlık yaması da. Yerleşke: telefonda saniyelerce süren canlı resmi.
   */
  kalici?: boolean;
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
    sicak,
    canli,
    onceDurgun,
    kalici,
    ref,
    () => setGpuYok(true),
  );
  const katman = glKatmanlari(resim);
  // Canlı resimde salınan parçalar atlasta (atlas kurulamadıysa resmin
  // içinde): yama da öyle olmalı.
  const parcalarKatmanda = canli && katman?.bayrak !== undefined;
  const yamaResmi = useYama(
    gpu && (yama !== undefined || kalici),
    anahtar,
    cokgensiz,
    uret,
    kamera,
    v,
    yama,
    resimEni(resim),
    parcalarKatmanda,
    canli && katman === undefined,
    tilt,
    sicak,
    kalici,
    ref,
  );
  const yamaUygun = yamaResmi && yamaResmi.hareketli === parcalarKatmanda ? yamaResmi : null;

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
        <>
          <image
            href={resim}
            x={v[0]}
            y={v[1]}
            width={v[2]}
            height={v[3]}
            preserveAspectRatio={YAYILMA}
          />
          {yamaUygun && (
            <image
              href={yamaUygun.url}
              x={yamaUygun.kutu[0]}
              y={yamaUygun.kutu[1]}
              width={yamaUygun.kutu[2]}
              height={yamaUygun.kutu[3]}
              preserveAspectRatio={YAYILMA}
              data-yama=""
            />
          )}
        </>
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
      {resim && (
        <HareketKatmani
          v={v}
          kirp={kirp}
          katman={katman}
          yama={
            yamaUygun?.katman?.bayrak
              ? { kutu: yamaUygun.kutu, bayrak: yamaUygun.katman.bayrak }
              : undefined
          }
        />
      )}
    </span>
  );
});

/** Tek hücre, kutuyu dolduran. */
const IZGARA = ['minmax(0,1fr)', 'minmax(0,1fr)'].join(' / ');
