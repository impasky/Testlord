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
  //
  // Önek EN ÇOK DÖRT harf. On harfken iki kez yanıldı: ad tümüyle
  // harften oluşunca ("Arfwnazim…", zaman damgası rakamsız düşmüş) önek
  // rastgele kısmı da yutuyor, yasak parçayı ("nazi") yeni ada taşıyordu;
  // üstüne 10 + 12 harf sunucunun 20 harf sınırını aşıyordu. Dört harf
  // tanınmaya yetiyor ("Olc", "Gd", "Arf") ve yasak parçaların çoğundan kısa.
  const onek = /^[A-Za-zÇĞİÖŞÜçğıöşü]+/.exec(ad)?.[0] ?? 'Lord';
  return benzersizAd(onek.slice(0, 4)).slice(0, 20);
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
 *
 * ── Tekrar kırmak yetmedi: süzgeç RAKAMI HARF okuyor ─────────────────
 *
 * Süzgeç adı önce sadeleştiriyor (`normalize`): 3→e, 0→o, 1→i, 4→a,
 * 5→s, 7→t, geri kalan rakamlar siliniyor. Kırpılmış ham ad onun gözünde
 * başka bir ad: CI'da "Yokdi" + "mue6e3e2…" → "yokdimueeeee…" beş e,
 * reddedildi (diyar-secimi-testi, AD_UYGUNSUZ). O saatlerde damga e ve
 * 3'le doluydu; bazı milisaniyelerde her on yedi addan biri kalıyordu.
 * Aynı yol yasak sözcük de kuruyordu: "n4z1" → "nazi".
 *
 * Artık rastgele kısım yalnız ÜNSÜZLERDEN: damga 20 ünsüzlük tabanda,
 * ardından dört rastgele ünsüz. Ünsüz sadeleşmede değişmiyor, ünlü hiç
 * yok; yasak parçaların hepsi ünlü içerdiğinden bu kısımda hiçbiri
 * oluşamıyor, tekrar sınırı da ham adda neyse süzgeçte o. Uzunluk eskisi
 * gibi 12: "Bildirim" öneki sunucunun 20 harf sınırına tam sığıyor.
 */
const UNSUZ = 'bcdfghjklmnpqrstvwxz';

function unsuzle(sayi, basamak) {
  let s = '';
  for (let i = 0; i < basamak; i++) {
    s = UNSUZ[sayi % UNSUZ.length] + s;
    sayi = Math.floor(sayi / UNSUZ.length);
  }
  return s;
}

export function benzersizAd(onek = 'Test') {
  // Sekiz basamak 20^8 ms ≈ 296 günde bir başa sarıyor; o kadar eski bir
  // adla çakışmak için dört rastgele ünsüzün de (160.000 ihtimal) tutması
  // gerek. Aynı milisaniyedeki iki kaydı da o dört ünsüz ayırıyor.
  const ham =
    unsuzle(Date.now() % UNSUZ.length ** 8, 8) +
    unsuzle(Math.floor(Math.random() * UNSUZ.length ** 4), 4);
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

/**
 * Bu KOŞUDAKİ bütün lordların gideceği diyar.
 *
 * Kayıt, diyar seçilmezse açık diyarların ilkine gidiyor. Bir diyar
 * zincir boyunca DOLARSA sıradaki lord başkasına düşüyor ve birbiriyle
 * konuşması gereken iki lord ayrı dünyalarda kalıyor: ittifak "bulunamadı"
 * diyor, takviye gidemiyor, pakt kurulamıyor. Sınama o zaman ölçtüğü
 * şeyle hiç ilgisi olmayan bir sebeple düşüyor — `ittifak-basvuru-testi`
 * zincirde tam olarak böyle kaldı.
 *
 * Değer süreç başına BİR KEZ çözülüyor: aynı koşudaki her lord aynı
 * diyara yazılıyor. Diyar sınırlarını KASTEN sınayan araçlar (shard,
 * birleşme, diyar seçimi) bunu çağırmıyor, kendi dünyasını kendisi
 * veriyor.
 */
let _diyarSozu = null;
export function onerilenDiyar(API) {
  _diyarSozu ??= fetch(`${API}/api/diyarlar`)
    .then((r) => r.json())
    .then((d) => d.onerilen ?? undefined)
    .catch(() => undefined);
  return _diyarSozu;
}

export async function kayitOl(
  API,
  { email, password = 'parola1234', lordName, worldId, dogrula = true },
) {
  let sonYanit = null;
  let ad = lordName;
  let adDenemesi = 0;

  for (let deneme = 0; deneme < 4; deneme++) {
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, lordName: ad, worldId }),
    });
    const govde = await r.json().catch(() => null);
    if (govde?.token) {
      /*
       * HESAP DOĞRULANMIŞ AÇILIYOR — `dogrula: false` denmedikçe.
       *
       * E-posta doğrulaması (docs/17) ittifak sohbetini ve kaynak
       * göndermeyi doğrulanmamış hesaba kapatıyor. Testlerin çoğu bunu
       * ölçmüyor; sohbeti, ticareti, ittifakı ölçüyor ve o kapıya
       * çarpınca ölçtükleri şeyle ilgisi olmayan bir sebeple kalıyorlar.
       * Kurulum burada bir kez yapılıyor; doğrulamanın KENDİSİNİ ölçen
       * araç `dogrula: false` diyor.
       */
      if (dogrula) {
        await fetch(`${API}/api/test/dogrulanmis-yap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${govde.token}`,
          },
          body: '{}',
        }).catch(() => null);
      }
      return govde;
    }
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
