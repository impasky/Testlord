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
 * Burada iki şey yapıyoruz: 429'da bekleyip tekrar deniyoruz (sınır dakikalık,
 * beklemek gerçekten çözüyor) ve başka bir sebeple kaydolamazsak İLK satırda
 * sebebi söyleyerek patlıyoruz.
 */
export async function kayitOl(API, { email, password = 'parola1234', lordName }) {
  let sonYanit = null;
  for (let deneme = 0; deneme < 4; deneme++) {
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, lordName }),
    });
    const govde = await r.json().catch(() => null);
    if (govde?.token) return govde;
    sonYanit = { status: r.status, govde };
    if (r.status !== 429) break;
    // Sınır dakikalık: 5, 10, 20 sn bekleyip yeniden dene.
    await new Promise((c) => setTimeout(c, 5000 * 2 ** deneme));
  }
  throw new Error(
    `Lord kaydı başarısız (${lordName}): HTTP ${sonYanit?.status} ` +
      JSON.stringify(sonYanit?.govde).slice(0, 200),
  );
}
