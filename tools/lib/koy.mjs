/**
 * Test araçları için: lorda gerçek bir yerleşim ve kurulmuş bir şehir.
 *
 * Neden gerekiyor: şehirdeki binalar yerleşim kademesine bağlı açılıyor
 * (docs/12 §3.3) ve kamptaki lordun demirhanesi, karargâhı, kütüphanesi
 * YOK. Bu ürünün doğru davranışı, testin engeli değil — ama bütün
 * kapıları gezen araçlar "oyunu oynayan" bir lord canlandırmalı ve oyunu
 * oynayan lordun bir başkenti ve kurulmuş binaları var.
 *
 * Hile YOK: yerleşim ürünün kendi uçlarından, gerçek bir saldırıyla
 * alınıyor; binalar gerçek inşa ucundan dikiliyor. Yalnız kaynak ve
 * bekleme kısaltılıyor (`/test/...`), çünkü ölçülen şey fethin kendisi
 * değil fetihten SONRAKİ ekran.
 */

export async function yerlesimAl(api, token, tur = 'sehir') {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const post = (y, g) =>
    fetch(`${api}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
      (x) => x.json(),
    );
  const get = (y) => fetch(`${api}/api${y}`, { headers: h }).then((x) => x.json());

  await post('/test/xp-ver', { miktar: 400000 });
  await post('/test/kaynak-ver', { altin: 3000000, demir: 1500000, erzak: 1500000 });

  /*
   * Puanları LİDERLİĞE yatır.
   *
   * `xp-ver` seviye veriyor ama komuta kapasitesi seviyeden değil
   * LİDERLİK statından geliyor. İlk denemede bunu atlamıştım: 200 asker
   * eğitmeye çalıştım, sunucu kapasite yok diye reddetti, kuyruk boş
   * kaldı ve "ordu boş" diye alâkasız bir yerden düştü. Puanlar ürünün
   * kendi ucundan harcanıyor.
   */
  const me = await get('/me');
  if ((me.lord?.statPoints ?? 0) > 0) {
    await post('/me/stats', {
      guc: 0,
      dayaniklilik: 0,
      liderlik: me.lord.statPoints,
      kurnazlik: 0,
    });
  }

  const harita = await get('/map');
  /*
   * En YAKIN uygun bölge: komşuluk kuralı uzağa saldırmayı engelliyor.
   *
   * `shielded` de eleniyor: yağmalanıp elde kalan bölge birkaç saat
   * koruma alıyor (docs/09 K6) ve sahipsiz görünmeye devam ediyor. Dünya
   * araçlar arasında PAYLAŞILDIĞI için bu kalkanlar birikiyor; kalkanlı
   * bölgeyi seçen araç "saldırı reddedildi — koruma altında" diye
   * düşüyordu ve düşme sebebi ölçtüğü şeyle ilgisizdi.
   */
  const hedef = harita.regions
    .filter((r) => r.type === tur && !r.owner && !r.shielded)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!hedef) throw new Error(`yerlesimAl: saldırılabilir "${tur}" bölgesi kalmamış`);

  /*
   * Ordu KOMUTA KAPASİTESİNE göre kuruluyor, sabit bir sayıya göre değil.
   * Kapasite dengeye bağlı ve denge değişiyor; sabit sayı yazmak bu
   * yardımcının bir gün sessizce çürümesi demekti.
   */
  const durum = await get('/me');
  const bosYer = Math.max(0, durum.lord.commandCapacity - durum.lord.usedSlots);
  if (bosYer > 0) {
    await post('/army/train', { unitType: 'mizrakci', count: Math.floor(bosYer * 0.6) });
    await post('/army/train', { unitType: 'okcu', count: Math.floor(bosYer * 0.35) });
    await post('/test/kuyruklari-bitir');
  }

  const ordu = (await get('/army')).home;
  const yanit = await post('/march', { toRegionId: hedef.id, army: ordu });
  if (yanit?.error) throw new Error(`yerlesimAl: saldırı reddedildi — ${yanit.error}`);
  await post('/test/yuruyusleri-bitir');
  return hedef;
}

/** Geriye dönük ad: köy almak yerleşim almanın özel hâli. */
export const koyAl = (api, token) => yerlesimAl(api, token, 'koy');

/**
 * Başkenti eldeki EN İYİ yerleşime taşır. Taşındıysa yeni kademeyi döner.
 *
 * Fetih başkenti kendiliğinden taşımıyor — bu bilerek: oyuncu nerede
 * oturacağına kendi karar veriyor (docs/12 §2.4). Ama denetim araçları
 * "oyunu oynayan" lordu canlandırıyor ve oyunu oynayan lord bir şehir
 * fethettiğinde oraya taşınır. Taşınmadan karargâh/kütüphane/liman
 * kapıları kapalı kalıyor ve gezinme aracı bunu bina eksikliği sanıyordu.
 */
export async function baskentiTasi(api, token) {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const get = (y) => fetch(`${api}/api${y}`, { headers: h }).then((x) => x.json());
  const post = (y, g) =>
    fetch(`${api}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
      (x) => x.json(),
    );

  const sehir = await get('/sehir');
  const hedef = (sehir.tasinabilir ?? [])[0];
  if (!hedef) return null; // zaten en iyisinde oturuyor

  const yanit = await post('/sehir/baskent', { bolgeId: hedef.bolgeId });
  if (yanit?.error) throw new Error(`baskentiTasi: reddedildi — ${yanit.error}`);
  return yanit.kademe;
}

/**
 * Şehirdeki bütün dikilebilir binaları diker.
 *
 * Dikilmemiş bina bir ARSA: içine girilmiyor, kapısı açılmıyor. Bu da
 * ürünün doğru davranışı — ortada henüz demirhane yok.
 *
 * Kademe tavanı kendiliğinden sınırlıyor: köydeki lord 2. seviyeden
 * yukarı çıkamıyor, o yüzden döngü kendiliğinden duruyor.
 */
export async function binalariDik(api, token) {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const post = (y, g) =>
    fetch(`${api}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
      (x) => x.json(),
    );
  const get = (y) => fetch(`${api}/api${y}`, { headers: h }).then((x) => x.json());

  let dikilen = 0;
  // Üst sınır sonsuz döngüye karşı emniyet, denge değil.
  for (let i = 0; i < 40; i++) {
    const sehir = await get('/sehir');
    const arsa = sehir.binalar.find((b) => b.seviye === 0 && b.seviyeli && b.yukseltilebilir);
    if (!arsa) break;
    await post('/sehir/bina', { key: arsa.key });
    await post('/test/kuyruklari-bitir');
    dikilen++;
  }
  return dikilen;
}
