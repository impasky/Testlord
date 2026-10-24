/**
 * Dünya haritası — GERÇEK DÜNYA (docs/27): 197 ülke, her şehir bir toprak.
 *
 * ── Neden tuval ──────────────────────────────────────────────────────
 *
 * Eski harita 121 Voronoi hücresini SVG olarak çiziyordu. Gerçek dünyada
 * 3.000'i aşkın toprak ve kıyı çizgileri var; her biri bir DOM öğesi
 * olsaydı yakınlaşmanın her kademesinde tarayıcı on binlerce köşeyi
 * yeniden tarardı. Burada iki katman var:
 *
 *   taban   ülkeler, topraklar, sınırlar — BİR KEZ, ekranın biraz
 *           fazlasına çiziliyor; kaydırmada yalnız kayıyor, kıstırmada
 *           ölçekleniyor, hareket bitince keskin hâliyle yeniden çiziliyor
 *   üst     seçim, kamp, tahtlar, şehir noktaları, adlar, yürüyüşler —
 *           her karede, yalnız görünenler
 *
 * Dokunma geometriyle ölçülüyor (`isPointInPath`): parmak hangi toprağın
 * içindeyse o. Uzaktan bakarken küçük toprakların yerine en yakın şehir
 * noktası seçiliyor.
 *
 * ── İki görünüm ──────────────────────────────────────────────────────
 *
 * "Kim nerede" (siyasi) ve "neye saldırabilirim" (hedef). Hedefler sınır
 * kuralını gösteriyor: kendi ülken ve sınır komşuların açık, gerisi
 * karanlık (shared `hedefDurumu`, sunucunun `sinirda` alanı).
 */
import { ULKELER, hedefDurumu } from '@lordlar/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MarchDto, RegionDto } from '../../api/client';
import { IkonSaldiri } from '../Ikonlar';
import { YakinlikDugmesi } from '../YakinlikDugmesi';
import { BolgeListesi } from './BolgeListesi';
import { dunyaGeometrisiYukle, type DunyaGeometrisi, type Hucre } from './dunyaGeometri';

export type Mercek = 'siyasi' | 'hedef';

export interface IttifakHedefi {
  regionId: number;
  etiket: string;
}

const MERCEK_ANAHTARI = 'lordlar_harita_mercek';
const GORUNUM_ANAHTARI = 'lordlar_dunya_gorunum';

const DENIZ = '#142128';
const ALTIN = '#f5b731';
const KARANLIK = '#0b0806';
/** Ülkelerin toprak rengi (Natural Earth MAPCOLOR7, 1-7): koyu ve soluk, bilgi katmanı öne çıksın. */
const KARA = ['#3b4a3c', '#4a4537', '#3d4654', '#4d3e47', '#45513f', '#53483a', '#3f4c4d'];

/** En uzak: bütün dünya; en yakın: bir şehrin toprağı ekranın büyük kısmı. */
const EN_COK = 14;
/** Şehir noktaları ve adları bu yakınlıktan sonra. */
const SEHIR_ESIGI = 0.9;
/** Kenarda parmağın haritayı en çok bu kadar taşırması (piksel). */
const TASMA = 120;
/** Kaydırmadan sonra kalkan parmak bir bölge seçmesin. */
const SURUKLE_ESIGI = 8;
/** Taban katmanı ekranın her yanından bu kadar fazlasına çiziliyor (CSS piksel). */
const PAY = 240;

/**
 * Son çizilen taban, haritanın dışında. Sekme değişince harita kaldırılıyor;
 * dönünce bütün ülke ve şehir yolları yeniden rasterleşiyordu: telefonda
 * Dünya'ya her dönüşte ~200 ms GPU (dördüncü ölçüm raporu, "boşta 178–201
 * ms (GPU/bileşikleyici)"), yazılım tuvalinde 4× yavaşlatılmış ana iş
 * parçacığında ~210 ms `drawImage`. Aynı geometri, boy, görünüm ve boyamayla
 * (`tabanImzasi`) aynısı kullanılıyor. Harita tek yerde (`Harita.tsx`).
 */
let sonTaban: { c: HTMLCanvasElement; g: Gorunum; geo: DunyaGeometrisi; imza: string } | null =
  null;

interface Gorunum {
  /** CSS pikseli / izdüşüm birimi. */
  k: number;
  tx: number;
  ty: number;
}

function kayitliMercek(): Mercek {
  try {
    return localStorage.getItem(MERCEK_ANAHTARI) === 'hedef' ? 'hedef' : 'siyasi';
  } catch {
    return 'siyasi';
  }
}

/** Lord kimliğinden kararlı bir renk: aynı lord her yerde aynı renk. */
function lordRengi(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return `hsl(${h % 360} 62% 52%)`;
}

/** Toprağın boyası: görünüme göre renk ve saydamlık. */
function boya(r: RegionDto, mercek: Mercek, ulkem: string | null): { renk: string; alfa: number } {
  if (mercek === 'siyasi') {
    if (r.isMine) return { renk: ALTIN, alfa: 0.7 };
    if (r.owner) return { renk: lordRengi(r.owner.id), alfa: 0.62 };
    return { renk: '#000', alfa: 0 };
  }
  const d = hedefDurumu(r, ulkem);
  if (d.tur === 'benim') return { renk: ALTIN, alfa: 0.55 };
  if (d.tur === 'yasak') return { renk: KARANLIK, alfa: 0.6 };
  const renk = r.owner ? '#e8524d' : '#f0e1c8';
  const alfa = d.adim <= 1 ? 0.55 : d.adim <= 3 ? 0.35 : 0.2;
  return { renk, alfa };
}

interface Etiket {
  x: number;
  y: number;
  metin: string;
  boyut: number;
  renk: string;
  kalin: boolean;
}

export function GercekHarita({
  regions,
  homeBolgeId,
  seciliId,
  yuruyusler,
  ittifakHedefi,
  ulkem,
  altBosluk,
  gostergeGizli = false,
  onSec,
  onBosDokun,
}: {
  regions: RegionDto[];
  /** Kampın çıpası (veritabanı kimliği). */
  homeBolgeId: number;
  seciliId: number | null;
  yuruyusler: MarchDto[];
  ittifakHedefi?: IttifakHedefi | null;
  /** Lordun ülkesi — Hedefler sınır kuralını bununla gösteriyor. */
  ulkem: string | null;
  /** Haritanın altını kaplayan panelin yüksekliği: seçim bu payın üstünde ortalanıyor. */
  altBosluk: number;
  gostergeGizli?: boolean;
  onSec: (id: number) => void;
  onBosDokun?: () => void;
}) {
  const kutuRef = useRef<HTMLDivElement>(null);
  const tuvalRef = useRef<HTMLCanvasElement>(null);
  const [geo, setGeo] = useState<DunyaGeometrisi | null>(null);
  const [hata, setHata] = useState(false);
  const [boyut, setBoyut] = useState({ en: 0, boy: 0 });
  const [mercek, setMercekHam] = useState<Mercek>(kayitliMercek);
  const [listeAcik, setListeAcik] = useState(false);
  /** Yakınlık kademesi değişince düğmeler (sığdır) yeniden çizilsin; her karede değil. */
  const [kademe, setKademe] = useState(0);

  const gorunum = useRef<Gorunum>({ k: 0, tx: 0, ty: 0 });
  const taban = useRef<{ c: HTMLCanvasElement; g: Gorunum; surum: number } | null>(null);
  const tabanSurumu = useRef(0);
  const kare = useRef(0);
  const etiketler = useRef<Etiket[]>([]);
  /** Yerleşen adların ekran kutuları — çakışma denetimi (test kancası) için. */
  const etiketKutulari = useRef<[number, number, number, number][]>([]);
  const isaretciler = useRef(new Map<number, { x: number; y: number }>());
  const hareket = useRef({ mesafe: 0, ilkAralik: 0, ilkK: 1, merkez: { x: 0, y: 0 } });
  const durgunlukZamani = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acildi = useRef(false);

  function setMercek(m: Mercek) {
    setMercekHam(m);
    try {
      localStorage.setItem(MERCEK_ANAHTARI, m);
    } catch {
      /* depo yoksa oturum boyunca */
    }
  }

  /* --- Geometri: bir kez, ayrı paket --- */
  useEffect(() => {
    let iptal = false;
    dunyaGeometrisiYukle()
      .then((g) => !iptal && setGeo(g))
      .catch(() => !iptal && setHata(true));
    return () => {
      iptal = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = kutuRef.current;
    if (!el) return;
    const olc = () => setBoyut({ en: el.clientWidth, boy: el.clientHeight });
    olc();
    const g = new ResizeObserver(olc);
    g.observe(el);
    return () => g.disconnect();
  }, []);

  /* --- Veri: kanonik numara ↔ satır --- */
  const mapIdIle = useMemo(() => new Map(regions.map((r) => [r.mapId, r])), [regions]);
  const idIle = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
  const boyamalar = useMemo(() => {
    const m = new Map<number, { renk: string; alfa: number }>();
    for (const r of regions) m.set(r.mapId, boya(r, mercek, ulkem));
    return m;
  }, [regions, mercek, ulkem]);
  /**
   * Tabana giren her şey (geometri dışında): boy, yoğunluk, bölgelerin
   * boyası, benimkiler (altın kenar) ve yerleri (deniz yolları). Veri her
   * sekme dönüşünde yeniden geliyor; aynıysa imza da aynı.
   */
  const tabanImzasi = useMemo(
    () =>
      `${Math.min(2, window.devicePixelRatio || 1)}|${boyut.en}x${boyut.boy}|` +
      regions
        .map((r) => {
          const b = boyamalar.get(r.mapId);
          return `${r.mapId}:${b?.renk}:${b?.alfa}:${r.isMine ? 1 : 0}:${r.x}:${r.y}`;
        })
        .join(';'),
    [regions, boyamalar, boyut.en, boyut.boy],
  );

  const gorunurBoy = Math.max(0, boyut.boy - altBosluk);
  const enAz = geo && boyut.en > 0 ? Math.min(boyut.en / geo.en, gorunurBoy / geo.boy) : 0.1;

  /** Bölgenin izdüşüm birimindeki yeri. */
  const yer = useCallback(
    (r: RegionDto): [number, number] =>
      geo ? [(r.x / 100) * geo.en, (r.y / 100) * geo.boy] : [0, 0],
    [geo],
  );

  /** `k` yakınlığında kaymanın izinli aralığı: [x0, x1, y0, y1]. */
  function kaymaAraligi(k: number): [number, number, number, number] {
    const aralik = (D: number, pencere: number): [number, number] =>
      D <= pencere ? [(pencere - D) / 2, (pencere - D) / 2] : [pencere - D, 0];
    const [x0, x1] = aralik((geo?.en ?? 0) * k, boyut.en);
    const [y0, y1] = aralik((geo?.boy ?? 0) * k, gorunurBoy);
    return [x0, x1, y0, y1];
  }

  function sinirla(g: Gorunum): Gorunum {
    if (!geo) return g;
    const k = Math.min(EN_COK, Math.max(enAz, g.k));
    const [x0, x1, y0, y1] = kaymaAraligi(k);
    return { k, tx: Math.min(x1, Math.max(x0, g.tx)), ty: Math.min(y1, Math.max(y0, g.ty)) };
  }

  function ortala(x: number, y: number, k: number): Gorunum {
    return sinirla({ k, tx: boyut.en / 2 - x * k, ty: gorunurBoy / 2 - y * k });
  }

  /* --- Çizim --- */
  const tabanCiz = useCallback(
    (g: Gorunum): HTMLCanvasElement | null => {
      if (!geo || boyut.en === 0) return null;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = boyut.en + 2 * PAY;
      const H = boyut.boy + 2 * PAY;
      const c = taban.current?.c ?? document.createElement('canvas');
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = DENIZ;
      ctx.fillRect(0, 0, c.width, c.height);
      const o = geo.olcek;
      const s = (dpr * g.k) / o;
      ctx.setTransform(s, 0, 0, s, dpr * (g.tx + PAY), dpr * (g.ty + PAY));
      // Görünen dikdörtgen, izdüşüm biriminde.
      const vx0 = (-PAY - g.tx) / g.k;
      const vy0 = (-PAY - g.ty) / g.k;
      const vx1 = (boyut.en + PAY - g.tx) / g.k;
      const vy1 = (boyut.boy + PAY - g.ty) / g.k;
      const gorunur = (k: readonly number[]) =>
        k[2]! >= vx0 && k[0]! <= vx1 && k[3]! >= vy0 && k[1]! <= vy1;
      const piksel = o / (dpr * g.k); // bir ekran pikseli, ölçekli koordinatta

      for (const u of geo.ulkeler) {
        if (!gorunur(u.kutu)) continue;
        ctx.fillStyle = KARA[(ULKELER.get(u.kod)?.renk ?? 1) - 1] ?? KARA[0]!;
        ctx.fill(u.yol, 'evenodd');
      }
      for (const h of geo.hucreler.values()) {
        if (!gorunur(h.kutu)) continue;
        const b = boyamalar.get(h.mapId);
        if (!b || b.alfa <= 0) continue;
        ctx.globalAlpha = b.alfa;
        ctx.fillStyle = b.renk;
        ctx.fill(h.yol, 'evenodd');
      }
      ctx.globalAlpha = 1;
      // Şehir sınırları: yakında görünür, uzakta gürültü.
      if (g.k >= 0.45) {
        ctx.strokeStyle = 'rgba(240,225,200,0.16)';
        ctx.lineWidth = piksel * 0.8;
        for (const h of geo.hucreler.values()) if (gorunur(h.kutu)) ctx.stroke(h.yol);
      }
      // Benim toprağımın kenarı altın.
      ctx.strokeStyle = ALTIN;
      ctx.lineWidth = piksel * 2;
      for (const r of regions) {
        if (!r.isMine) continue;
        const h = geo.hucreler.get(r.mapId);
        if (h && gorunur(h.kutu)) ctx.stroke(h.yol);
      }
      // Ülke sınırları ve kıyı.
      ctx.strokeStyle = 'rgba(12,9,7,0.85)';
      ctx.lineWidth = piksel * (g.k >= 0.45 ? 1.6 : 1);
      for (const u of geo.ulkeler) if (gorunur(u.kutu)) ctx.stroke(u.yol);
      // Deniz yolları: karşı kıyıya geçilen yer.
      if (g.k >= 0.35) {
        ctx.setTransform(dpr * g.k, 0, 0, dpr * g.k, dpr * (g.tx + PAY), dpr * (g.ty + PAY));
        ctx.strokeStyle = 'rgba(120,180,220,0.55)';
        ctx.lineWidth = 1.2 / g.k;
        ctx.setLineDash([5 / g.k, 4 / g.k]);
        ctx.beginPath();
        for (const [a, b] of geo.deniz) {
          const ra = mapIdIle.get(a);
          const rb = mapIdIle.get(b);
          if (!ra || !rb) continue;
          const [ax, ay] = yer(ra);
          const [bx, by] = yer(rb);
          // Antimeridyenin iki yakası: çizgi dünyayı boydan boya kesmesin.
          if (Math.abs(ax - bx) > geo.en / 2) continue;
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return c;
    },
    [geo, boyut.en, boyut.boy, boyamalar, regions, mapIdIle, yer],
  );

  /** Adlar: hareket bitince bir kez, çakışanlar elenerek. */
  const etiketleriKur = useCallback(
    (g: Gorunum) => {
      if (!geo) return;
      const tuval = tuvalRef.current;
      const ctx = tuval?.getContext('2d');
      if (!ctx) return;
      const adaylar: (Etiket & { oncelik: number })[] = [];
      const ekranda = (x: number, y: number) => {
        const sx = x * g.k + g.tx;
        const sy = y * g.k + g.ty;
        return sx > -40 && sx < boyut.en + 40 && sy > -20 && sy < boyut.boy + 20;
      };
      // Ülke adları: uzakta.
      if (g.k < 2.2) {
        for (const u of geo.ulkeler) {
          const [x, y] = u.etiket;
          if (!ekranda(x, y)) continue;
          const enPx = (u.parcaKutu[2] - u.parcaKutu[0]) * g.k;
          const ad = ULKELER.get(u.kod)?.name;
          if (!ad || enPx < 40) continue;
          const boyutPx = Math.max(10, Math.min(15, enPx / 12));
          adaylar.push({
            x,
            y,
            metin: ad,
            boyut: boyutPx,
            renk: 'rgba(240,225,200,0.75)',
            kalin: true,
            oncelik: 100 - Math.min(90, enPx / 10),
          });
        }
      }
      if (g.k >= SEHIR_ESIGI) {
        for (const r of regions) {
          const [x, y] = yer(r);
          if (!ekranda(x, y)) continue;
          const oncelik = r.isMine
            ? 0
            : r.type === 'taht'
              ? 5
              : r.owner
                ? 10
                : r.type === 'sehir'
                  ? 20
                  : 30;
          const metin = r.isMine ? `${r.name} ★` : r.owner ? `${r.name} · ${r.owner.name}` : r.name;
          adaylar.push({
            x,
            y: y + 6 / g.k,
            metin,
            boyut: r.type === 'taht' ? 12 : 11,
            renk: r.isMine ? ALTIN : '#f0e1c8',
            kalin: r.type === 'taht' || r.isMine,
            oncelik,
          });
        }
      } else {
        // Uzakta yalnız benim ve tahtım: oyuncu kendini kaybetmesin.
        for (const r of regions) {
          if (!r.isMine && r.id !== homeBolgeId) continue;
          const [x, y] = yer(r);
          adaylar.push({
            x,
            y: y + 6 / g.k,
            metin: r.isMine ? `${r.name} ★` : 'Kampın',
            boyut: 11,
            renk: ALTIN,
            kalin: true,
            oncelik: 0,
          });
        }
      }
      adaylar.sort((a, b) => a.oncelik - b.oncelik);
      const yerlesen: [number, number, number, number][] = [];
      const secilen: Etiket[] = [];
      for (const a of adaylar.slice(0, 400)) {
        ctx.font = `${a.kalin ? 700 : 500} ${a.boyut}px system-ui, sans-serif`;
        const w = ctx.measureText(a.metin).width;
        const sx = a.x * g.k + g.tx;
        const sy = a.y * g.k + g.ty;
        const kutu: [number, number, number, number] = [
          sx - w / 2 - 2,
          sy - a.boyut / 2 - 1,
          sx + w / 2 + 2,
          sy + a.boyut / 2 + 1,
        ];
        if (
          yerlesen.some((o) => kutu[0] < o[2] && o[0] < kutu[2] && kutu[1] < o[3] && o[1] < kutu[3])
        )
          continue;
        yerlesen.push(kutu);
        secilen.push(a);
      }
      etiketler.current = secilen;
      etiketKutulari.current = yerlesen;
    },
    [geo, regions, yer, boyut.en, boyut.boy, homeBolgeId],
  );

  const ciz = useCallback(() => {
    kare.current = 0;
    const tuval = tuvalRef.current;
    if (!tuval || !geo || boyut.en === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (
      tuval.width !== Math.round(boyut.en * dpr) ||
      tuval.height !== Math.round(boyut.boy * dpr)
    ) {
      tuval.width = Math.round(boyut.en * dpr);
      tuval.height = Math.round(boyut.boy * dpr);
    }
    const ctx = tuval.getContext('2d')!;
    const g = gorunum.current;

    // Taban: aynı yakınlıkta ve payın içindeyse yalnız kaydırılıyor.
    const t = taban.current;
    const tazeMi =
      t &&
      t.surum === tabanSurumu.current &&
      t.g.k === g.k &&
      Math.abs(t.g.tx - g.tx) < PAY &&
      Math.abs(t.g.ty - g.ty) < PAY;
    const elde = isaretciler.current.size > 0;
    if (!tazeMi && !(elde && t && t.surum === tabanSurumu.current)) {
      // Sekmeye dönüş: aynı görünüm ve veriyle çizilmişi varsa o (`sonTaban`).
      const s = sonTaban;
      if (
        s &&
        s.geo === geo &&
        s.imza === tabanImzasi &&
        s.g.k === g.k &&
        Math.abs(s.g.tx - g.tx) < PAY &&
        Math.abs(s.g.ty - g.ty) < PAY
      )
        taban.current = { c: s.c, g: s.g, surum: tabanSurumu.current };
      else {
        const c = tabanCiz(g);
        if (c) {
          taban.current = { c, g: { ...g }, surum: tabanSurumu.current };
          sonTaban = { c, g: { ...g }, geo, imza: tabanImzasi };
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = DENIZ;
    ctx.fillRect(0, 0, tuval.width, tuval.height);
    const tb = taban.current;
    if (tb) {
      const s = g.k / tb.g.k;
      ctx.setTransform(
        dpr * s,
        0,
        0,
        dpr * s,
        dpr * ((-PAY - tb.g.tx) * s + g.tx),
        dpr * ((-PAY - tb.g.ty) * s + g.ty),
      );
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tb.c, 0, 0, boyut.en + 2 * PAY, boyut.boy + 2 * PAY);
    }

    // ── Üst katman ──
    const o = geo.olcek;
    // Seçim: toprağın kenarı beyaz.
    const secili = seciliId != null ? idIle.get(seciliId) : undefined;
    const sh = secili ? geo.hucreler.get(secili.mapId) : undefined;
    ctx.setTransform((dpr * g.k) / o, 0, 0, (dpr * g.k) / o, dpr * g.tx, dpr * g.ty);
    if (sh) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (2.4 * o) / g.k;
      ctx.stroke(sh.yol);
    }
    const ih = ittifakHedefi ? idIle.get(ittifakHedefi.regionId) : undefined;
    const ihh = ih ? geo.hucreler.get(ih.mapId) : undefined;
    if (ihh) {
      ctx.strokeStyle = '#5aa9e6';
      ctx.lineWidth = (2 * o) / g.k;
      ctx.setLineDash([(4 * o) / g.k, (3 * o) / g.k]);
      ctx.stroke(ihh.yol);
      ctx.setLineDash([]);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ekran = (r: RegionDto): [number, number] => {
      const [x, y] = yer(r);
      return [x * g.k + g.tx, y * g.k + g.ty];
    };
    const icerde = (sx: number, sy: number) =>
      sx > -20 && sx < boyut.en + 20 && sy > -20 && sy < boyut.boy + 20;

    // Şehir noktaları ve tahtlar.
    for (const r of regions) {
      const [sx, sy] = ekran(r);
      if (!icerde(sx, sy)) continue;
      if (r.type === 'taht') {
        if (g.k < 0.25 && !r.isMine) continue;
        ctx.fillStyle = r.owner ? (r.isMine ? ALTIN : lordRengi(r.owner.id)) : '#e9c46a';
        ctx.strokeStyle = KARANLIK;
        ctx.lineWidth = 1;
        const a = g.k < 0.6 ? 3 : 4.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy - a);
        ctx.lineTo(sx + a, sy);
        ctx.lineTo(sx, sy + a);
        ctx.lineTo(sx - a, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (g.k >= SEHIR_ESIGI || r.isMine) {
        ctx.fillStyle = r.isMine ? ALTIN : r.owner ? lordRengi(r.owner.id) : '#f0e1c8';
        ctx.beginPath();
        ctx.arc(sx, sy, g.k >= 2 ? 2.6 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Kamp: küçük çadır.
    const ev = idIle.get(homeBolgeId);
    if (ev) {
      const [sx, sy] = ekran(ev);
      const ex = sx + 7;
      const ey = sy - 7;
      ctx.fillStyle = ALTIN;
      ctx.strokeStyle = KARANLIK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex, ey - 6);
      ctx.lineTo(ex + 6, ey + 4);
      ctx.lineTo(ex - 6, ey + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Yürüyüşler: çizgi ve ilerleyen nokta.
    if (ev) {
      const [evx, evy] = ekran(ev);
      for (const y of yuruyusler) {
        const h = idIle.get(y.toRegionId);
        if (!h) continue;
        const [hx, hy] = ekran(h);
        const donus = y.kind === 'return';
        const [bx, by, sx2, sy2] = donus ? [hx, hy, evx, evy] : [evx, evy, hx, hy];
        const renk = donus ? '#3ddc84' : '#e8524d';
        ctx.strokeStyle = renk;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);
        const bas = new Date(y.departAt).getTime();
        const bit = new Date(y.arriveAt).getTime();
        const oran = bit > bas ? Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas))) : 1;
        ctx.fillStyle = renk;
        ctx.strokeStyle = KARANLIK;
        ctx.beginPath();
        ctx.arc(bx + (sx2 - bx) * oran, by + (sy2 - by) * oran, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    // Adlar.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const e of etiketler.current) {
      const sx = e.x * g.k + g.tx;
      const sy = e.y * g.k + g.ty;
      if (!icerde(sx, sy)) continue;
      ctx.font = `${e.kalin ? 700 : 500} ${e.boyut}px system-ui, sans-serif`;
      ctx.strokeStyle = 'rgba(11,8,6,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(e.metin, sx, sy);
      ctx.fillStyle = e.renk;
      ctx.fillText(e.metin, sx, sy);
    }
  }, [
    geo,
    boyut.en,
    boyut.boy,
    tabanCiz,
    tabanImzasi,
    seciliId,
    idIle,
    ittifakHedefi,
    regions,
    homeBolgeId,
    yuruyusler,
    yer,
  ]);

  const cizRef = useRef(ciz);
  cizRef.current = ciz;
  const cizdir = useCallback(() => {
    if (!kare.current) kare.current = requestAnimationFrame(() => cizRef.current());
  }, []);

  /** Hareket durunca: adlar yeniden yerleşiyor, taban keskinleşiyor, görünüm saklanıyor. */
  const durdu = useCallback(() => {
    if (durgunlukZamani.current) clearTimeout(durgunlukZamani.current);
    durgunlukZamani.current = setTimeout(() => {
      const g = gorunum.current;
      etiketleriKur(g);
      setKademe(Math.round(g.k * 100));
      cizdir();
      if (geo && boyut.en > 0) {
        try {
          localStorage.setItem(
            GORUNUM_ANAHTARI,
            JSON.stringify({
              k: g.k,
              x: (boyut.en / 2 - g.tx) / g.k,
              y: (gorunurBoy / 2 - g.ty) / g.k,
            }),
          );
        } catch {
          /* depo yok */
        }
      }
    }, 140);
  }, [etiketleriKur, cizdir, geo, boyut.en, gorunurBoy]);

  // Veri değişince taban yeniden çiziliyor.
  useEffect(() => {
    tabanSurumu.current++;
    etiketleriKur(gorunum.current);
    cizdir();
  }, [boyamalar, geo, etiketleriKur, cizdir]);
  useEffect(() => {
    cizdir();
  }, [seciliId, ittifakHedefi, yuruyusler, cizdir]);

  // Yürüyüş noktası saniyede bir ilerliyor; yürüyüş yokken zamanlayıcı yok.
  useEffect(() => {
    if (yuruyusler.length === 0) return;
    const z = setInterval(cizdir, 1000);
    return () => clearInterval(z);
  }, [yuruyusler.length, cizdir]);

  /* --- Açılış: saklı görünüm, yoksa toprağım / kampım --- */
  useEffect(() => {
    if (!geo || boyut.en === 0 || regions.length === 0) return;
    if (!acildi.current) {
      acildi.current = true;
      let g: Gorunum | null = null;
      try {
        const s = JSON.parse(localStorage.getItem(GORUNUM_ANAHTARI) ?? 'null') as {
          k: number;
          x: number;
          y: number;
        } | null;
        if (s && [s.k, s.x, s.y].every((v) => typeof v === 'number' && Number.isFinite(v)))
          g = ortala(s.x, s.y, s.k);
      } catch {
        /* bozuk kayıt */
      }
      if (!g) {
        const benim = regions.find((r) => r.isMine) ?? idIle.get(homeBolgeId) ?? regions[0]!;
        const [x, y] = yer(benim);
        g = ortala(x, y, boyut.en / 260);
      }
      gorunum.current = g;
    } else {
      gorunum.current = sinirla(gorunum.current);
    }
    tabanSurumu.current++;
    etiketleriKur(gorunum.current);
    setKademe(Math.round(gorunum.current.k * 100));
    cizdir();
  }, [geo, boyut.en, boyut.boy, altBosluk, regions.length > 0]);

  /* --- Seçilen bölge görünen alana --- */
  useEffect(() => {
    if (seciliId == null || !geo) return;
    const r = idIle.get(seciliId);
    if (!r) return;
    const [x, y] = yer(r);
    const g = gorunum.current;
    const sx = x * g.k + g.tx;
    const sy = y * g.k + g.ty;
    if (sx >= 36 && sx <= boyut.en - 36 && sy >= 80 && sy <= gorunurBoy - 36) return;
    gorunum.current = ortala(x, y, Math.max(g.k, 1.5));
    durdu();
    cizdir();
  }, [seciliId, altBosluk, geo]);

  /* --- Parmak, fare, tekerlek --- */
  function yakinlastir(ekranX: number, ekranY: number, yeniK: number) {
    const g = gorunum.current;
    const k = Math.min(EN_COK, Math.max(enAz, yeniK));
    const wx = (ekranX - g.tx) / g.k;
    const wy = (ekranY - g.ty) / g.k;
    gorunum.current = sinirla({ k, tx: ekranX - wx * k, ty: ekranY - wy * k });
    cizdir();
  }

  function nokta(e: { clientX: number; clientY: number }) {
    const r = kutuRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function indi(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (isaretciler.current.size === 1) hareket.current.mesafe = 0;
    if (isaretciler.current.size === 2) {
      const [a, b] = [...isaretciler.current.values()];
      hareket.current.ilkAralik = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      hareket.current.ilkK = gorunum.current.k;
      hareket.current.merkez = nokta({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
    }
  }

  function kaydi(e: React.PointerEvent) {
    const onceki = isaretciler.current.get(e.pointerId);
    if (!onceki) return;
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hareket.current.mesafe += Math.hypot(e.clientX - onceki.x, e.clientY - onceki.y);
    if (isaretciler.current.size === 2 && hareket.current.ilkAralik > 0) {
      const [a, b] = [...isaretciler.current.values()];
      const oran = Math.hypot(a!.x - b!.x, a!.y - b!.y) / hareket.current.ilkAralik;
      yakinlastir(hareket.current.merkez.x, hareket.current.merkez.y, hareket.current.ilkK * oran);
      return;
    }
    /*
     * Kenarda DİRENÇ, ölü jest değil: dünya sığmışken ya da kenara
     * gelinmişken parmak haritayı yine çekiyor (üçte bir hızla, en çok
     * TASMA piksel) ve bırakınca harita yerine yaylanıyor. Hiç
     * kıpırdamayan bir ekran oyuncuya donmuş görünüyordu (docs/23).
     */
    const g = gorunum.current;
    const [x0, x1, y0, y1] = kaymaAraligi(g.k);
    const diren = (v: number, d: number, lo: number, hi: number) => {
      const n = v + d;
      if ((n < lo && d < 0) || (n > hi && d > 0)) {
        return Math.min(hi + TASMA, Math.max(lo - TASMA, v + d * 0.35));
      }
      return n;
    };
    gorunum.current = {
      k: g.k,
      tx: diren(g.tx, e.clientX - onceki.x, x0, x1),
      ty: diren(g.ty, e.clientY - onceki.y, y0, y1),
    };
    cizdir();
  }

  /** Kenardan taşan görünümü yerine yaylandırır; sonra dinlenir. */
  function yaylan() {
    const bas = { ...gorunum.current };
    const hedef = sinirla(bas);
    if (Math.abs(hedef.tx - bas.tx) < 0.5 && Math.abs(hedef.ty - bas.ty) < 0.5) {
      gorunum.current = hedef;
      durdu();
      cizdir();
      return;
    }
    const t0 = performance.now();
    const adim = (t: number) => {
      // Parmak yeniden indiyse yay bırakılıyor: harita parmağın.
      if (isaretciler.current.size > 0) return;
      const p = Math.min(1, (t - t0) / 220);
      const e = 1 - (1 - p) ** 3;
      gorunum.current = {
        k: hedef.k,
        tx: bas.tx + (hedef.tx - bas.tx) * e,
        ty: bas.ty + (hedef.ty - bas.ty) * e,
      };
      cizdir();
      if (p < 1) requestAnimationFrame(adim);
      else durdu();
    };
    requestAnimationFrame(adim);
  }

  function kalkti(e: React.PointerEvent) {
    const surukledi = hareket.current.mesafe > SURUKLE_ESIGI;
    const tek = isaretciler.current.size === 1;
    isaretciler.current.delete(e.pointerId);
    if (isaretciler.current.size < 2) hareket.current.ilkAralik = 0;
    if (isaretciler.current.size === 0) {
      if (tek && !surukledi && e.type === 'pointerup') dokun(nokta(e));
      yaylan();
    }
  }

  function tekerlek(e: React.WheelEvent) {
    const p = nokta(e);
    yakinlastir(p.x, p.y, gorunum.current.k * Math.exp(-e.deltaY * 0.0015));
    durdu();
  }

  function dugmeyleYakinlastir(carpan: number) {
    yakinlastir(boyut.en / 2, gorunurBoy / 2, gorunum.current.k * carpan);
    durdu();
  }

  /** Dokunulan toprak: önce geometri, küçük topraklarda en yakın şehir noktası. */
  const vurusCtx = useMemo(() => document.createElement('canvas').getContext('2d'), []);
  function dokun(p: { x: number; y: number }) {
    if (!geo) return;
    const g = gorunum.current;
    const mx = (p.x - g.tx) / g.k;
    const my = (p.y - g.ty) / g.k;
    // Yakın bir şehir noktası (küçük toprak, ada): 14 piksel içindeki en yakını.
    let enYakin: { r: RegionDto; d: number } | null = null;
    for (const r of regions) {
      const [x, y] = yer(r);
      const d = Math.hypot((x - mx) * g.k, (y - my) * g.k);
      if (d < 14 && (!enYakin || d < enYakin.d)) enYakin = { r, d };
    }
    let isabet: Hucre | null = null;
    if (vurusCtx) {
      const o = geo.olcek;
      for (const h of geo.hucreler.values()) {
        const k = h.kutu;
        if (mx < k[0] || mx > k[2] || my < k[1] || my > k[3]) continue;
        if (vurusCtx.isPointInPath(h.yol, mx * o, my * o, 'evenodd')) {
          isabet = h;
          break;
        }
      }
    }
    const hucreBolgesi = isabet ? mapIdIle.get(isabet.mapId) : undefined;
    // Toprak ekranda küçükse (uzaktan bakış) nokta öncelikli.
    const kucuk = isabet ? Math.sqrt(isabet.alan) * g.k < 18 : true;
    const secilen = (kucuk ? enYakin?.r : undefined) ?? hucreBolgesi ?? enYakin?.r;
    if (secilen) onSec(secilen.id);
    else onBosDokun?.();
  }

  /* --- Testler ve ekran okuyucu için: bölgenin ekrandaki yeri --- */
  useEffect(() => {
    const w = window as unknown as { __dunyaHaritasi?: unknown };
    w.__dunyaHaritasi = {
      hazir: () => geo !== null,
      konum: (id: number) => {
        const r = idIle.get(id);
        if (!r || !geo) return null;
        const g = gorunum.current;
        const [x, y] = yer(r);
        const kutu = kutuRef.current?.getBoundingClientRect();
        return { x: (kutu?.left ?? 0) + x * g.k + g.tx, y: (kutu?.top ?? 0) + y * g.k + g.ty };
      },
      git: (id: number, k = 3) => {
        const r = idIle.get(id);
        if (!r) return;
        const [x, y] = yer(r);
        gorunum.current = ortala(x, y, k);
        durdu();
        cizdir();
      },
      /** Yakınlık ve kayma; `enAz` bütün dünyanın sığdığı yakınlık. */
      gorunum: () => ({ ...gorunum.current, enAz }),
      /** Bu yakınlıkta kaymanın izinli aralığı: [x0, x1, y0, y1]. */
      aralik: () => kaymaAraligi(gorunum.current.k),
      /** Son çizimde ekrana yazılan adlar. */
      etiketler: () => etiketler.current.map((e) => e.metin),
      /** O adların ekran kutuları: [x0, y0, x1, y1]. */
      etiketKutulari: () => etiketKutulari.current.map((k) => [...k]),
      /** Bölgenin o anki görünümdeki boyası. */
      boya: (id: number) => {
        const r = idIle.get(id);
        return r ? (boyamalar.get(r.mapId) ?? null) : null;
      },
    };
    return () => {
      delete w.__dunyaHaritasi;
    };
  });

  const sigdirilmis = geo ? kademe <= Math.round(enAz * 100) + 1 : true;

  return (
    <div
      ref={kutuRef}
      role="region"
      aria-label={`Dünya haritası, ${regions.length} şehir`}
      data-harita-hazir={geo ? '' : undefined}
      className="absolute inset-0 overflow-hidden select-none"
      style={{ touchAction: 'none', background: DENIZ }}
    >
      <canvas
        ref={tuvalRef}
        data-harita-tuval=""
        className="absolute inset-0 h-full w-full"
        onPointerDown={indi}
        onPointerMove={kaydi}
        onPointerUp={kalkti}
        onPointerCancel={kalkti}
        onWheel={tekerlek}
      />
      {!geo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-solgun">
          {hata ? 'Harita yüklenemedi — bağlantını kontrol et.' : 'Dünya haritası yükleniyor…'}
        </div>
      )}

      {/* --- Hedefler ve liste --- */}
      <div className="absolute top-2 left-2 flex gap-2">
        <button
          type="button"
          aria-pressed={mercek === 'hedef'}
          data-mercek="hedef"
          onClick={() => setMercek(mercek === 'hedef' ? 'siyasi' : 'hedef')}
          className={`bas flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold backdrop-blur ${
            mercek === 'hedef'
              ? 'border-kirmizi bg-kirmizi text-parsomen'
              : 'border-kenar bg-gece/80 text-parsomen'
          }`}
        >
          <IkonSaldiri boyut={14} />
          {mercek === 'hedef' ? 'Hedefler açık' : 'Hedefler'}
        </button>
        <button
          type="button"
          aria-expanded={listeAcik}
          data-harita-liste=""
          onClick={() => setListeAcik((a) => !a)}
          className={`bas flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold backdrop-blur ${
            listeAcik ? 'border-altin bg-altin text-gece' : 'border-kenar bg-gece/80 text-parsomen'
          }`}
        >
          <span aria-hidden>☰</span>
          Liste
        </button>
      </div>

      {listeAcik && (
        <BolgeListesi
          regions={regions}
          ulkem={ulkem}
          seciliId={seciliId}
          alt={altBosluk}
          onSec={(id) => {
            // Liste kapanıyor, kart açılıyor; harita şehri görünen alana getiriyor.
            setListeAcik(false);
            onSec(id);
          }}
          onKapat={() => setListeAcik(false)}
        />
      )}

      {/* --- Yakınlık ve evime dön --- */}
      <div
        data-arac-sutunu=""
        className="absolute top-2 right-2 flex flex-col divide-y divide-kenar overflow-hidden rounded-xl border border-kenar bg-gece/80 backdrop-blur"
      >
        <YakinlikDugmesi etiket="Yakınlaştır" isaret="+" onTikla={() => dugmeyleYakinlastir(1.6)} />
        <YakinlikDugmesi
          etiket="Uzaklaştır"
          isaret="−"
          onTikla={() => dugmeyleYakinlastir(1 / 1.6)}
        />
        <YakinlikDugmesi
          etiket="Kampıma git"
          isaret="⌂"
          onTikla={() => {
            const benim = regions.find((r) => r.isMine) ?? idIle.get(homeBolgeId);
            if (!benim) return;
            const [x, y] = yer(benim);
            gorunum.current = ortala(x, y, Math.max(gorunum.current.k, boyut.en / 260));
            durdu();
            cizdir();
          }}
        />
        {!sigdirilmis && (
          <YakinlikDugmesi
            etiket="Dünyayı göster"
            isaret="⊡"
            onTikla={() => {
              gorunum.current = sinirla({ k: enAz, tx: 0, ty: 0 });
              durdu();
              cizdir();
            }}
          />
        )}
      </div>

      {!gostergeGizli && !listeAcik && (
        <div
          className="pointer-events-none absolute left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-xl bg-gece/75 px-3 py-1 text-[11px] text-solgun backdrop-blur"
          style={{ bottom: altBosluk + 8 }}
          data-harita-gosterge=""
        >
          {mercek === 'hedef' ? (
            <>
              <Nokta renk="#e8524d" />
              lord
              <Nokta renk="#f0e1c8" />
              boş
              <Nokta renk="#2a221c" />
              sınır dışı
            </>
          ) : (
            <>
              <Nokta renk={ALTIN} />
              senin
              <Nokta renk="#e9c46a" kare />
              başkent (taht)
              <span className="text-solgun/80">· renkli: bir lordun</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Nokta({ renk, kare = false }: { renk: string; kare?: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 border border-parsomen/35 ${kare ? 'rotate-45' : 'rounded-full'}`}
      style={{ background: renk }}
      aria-hidden
    />
  );
}
