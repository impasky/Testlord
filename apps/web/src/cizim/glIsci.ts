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
  onmessage: ((e: MessageEvent<{ id: number; istek: IsciIstegi }>) => void) | null;
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

function hazirla(istek: IsciIstegi): { c: CizimIstegi; dumanlar?: DumanKaynagi[] } {
  if (!('tarif' in istek)) return { c: istek };
  const { tarif, ...geri } = istek;
  const model = modelAl(tarif);
  const h = istek.hareket;
  // Yama, canlı sahnenin ana resmi gibi: salınan parça ve duman katmanlarda.
  const parcasiz = h || istek.yama;
  return {
    c: {
      ...geri,
      ag: agYap(model, istek.kamera, { dumansiz: parcasiz, bayraksiz: parcasiz }),
      bayrak: h ? bayrakKareleri(model, istek.kamera) : undefined,
    },
    // Yamanın dumanı yok: sahnenin kendi dumanı onun üstünde yükseliyor.
    dumanlar: h && !istek.yama ? dumanKaynaklari(model, istek.kamera) : undefined,
  };
}

let zincir: Promise<unknown> = Promise.resolve();

kapsam.onmessage = (e) => {
  const { id, istek } = e.data;
  zincir = zincir.then(async () => {
    const { c, dumanlar } = hazirla(istek);
    const sonuc = await cizBlob(c).catch(() => null);
    if (glDurumu() === 'yok') {
      // Tembel kareler (işlev) aktarılamıyor: ağ da gitmiyor, ana iş
      // parçacığı sahneyi tariften yeniden kuruyor.
      if (c.bayrak?.kareAl) kapsam.postMessage({ id, yok: true });
      else
        kapsam.postMessage(
          { id, yok: true, ag: c.ag, bayrak: c.bayrak, dumanlar },
          aktarilanlar(c),
        );
    } else kapsam.postMessage({ id, sonuc: sonuc && { ...sonuc, dumanlar } });
  });
};
