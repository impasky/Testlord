# 06 — Play Store ve App Store Yayını

Oyunu mağazalara çıkarmak için tamamlanması gereken işler.

> **Bu listenin doğrulanması gerekiyor.** Mağaza politikaları sık değişiyor ve
> bu ortamdan politika sayfalarına erişemiyorum. Aşağıdakiler bildiğim kadarıyla
> doğru ama her maddeyi kendi kaynağından teyit et:
> [Play Console politikaları](https://play.google.com/console/about/programs/) ·
> [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

---

## 0. En büyük engel: iOS için bilgisayar gerekiyor

App Store'a yükleme Xcode ile yapılır ve **Xcode yalnızca macOS'ta çalışır.**
Telefondan iOS derlemesi yapılamaz.

Üç yol var:

| Yol | Ne gerektirir |
|---|---|
| Mac satın al / ödünç al | Tek seferlik maliyet |
| Bulut CI (Codemagic, Bitrise, EAS Build, GitHub Actions macOS runner) | Aylık ücret, kurulum telefondan yapılabilir |
| Önce yalnızca Android | Hiçbir şey — Play derlemesi Linux'ta yapılır |

**Öneri: önce Play Store.** Android tarafı bilgisayarsız yürüyebilir, iOS'u
oyun oturduktan sonra ekle.

---

## 1. Paketleme — oyun şu an bir web uygulaması

Mağazalar web sitesi kabul etmiyor; uygulamanın paketlenmesi gerekiyor.

**Capacitor öneriyorum.** Mevcut React + Vite çıktısını olduğu gibi alır, iki
platforma da paket üretir ve bildirim, titreşim, paylaşım gibi native
yetenekleri eklenti olarak açar.

Alternatifi **TWA (Bubblewrap)** yalnızca Android'de çalışır ve daha basittir,
ama iOS yolunu tamamen kapatır.

> **Apple'ın 4.2 kuralı (Minimum Functionality):** siteyi bir webview'a sarıp
> göndermek reddedilme sebebi. Uygulamanın native bir şeyler yapması bekleniyor
> — bildirim, titreşim, çevrimdışı davranış. Capacitor bunları verdiği için bu
> kuralı geçmek kolaylaşıyor.

---

## 2. Sunucu

- **Gerçek alan adı ve HTTPS.** Render'ın verdiği alt alan adı çalışır ama
  mağazada durması kötü; kendi alan adını bağla.
- **Ücretli veritabanı.** Ücretsiz PostgreSQL siliniyor (bkz. `docs/05`).
- **Kesintisizlik.** Mağazadaki bir uygulama çöktüğünde geri dönüş yorum
  puanı olarak gelir ve puan geri alınmaz.

---

## 3. Zorunlu metinler ve formlar

| Ne | Play | Apple | Durum |
|---|---|---|---|
| Gizlilik politikası (herkese açık URL) | zorunlu | zorunlu | ❌ yok |
| Veri güvenliği formu / App Privacy etiketi | zorunlu | zorunlu | ❌ doldurulmadı |
| İçerik derecelendirme anketi | IARC | yaş derecesi | ❌ yapılmadı |
| Destek e-postası / URL | zorunlu | zorunlu | ❌ yok |

Toplanan veri: **e-posta adresi** ve **oyun içi ilerleme**. Formlarda ikisi de
beyan edilmeli. Parola hash'lenmiş tutuluyor (argon2id), ham parola saklanmıyor.

---

## 4. Hesap gereksinimleri — kodda eksik olanlar

Bunlar mağaza politikası, tercih değil:

- **Hesap silme.** Her iki mağaza da uygulama içinden hesap silmeyi şart
  koşuyor; Play ayrıca **uygulama dışından erişilebilen bir silme sayfası**
  istiyor. Şu an ikisi de yok.
- **Parola sıfırlama.** Politika şartı olmasa da, sıfırlaması olmayan bir
  hesap sistemi doğrudan kötü yoruma dönüşür. Zaten `docs/05` listesinde ilk
  sırada.
- **Kullanıcı üretimi içerik denetimi.** Lord adları oyuncu tarafından
  yazılıyor ve sıralamada, savaş raporlarında herkese görünüyor. Apple'ın 1.2
  kuralı bu durumda **süzme, şikâyet etme ve kullanıcı engelleme** mekanizması
  istiyor. Play'in de benzer bir kuralı var. Şu an hiçbiri yok.
- **Apple ile Giriş.** Şu an yalnızca e-posta + parola var, bu yüzden bir
  yükümlülük doğmuyor. Ama ileride Google ya da Facebook ile girişi eklersen
  Apple, "Apple ile Giriş"i de eklemeni zorunlu kılıyor.

---

## 5. Mağaza varlıkları

**Play Store**
- Uygulama simgesi 512×512 PNG
- Öne çıkan görsel 1024×500
- En az 2 telefon ekran görüntüsü (daha fazlası daha iyi)
- Kısa açıklama (80 karakter) ve tam açıklama (4000 karakter)

**App Store**
- Uygulama simgesi 1024×1024 PNG
- 6,7" ve 6,5" ekran görüntüleri (iPad destekleyeceksen onlar da)
- Açıklama, anahtar kelimeler, destek URL'si

Ekran görüntüleri elde var: `docs/gorseller/` altında yedi ekranın telefon
boyutunda görüntüsü duruyor, mağaza için yeniden çekilebilir.

---

## 6. Hesaplar ve maliyet

| Kalem | Tutar |
|---|---|
| Google Play Developer hesabı | 25 USD, tek seferlik |
| Apple Developer Program | 99 USD, yıllık |
| Alan adı | yıllık, birkaç dolar |
| Sunucu + veritabanı (ücretli katman) | aylık |

**Doğrula:** Play'in bireysel geliştirici hesapları için, üretime çıkmadan
önce belli sayıda test kullanıcısıyla belli bir süre kapalı test yapma şartı
olduğunu biliyorum. Sayılar ve süre değişmiş olabilir — Play Console'dan
kendi hesabının gördüğü şartı oku.

---

## 7. Teknik paketleme adımları

**Android**
- Çıktı biçimi AAB (APK artık kabul edilmiyor)
- Play'in istediği hedef API seviyesi (her yıl yükseliyor)
- İmzalama anahtarı — Play App Signing kullan, anahtarı kaybetmek uygulamayı
  bir daha güncelleyememek demek

**iOS**
- Bundle kimliği, provisioning profilleri
- TestFlight üzerinden dahili test
- İlk incelemede reddedilmeyi normal say; gerekçe yazılı gelir

---

## 8. Önerilen sıra

1. **`docs/05`'teki beş engeli bitir.** Parola sıfırlama, ücretli veritabanı,
   yedekleme, ortam değişkenleri, aydınlatma metni. Mağaza bunların üstüne
   kurulur.
2. **Hesap silme ve içerik denetimini ekle.** Bunlar politika şartı; eksikse
   inceleme geçmez.
3. **Alan adını bağla.**
4. **Capacitor ile Android paketini üret**, Play Console hesabını aç, kapalı
   testi başlat.
5. **Oyun Play'de otururken iOS'a bak** — Mac ya da bulut CI kararını o zaman
   ver.
