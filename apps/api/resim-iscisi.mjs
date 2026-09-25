/**
 * Profil resmi sınıflandırıcısı — AYRI BİR İŞ PARÇACIĞINDA.
 *
 * Neden ayrı: TensorFlow.js saf JavaScript arka ucunda bir resmi yaklaşık
 * iki saniyede sınıflandırıyor ve o iki saniye boyunca çalıştığı iş
 * parçacığını tamamen tutuyor. Ana iş parçacığında çalışsaydı her yükleme
 * bütün oyuncuların isteklerini iki saniye dondururdu.
 *
 * Neden TypeScript değil: iş parçacığı Node'un kendisi tarafından ayrı bir
 * dosya olarak açılıyor; geliştirmede tsx, üretimde tsup çıktısı — ikisinde
 * de aynı yolda duran düz bir .mjs en az sürprizli seçenek. Burada tip
 * gerektiren bir mantık yok: sayı girer, sayı çıkar. Kararın kendisi
 * packages/shared/src/profil.ts `resimKarari`'nda.
 *
 * Protokol: { id, rgb: Uint8Array (224x224x3) } → { id, tahmin } | { id, hata }
 */
import { parentPort } from 'node:worker_threads';

let model = null;
let tf = null;

async function yukle() {
  if (model) return model;
  tf = await import('@tensorflow/tfjs');
  const nsfwjs = await import('nsfwjs');
  await tf.setBackend('cpu');
  // MobileNetV2: paketin içinde geliyor (ağdan indirilmiyor), 3,5 MB.
  // InceptionV3 daha isabetli ama sekiz kat büyük ve üç kat yavaş;
  // kararsız bölge zaten bir insana gidiyor.
  model = await nsfwjs.load('MobileNetV2');
  return model;
}

parentPort.on('message', async (m) => {
  try {
    const mdl = await yukle();
    const img = tf.tensor3d(m.rgb, [224, 224, 3], 'int32');
    try {
      const sonuc = await mdl.classify(img, 5);
      const tahmin = { Porn: 0, Hentai: 0, Sexy: 0, Neutral: 0, Drawing: 0 };
      for (const s of sonuc) tahmin[s.className] = s.probability;
      parentPort.postMessage({ id: m.id, tahmin });
    } finally {
      img.dispose();
    }
  } catch (e) {
    parentPort.postMessage({ id: m.id, hata: String(e?.message ?? e) });
  }
});
