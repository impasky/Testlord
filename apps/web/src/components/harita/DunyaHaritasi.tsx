/**
 * Dünya haritası — noktalar değil TOPRAK (docs/23).
 *
 * Oyuncu: "Dünya haritası hâlâ verimsiz, nerenin ne olduğu anlaşılmıyor,
 * hangi bölge kimin belli değil. Haritayı sıfırdan yapmak istiyorum."
 *
 * Eski harita bir nokta haritasıydı: her bölge 24 piksellik bir madalyon,
 * madalyonun kendisi TÜRÜ söylüyordu, sahibini ise etrafındaki 2-3
 * piksellik halka. Oyuncunun ilk sorusu en küçük işarette kalıyordu.
 *
 * ── Katmanlar ──────────────────────────────────────────────────────────
 *
 *   zemin      dokuz karo; rengi kısık — bilgi katmanı öne çıksın diye
 *   toprak     her bölge bir Voronoi hücresi (packages/shared/src/toprak.ts),
 *              karaya kırpılı (kara.ts); rengi merceğe göre
 *   sınır      dört kademe: bölge ince, medeniyet orta, lord kalın, SEN altın
 *   etiket     lord adı kümenin ortasında BİR kez, medeniyet adları, tür
 *              simgeleri ve bölge adları yakınlığa göre
 *
 * ── Mercek: tek soru, tek boyama ─────────────────────────────────────
 *
 * Madalyon her soruyu aynı anda cevaplamaya çalışıyordu (tür, sahip,
 * medeniyet, sur, kalkan) ve 24 piksele beş boyut sığmıyordu. Mercek her
 * seferinde BİR soruyu cevaplıyor: Kim nerede, Hedefler, Medeniyetler,
 * Kaynaklar.
 *
 * ── Dokunma = toprak ─────────────────────────────────────────────────
 *
 * Dokunma hedefi artık 24 piksellik madalyon değil, bölgenin kendisi:
 * `data-bolge` toprağın `<path>`inde. Üst üste binen işaretçiler ve
 * "yanlış bölge açıldı" sorunu kökten kalktı. Kara kırpması dokunmayı da
 * kırpıyor: denize basan parmak bir kıyı bölgesini seçmiyor.
 *
 * ── Verim ────────────────────────────────────────────────────────────
 *
 * Kaydırma sırasında yalnız tuvalin `transform`u değişiyor. Toprak ve
 * etiket katmanları `memo`; etiketler ters ölçeğini bir CSS değişkeninden
 * (`--k`) alıyor, yani yakınlaştırırken React onları yeniden çizmiyor.
 * Etiket çakışması hareket BİTİNCE ölçülüyor, her karede değil.
 */
import {
  hedefDurumu,
  kumeler,
  sinirKenarlari,
  sinirTuru,
  toprakYolu,
  topraklar,
  gecitMi,
  VILAYET_ADI,
  type Sahiplik,
  type SinirTuru,
} from '@lordlar/shared';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { MarchDto, RegionDto } from '../../api/client';
import { IKONLAR } from '../ikon-verisi';
import { KARA_YOLU } from './kara';

export type Mercek = 'siyasi' | 'hedef' | 'medeniyet' | 'kaynak';

export const MERCEKLER: { key: Mercek; ad: string }[] = [
  { key: 'siyasi', ad: 'Kim nerede' },
  { key: 'hedef', ad: 'Hedefler' },
  { key: 'medeniyet', ad: 'Medeniyetler' },
  { key: 'kaynak', ad: 'Kaynaklar' },
];

const MERCEK_ANAHTARI = 'lordlar_harita_mercek';

/** Seçilen mercek cihazda hatırlanıyor — oyuncunun alışkanlığı. */
function kayitliMercek(): Mercek {
  try {
    const v = localStorage.getItem(MERCEK_ANAHTARI);
    if (v && MERCEKLER.some((m) => m.key === v)) return v as Mercek;
  } catch {
    /* gizli sekme ya da kapalı depo: varsayılan yeter */
  }
  return 'siyasi';
}

const ALTIN = '#f5b731';
const KARANLIK = '#0b0806';

/** Kaynaklar merceğinde türün rengi. Hiçbir sayıya dokunmuyor. */
const TIP_RENGI: Record<string, string> = {
  koy: '#b59a5a',
  tarla: '#7fa23f',
  maden: '#6f8aa6',
  sehir: '#d49a3c',
  kale: '#b2553f',
  taht: ALTIN,
};

const TIP_ADI: Record<string, string> = {
  koy: 'Köy',
  tarla: 'Tarla',
  maden: 'Maden',
  sehir: 'Şehir',
  kale: 'Kale',
  taht: 'Taht',
};

const TIP_IKON: Record<string, keyof typeof IKONLAR> = {
  koy: 'koy',
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'taht',
};

function TipIkonu({ tip, boyut }: { tip: string; boyut: number }) {
  const v = IKONLAR[TIP_IKON[tip] ?? 'tarla'];
  return (
    <svg
      viewBox={`0 0 ${v.w} ${v.h}`}
      width={boyut}
      height={boyut}
      aria-hidden="true"
      className="shrink-0"
      dangerouslySetInnerHTML={{ __html: v.body }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Görünüm: yakınlık ve kaydırma                                       */
/* ------------------------------------------------------------------ */

interface Gorunum {
  /** Yakınlık. 1: dünyanın eni kutunun enine eşit. */
  k: number;
  tx: number;
  ty: number;
}

const EN_COK = 4.5;
/*
 * Açılış ölçeği: dünyanın eninin ~%55'i görünüyor. Harita artık ekranın
 * çoğunu kaplıyor; eski ×2,4 bu kutuda fazla yakındı — denizle çevrili
 * bir köyde açılan oyuncu yalnız birkaç toprak görüyordu.
 */
const ACILIS = 1.8;
/** Kademe eşikleri: uzak (toprak ve adlar), orta (+ simgeler), yakın (+ bölge adları). */
const ORTA = 1.5;
const YAKIN = 2.6;
/** Sağdaki araç sütununun (küçük harita + üç düğme) alt kenarı. */
const ARAC_SUTUNU_ALTI = 48 + 64 + 3 * 50 + 12;
/** Bu kadar pikselden sonra parmak "dokundu" değil "kaydırdı" sayılıyor. */
const SURUKLE_ESIGI = 8;

type Kademe = 'uzak' | 'orta' | 'yakin';

export interface IttifakHedefi {
  regionId: number;
  etiket: string;
}

export function DunyaHaritasi({
  regions,
  homeBolgeId,
  seciliId,
  yuruyusler,
  ittifakHedefi,
  benimMedeniyetId,
  altBosluk,
  gostergeGizli = false,
  onSec,
  onBosDokun,
}: {
  regions: RegionDto[];
  /** Kampın çıpası: hangi bölgenin yanında durduğu. */
  homeBolgeId: number;
  seciliId: number | null;
  /** Yoldaki ordular: çizgi ve ilerleyen bir sancak. */
  yuruyusler: MarchDto[];
  /** İttifakın ortak hedefi. Haritada işaretli olmazsa hedef değil, nottur. */
  ittifakHedefi?: IttifakHedefi | null;
  /** Oyuncunun medeniyeti — Hedefler merceği "yoldaş toprağı"nı bununla ayırıyor. */
  benimMedeniyetId: string | null;
  /**
   * Haritanın altını kaplayan panelin yüksekliği (bölge kartı, çekmece).
   * Seçim bu payın ÜSTÜNDE ortalanıyor; gösterge onun üstüne oturuyor.
   */
  altBosluk: number;
  /** Kart ya da çekmece açıkken gösterge haritanın kalan parçasını boğmasın. */
  gostergeGizli?: boolean;
  onSec: (id: number) => void;
  /** Denize ya da boşluğa dokunuldu — açık bir kart varsa kapatmak için. */
  onBosDokun?: () => void;
}) {
  const kutuRef = useRef<HTMLDivElement>(null);
  const [boyut, setBoyut] = useState({ en: 0, boy: 0 });
  const [gorunum, setGorunum] = useState<Gorunum>({ k: 1, tx: 0, ty: 0 });
  const [animasyon, setAnimasyon] = useState(false);
  const [mercek, setMercekHam] = useState<Mercek>(kayitliMercek);
  const [yerlesim, setYerlesim] = useState(0);
  const acilisYapildi = useRef(false);
  // Geri çağrılar SABİT: katmanlar `memo` ve her çizimde yeni bir işlev
  // gelseydi kaydırmanın her karesinde 121 toprağı yeniden çizerlerdi.
  const secRef = useRef(onSec);
  secRef.current = onSec;
  const bosRef = useRef(onBosDokun);
  bosRef.current = onBosDokun;
  const sec = useCallback((id: number) => secRef.current(id), []);
  const bosDokun = useCallback(() => bosRef.current?.(), []);
  const isaretciler = useRef(new Map<number, { x: number; y: number }>());
  const hareket = useRef({
    mesafe: 0,
    ilkAralik: 0,
    ilkK: 1,
    merkez: { x: 0, y: 0 },
    // Parmağın götürdüğü HAM kayma: sınırın ötesinde esneme bundan hesaplanıyor.
    hamX: 0,
    hamY: 0,
  });

  function setMercek(m: Mercek) {
    setMercekHam(m);
    try {
      localStorage.setItem(MERCEK_ANAHTARI, m);
    } catch {
      /* depo yoksa oturum boyunca hatırlanıyor, o kadar */
    }
  }

  // Kutunun boyutu: tam ekran harita dönünce ya da klavye açılınca değişir.
  useLayoutEffect(() => {
    const el = kutuRef.current;
    if (!el) return;
    const olc = () => setBoyut({ en: el.clientWidth, boy: el.clientHeight });
    olc();
    const g = new ResizeObserver(olc);
    g.observe(el);
    return () => g.disconnect();
  }, []);

  const W = boyut.en; // dünyanın ×1'deki kenarı
  const gorunurBoy = Math.max(0, boyut.boy - altBosluk);
  // En uzak: bütün dünya görünür. Dikey telefonda eni, yatayda boyu sınırlar.
  const enAz = W > 0 && gorunurBoy > 0 ? Math.min(1, gorunurBoy / W) : 1;

  /** Bir eksende kaymanın izinli aralığı: dünya sığıyorsa ortası, sığmıyorsa kenarlar. */
  function aralik(D: number, pencere: number): [number, number] {
    return D <= pencere ? [(pencere - D) / 2, (pencere - D) / 2] : [pencere - D, 0];
  }

  function sinirla(g: Gorunum): Gorunum {
    const k = Math.min(EN_COK, Math.max(enAz, g.k));
    const D = W * k;
    const [x0, x1] = aralik(D, boyut.en);
    const [y0, y1] = aralik(D, gorunurBoy);
    return { k, tx: Math.min(x1, Math.max(x0, g.tx)), ty: Math.min(y1, Math.max(y0, g.ty)) };
  }

  /*
   * ESNEME. Harita sınırına gelen (ya da "sığdır"da hiç kayacak yeri
   * olmayan) parmak ÖLÜ bir jest yapmamalı: eskiden oyuncu bunu "harita
   * donuyor" diye bildirmişti — ekran oynamayınca donmuş bir ekrandan
   * ayırt edilemiyordu. Sınırın ötesinde harita parmağı dirençle izliyor,
   * parmak kalkınca yerine yaylanıyor.
   */
  function esnet(ham: number, [alt, ust]: [number, number]): number {
    if (ham < alt) return alt - (alt - ham) * 0.35;
    if (ham > ust) return ust + (ham - ust) * 0.35;
    return ham;
  }

  /** (x, y) yüzdelik noktayı görünen alanın ortasına getiren görünüm. */
  function ortala(x: number, y: number, k: number): Gorunum {
    return sinirla({
      k,
      tx: boyut.en / 2 - (x / 100) * W * k,
      ty: gorunurBoy / 2 - (y / 100) * W * k,
    });
  }

  /* --- Geometri: hücreler yalnız bölgelerin YERİ değişince --- */
  // Bağımlılık YER bilgisinin kendisi, dizi değil: harita her fetihte ve
  // saldırıda tazeleniyor; sahiplik değişti diye topraklar yeniden
  // hesaplanmasın — değişen yalnız boyama.
  const yerAnahtari = regions.map((r) => `${r.id}:${r.x}:${r.y}`).join('|');
  const hucreler = useMemo(
    () => topraklar(regions.map((r) => ({ id: r.id, x: r.x, y: r.y }))),
    [yerAnahtari],
  );
  const yollar = useMemo(() => {
    const m = new Map<number, string>();
    for (const [id, h] of hucreler) m.set(id, toprakYolu(h));
    return m;
  }, [hucreler]);
  const kenarlar = useMemo(() => sinirKenarlari(hucreler), [hucreler]);
  const bolgeHaritasi = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);

  /* --- Açılış: senin toprağının üstünde, yakın --- */
  const benimKumem = useMemo(() => {
    const k = kumeler(hucreler, (id) => (bolgeHaritasi.get(id)?.isMine ? 'ben' : null));
    return k[0] ?? null;
  }, [hucreler, bolgeHaritasi]);

  useEffect(() => {
    if (acilisYapildi.current || regions.length === 0 || W === 0) return;
    acilisYapildi.current = true;
    const ev = bolgeHaritasi.get(homeBolgeId) ?? regions[0]!;
    const hedef = benimKumem?.merkez ?? { x: ev.x, y: ev.y };
    setGorunum(ortala(hedef.x, hedef.y, ACILIS));
    // Yalnız BİR kez: oyuncu haritayı kaydırdıktan sonra her tazelemede
    // onu eve geri fırlatmak, elinden haritayı almak olurdu.
  }, [regions.length, W]);

  /*
   * SEÇİLEN BÖLGE GÖRÜNEN ALANA getiriliyor — omurga, ittifak hedefi ya
   * da olay akışı seçimi değiştirebiliyor. Kart açılınca görünen alan
   * küçülüyor (altBosluk); seçim kartın altında kalmamalı. Zaten
   * görünüyorsa kıpırdamıyor: oyuncunun kurduğu görüntüyü bozmamak için.
   */
  useEffect(() => {
    if (seciliId == null || W === 0) return;
    const r = bolgeHaritasi.get(seciliId);
    if (!r) return;
    const sx = (r.x / 100) * W * gorunum.k + gorunum.tx;
    const sy = (r.y / 100) * W * gorunum.k + gorunum.ty;
    const PAY = 36;
    if (sx >= PAY && sx <= boyut.en - PAY && sy >= PAY + 44 && sy <= gorunurBoy - PAY) return;
    setAnimasyon(true);
    setGorunum(ortala(r.x, r.y, Math.max(gorunum.k, ORTA)));
  }, [seciliId, altBosluk, W]);

  // Kutu küçülünce (kart açıldı) görünüm yeni sınırlara otursun.
  useEffect(() => {
    setGorunum((g) => sinirla(g));
  }, [boyut.en, boyut.boy, altBosluk]);

  /* --- Parmak ve fare --- */
  function yakinlastir(ekranX: number, ekranY: number, yeniK: number) {
    setGorunum((g) => {
      const k = Math.min(EN_COK, Math.max(enAz, yeniK));
      const wx = (ekranX - g.tx) / g.k;
      const wy = (ekranY - g.ty) / g.k;
      return sinirla({ k, tx: ekranX - wx * k, ty: ekranY - wy * k });
    });
  }

  function kutuNoktasi(e: { clientX: number; clientY: number }) {
    const r = kutuRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function indi(e: React.PointerEvent) {
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimasyon(false);
    if (isaretciler.current.size === 1) {
      hareket.current.mesafe = 0;
      hareket.current.hamX = gorunum.tx;
      hareket.current.hamY = gorunum.ty;
    }
    if (isaretciler.current.size === 2) {
      const [a, b] = [...isaretciler.current.values()];
      hareket.current.ilkAralik = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      hareket.current.ilkK = gorunum.k;
      hareket.current.merkez = kutuNoktasi({
        clientX: (a!.x + b!.x) / 2,
        clientY: (a!.y + b!.y) / 2,
      });
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
    hareket.current.hamX += e.clientX - onceki.x;
    hareket.current.hamY += e.clientY - onceki.y;
    const { hamX, hamY } = hareket.current;
    setGorunum((g) => {
      const D = W * g.k;
      return {
        k: g.k,
        tx: esnet(hamX, aralik(D, boyut.en)),
        ty: esnet(hamY, aralik(D, gorunurBoy)),
      };
    });
  }

  function kalkti(e: React.PointerEvent) {
    isaretciler.current.delete(e.pointerId);
    if (isaretciler.current.size < 2) hareket.current.ilkAralik = 0;
    if (isaretciler.current.size === 1) {
      // Kıstırmadan tek parmağa dönüş: kalan parmak kaldığı yerden sürüklesin.
      hareket.current.hamX = gorunum.tx;
      hareket.current.hamY = gorunum.ty;
    }
    if (isaretciler.current.size === 0) {
      // Esnediyse yerine yaylansın; etiket çakışması hareket BİTİNCE ölçülüyor.
      const yerli = sinirla(gorunum);
      if (yerli.tx !== gorunum.tx || yerli.ty !== gorunum.ty) {
        setAnimasyon(true);
        setGorunum(yerli);
      }
      setYerlesim((n) => n + 1);
    }
  }

  function tekerlek(e: React.WheelEvent) {
    const p = kutuNoktasi(e);
    setAnimasyon(false);
    yakinlastir(p.x, p.y, gorunum.k * Math.exp(-e.deltaY * 0.0015));
    setYerlesim((n) => n + 1);
  }

  function dugmeyleYakinlastir(carpan: number) {
    setAnimasyon(true);
    yakinlastir(boyut.en / 2, gorunurBoy / 2, gorunum.k * carpan);
    setYerlesim((n) => n + 1);
  }

  const kademe: Kademe = gorunum.k >= YAKIN ? 'yakin' : gorunum.k >= ORTA ? 'orta' : 'uzak';

  /* --- Boyama --- */
  const sahiplik = (id: number): Sahiplik => {
    const r = bolgeHaritasi.get(id);
    return {
      benim: Boolean(r?.isMine),
      lord: r?.owner?.id ?? null,
      medeniyet: r?.medeniyet?.id ?? null,
    };
  };

  const boyama = useMemo(() => {
    const m = new Map<number, { renk: string; alfa: number }>();
    for (const r of regions) m.set(r.id, toprakRengi(r, mercek, benimMedeniyetId));
    return m;
  }, [regions, mercek, benimMedeniyetId]);

  const sinirlar = useMemo(() => {
    const yol: Record<SinirTuru, string[]> = { ic: [], medeniyet: [], lord: [], ben: [] };
    for (const k of kenarlar) {
      const a = sahiplik(k.a);
      const b = sahiplik(k.b);
      let tur: SinirTuru;
      if (mercek === 'siyasi') tur = sinirTuru(a, b);
      else if (mercek === 'medeniyet') tur = sinirTuru({ ...a, lord: null }, { ...b, lord: null });
      else if (a.benim !== b.benim) tur = 'ben';
      // Kaynaklar'da orta çizgi VİLAYET sınırı: vilayet birliği bir gelir
      // kuralı ve "aynı vilayette mi" sorusunun cevabı bu çizgi.
      else if (
        mercek === 'kaynak' &&
        bolgeHaritasi.get(k.a)?.province !== bolgeHaritasi.get(k.b)?.province
      )
        tur = 'medeniyet';
      else tur = 'ic';
      // Birleştirme, şablon değil: şablon dizgeyi çeviri çıkarıcısı metin sanıyor.
      yol[tur].push(
        'M' +
          k.p.x.toFixed(2) +
          ' ' +
          k.p.y.toFixed(2) +
          'L' +
          k.q.x.toFixed(2) +
          ' ' +
          k.q.y.toFixed(2),
      );
    }
    return {
      ic: yol.ic.join(''),
      medeniyet: yol.medeniyet.join(''),
      lord: yol.lord.join(''),
      ben: yol.ben.join(''),
    };
  }, [kenarlar, regions, mercek]);

  /* --- Etiketler --- */
  const lordKumeleri = useMemo(() => {
    const ad = new Map(regions.filter((r) => r.owner).map((r) => [r.owner!.id, r.owner!.name]));
    return kumeler(hucreler, (id) => {
      const r = bolgeHaritasi.get(id);
      if (!r?.owner || r.type === 'taht') return null;
      return r.isMine ? 'ben' : r.owner.id;
    }).map((k) => ({
      ...k,
      ad: k.anahtar === 'ben' ? 'SEN' : (ad.get(k.anahtar) ?? ''),
      benim: k.anahtar === 'ben',
    }));
  }, [hucreler, regions, bolgeHaritasi]);

  const medeniyetKumeleri = useMemo(() => {
    const bilgi = new Map(
      regions.filter((r) => r.medeniyet).map((r) => [r.medeniyet!.id, r.medeniyet!]),
    );
    const enBuyuk = new Map<string, ReturnType<typeof kumeler>[number]>();
    for (const k of kumeler(hucreler, (id) => bolgeHaritasi.get(id)?.medeniyet?.id ?? null)) {
      if (!enBuyuk.has(k.anahtar)) enBuyuk.set(k.anahtar, k);
    }
    return [...enBuyuk.values()].map((k) => ({ ...k, bilgi: bilgi.get(k.anahtar)! }));
  }, [hucreler, regions, bolgeHaritasi]);

  const vilayetKumeleri = useMemo(() => {
    const enBuyuk = new Map<string, ReturnType<typeof kumeler>[number]>();
    for (const k of kumeler(hucreler, (id) => {
      const p = bolgeHaritasi.get(id)?.province;
      return p && p !== 'taht' ? p : null;
    })) {
      if (!enBuyuk.has(k.anahtar)) enBuyuk.set(k.anahtar, k);
    }
    return [...enBuyuk.values()].map((k) => ({
      anahtar: k.anahtar,
      merkez: k.merkez,
      ad: VILAYET_ADI[k.anahtar] ?? k.anahtar,
    }));
  }, [hucreler, bolgeHaritasi]);

  // Yürüyüş sancağı her saniye ilerliyor; yürüyüş yokken zamanlayıcı yok.
  const [, tik] = useState(0);
  useEffect(() => {
    if (yuruyusler.length === 0) return;
    const z = setInterval(() => tik((n) => n + 1), 1000);
    return () => clearInterval(z);
  }, [yuruyusler.length]);

  /* --- Etiket seyreltme: çakışanı sustur (hareket bitince) --- */
  const tuvalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const kutu = tuvalRef.current;
    if (!kutu) return;
    const kare = requestAnimationFrame(() => {
      const etiketler = [...kutu.querySelectorAll<HTMLElement>('[data-oncelik]')];
      for (const e of etiketler) e.style.visibility = '';
      const sirali = etiketler
        .map((e) => ({ e, o: Number(e.dataset.oncelik ?? 9) }))
        .sort((a, b) => a.o - b.o);
      const yerlesen: DOMRect[] = [];
      for (const { e } of sirali) {
        const r = e.getBoundingClientRect();
        if (r.width === 0) continue;
        const carpisti = yerlesen.some(
          (o) =>
            r.left < o.right + 2 &&
            o.left < r.right + 2 &&
            r.top < o.bottom + 2 &&
            o.top < r.bottom + 2,
        );
        if (carpisti) e.style.visibility = 'hidden';
        else yerlesen.push(r);
      }
    });
    return () => cancelAnimationFrame(kare);
  }, [kademe, mercek, regions, seciliId, yerlesim, W]);

  /* --- Ekran dışındaki ordular ve toprak: kenarda ok --- */
  const disaridakiler = useMemo(() => {
    if (W === 0 || gorunum.k <= enAz + 0.02) return [];
    const adaylar: { anahtar: string; ad: string; x: number; y: number; renk: string }[] = [];
    for (const y of yuruyusler) {
      const h = bolgeHaritasi.get(y.toRegionId);
      if (h) {
        adaylar.push({
          anahtar: `y${y.id}`,
          ad: y.kind === 'return' ? 'Dönen ordun' : `Ordun ${h.name} yolunda`,
          x: h.x,
          y: h.y,
          renk: y.kind === 'return' ? '#3ddc84' : '#e8524d',
        });
      }
    }
    if (benimKumem) {
      adaylar.push({ anahtar: 'ben', ad: 'Toprağın', ...benimKumem.merkez, renk: ALTIN });
    } else {
      const ev = bolgeHaritasi.get(homeBolgeId);
      if (ev) adaylar.push({ anahtar: 'ev', ad: 'Kampın', x: ev.x, y: ev.y, renk: ALTIN });
    }
    const PAY = 24;
    const sonuc = [];
    for (const a of adaylar) {
      if (sonuc.length >= 4) break;
      const sx = (a.x / 100) * W * gorunum.k + gorunum.tx;
      const sy = (a.y / 100) * W * gorunum.k + gorunum.ty;
      if (sx >= 0 && sx <= boyut.en && sy >= 44 && sy <= gorunurBoy) continue;
      const aci = (Math.atan2(sy - gorunurBoy / 2, sx - boyut.en / 2) * 180) / Math.PI;
      const ekranX = Math.max(PAY, Math.min(boyut.en - PAY, sx));
      let ekranY = Math.max(PAY + 44, Math.min(gorunurBoy - PAY - 40, sy));
      // Sağ kenarda araç sütunu (küçük harita + yakınlık) duruyor: ok
      // onun üstüne binmesin, altına kaysın.
      if (ekranX > boyut.en - 64 && ekranY < ARAC_SUTUNU_ALTI) ekranY = ARAC_SUTUNU_ALTI;
      sonuc.push({ ...a, ekranX, ekranY, aci });
    }
    return sonuc;
  }, [yuruyusler, bolgeHaritasi, benimKumem, homeBolgeId, gorunum, W, boyut.en, gorunurBoy, enAz]);

  const ev = bolgeHaritasi.get(homeBolgeId) ?? regions[0];
  const D = W * gorunum.k;

  return (
    <div
      ref={kutuRef}
      role="region"
      aria-label={`Dünya haritası, ${regions.length} bölge`}
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        touchAction: 'none',
        background: 'radial-gradient(ellipse at 50% 45%, #1d2a30 0%, #142128 55%, #0d171d 100%)',
      }}
      onPointerDown={indi}
      onPointerMove={kaydi}
      onPointerUp={kalkti}
      onPointerCancel={kalkti}
      onWheel={tekerlek}
      // Kaydırmadan sonra kalkan parmak bir bölge SEÇMEZ. Yalnız tuvalde:
      // kenardaki düğmelerin tıklaması önceki kaydırmanın payını taşımamalı.
      onClickCapture={(e) => {
        const tuvalde = (e.target as Element).closest?.('[data-harita-tuval]');
        if (tuvalde && hareket.current.mesafe > SURUKLE_ESIGI) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {W > 0 && (
        <div
          ref={tuvalRef}
          data-harita-tuval=""
          className={`absolute top-0 left-0 ${animasyon ? 'transition-transform duration-300 ease-out motion-reduce:transition-none' : ''}`}
          style={
            {
              width: W,
              height: W,
              transform: `translate3d(${gorunum.tx}px, ${gorunum.ty}px, 0) scale(${gorunum.k})`,
              transformOrigin: '0 0',
              willChange: 'transform',
              '--k': gorunum.k,
            } as CSSProperties
          }
          onTransitionEnd={() => {
            setAnimasyon(false);
            setYerlesim((n) => n + 1);
          }}
        >
          <Zemin />
          <ToprakKatmani
            regions={regions}
            yollar={yollar}
            boyama={boyama}
            sinirlar={sinirlar}
            seciliId={seciliId}
            ittifakHedefiId={ittifakHedefi?.regionId ?? null}
            mercek={mercek}
            onSec={sec}
            onBosDokun={bosDokun}
          />
          <YuruyusCizgileri yuruyusler={yuruyusler} bolgeler={bolgeHaritasi} ev={ev} />
          <Etiketler
            regions={regions}
            kademe={kademe}
            mercek={mercek}
            seciliId={seciliId}
            homeBolgeId={homeBolgeId}
            lordKumeleri={lordKumeleri}
            medeniyetKumeleri={medeniyetKumeleri}
            vilayetKumeleri={vilayetKumeleri}
            ittifakHedefId={ittifakHedefi?.regionId ?? null}
            ittifakEtiket={ittifakHedefi?.etiket ?? null}
          />
          <YuruyusSancaklari yuruyusler={yuruyusler} bolgeler={bolgeHaritasi} ev={ev} />
        </div>
      )}

      {/* --- Mercek seçimi: tepede, parmağın kolay ulaştığı çipler --- */}
      <div
        className="absolute top-2 right-2 left-2 flex gap-1.5 overflow-x-auto"
        role="group"
        aria-label="Harita merceği"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {MERCEKLER.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={mercek === m.key}
            data-mercek={m.key}
            onClick={() => setMercek(m.key)}
            className={`bas h-9 shrink-0 rounded-full border px-2.5 text-[11.5px] font-bold whitespace-nowrap backdrop-blur ${
              mercek === m.key
                ? 'border-altin bg-altin text-gece'
                : 'border-kenar bg-gece/80 text-solgun'
            }`}
          >
            {m.ad}
          </button>
        ))}
      </div>

      {/* --- Sağ sütun: küçük harita ve yakınlık --- */}
      <div
        className="absolute top-12 right-2 flex flex-col items-end gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <KucukHarita
          regions={regions}
          gorunum={gorunum}
          W={W}
          en={boyut.en}
          boy={gorunurBoy}
          onGit={(x, y) => {
            setAnimasyon(true);
            setGorunum(ortala(x, y, Math.max(gorunum.k, ORTA)));
            setYerlesim((n) => n + 1);
          }}
        />
        <YakinlikDugmesi etiket="Yakınlaştır" isaret="+" onTikla={() => dugmeyleYakinlastir(1.5)} />
        <YakinlikDugmesi
          etiket="Uzaklaştır"
          isaret="−"
          onTikla={() => dugmeyleYakinlastir(1 / 1.5)}
        />
        {gorunum.k > enAz + 0.02 && (
          <YakinlikDugmesi
            etiket="Haritayı sığdır"
            isaret="⊡"
            onTikla={() => {
              setAnimasyon(true);
              setGorunum(sinirla({ k: enAz, tx: 0, ty: 0 }));
              setYerlesim((n) => n + 1);
            }}
          />
        )}
      </div>

      {/* --- Ekran dışı okları --- */}
      {disaridakiler.map((d) => (
        <button
          key={d.anahtar}
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setAnimasyon(true);
            setGorunum(ortala(d.x, d.y, Math.max(gorunum.k, ORTA)));
            setYerlesim((n) => n + 1);
          }}
          aria-label={`${d.ad} — haritada göster`}
          title={`${d.ad} — haritada göster`}
          className="bas absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ left: d.ekranX, top: d.ekranY }}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gece/70 text-[13px] shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            style={{ background: d.renk, color: '#17100c' }}
          >
            <span style={{ transform: `rotate(${d.aci}deg)` }}>➤</span>
          </span>
        </button>
      ))}

      {/* --- Gösterge: merceğe göre, tek satır --- */}
      {!gostergeGizli && (
        <Gosterge
          mercek={mercek}
          regions={regions}
          benimMedeniyetId={benimMedeniyetId}
          alt={altBosluk}
        />
      )}

      {/* Ekran okuyucuya haritanın ne gösterdiği. */}
      <p className="sr-only" aria-live="polite">
        {`${MERCEKLER.find((m) => m.key === mercek)?.ad} merceği. Görünen alan ${Math.round(
          Math.min(1, boyut.en / Math.max(1, D)) * 100,
        )}%.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Merceklerin boyaması                                                */
/* ------------------------------------------------------------------ */

function toprakRengi(
  r: RegionDto,
  mercek: Mercek,
  benimMedeniyetId: string | null,
): { renk: string; alfa: number } {
  const med = r.medeniyet?.renk ?? null;
  switch (mercek) {
    case 'siyasi': {
      // Renk = SAHİP. Altın sen; medeniyet rengi dolu: o medeniyetten
      // bir lordun toprağı; soluk: lordu yok ama medeniyetin elinde.
      if (r.isMine) return { renk: ALTIN, alfa: 0.55 };
      if (r.owner) return { renk: med ?? '#c8453b', alfa: 0.55 };
      if (r.type === 'taht') return { renk: ALTIN, alfa: 0.28 };
      if (med) return { renk: med, alfa: 0.2 };
      return { renk: '#000', alfa: 0 };
    }
    case 'medeniyet': {
      if (med) return { renk: med, alfa: r.owner ? 0.55 : 0.38 };
      if (r.type === 'taht') return { renk: ALTIN, alfa: 0.28 };
      return { renk: '#000', alfa: 0 };
    }
    case 'kaynak':
      return { renk: TIP_RENGI[r.type] ?? '#8a7a52', alfa: 0.5 };
    case 'hedef': {
      const d = hedefDurumu(r, benimMedeniyetId);
      if (d.tur === 'benim') return { renk: ALTIN, alfa: 0.5 };
      if (d.tur === 'yasak') return { renk: KARANLIK, alfa: 0.62 };
      // Yakın olan parlak: bitişik (1 adım) en canlı, uzaklaştıkça söner.
      const renk = r.owner ? '#e8524d' : '#f0e1c8';
      const alfa = d.adim <= 1 ? 0.5 : d.adim === 2 ? 0.32 : d.adim === 3 ? 0.18 : 0;
      return alfa > 0 ? { renk, alfa } : { renk: KARANLIK, alfa: 0.45 };
    }
  }
}

/** Erişilebilir ad — testler ve ekran okuyucu bölgeyi bununla buluyor. */
function bolgeEtiketi(r: RegionDto): string {
  const sur = r.fortressBonus > 0 ? `, tahkimat +%${Math.round(r.fortressBonus * 100)}` : '';
  return `${r.name} — ${r.type}, seviye ${r.level}, ${
    r.owner ? `sahibi ${r.owner.name}` : 'sahipsiz'
  }${r.medeniyet ? `, ${r.medeniyet.ad}` : ''}${
    r.cekirdek ? ', çekirdek — ele geçirilemez' : ''
  }, ${r.distance} adım${sur}`;
}

/* ------------------------------------------------------------------ */
/* Katmanlar                                                           */
/* ------------------------------------------------------------------ */

const ZEMIN_KAROLARI = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ c, r })));

/**
 * Zemin: dokuz karo, rengi kısık. Resim bilgi değil, YER hissi — toprak
 * renkleri onun üstünde okunmalı. Karolar %33,34: ölçek büyüyünce
 * yuvarlanmada aralarında kıl gibi çizgi kalmasın diye bir tık bindiriyor.
 */
const Zemin = memo(function Zemin() {
  return (
    <div
      className="absolute inset-0"
      style={{ filter: 'saturate(0.5) brightness(0.78)' }}
      aria-hidden="true"
    >
      <img
        src="/gorseller/harita/dunya-onizleme.webp"
        alt=""
        className="absolute inset-0 h-full w-full"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
      />
      {ZEMIN_KAROLARI.map(({ c, r }) => (
        <img
          key={`${c}${r}`}
          src={`/gorseller/harita/dunya-${c}${r}.webp`}
          alt=""
          className="absolute"
          style={{
            left: `${(c * 100) / 3}%`,
            top: `${(r * 100) / 3}%`,
            width: '33.34%',
            height: '33.34%',
          }}
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
        />
      ))}
    </div>
  );
});

const ToprakKatmani = memo(function ToprakKatmani({
  regions,
  yollar,
  boyama,
  sinirlar,
  seciliId,
  ittifakHedefiId,
  mercek,
  onSec,
  onBosDokun,
}: {
  regions: RegionDto[];
  yollar: Map<number, string>;
  boyama: Map<number, { renk: string; alfa: number }>;
  sinirlar: Record<SinirTuru, string>;
  seciliId: number | null;
  ittifakHedefiId: number | null;
  mercek: Mercek;
  onSec: (id: number) => void;
  onBosDokun: () => void;
}) {
  const secili = seciliId != null ? yollar.get(seciliId) : undefined;
  const hedef = ittifakHedefiId != null ? yollar.get(ittifakHedefiId) : undefined;
  const muttefikler = regions.filter((r) => r.muttefik && !r.isMine);
  // Yollar ve geçitler yalnız Hedefler merceğinde: orada soru "nereye
  // kaç adımda gidilir" ve cevabı yol grafiği.
  const yolCizgileri = useMemo(() => {
    if (mercek !== 'hedef') return null;
    const yer = new Map(regions.map((r) => [r.id, r]));
    const sade: string[] = [];
    const gecit: string[] = [];
    for (const r of regions) {
      for (const k of r.komsular) {
        if (k <= r.id) continue;
        const o = yer.get(k);
        if (!o) continue;
        (gecitMi(r.id, k) ? gecit : sade).push('M' + r.x + ' ' + r.y + 'L' + o.x + ' ' + o.y);
      }
    }
    return { sade: sade.join(''), gecit: gecit.join('') };
  }, [regions, mercek]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      data-toprak-katmani=""
    >
      <defs>
        {/*
          KARA KIRPMASI. Toprak denize taşmıyor ve denize dokunan parmak
          kıyı bölgesini seçmiyor. Her bölgenin çevresine küçük bir daire
          de ekleniyor: kara çizgisi zeminden OKUNUYOR ve bir bölge kıyıda
          yanlış tarafta kalırsa görünmez, dokunulamaz olmamalı.
        */}
        <clipPath id="kara-kirpma" clipPathUnits="userSpaceOnUse">
          <path d={KARA_YOLU} clipRule="evenodd" />
          {regions.map((r) => (
            <circle key={r.id} cx={r.x} cy={r.y} r={1.8} />
          ))}
        </clipPath>
      </defs>

      {/* Denize dokunmak: açık kartı kapatır. */}
      <rect x={0} y={0} width={100} height={100} fill="transparent" onClick={onBosDokun} />

      <g clipPath="url(#kara-kirpma)">
        {regions.map((r) => {
          const b = boyama.get(r.id) ?? { renk: '#000', alfa: 0 };
          return (
            <path
              key={r.id}
              d={yollar.get(r.id)}
              fill={b.renk}
              fillOpacity={b.alfa}
              pointerEvents="all"
              role="button"
              tabIndex={0}
              aria-label={bolgeEtiketi(r)}
              data-bolge={r.id}
              data-x={r.x}
              data-y={r.y}
              className="cursor-pointer outline-none focus-visible:stroke-white"
              onClick={() => onSec(r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSec(r.id);
                }
              }}
            >
              <title>{bolgeEtiketi(r)}</title>
            </path>
          );
        })}

        {/* Sınırlar: ince → kalın. Kalınlık ekran pikseli (yakınlaşınca kalınlaşmaz). */}
        <g pointerEvents="none" fill="none" strokeLinecap="round">
          <path
            d={sinirlar.ic}
            stroke="rgba(20,14,10,0.42)"
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={sinirlar.medeniyet}
            stroke="rgba(18,12,8,0.78)"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={sinirlar.lord}
            stroke="#110b07"
            strokeWidth={2.6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={sinirlar.ben}
            stroke={ALTIN}
            strokeWidth={2.8}
            vectorEffect="non-scaling-stroke"
          />
          {/* İttifak arkadaşı: beyaz kesik sınır — renk medeniyetin, kesik çizgi ittifakın. */}
          {muttefikler.map((r) => (
            <path
              key={r.id}
              d={yollar.get(r.id)}
              stroke="rgba(245,240,230,0.85)"
              strokeWidth={1.4}
              strokeDasharray="3 2.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {yolCizgileri && (
            <>
              <path
                d={yolCizgileri.sade}
                stroke="#e6d3ae"
                strokeWidth={0.8}
                opacity={0.35}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={yolCizgileri.gecit}
                stroke="#ff8c3a"
                strokeWidth={1.8}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {hedef && (
            <path
              d={hedef}
              stroke="#7cc4f0"
              strokeWidth={2.4}
              strokeDasharray="5 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {secili && (
            <>
              <path
                d={secili}
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={6}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={secili}
                stroke="#fff6dc"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                className="secili-toprak"
              />
            </>
          )}
        </g>
      </g>

      {/* Kıyı çizgisi: toprak bittiği yerde net bitsin. */}
      <path
        d={KARA_YOLU}
        fill="none"
        stroke="rgba(8,6,4,0.55)"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    </svg>
  );
});

const YuruyusCizgileri = memo(function YuruyusCizgileri({
  yuruyusler,
  bolgeler,
  ev,
}: {
  yuruyusler: MarchDto[];
  bolgeler: Map<number, RegionDto>;
  ev: RegionDto | undefined;
}) {
  if (!ev || yuruyusler.length === 0) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {yuruyusler.map((y) => {
        const h = bolgeler.get(y.toRegionId);
        if (!h) return null;
        return (
          <line
            key={y.id}
            x1={ev.x}
            y1={ev.y}
            x2={h.x}
            y2={h.y}
            stroke={y.kind === 'return' ? '#3ddc84' : '#e8524d'}
            strokeWidth={2}
            strokeDasharray="5 4"
            opacity={0.8}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
});

/** Ters ölçek: harita yakınlaşınca etiket aynı piksel boyunda kalıyor. */
const TERS: CSSProperties = { transform: 'translate(-50%, -50%) scale(calc(1 / var(--k)))' };

/**
 * Yoldaki ordunun sancağı. Yeri gerçek: çıkış ve varış zamanından
 * oranlanıyor. Direk dik, bez gidiş yönüne bakıyor; dönüşte yeşil.
 */
function YuruyusSancaklari({
  yuruyusler,
  bolgeler,
  ev,
}: {
  yuruyusler: MarchDto[];
  bolgeler: Map<number, RegionDto>;
  ev: RegionDto | undefined;
}) {
  if (!ev) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {yuruyusler.map((y) => {
        const h = bolgeler.get(y.toRegionId);
        if (!h) return null;
        const bas = new Date(y.departAt).getTime();
        const bit = new Date(y.arriveAt).getTime();
        const oran = bit > bas ? Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas))) : 1;
        const donus = y.kind === 'return';
        const [bx, by, hx, hy] = donus ? [h.x, h.y, ev.x, ev.y] : [ev.x, ev.y, h.x, h.y];
        const renk = donus ? '#3ddc84' : '#e8524d';
        return (
          <span
            key={y.id}
            className="absolute"
            data-yuruyus={y.id}
            style={{ left: `${bx + (hx - bx) * oran}%`, top: `${by + (hy - by) * oran}%`, ...TERS }}
          >
            <svg width="22" height="26" viewBox="-6 -8 12 10" aria-hidden="true">
              <line
                x1={0}
                y1={0.6}
                x2={0}
                y2={-6.6}
                stroke="#17100c"
                strokeWidth={1.1}
                strokeLinecap="round"
              />
              <path
                d={`M0 -6.5 L${hx >= bx ? 4.6 : -4.6} -5 L0 -3.5 Z`}
                fill={renk}
                stroke="#17100c"
                strokeWidth={0.6}
                strokeLinejoin="round"
              />
              <circle cx={0} cy={0.6} r={1.2} fill={renk} stroke="#17100c" strokeWidth={0.6} />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

const Etiketler = memo(function Etiketler({
  regions,
  kademe,
  mercek,
  seciliId,
  homeBolgeId,
  lordKumeleri,
  medeniyetKumeleri,
  vilayetKumeleri,
  ittifakHedefId,
  ittifakEtiket,
}: {
  regions: RegionDto[];
  kademe: Kademe;
  mercek: Mercek;
  seciliId: number | null;
  homeBolgeId: number;
  lordKumeleri: {
    merkez: { x: number; y: number };
    ad: string;
    benim: boolean;
    alan: number;
    anahtar: string;
  }[];
  medeniyetKumeleri: {
    merkez: { x: number; y: number };
    bilgi: { id: string; ad: string; renk: string };
    anahtar: string;
  }[];
  vilayetKumeleri: { anahtar: string; merkez: { x: number; y: number }; ad: string }[];
  ittifakHedefId: number | null;
  ittifakEtiket: string | null;
}) {
  const uzak = kademe === 'uzak';
  const yakin = kademe === 'yakin';
  // Lord adları "Kim nerede"de; uzakta yalnız büyük topraklar (ve SEN).
  const lordAdlari = mercek === 'siyasi';
  // Medeniyet adları: Medeniyetler merceğinde her zaman, Kim nerede'de uzakta.
  const medeniyetAdlari = mercek === 'medeniyet' || (mercek === 'siyasi' && uzak);
  const simgeler = !uzak;

  return (
    <div className="pointer-events-none absolute inset-0">
      {medeniyetAdlari &&
        medeniyetKumeleri.map((m) => (
          <span
            key={`m-${m.anahtar}`}
            data-medeniyet-ad=""
            data-oncelik={3}
            className="baslik absolute text-[13px] tracking-[0.22em] whitespace-nowrap"
            style={{
              left: `${m.merkez.x}%`,
              top: `${m.merkez.y}%`,
              color: m.bilgi.renk,
              filter: 'brightness(1.45)',
              textShadow: '0 0 4px #0a0705, 0 0 8px #0a0705, 0 1px 2px #0a0705',
              ...TERS,
            }}
          >
            {m.bilgi.ad.toLocaleUpperCase('tr')}
          </span>
        ))}

      {/* Vilayet adları Kaynaklar'da, yakınlaşınca çekiliyor: o ölçekte
          bölge adları yazılıyor ve ikisi aynı yerde birbirini okutmaz. */}
      {mercek === 'kaynak' &&
        !yakin &&
        vilayetKumeleri.map((v) => (
          <span
            key={`v-${v.anahtar}`}
            data-vilayet-ad=""
            data-oncelik={3}
            className="baslik absolute text-[12px] tracking-[0.22em] whitespace-nowrap text-parsomen"
            style={{
              left: `${v.merkez.x}%`,
              top: `${v.merkez.y}%`,
              textShadow: '0 0 4px #0a0705, 0 0 8px #0a0705, 0 1px 2px #0a0705',
              ...TERS,
            }}
          >
            {v.ad.toLocaleUpperCase('tr')}
          </span>
        ))}

      {simgeler &&
        regions.map((r) => {
          const secili = r.id === seciliId;
          const adGoster = yakin || secili || (r.isMine && !uzak);
          return (
            <span
              key={r.id}
              className="absolute flex flex-col items-center gap-0.5"
              style={{ left: `${r.x}%`, top: `${r.y}%`, ...TERS }}
            >
              <span
                data-bolge-simge={r.id}
                className="relative flex items-center justify-center rounded-full text-parsomen"
                style={{
                  width: secili ? 26 : 20,
                  height: secili ? 26 : 20,
                  background: 'rgba(16,11,8,0.78)',
                  border: `1.5px solid ${r.isMine ? ALTIN : 'rgba(240,225,200,0.45)'}`,
                }}
              >
                <TipIkonu tip={r.type} boyut={secili ? 15 : 12} />
                {yakin && r.level > 1 && (
                  <span className="tabular absolute -right-2 -bottom-1.5 rounded bg-gece px-0.5 text-[11px] leading-tight font-bold text-altin">
                    {r.level}
                  </span>
                )}
                {yakin && r.shielded && (
                  <span
                    className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full border border-mavi bg-gece text-[11px] leading-none text-mavi"
                    title="Korumalı"
                  >
                    ⛨
                  </span>
                )}
                {yakin && r.cekirdek && (
                  <span
                    className="absolute -top-1 -left-1 h-2.5 w-2.5 rotate-45 border border-gece bg-parsomen"
                    title="Çekirdek — ele geçirilemez"
                  />
                )}
                {r.id === homeBolgeId && (
                  <span
                    className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full border-2 border-gece bg-altin"
                    title="Kampın"
                  />
                )}
              </span>
              {adGoster && (
                <span
                  data-bolge-ad=""
                  data-oncelik={secili ? 0 : r.isMine ? 2 : 5}
                  className="rounded bg-gece/80 px-1 text-[11px] leading-tight font-bold whitespace-nowrap text-parsomen"
                  style={{ textShadow: '0 1px 2px #000' }}
                >
                  {r.name}
                </span>
              )}
            </span>
          );
        })}

      {lordAdlari &&
        lordKumeleri
          .filter((k) => k.benim || !uzak || k.alan >= 60)
          .map((k) => (
            <span
              key={`l-${k.anahtar}-${k.merkez.x}`}
              data-kume-ad=""
              data-oncelik={k.benim ? 1 : 2}
              className={`absolute font-extrabold whitespace-nowrap ${
                k.benim ? 'text-[13px] tracking-[0.14em] text-altin' : 'text-[12px] text-white'
              }`}
              style={{
                left: `${k.merkez.x}%`,
                // Simge görünürken ad onun ALTINA; üst üste binmesinler.
                top: `calc(${k.merkez.y}% + ${simgeler ? 18 : 0}px * (1 / var(--k)))`,
                textShadow: '0 0 3px #000, 0 0 6px #000, 0 1px 2px #000',
                ...TERS,
              }}
            >
              {k.ad}
            </span>
          ))}

      {/* Taht her kademede: diyarın tek endgame hedefi. */}
      {regions
        .filter((r) => r.type === 'taht')
        .map((r) => (
          <span
            key={`t-${r.id}`}
            data-oncelik={1}
            className="absolute flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/40 text-[#2a1d10]"
            style={{ left: `${r.x}%`, top: `${r.y}%`, background: ALTIN, ...TERS }}
            title="Taht Kalesi"
          >
            <TipIkonu tip="taht" boyut={18} />
          </span>
        ))}

      {ittifakHedefId != null &&
        (() => {
          const r = regions.find((x) => x.id === ittifakHedefId);
          if (!r) return null;
          return (
            <span
              data-oncelik={1}
              className="absolute rounded bg-[#7cc4f0] px-1 text-[11px] leading-tight font-bold whitespace-nowrap text-gece"
              style={{ left: `${r.x}%`, top: `calc(${r.y}% - 20px * (1 / var(--k)))`, ...TERS }}
            >
              {`[${ittifakEtiket ?? ''}] hedef`}
            </span>
          );
        })()}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Kenar araçları                                                      */
/* ------------------------------------------------------------------ */

function KucukHarita({
  regions,
  gorunum,
  W,
  en,
  boy,
  onGit,
}: {
  regions: RegionDto[];
  gorunum: Gorunum;
  W: number;
  en: number;
  boy: number;
  onGit: (x: number, y: number) => void;
}) {
  const S = 64;
  if (W === 0) return null;
  const D = W * gorunum.k;
  const x = (-gorunum.tx / D) * S;
  const y = (-gorunum.ty / D) * S;
  const w = Math.min(S, (en / D) * S);
  const h = Math.min(S, (boy / D) * S);
  return (
    <button
      type="button"
      aria-label="Küçük harita — dokunduğun yere git"
      title="Küçük harita"
      className="bas relative overflow-hidden rounded-md border border-kenar"
      style={{ width: S, height: S }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onGit(((e.clientX - r.left) / S) * 100, ((e.clientY - r.top) / S) * 100);
      }}
    >
      <img
        src="/gorseller/harita/dunya-onizleme.webp"
        alt=""
        className="absolute inset-0 h-full w-full"
        style={{ filter: 'saturate(0.5) brightness(0.7)' }}
      />
      {regions
        .filter((r) => r.isMine)
        .map((r) => (
          <span
            key={r.id}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-altin"
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          />
        ))}
      <span
        className="absolute rounded-sm border-[1.5px] border-white"
        style={{ left: Math.max(0, x), top: Math.max(0, y), width: w, height: h }}
      />
    </button>
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
      // 44px: dokunma hedefi alt sınırı (tools/gorsel-denetim.mjs ölçüyor).
      className="bas flex h-11 w-11 items-center justify-center rounded-lg border border-kenar bg-gece/80 text-[16px] leading-none text-solgun backdrop-blur"
    >
      {isaret}
    </button>
  );
}

function Gosterge({
  mercek,
  regions,
  benimMedeniyetId,
  alt,
}: {
  mercek: Mercek;
  regions: RegionDto[];
  benimMedeniyetId: string | null;
  alt: number;
}) {
  const kutu = (renk: string, soluk = false) => (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
      style={{ background: renk, opacity: soluk ? 0.45 : 1 }}
      aria-hidden
    />
  );
  let icerik: React.ReactNode;
  if (mercek === 'hedef') {
    icerik = (
      <>
        <span className="flex items-center gap-1">{kutu(ALTIN)}sen</span>
        <span className="flex items-center gap-1">{kutu('#e8524d')}lord · saldırılabilir</span>
        <span className="flex items-center gap-1">{kutu('#f0e1c8')}sahipsiz · saldırılabilir</span>
        <span className="flex items-center gap-1">{kutu(KARANLIK)}saldırılamaz ya da uzak</span>
        <span className="text-sonuk">parlak = yakın</span>
      </>
    );
  } else if (mercek === 'kaynak') {
    icerik = (
      <>
        {Object.entries(TIP_RENGI).map(([t, renk]) => (
          <span key={t} className="flex items-center gap-1">
            {kutu(renk)}
            {TIP_ADI[t]}
          </span>
        ))}
        <span className="text-sonuk">kalın çizgi: vilayet</span>
      </>
    );
  } else {
    // Medeniyetler: renk + bölge sayısı; Kim nerede: renk + sen.
    const say = new Map<string, { ad: string; renk: string; n: number }>();
    for (const r of regions) {
      if (!r.medeniyet) continue;
      const e = say.get(r.medeniyet.id) ?? { ad: r.medeniyet.ad, renk: r.medeniyet.renk, n: 0 };
      e.n++;
      say.set(r.medeniyet.id, e);
    }
    icerik = (
      <>
        {mercek === 'siyasi' && <span className="flex items-center gap-1">{kutu(ALTIN)}sen</span>}
        {[...say.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .map(([id, m]) => (
            <span key={id} className="flex items-center gap-1">
              {kutu(m.renk)}
              {m.ad}
              {mercek === 'medeniyet' && <span className="tabular text-sonuk">{m.n}</span>}
              {id === benimMedeniyetId && <span className="text-altin">★</span>}
            </span>
          ))}
        {mercek === 'siyasi' && <span className="text-sonuk">dolu: lordun · soluk: sahipsiz</span>}
      </>
    );
  }
  return (
    <div
      className="pointer-events-none absolute right-2 left-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg border border-kenar bg-gece/85 px-2.5 py-1.5 text-[11px] text-solgun backdrop-blur"
      style={{ bottom: alt + 8 }}
      data-harita-gosterge=""
    >
      {icerik}
    </div>
  );
}
