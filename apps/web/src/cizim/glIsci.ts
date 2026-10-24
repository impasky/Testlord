/**
 * GPU çizim işçisi (docs/24): `glCizici`yi ana iş parçacığının dışında
 * koşturuyor. İşler geldiği sırayla, tek tek. WebGL2 burada yoksa ağı geri
 * yolluyor ("yok"); `gl.ts` o zaman aynı işi kendisi çiziyor.
 *
 * İş bir tarifse (`tarif.ts`) model de burada kuruluyor: ağ, bayrak kareleri,
 * duman kaynakları. Büyük bir sahnenin (ekran zemini, diyar kapağı) bu
 * hazırlığı telefonda bir saniyeyi aşıyordu; ana iş parçacığında o süre
 * boyunca sayfa donuyordu.
 */
import { bayrakKareleri } from './bayrakAni';
import { dumanKaynaklari, type DumanKaynagi } from './duman';
import { agYap } from './glAg';
import {
  CizimKesildi,
  aktarilanlar,
  cizBlob,
  glDurumu,
  type CizimIstegi,
  type IsciCevabi,
  type IsciIstegi,
} from './glCizici';
import { tarifModeli } from './tarif';
import type { Model } from './uc';

const kapsam = self as unknown as {
  onmessage:
    ((e: MessageEvent<{ id: number; istek: IsciIstegi } | { kes: number }>) => void) | null;
  postMessage(ileti: IsciCevabi, aktar?: Transferable[]): void;
};

/**
 * Son kurulan birkaç model: aynı sahne iki boyda (ekran dönünce, alt sayfa
 * büyüyünce) yeniden istenebiliyor. Yalnız birkaçı: büyük sahnenin modeli
 * megabaytlar tutuyor.
 */
const MODELLER = new Map<string, Model>();
function modelAl(tarif: string): Model {
  let m = MODELLER.get(tarif);
  if (m) MODELLER.delete(tarif);
  else m = tarifModeli(tarif) ?? [];
  MODELLER.set(tarif, m);
  if (MODELLER.size > 4) MODELLER.delete(MODELLER.keys().next().value!);
  return m;
}

/** Tarifin pahalı hazırlığı: ağ, canlı parça kareleri, duman kaynakları. */
interface Hazirlik {
  ag: CizimIstegi['ag'];
  bayrak: CizimIstegi['bayrak'];
  dumanlar?: DumanKaynagi[];
}

function hazirla(istek: IsciIstegi & { tarif: string }): Hazirlik {
  const model = modelAl(istek.tarif);
  const h = istek.hareket;
  // Yama, canlı sahnenin ana resmi gibi: salınan parça ve duman katmanlarda.
  const parcasiz = h || istek.yama;
  return {
    ag: agYap(model, istek.kamera, { dumansiz: parcasiz, bayraksiz: parcasiz }),
    bayrak: h ? bayrakKareleri(model, istek.kamera) : undefined,
    // Yamanın dumanı yok: sahnenin kendi dumanı onun üstünde yükseliyor.
    dumanlar: h && !istek.yama ? dumanKaynaklari(model, istek.kamera) : undefined,
  };
}

/**
 * Kesilen işin hazırlığı (ağ, canlı parça kareleri, duman). İş sıraya geri
 * dönüyor (`gl.ts`, en çok üç kez); önce onu kesen küçük işler çiziliyor,
 * sonra o yeniden geliyor: hazırlık baştan kurulmasın. Telefonda
 * yerleşkenin ilk çizimi iki kez kesildi, her seferinde ~4,4 sn hazırlık
 * boşa gitti. Yalnız sonuncusu; aynı iş gelince bırakılıyor, gelmezse
 * (isteyen kalmadı, sayfadan çıkıldı) `KESILEN_SAKLA_MS` sonra: bellekte
 * büyük. Kesilme çoğunlukla canlı parçaların 1. aşamasından önce (`gl.ts`
 * `korunur`); sonra kesildiyse kaydı bırakılmış kare duruştan yeniden
 * kuruluyor (`bayrakKareleri`), aynı kare.
 */
let kesilenin: { anahtar: string; h: Hazirlik } | null = null;
let kesileniBirak: ReturnType<typeof setTimeout> | undefined;
const KESILEN_SAKLA_MS = 30_000;

function kesileniSakla(k: typeof kesilenin) {
  clearTimeout(kesileniBirak);
  kesilenin = k;
  if (k) kesileniBirak = setTimeout(() => (kesilenin = null), KESILEN_SAKLA_MS);
}

/** Hazırlığı belirleyen: tarif, kamera, canlı mı, yama mı (boy, vakit değil). */
function hazirlikAnahtari(istek: IsciIstegi): string | null {
  if (!('tarif' in istek)) return null;
  return [
    istek.tarif,
    JSON.stringify(istek.kamera ?? null),
    istek.hareket ? 1 : 0,
    istek.yama ? 1 : 0,
  ].join('|');
}

let zincir: Promise<unknown> = Promise.resolve();
/**
 * Kesilecek işler (`gl.ts` `isciyiKes`): mesaj hemen işleniyor (zincire
 * girmiyor); süren çizim bir sonraki şerit arasında soruyor.
 */
const KESILECEK = new Set<number>();

kapsam.onmessage = (e) => {
  if ('kes' in e.data) {
    KESILECEK.add(e.data.kes);
    return;
  }
  const { id, istek } = e.data;
  zincir = zincir.then(async () => {
    if (KESILECEK.delete(id)) return kapsam.postMessage({ id, kesildi: true });
    const hazirlikBasi = performance.now();
    const anahtar = hazirlikAnahtari(istek);
    let hazir: Hazirlik | null = null;
    let c: CizimIstegi;
    if ('tarif' in istek) {
      if (kesilenin && kesilenin.anahtar === anahtar) {
        hazir = kesilenin.h;
        kesileniSakla(null);
      } else hazir = hazirla(istek);
      const { tarif: _tarif, ...geri } = istek;
      c = { ...geri, ag: hazir.ag, bayrak: hazir.bayrak };
    } else c = istek;
    const dumanlar = hazir?.dumanlar;
    // Telefonda ölçüm: model ve ağ kurulumu da bir aşama (`CizimSonucu.evreler`).
    const hazirlik = performance.now() - hazirlikBasi;
    let kesildi = false;
    const sonuc = await cizBlob(
      c,
      () => KESILECEK.has(id),
      // Ara teslim: iş sürüyor; ana iş parçacığı göstermeye başlıyor.
      (kismi, aktar) => kapsam.postMessage({ id, kismi: { ...kismi, dumanlar } }, aktar),
    ).catch((h: unknown) => {
      kesildi = h instanceof CizimKesildi;
      return null;
    });
    KESILECEK.delete(id);
    if (kesildi) {
      if (anahtar && hazir) kesileniSakla({ anahtar, h: hazir });
      return kapsam.postMessage({ id, kesildi: true });
    }
    if (glDurumu() === 'yok') {
      // Tembel kareler (işlev) aktarılamıyor: ağ da gitmiyor, ana iş
      // parçacığı sahneyi tariften yeniden kuruyor.
      if (c.bayrak?.kareAl) kapsam.postMessage({ id, yok: true });
      else
        kapsam.postMessage(
          { id, yok: true, ag: c.ag, bayrak: c.bayrak, dumanlar },
          aktarilanlar(c),
        );
    } else
      kapsam.postMessage({
        id,
        sonuc: sonuc && { ...sonuc, dumanlar, evreler: { hazirlik, ...sonuc.evreler } },
      });
  });
};
