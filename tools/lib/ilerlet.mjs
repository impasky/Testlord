/**
 * Bir lordu İLK DÖNGÜNÜN ÖTESİNE taşır.
 *
 * Neden gerekli: arayüz ilk döngüde bilerek sade (docs/09, kademeli
 * açılım). Hiçbir şey yapmamış lorda durum şeridi, olay akışı ve diyarın
 * kapıları (Olaylar, İttifak) görünmüyor — oyuncunun "her yerde bir şeyler
 * yazıyor, neler önemli anlayamadım" şikâyetinin cevabı buydu.
 *
 * Ama denetim araçları oyunun YERLEŞMİŞ hâlini ölçüyor. Yepyeni bir lordla
 * gezdiklerinde ekranların yarısını hiç görmüyorlardı. Bu yardımcı, o
 * lorda gerçek yoldan bir bölge kazandırıyor: asker eğit, kuyruğu bitir,
 * öneriye saldır, yürüyüşü bitir.
 *
 * Kısayol yok — oyunun kendi uçları kullanılıyor; yalnız beklemeler
 * geliştirme uçlarıyla atlanıyor (`/test/kuyruklari-bitir`,
 * `/test/yuruyusleri-bitir`), ki onlar zaten bunun için var.
 */

/**
 * Lorda bir bölge kazandırır. Bölge sayısını döndürür.
 *
 * Eğitim bitince öneri YENİDEN hesaplanıyor ve başka bir hedefe kayabiliyor
 * (ordu büyüdü, artık daha iyisi alınabilir). O yüzden hedef her turda
 * baştan okunuyor ve gerekirse ikinci bir eğitim yapılıyor. Tek turluk
 * hâli sessizce başarısız oluyordu: denetim aracı bölgesiz bir lordla
 * geziyor, ekranların yarısını hiç görmüyordu.
 */
export async function bolgeKazandir(api, jeton, tur = 3) {
  const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
  const al = (yol) => fetch(`${api}/api${yol}`, { headers: bas }).then((r) => r.json());
  const gonder = (yol, govde = {}) =>
    fetch(`${api}/api${yol}`, { method: 'POST', headers: bas, body: JSON.stringify(govde) }).then(
      (r) => r.json(),
    );

  for (let i = 0; i < tur; i++) {
    const oneri = (await al('/map')).oneri;
    if (!oneri) break;

    if (!oneri.kazanir) {
      if (!oneri.eksik) break; // komuta kapasitesi yetmiyor: eğitmek çözmez
      await gonder('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
      await gonder('/test/kuyruklari-bitir');
      continue; // hedef değişmiş olabilir, baştan oku
    }

    const ordu = (await al('/army')).home ?? {};
    const gonderilecek = Object.fromEntries(Object.entries(ordu).filter(([, n]) => (n ?? 0) > 0));
    if (Object.keys(gonderilecek).length === 0) break;

    await gonder('/march', { toRegionId: oneri.regionId, army: gonderilecek, generalIds: [] });
    await gonder('/test/yuruyusleri-bitir');

    const sayi = (await al('/me')).lord?.regionCount ?? 0;
    if (sayi > 0) return sayi;
  }

  return (await al('/me')).lord?.regionCount ?? 0;
}
