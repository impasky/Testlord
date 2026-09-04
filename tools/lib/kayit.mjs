/**
 * Test araçları için ortak lord kaydı.
 *
 * Kayıt IP başına dakikada AUTH_RATE_LIMIT_MAX ile sınırlı (bkz.
 * apps/api/src/routes/auth.ts). Testler zincir hâlinde koştuğunda bu bütçe
 * tükenebiliyor ve 429 dönüyor. Testlerin çoğu yanıtı `{ token }` diye
 * ayrıştırdığı için token undefined kalıyor, sonraki her istek yetkisiz
 * düşüyor ve hata testin ORTASINDA, alâkasız bir satırda patlıyor
 * ("Cannot read properties of undefined"). Asıl sebep hiç görünmüyor.
 *
 * Burada üç şey yapıyoruz: 429'da bekleyip tekrar deniyoruz (sınır dakikalık,
 * beklemek gerçekten çözüyor), ad süzgecine takılırsak adı değiştirip yeniden
 * deniyoruz (aşağıya bak) ve başka bir sebeple kaydolamazsak İLK satırda
 * sebebi söyleyerek patlıyoruz.
 */

/**
 * Araçlar lord adını `Km${Date.now().toString(36).slice(-3)}` gibi rastgele
 * üretiyor. Rastgele harf dizisi er ya da geç ad süzgecinin bir parçasına
 * denk geliyor ve test, ölçtüğü şeyle hiç ilgisi olmayan bir sebeple
 * kalıyor — bu bir kez gerçekten oldu ("Kmaq7…" içindeki "aq"). Süzgecin o
 * hatası düzeldi ama sınıf duruyor: 36^3 içinde "amk" da var. Adı bir harf
 * uzatmak parçayı bozar, testin ölçtüğü şeye ise dokunmaz.
 */
function adiUzat(ad, tur) {
  const ekler = ['x', 'z', 'v'];
  return `${ad}${ekler[tur] ?? tur}`;
}

export async function kayitOl(API, { email, password = 'parola1234', lordName }) {
  let sonYanit = null;
  let ad = lordName;
  let adDenemesi = 0;

  for (let deneme = 0; deneme < 4; deneme++) {
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, lordName: ad }),
    });
    const govde = await r.json().catch(() => null);
    if (govde?.token) return govde;
    sonYanit = { status: r.status, govde, ad };

    if (govde?.code === 'AD_UYGUNSUZ' && adDenemesi < 3) {
      ad = adiUzat(lordName, adDenemesi++);
      deneme--; // Ad denemesi, oran sınırı bütçesinden sayılmasın.
      continue;
    }
    if (r.status !== 429) break;
    // Sınır dakikalık: 5, 10, 20 sn bekleyip yeniden dene.
    await new Promise((c) => setTimeout(c, 5000 * 2 ** deneme));
  }

  throw new Error(
    `Lord kaydı başarısız (${sonYanit?.ad}): HTTP ${sonYanit?.status} ` +
      JSON.stringify(sonYanit?.govde).slice(0, 200),
  );
}
