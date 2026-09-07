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
 * Ad süzgecine takılan bir adı YENİDEN ÜRETİR.
 *
 * Araçlar lord adını `Km${Date.now().toString(36).slice(-3)}` gibi rastgele
 * üretiyor. Rastgele harf dizisi er ya da geç ad süzgecinin bir parçasına
 * denk geliyor ve test, ölçtüğü şeyle hiç ilgisi olmayan bir sebeple
 * kalıyor — bu iki kez gerçekten oldu ("Kmaq7…" içindeki "aq", sonra
 * "Csh17defv").
 *
 * Önce adın SONUNA bir harf ekleniyordu. İkinci vakada bu işe yaramadı ve
 * sebebi öğreticiydi: süzgeç leetspeak'i çözüyor (`1`→`i`, `7`→`t`), yani
 * "Csh17defv" onun gözünde "cshitdefv" ve yasak parça adın ORTASINDA. Sona
 * harf eklemek ortadaki parçayı bozmaz; dört deneme de aynı sebeple
 * reddedildi. Artık rastgele kısım tümüyle yenileniyor: nerede olursa
 * olsun parça kayboluyor.
 */
function adiYenile(ad) {
  // Önek = baştaki harfler (ilk rakam ya da boşluğa kadar). Testin
  // günlükte tanıdığı ad böylece okunur kalıyor.
  const onek = /^[A-Za-zÇĞİÖŞÜçğıöşü]+/.exec(ad)?.[0] ?? 'Lord';
  return benzersizAd(onek.slice(0, 10));
}

/**
 * Ad süzgecine takılmayan benzersiz bir lord adı.
 *
 * Araçlar adı `Tasan${Date.now()}` gibi üretiyordu ve milisaniye damgası
 * er ya da geç beş aynı rakamı arka arkaya içeriyor ("...100000...").
 * Sunucu bunu reddediyor ("Aynı harfi arka arkaya bu kadar
 * tekrarlayamazsın") ve test, ölçtüğü şeyle hiç ilgisi olmayan bir
 * sebeple kalıyordu. Gerçekte olan buydu: shard testi rastgele bir gün
 * çöküyordu.
 *
 * Burada tekrarlar kırılıyor: aynı karakter üst üste ikiden fazla
 * gelmiyor.
 */
export function benzersizAd(onek = 'Test') {
  const ham = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let cikti = '';
  let oncekiKarakter = '';
  let tekrar = 0;
  for (const k of ham) {
    if (k === oncekiKarakter) tekrar++;
    else {
      oncekiKarakter = k;
      tekrar = 1;
    }
    // Üst üste ikiden fazlasına izin verilmiyor; süzgecin sınırı beş,
    // aradaki pay bilerek geniş.
    if (tekrar <= 2) cikti += k;
  }
  return `${onek}${cikti}`;
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
      ad = adiYenile(ad);
      adDenemesi++;
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
