/**
 * GPU çizim işçisi (docs/24): `glCizici`yi ana iş parçacığının dışında
 * koşturuyor. İşler geldiği sırayla, tek tek. WebGL2 burada yoksa ağı geri
 * yolluyor ("yok"); `gl.ts` o zaman aynı işi kendisi çiziyor.
 */
import { aktarilanlar, cizBlob, glDurumu, type CizimIstegi, type IsciCevabi } from './glCizici';

const kapsam = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; istek: CizimIstegi }>) => void) | null;
  postMessage(ileti: IsciCevabi, aktar?: Transferable[]): void;
};

let zincir: Promise<unknown> = Promise.resolve();

kapsam.onmessage = (e) => {
  const { id, istek } = e.data;
  zincir = zincir.then(async () => {
    const sonuc = await cizBlob(istek).catch(() => null);
    if (glDurumu() === 'yok')
      kapsam.postMessage(
        { id, yok: true, ag: istek.ag, bayrak: istek.bayrak },
        aktarilanlar(istek),
      );
    else kapsam.postMessage({ id, sonuc });
  });
};
