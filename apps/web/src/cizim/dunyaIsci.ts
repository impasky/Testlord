/**
 * Dünya zemini ağını ana iş parçacığının dışında kuran işçi (Web Worker).
 *
 * Elli bin üçgenin modeli ve köşe tamponu birkaç yüz milisaniye tutuyor;
 * harita açılırken bu, kaydırmayı ve dokunmayı dondururdu. İşçi ağı kurup
 * tamponları kopyasız (aktararak) geri yolluyor; ana iş parçacığına yalnız
 * GPU'ya yükleme kalıyor.
 */
import { DUNYA_KAMERASI, dunyaModeli } from './dunya';
import { agYap } from './glAg';

const kapsam = self as unknown as {
  onmessage: (() => void) | null;
  postMessage(ileti: unknown, aktar: Transferable[]): void;
};

kapsam.onmessage = () => {
  const ag = agYap(dunyaModeli(), DUNYA_KAMERASI);
  kapsam.postMessage(ag, [ag.yer.buffer, ag.nesne.buffer, ag.saydam.buffer, ag.golge.buffer]);
};
