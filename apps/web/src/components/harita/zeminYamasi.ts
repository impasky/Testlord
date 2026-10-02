/**
 * Dünya zemininin yakınlık yaması (docs/24 "Yakınlaştırma").
 *
 * Oyuncu: "haritaya da yakınlık yaması ekle." Zemin 2048 piksellik tek bir
 * GPU resmi; harita 4,5 kata kadar büyüyor ve telefonda yakında bulanık
 * kalıyordu (ekranın istediğinin yarısından az piksel). Şehir'in
 * yerleşkesindeki gibi: harita durunca görünen bölge, her yanından %15
 * payla, ekranın piksel yoğunluğunda ayrıca çiziliyor ve zeminin üstüne
 * oturuyor — zeminin renk süzgecinin içinde, toprakların ve sınırların
 * altında.
 *
 * Dikişte ana resimle aynı: aynı model (işçide bir kez kurulan tarif,
 * `dunya:zemin`), aynı ışık, kenar çizgisi ve hare dünya biriminde,
 * dalgalar ana resmin ölçüsünde (`dalgaBirimi`). Yama ancak ana resimden
 * belirgin yoğunsa çiziliyor (uzaktan zemin yetiyor); bölge eldeki ya da
 * yoldaki yamanın içinde kaldıkça yeniden istenmiyor, yenisi gelince eskisi
 * bellekten bırakılıyor, sırası gelince istenmeyen yama çizilmiyor.
 */
import { useEffect, useRef, useState } from 'react';
import { DUNYA_ISIGI, DUNYA_KAMERASI } from '../../cizim/dunya';
import { glBirak, glCiz, glOnYukle, glVarMi, ornekSayisi } from '../../cizim/gl';

type Kutu = [number, number, number, number];

/** Ana zeminin piksel kenarı (`DunyaHaritasi` GPU zemini). */
export const ZEMIN_GPU_PIKSEL = 2048;
/** Yamanın en uzun kenarı: ana zeminle aynı sınır (tek örnek). */
const YAMA_EN_COK = 2048;
/** Görünen bölgenin her yanından taşan pay (bölgenin boyuna oran). */
const PAY = 0.15;
/** Yama ancak ana zeminden bu kat yoğunsa çiziliyor. */
const KAZANC = 1.25;
/** Harita durduktan sonra (ms). */
const DURMA_MS = 250;
/** Zemin henüz hazır değilse yeniden bakma aralığı (ms). */
const YENIDEN_MS = 600;

export interface ZeminYamasi {
  /** `glCiz` anahtarı: yerine yenisi konunca bırakılıyor. */
  is: string;
  url: string;
  /** Yamanın bölgesi, dünya biriminde (0–100). */
  kutu: Kutu;
}

interface Oturum {
  iptal: boolean;
  kutu: Kutu;
  yogunluk: number;
  /** İşin anahtarı: aynı bölgeyi yeniden isteyen oturum aynı işi bekliyor. */
  is: string;
}

const icinde = (a: Kutu, b: Kutu) =>
  b[0] >= a[0] - 1e-6 &&
  b[1] >= a[1] - 1e-6 &&
  b[0] + b[2] <= a[0] + a[2] + 1e-6 &&
  b[1] + b[3] <= a[1] + a[3] + 1e-6;

/**
 * Görünen bölge (dünya biriminde, 0–100'e kırpılmış) ve bir dünya biriminin
 * ekrandaki CSS pikseli. Görünüm: harita tuvali `translate(tx, ty)
 * scale(k)`, tuvalin ×1'deki kenarı `W`.
 */
export function gorunenBolge(
  g: { k: number; tx: number; ty: number },
  en: number,
  boy: number,
  W: number,
): { kutu: Kutu; birim: number } | null {
  const D = W * g.k;
  if (!(D > 0) || en <= 0 || boy <= 0) return null;
  const birim = D / 100;
  const x0 = Math.max(0, -g.tx / birim);
  const y0 = Math.max(0, -g.ty / birim);
  const x1 = Math.min(100, (en - g.tx) / birim);
  const y1 = Math.min(100, (boy - g.ty) / birim);
  if (x1 <= x0 || y1 <= y0) return null;
  return { kutu: [x0, y0, x1 - x0, y1 - y0], birim };
}

export function useZeminYamasi(
  gorunum: { k: number; tx: number; ty: number },
  en: number,
  boy: number,
  W: number,
  /** Ana zemin GPU'da çizilip yerine oturdu mu (düz üçgenlere yama yok). */
  zeminHazir: () => boolean,
): ZeminYamasi | null {
  const [yama, setYama] = useState<ZeminYamasi | null>(null);
  const oturum = useRef<Oturum | null>(null);
  const gosterilen = useRef<ZeminYamasi | null>(null);
  const kapandi = useRef(false);
  const guncel = useRef(zeminHazir);
  guncel.current = zeminHazir;

  useEffect(() => {
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const vazgec = () => {
      if (oturum.current) oturum.current.iptal = true;
      oturum.current = null;
    };
    const hesapla = () => {
      if (!glVarMi()) return;
      if (!guncel.current()) {
        zaman = setTimeout(hesapla, YENIDEN_MS);
        return;
      }
      const g = gorunenBolge(gorunum, en, boy, W);
      if (!g) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      // Yoğunluk dünya birimine düşen resim pikseli: yakınlıktan bağımsız
      // (yamanın içinde daha da yakınlaşınca eski seyrek yama yetmiyor).
      const tabanYogunluk = ZEMIN_GPU_PIKSEL / 100;
      const [vx, vy, vw, vh] = g.kutu;
      const px = Math.max(0, vx - vw * PAY);
      const py = Math.max(0, vy - vh * PAY);
      const k: Kutu = [
        px,
        py,
        Math.min(100, vx + vw * (1 + PAY)) - px,
        Math.min(100, vy + vh * (1 + PAY)) - py,
      ];
      let pe = k[2] * g.birim * dpr;
      let pb = k[3] * g.birim * dpr;
      const sigdir = Math.min(1, YAMA_EN_COK / Math.max(pe, pb));
      pe = Math.max(1, Math.round(pe * sigdir));
      pb = Math.max(1, Math.round(pb * sigdir));
      const yogunluk = pe / k[2];
      if (yogunluk < tabanYogunluk * KAZANC) {
        // Uzaktan ana zemin yetiyor.
        vazgec();
        setYama(null);
        return;
      }
      const o = oturum.current;
      if (o && icinde(o.kutu, g.kutu) && o.yogunluk >= yogunluk * 0.85) return;
      vazgec();
      const is = `dunya-zemini|yama|${k.map((x) => x.toFixed(2)).join(',')}|${pe}x${pb}`;
      const yeni: Oturum = { iptal: false, kutu: k, yogunluk, is };
      oturum.current = yeni;
      void glCiz(
        is,
        () => ({
          tarif: 'dunya:zemin',
          kamera: DUNYA_KAMERASI,
          isik: DUNYA_ISIGI,
          kutu: k,
          // Ana zeminle aynı: ortam gölgesi yok, çizgi ve hare dünya biriminde
          // (ana zemin 2048 pikselde `olcek` 2048 / 400), dalgalar onun ölçüsünde.
          ao: 0,
          en: pe,
          boy: pb,
          olcek: pe / (k[2] * 4),
          dalgaBirimi: 100 / (ZEMIN_GPU_PIKSEL * ornekSayisi(ZEMIN_GPU_PIKSEL, ZEMIN_GPU_PIKSEL)),
        }),
        { istenmiyor: () => yeni.iptal },
      ).then(async (url) => {
        if (url) await glOnYukle(url);
        if (!url || yeni.iptal || kapandi.current) {
          // Gösterilmeyecek: canlı oturum aynı işi beklemiyorsa bırak.
          const bekleyen = !kapandi.current && oturum.current?.is === is;
          if (url && !bekleyen && gosterilen.current?.is !== is) glBirak(is);
          return;
        }
        setYama({ is, url, kutu: k });
      });
    };
    zaman = setTimeout(hesapla, DURMA_MS);
    return () => clearTimeout(zaman);
  }, [gorunum, en, boy, W]);

  // Yerine yenisi geçen yama bırakılıyor; harita kapanınca sonuncusu da.
  useEffect(() => {
    const o = gosterilen.current;
    if (o && o.is !== yama?.is) glBirak(o.is);
    gosterilen.current = yama;
  }, [yama]);
  useEffect(() => {
    kapandi.current = false;
    return () => {
      kapandi.current = true;
      if (oturum.current) oturum.current.iptal = true;
      oturum.current = null;
      if (gosterilen.current) glBirak(gosterilen.current.is);
      gosterilen.current = null;
    };
  }, []);
  return yama;
}
