/**
 * Dünya zemininin GPU ağı (docs/24): işçide kuruluyor (`dunyaIsci.ts`),
 * işçi açılamazsa ya da düşerse burada, ana iş parçacığında.
 */
import { DUNYA_KAMERASI, dunyaModeli } from './dunya';
import { agYap, type Ag } from './glAg';

function iscide(): Promise<Ag> {
  return new Promise((coz, reddet) => {
    const isci = new Worker(new URL('./dunyaIsci.ts', import.meta.url), { type: 'module' });
    isci.onmessage = (e: MessageEvent<Ag>) => {
      isci.terminate();
      coz(e.data);
    };
    isci.onerror = (e) => {
      isci.terminate();
      reddet(e);
    };
    isci.postMessage(null);
  });
}

/**
 * Her çağrı yeni bir ağ: tamponlar GPU işçisine aktarılınca bu taraftan
 * gidiyor, saklamanın anlamı yok (zemin zaten bir kez çiziliyor).
 */
export function dunyaAgi(): Promise<Ag> {
  return iscide().catch(() => agYap(dunyaModeli(), DUNYA_KAMERASI));
}
