/**
 * Worker testi: yürüyüşü worker'ın KENDİLİĞİNDEN çözdüğünü doğrular.
 *
 * API ve worker ayakta olmalı:
 *   pnpm --filter @lordlar/api dev
 *   pnpm worker
 * Sonra: node tools/worker-testi.mjs
 *
 * Saldırıyı başlatır, varış zamanını veritabanında geçmişe alır ve worker'ın
 * savaşı kendi döngüsünde çözmesini bekler. Hiçbir test ucu çağırmaz.
 */
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { merkezUzakliklari } from './lib/harita.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const DB = process.env.DATABASE_URL ?? 'postgresql://lordlar@127.0.0.1:5432/lordlar_cagi';
const d = Date.now();
const { token } = await kayitOl(API, { email: `w${d}@l.dev`, lordName: benzersizAd('Worker') });
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const P = (u, b) =>
  fetch(`${API}/api${u}`, { method: 'POST', headers: h, body: JSON.stringify(b ?? {}) }).then((r) =>
    r.json(),
  );
const G = (u) => fetch(`${API}/api${u}`, { headers: h }).then((r) => r.json());

await P('/test/bolgeleri-sifirla');
await P('/test/kaynak-ver', { altin: 50000, demir: 20000, erzak: 20000 });
await P('/army/train', { unitType: 'mizrakci', count: 20 });
await P('/army/train', { unitType: 'okcu', count: 15 });
await P('/test/kuyruklari-bitir');

const harita = await G('/map');
// Eski `ring === 4` ölçütünün karşılığı: Taht Kalesi'nden en az 4 adım
// uzaktaki bölgeler. Altıgen ızgara kalktı, ölçü komşuluk grafiğinden
// türüyor (docs/12 §1).
const kenar = new Set(
  [...merkezUzakliklari(harita.regions)].filter(([, d]) => d >= 4).map(([id]) => id),
);
const hedef = harita.regions
  .filter((r) => kenar.has(r.id) && !r.owner && r.type !== 'kale')
  .sort((a, b) => a.distance - b.distance)[0];
const y = await P('/march', { toRegionId: hedef.id, army: { mizrakci: 20, okcu: 15 } });
console.log('Yuruyus basladi:', hedef.name, '| varis', y.arriveAt);

// Varis zamanini gecmise al ve WORKER'in kendiliginden cozmesini bekle
const { execSync } = await import('node:child_process');
execSync(
  `psql "${DB}" -q -c "UPDATE \\"March\\" SET \\"arriveAt\\" = now() - interval '1 minute' WHERE id = '${y.marchId}';"`,
);
console.log('Varis zamani gecmise alindi, worker bekleniyor (max 30sn)...');

let cozuldu = false;
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const savaslar = await G('/battles');
  if (savaslar.length > 0) {
    cozuldu = true;
    console.log(
      `Worker ${(i + 1) * 2}sn icinde cozdu:`,
      savaslar[0].result,
      '| ele gecirdi:',
      savaslar[0].captured,
    );
    break;
  }
}
console.log(
  cozuldu ? 'GECTI: worker yuruyusu kendiliginden cozuyor' : 'KALDI: worker yuruyusu cozmedi',
);
process.exit(cozuldu ? 0 : 1);
