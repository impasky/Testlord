/**
 * Ortam tuvalinin sayfa yanı (docs/24 "Ortam tuvali"): işçi
 * (`ortamIsci.ts`) tek, tuvaller kimlikle. Kurulamazsa (OffscreenCanvas ya
 * da işçi yok) null; sonradan çizemezse (işçide WebGL2 yok, bağlam düştü,
 * işçi yüklenemedi) `hata` çağrılıyor: sahne CSS katmanlarına dönüyor.
 */
import { glKatmanBlobu } from './gl';
import type { OrtamCevabi, OrtamDokulari, OrtamKatmani, OrtamMesaji } from './ortam';

let isci: Worker | null | undefined;
let sayac = 0;
const HATALAR = new Map<number, () => void>();

/** `localStorage['ortam-tuvali'] = '0'`: tuval yok, CSS katmanları (karşılaştırma, sorun). */
function kapaliMi(): boolean {
  try {
    return localStorage.getItem('ortam-tuvali') === '0';
  } catch {
    return false;
  }
}

function isciAl(): Worker | null {
  if (isci !== undefined) return isci;
  try {
    if (
      kapaliMi() ||
      typeof Worker === 'undefined' ||
      typeof OffscreenCanvas === 'undefined' ||
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen !== 'function'
    )
      return (isci = null);
    const i = new Worker(new URL('./ortamIsci.ts', import.meta.url), { type: 'module' });
    i.onmessage = (e: MessageEvent<OrtamCevabi>) => {
      if (e.data.tip === 'hata') HATALAR.get(e.data.id)?.();
    };
    // Yüklenemedi ya da düştü: bütün tuvaller CSS katmanlarına.
    i.onerror = () => {
      isci = null;
      const hepsi = [...HATALAR.values()];
      HATALAR.clear();
      for (const h of hepsi) h();
    };
    isci = i;
  } catch {
    isci = null;
  }
  return isci;
}

export interface OrtamTuvali {
  katman(k: OrtamKatmani): void;
  boyut(css: [number, number]): void;
  oyna(acik: boolean): void;
  kapat(): void;
}

/** `tuval`in çizimini işçiye veriyor (bir kez: tuval artık sayfada çizilemez). */
export function ortamTuvaliKur(
  tuval: HTMLCanvasElement,
  css: [number, number],
  katman: OrtamKatmani,
  acik: boolean,
  hata: () => void,
): OrtamTuvali | null {
  const i = isciAl();
  if (!i) return null;
  let off: OffscreenCanvas;
  try {
    off = tuval.transferControlToOffscreen();
  } catch {
    return null;
  }
  const id = ++sayac;
  HATALAR.set(id, hata);
  const gonder = (m: OrtamMesaji, aktar: Transferable[] = []) => isci?.postMessage(m, aktar);
  gonder({ tip: 'kur', id, tuval: off, css, acik }, [off]);
  // Resimler blob olarak (`glKatmanBlobu`): kopya yok, işçi çözüyor.
  let son: OrtamKatmani = {};
  const katmanGonder = (k: OrtamKatmani) => {
    if (
      k.su === son.su &&
      k.cimen === son.cimen &&
      k.isik === son.isik &&
      !!k.aksam === !!son.aksam
    )
      return;
    son = k;
    const d: OrtamDokulari = {
      su: glKatmanBlobu(k.su),
      cimen: glKatmanBlobu(k.cimen),
      isik: glKatmanBlobu(k.isik),
      aksam: k.aksam,
    };
    gonder({ tip: 'katman', id, katman: d });
  };
  katmanGonder(katman);
  return {
    katman: katmanGonder,
    boyut: (c) => gonder({ tip: 'boyut', id, css: c }),
    oyna: (a) => gonder({ tip: 'oyna', id, acik: a }),
    kapat: () => {
      HATALAR.delete(id);
      gonder({ tip: 'kapat', id });
    },
  };
}
