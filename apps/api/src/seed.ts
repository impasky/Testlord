/**
 * İlk dünyayı açar ve bölgelerini yazar. Tekrar çalıştırılabilir.
 *
 * HARİTA SÜRÜMÜ (docs/12 §14). Eskiden bu betik açılışta BÜTÜN dünyaların
 * bölgelerini kanonik haritaya eşitliyordu. Geliştirmede doğru davranıştı;
 * yayında bir oyuncunun aylardır tuttuğu "Gölcük Köyü" bir gecede başka
 * bir yer olabilirdi. Artık her dünya açıldığı harita sürümünü taşıyor ve
 * kural tek cümle: **üzerinde oyuncu olan dünyanın haritası değişmez.**
 *
 * Aynı sürümdeki dünyada statik alanlar (ad, tip, ülke, harita
 * üzerindeki yer, komşuluk, gelir çarpanı) yine tazeleniyor; oyunun
 * ürettiği durum (sahiplik, seviye, depo, kalkan, yıpranmış NPC garnizonu)
 * korunuyor. Tek istisna tür değişimi: bir tarla köye dönüştüyse garnizonu
 * da yeni türün kanonik garnizonuna döner.
 *
 * HARİTA KUŞAĞI (docs/27) bu kuralın tek istisnası: harita TÜRÜ değişince
 * (121 bölgelik hayalî diyardan gerçek dünyaya) oyunculu dünya da göçüyor
 * (`services/goc.ts`) — şehri, ordusu, eşyası yerinde, toprağı sıfırdan.
 */
import { validateBalance } from '@lordlar/shared';
import { HARITA_SURUMU, haritayiDogrula } from '@lordlar/shared/kanonik';
import { prisma } from './db.js';
import { eskiDunyalariGocur } from './services/goc.js';
import {
  createWorld,
  eskiHaritaliDunyayiKapat,
  refreshWorldRegions,
  tazelemeKarari,
} from './services/world.js';

async function main(): Promise<void> {
  validateBalance();
  haritayiDogrula();
  console.log(`Harita sürümü: ${HARITA_SURUMU}`);

  const dunyalar = await prisma.world.findMany({ orderBy: { openedAt: 'asc' } });

  if (dunyalar.length === 0) {
    const id = await createWorld();
    const w = await prisma.world.findUniqueOrThrow({ where: { id } });
    const n = await prisma.region.count({ where: { worldId: id } });
    console.log(`Dünya açıldı: ${w.name} — ${n} bölge yazıldı.`);
    return;
  }

  // Harita kuşağı eski dünyalar önce gerçek dünyaya göçüyor (docs/27).
  await eskiDunyalariGocur();

  let dokunulmayan = 0;
  for (const w of await prisma.world.findMany({ orderBy: { openedAt: 'asc' } })) {
    const lordSayisi = await prisma.lord.count({ where: { worldId: w.id } });
    // Kapanmış, boş diyar (birleşmenin konuğu): haritası tutulmuyor.
    const olu = w.status === 'closed' && lordSayisi === 0;
    if (olu) continue;
    const karar = await tazelemeKarari(w.id);

    if (karar === 'dokunma') {
      // Sessizce geçmek yanlış olurdu: bu dünya artık kanonik haritadan
      // AYRI ve bunu bilmek gerekiyor.
      const lordSayisi = await prisma.lord.count({ where: { worldId: w.id } });
      await eskiHaritaliDunyayiKapat(w.id);
      console.log(
        `${w.name}: ESKİ HARİTADA (${w.mapVersion}) — ${lordSayisi} oyuncu var, dokunulmadı; yeni kayıtlara kapatıldı.`,
      );
      dokunulmayan++;
      continue;
    }

    const n = await refreshWorldRegions(w.id);
    const toplam = await prisma.region.count({ where: { worldId: w.id } });
    const etiket =
      karar === 'ilk-damga'
        ? ' (sürümsüzdü, damgalandı)'
        : karar === 'bos-dunya'
          ? ' (oyuncusuz, yeni haritaya taşındı)'
          : '';
    console.log(
      `${w.name}: ${toplam} bölge${etiket}` +
        (n > 0 ? `, ${n} tanesinin statik alanları tazelendi.` : '.'),
    );
  }

  if (dokunulmayan > 0) {
    console.log(
      `\n${dokunulmayan} dünya eski haritada bırakıldı. Oyuncuları oynamaya devam eder; yeni oyuncular bugünkü haritanın olduğu dünyalara düşer.`,
    );
  }
}

main()
  .catch((e) => {
    console.error('Seed başarısız:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
