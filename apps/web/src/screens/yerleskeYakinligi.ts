/**
 * Şehir'in yerleşkesinde yakınlaştırma (docs/24 "Yakınlaştırma").
 *
 * Oyuncu: "binaları daha da detaylı yap" — ayrıntı vardı ama sayfa
 * ölçeğinde seçilmiyordu. Yerleşke iki parmakla (kıstırma), Ctrl + tekerlek
 * ya da dokunmatik yüzeyle ve −/+ düğmeleriyle büyüyüp küçülüyor; gezinme
 * hâlâ tarayıcının kendi kaydırması (akıcı, JS yok).
 *
 * Hareket sürerken React'e dokunulmuyor: kap ve sahne doğrudan DOM'da
 * büyüyor (kap düzeni, sahne CSS ölçeği), bitince durum bir kez
 * güncelleniyor. Binalar kabın yüzdesiyle konumlu, kendiliğinden
 * kayıyorlar; yazılar aynı boyda kalıyor.
 *
 * Görünen bölge (sahnenin oranı) hareket durunca bildiriliyor: yerleşke o
 * bölgeyi ekranın piksel yoğunluğunda yeniden çiziyor (`Sahne.yama`).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** En yakın: sahne biriminin 24 CSS pikseli (8 × 3); bir figür ~90 piksel. */
export const EN_YAKIN = 3;
/** Düğmenin bir basışı. */
export const DUGME_ADIMI = 1.5;
/** Hareket durduktan sonra görünen bölgenin bildirilmesi (ms). */
const DURMA_MS = 220;

export interface Gorunum {
  z: number;
  /** Ekranın ortasındaki nokta, sahnenin oranı (0–1). */
  merkez: [number, number];
}

/** Cihazda saklanan görünümün anahtarı (haritanın merceği gibi). */
export const GORUNUM_ANAHTARI = 'lordlar_sehir_gorunum';

/**
 * Saklı görünümü okur; bozuk, eski biçimli ya da sınır dışı değer yok
 * sayılıyor (elle düzenlenmiş ya da başka sürümden kalmış depo).
 */
export function gorunumOku(ham: string | null): Gorunum | null {
  if (!ham) return null;
  try {
    const g = JSON.parse(ham) as Partial<Gorunum>;
    const [x, y] = Array.isArray(g.merkez) ? g.merkez : [];
    const sayi = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    if (!sayi(g.z) || !sayi(x) || !sayi(y)) return null;
    if (g.z <= 0 || g.z > EN_YAKIN || x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { z: g.z, merkez: [x, y] };
  } catch {
    return null;
  }
}

/**
 * Son görünüm: yakınlık ve ekranın ortasındaki nokta. Oyuncu: "yakınlığı
 * Şehir'e dönünce de korusun", sonra "kalıcı olarak da saklasın". Bir
 * yapıya girip dönen de, uygulamayı kapatıp açan da bıraktığı yerde ve
 * yakınlıkta. Cihazda saklanıyor; depo kapalıysa (gizli sekme) sekme açık
 * kaldıkça.
 */
let SON_GORUNUM: Gorunum | null | undefined;

/** Saklı görünüm (yoksa null). İlk çağrıda cihazdan okunuyor. */
export function sonGorunum(): Gorunum | null {
  if (SON_GORUNUM === undefined) {
    try {
      SON_GORUNUM = gorunumOku(localStorage.getItem(GORUNUM_ANAHTARI));
    } catch {
      SON_GORUNUM = null;
    }
  }
  return SON_GORUNUM;
}

function gorunumYaz(g: Gorunum) {
  SON_GORUNUM = g;
  try {
    localStorage.setItem(
      GORUNUM_ANAHTARI,
      JSON.stringify({ z: +g.z.toFixed(3), merkez: g.merkez.map((v) => +v.toFixed(4)) }),
    );
  } catch {
    /* gizli sekme ya da dolu depo: sekme açık kaldıkça yine hatırlanıyor */
  }
}

/** Kabı dolduran en uzak yakınlık: yerleşkenin kenarından öte boşluk görünmesin. */
export function enUzak(kapEn: number, kapBoy: number, sahneEn: number, sahneBoy: number): number {
  return Math.min(1, Math.max(kapEn / sahneEn, kapBoy / sahneBoy));
}

/** Görünen bölge, sahnenin oranı olarak: [x, y, en, boy] (0–1). */
export function gorunenOran(
  kaydirX: number,
  kaydirY: number,
  kapEn: number,
  kapBoy: number,
  sahneEn: number,
  sahneBoy: number,
  z: number,
): [number, number, number, number] {
  const W = sahneEn * z;
  const H = sahneBoy * z;
  return [kaydirX / W, kaydirY / H, Math.min(1, kapEn / W), Math.min(1, kapBoy / H)];
}

export function useYerleskeYakinligi(
  kaydirici: RefObject<HTMLDivElement | null>,
  kap: RefObject<HTMLDivElement | null>,
  sahne: RefObject<HTMLDivElement | null>,
  sahneEn: number,
  sahneBoy: number,
  etkin: boolean,
  /**
   * Görünüm cihazda saklanıyor ve açılış oradan (Şehir'in yerleşkesi).
   * Kapalıysa (diyar haritası) her açılışta ×1.
   */
  kalici = true,
) {
  const [z, setZ] = useState(() => (kalici ? sonGorunum()?.z : undefined) ?? 1);
  const zRef = useRef(z);
  const [gorunen, setGorunen] = useState<[number, number, number, number] | null>(null);
  /** Kabı dolduran en uzak yakınlık (kap boyu değişince yeniden). */
  const [uzak, setUzak] = useState(0);
  const durma = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Görünen bölgeyi hareket durunca bildir. */
  const bildir = useCallback(() => {
    clearTimeout(durma.current);
    durma.current = setTimeout(() => {
      const k = kaydirici.current;
      if (!k || k.clientWidth < 2) return;
      const o = gorunenOran(
        k.scrollLeft,
        k.scrollTop,
        k.clientWidth,
        k.clientHeight,
        sahneEn,
        sahneBoy,
        zRef.current,
      );
      setGorunen((g) => (g && g.every((x, i) => Math.abs(x - o[i]!) < 1e-3) ? g : o));
      setUzak(enUzak(k.clientWidth, k.clientHeight, sahneEn, sahneBoy));
      if (kalici) gorunumYaz({ z: zRef.current, merkez: [o[0] + o[2] / 2, o[1] + o[3] / 2] });
    }, DURMA_MS);
  }, [kaydirici, sahneEn, sahneBoy, kalici]);

  /**
   * Yeni yakınlık: sahnenin (fx, fy) noktası (yakınlık 1'deki CSS pikseli)
   * kabın (mx, my) noktasında kalıyor. React'e dokunmadan.
   */
  const uygula = useCallback(
    (yeni: number, fx: number, fy: number, mx: number, my: number) => {
      const k = kaydirici.current;
      const c = kap.current;
      const s = sahne.current;
      if (!k || !c || !s) return;
      const zz = Math.min(
        EN_YAKIN,
        Math.max(enUzak(k.clientWidth, k.clientHeight, sahneEn, sahneBoy), yeni),
      );
      zRef.current = zz;
      c.style.width = `${sahneEn * zz}px`;
      c.style.height = `${sahneBoy * zz}px`;
      s.style.transform = `scale(${zz})`;
      k.scrollLeft = fx * zz - mx;
      k.scrollTop = fy * zz - my;
    },
    [kaydirici, kap, sahne, sahneEn, sahneBoy],
  );

  /** Hareket bitti: durum bir kez. */
  const bitir = useCallback(() => {
    setZ(zRef.current);
    bildir();
  }, [bildir]);

  /** Kabın (mx, my) noktası çevresinde çarpan kadar (düğme: kabın ortası). */
  const yakinlastir = useCallback(
    (carpan: number, mx?: number, my?: number) => {
      const k = kaydirici.current;
      if (!k) return;
      const x = mx ?? k.clientWidth / 2;
      const y = my ?? k.clientHeight / 2;
      const z0 = zRef.current;
      uygula(z0 * carpan, (k.scrollLeft + x) / z0, (k.scrollTop + y) / z0, x, y);
      bitir();
    },
    [kaydirici, uygula, bitir],
  );

  /**
   * Açılış: saklı görünüm varsa onun ortası ekranın ortasında, yoksa
   * verilen nokta (kabın `dikey` oranında). Yakınlık kaba göre sınırlanıyor
   * (ekran döndüyse saklı yakınlık artık kabı doldurmayabilir).
   */
  const ortala = useCallback(
    (varsayilan: [number, number], dikey: number) => {
      const k = kaydirici.current;
      if (!k) return;
      const sakli = kalici ? sonGorunum() : null;
      const [x, y] = sakli?.merkez ?? varsayilan;
      const my = k.clientHeight * (sakli ? 0.5 : dikey);
      uygula(zRef.current, x * sahneEn, y * sahneBoy, k.clientWidth / 2, my);
      bitir();
    },
    [kaydirici, uygula, bitir, sahneEn, sahneBoy, kalici],
  );

  useEffect(() => {
    const k = kaydirici.current;
    if (!etkin || !k) return;
    let kistirma: { d0: number; z0: number; fx: number; fy: number } | null = null;
    const nokta = (e: TouchEvent) => {
      const r = k.getBoundingClientRect();
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      return {
        d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        mx: (a.clientX + b.clientX) / 2 - r.left,
        my: (a.clientY + b.clientY) / 2 - r.top,
      };
    };
    const basla = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const { d, mx, my } = nokta(e);
      const z0 = zRef.current;
      kistirma = {
        d0: Math.max(1, d),
        z0,
        fx: (k.scrollLeft + mx) / z0,
        fy: (k.scrollTop + my) / z0,
      };
    };
    const kay = (e: TouchEvent) => {
      if (!kistirma || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      const { d, mx, my } = nokta(e);
      // Parmakların ortası da kayıyor: kıstırırken sürüklemek de oluyor.
      uygula((kistirma.z0 * d) / kistirma.d0, kistirma.fx, kistirma.fy, mx, my);
    };
    const kalk = (e: TouchEvent) => {
      if (!kistirma || e.touches.length >= 2) return;
      kistirma = null;
      bitir();
    };
    // Ctrl + tekerlek; dokunmatik yüzeyde kıstırma da bu olarak geliyor.
    // Düz tekerlek kaydırıyor (tarayıcının kendisi).
    let tekerBitti: ReturnType<typeof setTimeout> | undefined;
    const teker = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = k.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const z0 = zRef.current;
      const birim = e.deltaMode === 1 ? 33 : 1;
      uygula(
        z0 * Math.exp(-e.deltaY * birim * 0.004),
        (k.scrollLeft + mx) / z0,
        (k.scrollTop + my) / z0,
        mx,
        my,
      );
      clearTimeout(tekerBitti);
      tekerBitti = setTimeout(bitir, 150);
    };
    k.addEventListener('touchstart', basla, { passive: true });
    k.addEventListener('touchmove', kay, { passive: false });
    k.addEventListener('touchend', kalk, { passive: true });
    k.addEventListener('touchcancel', kalk, { passive: true });
    k.addEventListener('wheel', teker, { passive: false });
    k.addEventListener('scroll', bildir, { passive: true });
    // Ekran dönünce görünen bölge de, en uzak yakınlık da değişiyor.
    const ro = new ResizeObserver(bildir);
    ro.observe(k);
    return () => {
      ro.disconnect();
      k.removeEventListener('touchstart', basla);
      k.removeEventListener('touchmove', kay);
      k.removeEventListener('touchend', kalk);
      k.removeEventListener('touchcancel', kalk);
      k.removeEventListener('wheel', teker);
      k.removeEventListener('scroll', bildir);
      clearTimeout(tekerBitti);
      clearTimeout(durma.current);
    };
  }, [etkin, kaydirici, uygula, bitir, bildir]);

  return {
    z,
    gorunen,
    yakinlastir,
    ortala,
    enYakinda: z >= EN_YAKIN - 1e-3,
    enUzakta: z <= uzak + 1e-3,
  };
}
