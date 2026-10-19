# 26 — Play Console için hazır metinler

Play Console'daki formların cevapları, oyunun gerçekte yaptığına göre
yazıldı (Aydınlatma Metni, `docs/21`, `docs/25`). Kopyala, yapıştır.
`<alan adın>` gördüğün yere oyunun adresini yaz.

Bu bir hukuki görüş değil; formların sorumluluğu hesap sahibinde.
Google'ın formları sık değişiyor; bir soru burada yoksa cevabını
Aydınlatma Metni'nden çıkar.

## 1. Mağaza girişi

| Alan               | Türkçe                                                                | English                                                                         |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Uygulama adı (30)  | Lordlar Çağı                                                          | Age of Lords                                                                    |
| Kısa açıklama (80) | Ortaçağ diyarında kaleni kur, ordunu eğit, ittifakınla toprak fethet. | Build your keep, train an army and conquer a medieval realm with your alliance. |
| Kategori           | Oyun → Strateji                                                       | Game → Strategy                                                                 |
| Etiketler          | Strateji, Çok oyunculu, Ortaçağ                                       | Strategy, Multiplayer, Medieval                                                 |

### Tam açıklama — Türkçe

```
Lordlar Çağı, telefonda oynanan çok oyunculu bir ortaçağ strateji oyunu. Bir diyarda küçük bir yerleşkeyle başlarsın; kaleni büyütür, ordunu kurar ve haritadaki bölgeler için başka lordlarla yarışırsın.

KALENİ KUR
• 13 yapı: malikâneden demirhaneye, kışladan surlara, limandan elçiliğe
• Dört dalda 60 araştırma: imar, ordu, doktrin ve diyar
• Kaynakların sen yokken de akar; dönünce ne olduğunu özet olarak görürsün

ORDUNU YÖNET
• Piyade, okçu, süvari ve kuşatma; her birinin güçlü ve zayıf olduğu birlikler
• Savaş dizilimini sen kurarsın; her savaşın ayrıntılı raporu var
• 8 general, her birinin kendi uzmanlığı
• Demirhanede ekipman üret ve yükselt

DİYARI FETHET
• Gerçek dünya haritası: 197 ülke, 3.000'i aşkın şehir; her şehir ele geçirilebilir
• Şef kamplarına akın ederek ganimet topla
• Keşif, kalkan ve takviye ile hamleni planla
• Bir ülke seç, sınırdan yayıl; her ülkenin başkenti bir taht

İTTİFAKINLA OYNA
• İttifak kur ya da birine katıl; sohbet, duyuru, kaynak gönderme, paktlar
• Genel sohbette bütün diyarla konuş
• Haftalık seferler ve diyar etkinlikleri

ADİL OYUN
Güç satılmaz. Kaynak, asker, kalkan ya da ekipman parayla alınamaz; başka bir lorda giden hiçbir yürüyüş hızlanmaz. Elmas yalnız kendi işlerinin süresini kısaltır ve oynayarak da kazanılır. İstersen kısa, ödüllü bir reklam izleyerek de bir işin süresini kısaltabilirsin — reklam yalnız sen istediğinde açılır.

Sohbet otomatik süzgeçten geçer; uygunsuz içeriği şikâyet edebilir, kötüye kullananı engelleyebilirsin. Hesabını dilediğin an oyunun içinden silebilirsin.
```

### Full description — English

```
Age of Lords is a multiplayer medieval strategy game made for your phone. You start with a small settlement in a realm; grow your keep, build your army and compete with other lords for the regions on the map.

BUILD YOUR KEEP
• 13 buildings, from the manor to the forge, from barracks to walls, from the harbor to the embassy
• 60 research topics across four branches: development, army, doctrine and realm
• Your resources keep flowing while you're away; when you return you get a summary of what happened

LEAD YOUR ARMY
• Infantry, archers, cavalry and siege — each with strengths and weaknesses
• You set the battle formation; every battle has a detailed report
• 8 generals, each with their own specialty
• Craft and upgrade equipment at the forge

CONQUER THE REALM
• A real world map: 197 countries, over 3,000 cities, every one of them conquerable
• Raid chief camps for loot
• Plan your moves with scouting, shields and reinforcements
• Pick a country, expand across its borders; every capital is a throne

PLAY WITH YOUR ALLIANCE
• Found or join an alliance: chat, announcements, resource sharing, pacts
• Talk to the whole realm in global chat
• Weekly campaigns and realm events

FAIR PLAY
Power is not for sale. Resources, soldiers, shields and equipment can't be bought; no march against another lord is ever sped up. Gems only shorten the time of your own tasks, and you can earn them by playing. You can also watch a short rewarded ad to shorten a task — ads only open when you ask.

Chat is automatically filtered; you can report objectionable content and block abusive players. You can delete your account from inside the game at any time.
```

### Bağlantılar

| Alan                   | Değer                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Web sitesi             | `https://<alan adın>` (AdMob app-ads.txt'yi burada arıyor)                                           |
| E-posta                | `DESTEK_EPOSTA`'ya girdiğin adres                                                                    |
| Gizlilik politikası    | `https://<alan adın>/#/gizlilik`                                                                     |
| Hesap silme bağlantısı | `https://<alan adın>/#/gizlilik` ("Haklarını nasıl kullanırsın": web'den giriş → Hesap → Hesabı Sil) |

Ekran görüntüleri: `docs/gorseller/` (telefon boyutu). Simge 512×512:
`apps/web/public/simge-512.png`.

## 2. Uygulama içeriği

### 2.1 Reklamlar

**Uygulamada reklam var mı?** Evet (ödüllü reklam, AdMob).

### 2.2 Uygulama erişimi

"Bazı işlevler kısıtlı" → giriş bilgisi ver. İnceleyici için **sen** bir
hesap aç, e-postasını doğrula (sohbet doğrulanmış hesap istiyor), lordu
biraz geliştir (bina, ordu, bir ittifak). Talimat:

```
Giriş: e-posta ve parola ile "Diyara gir".
Mağaza: üst çubuktaki elmas sayacına dokun.
Hızlandırma: Kışla'da asker eğitirken "Hızlandır".
Ödüllü reklam: Hızlandır penceresindeki "Reklam izle".
Sohbet şikâyeti/engelleme: bir mesajın yanındaki ⚑ ve ⊘.
Hesap silme: Hesap → Hesabı Sil.
```

### 2.3 Hedef kitle

**13–15, 16–17, 18+.** 13 yaş altını SEÇME: oyunda yabancılarla sohbet,
satın alma ve reklam var. Çocuklara yönelik bir uygulama Aileler
politikasına ve reklamda ek kısıtlara girer. "Çocukların ilgisini
çekebilir mi?" → Hayır.

### 2.4 İçerik derecelendirmesi (IARC)

| Soru                                          | Cevap                                                               |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Kategori                                      | Oyun                                                                |
| Şiddet                                        | Evet — fantastik/stilize savaş; kan yok, gerçekçi değil             |
| Cinsellik, çıplaklık                          | Hayır                                                               |
| Küfür                                         | Oyunun kendisinde hayır (kullanıcı sohbeti aşağıda)                 |
| Uyuşturucu, alkol, tütün                      | Hayır                                                               |
| Kumar / benzetilmiş kumar                     | Hayır                                                               |
| Parayla alınan rastgele ödül (ganimet kutusu) | Hayır — elmas yalnız süre kısaltıyor, rastgele bir şey satılmıyor   |
| Kullanıcılar etkileşir                        | Evet — ittifak ve genel sohbet (süzgeç, şikâyet, engel, moderasyon) |
| Kullanıcı içerik paylaşır                     | Evet — profil resmi (denetimli), ad ve mesajlar                     |
| Konum paylaşımı                               | Hayır                                                               |
| Dijital satın alma                            | Evet                                                                |

### 2.5 Veri güvenliği

**Genel:** veri aktarımda şifreli → **Evet**. Kullanıcı silme isteyebilir →
**Evet** (oyun içi ve web bağlantısı). Aileler politikası → hayır.

"Paylaşım" Play'in tanımıyla: kullanıcının kendi eylemiyle (sohbete
yazmak gibi) görünen veri ve hizmet sağlayıcılarına bizim adımıza giden
veri paylaşım sayılmıyor. AdMob'un topladığı veri ise Google'ın kendi
amaçları için de işlendiğinden **paylaşılıyor** işaretlendi.

| Tür (Play)                                  | Toplanıyor | Paylaşılıyor  | Zorunlu mu   | Amaç                                                               | Kaynak       |
| ------------------------------------------- | ---------- | ------------- | ------------ | ------------------------------------------------------------------ | ------------ |
| Kişisel bilgi → E-posta adresi              | Evet       | Hayır         | Zorunlu      | Uygulama işlevi, hesap yönetimi                                    | Oyun         |
| Kişisel bilgi → Ad (lord adı, takma ad)     | Evet       | Hayır         | Zorunlu      | Uygulama işlevi                                                    | Oyun         |
| Kişisel bilgi → Kullanıcı kimlikleri        | Evet       | Hayır         | Zorunlu      | Uygulama işlevi, hesap yönetimi, sahtekârlık önleme                | Oyun         |
| Finansal bilgi → Satın alma geçmişi         | Evet       | Hayır         | İsteğe bağlı | Uygulama işlevi, sahtekârlık önleme                                | Oyun         |
| Mesajlar → Diğer uygulama içi mesajlar      | Evet       | Hayır         | İsteğe bağlı | Uygulama işlevi                                                    | Oyun         |
| Fotoğraflar → Fotoğraflar                   | Evet       | Hayır         | İsteğe bağlı | Uygulama işlevi (profil resmi)                                     | Oyun         |
| Uygulama etkinliği → Uygulama etkileşimleri | Evet       | Evet (Google) | Zorunlu      | Analiz, uygulama işlevi; AdMob: reklam, analiz, sahtekârlık önleme | Oyun + AdMob |
| Uygulama bilgisi ve performans → Tanılama   | Evet       | Evet (Google) | Zorunlu      | Analiz, sahtekârlık önleme (AdMob); hata izleme                    | Oyun + AdMob |
| Konum → Yaklaşık konum                      | Evet       | Evet (Google) | Zorunlu      | Reklam, analiz, sahtekârlık önleme (AdMob, IP'den)                 | AdMob        |
| Cihaz veya diğer kimlikler                  | Evet       | Evet (Google) | Zorunlu      | Reklam, analiz, sahtekârlık önleme (reklam kimliği)                | AdMob        |

"Reklam kimliği" bildirimi: **Evet, kullanılıyor** — amaç reklam, analiz,
sahtekârlık önleme (AdMob SDK'sı izni kendisi ekliyor).

AdMob satırlarını Google'ın kendi rehberiyle karşılaştır; SDK sürümüne
göre değişebiliyor:
[AdMob Play veri beyanı](https://developers.google.com/admob/android/privacy/play-data-disclosure).

## 3. Uygulama içi ürünler

Para kazanma → Ürünler → Uygulama içi ürünler → **Ürün oluştur**. Kimlik
`balance.json` ile aynı olmalı; ad ve açıklama oyuncunun Play penceresinde
gördüğü.

| Ürün kimliği | Ad (55)                    | Açıklama (200)                                | Önerilen taban fiyat |
| ------------ | -------------------------- | --------------------------------------------- | -------------------- |
| `elmas_100`  | Avuç Elmas — 100 elmas     | 100 elmas. Kendi işlerinin süresini kısaltır. | 0,99 USD             |
| `elmas_550`  | Elmas Kesesi — 550 elmas   | 500 + 50 hediye elmas.                        | 4,99 USD             |
| `elmas_1200` | Elmas Sandığı — 1200 elmas | 1000 + 200 hediye elmas.                      | 9,99 USD             |
| `elmas_2600` | Hazine — 2600 elmas        | 2000 + 600 hediye elmas.                      | 19,99 USD            |

Fiyatı bir para biriminde gir, "ülkelere göre fiyat" ile Play'in
dönüştürmesine bırak (Türkiye fiyatını ayrıca yuvarlayabilirsin). Taban
fiyatlar yalnız öneri: bir saatlik hızlandırma 27 elmas, bir günlük 337.

## 4. Kapalı test (yeni kişisel hesaplar)

Kişisel geliştirici hesabıyla üretime çıkmadan önce **en az 12 test
kullanıcısının 14 gün kesintisiz** kapalı teste katılmış olması gerekiyor;
sonra Gösterge Tablosu'ndan üretim erişimi isteniyor
([Play yardım](https://support.google.com/googleplay/android-developer/answer/14151465)).
Sayı düşerse süre baştan başlayabiliyor; 15–20 kişiyle başla. Bu 14 gün
lisans testi (satın alma) ve reklam denemesi için de iyi bir zaman.

## 5. Yükleme anahtarı ve paket

Paketi bilgisayarsız üretmek için: **Actions → "Android yayın paketi" →
Run workflow** (`.github/workflows/android-yayin.yml`). Önce bir kez:

1. Yükleme anahtarını üret (Java olan herhangi bir bilgisayarda bir kez):

   ```sh
   keytool -genkeypair -keystore yukleme.p12 -storetype PKCS12 \
     -alias yukleme -keyalg RSA -keysize 4096 -validity 10000 \
     -dname "CN=Lordlar Cagi"
   base64 -w0 yukleme.p12 > yukleme.p12.b64
   ```

   `yukleme.p12`'yi ve parolasını **iki ayrı güvenli yerde** sakla.
   Kaybedersen Play Console'dan yükleme anahtarı sıfırlama istenebiliyor
   ama günler sürüyor.

2. GitHub → Settings → Secrets and variables → Actions:
   - **Secrets:** `IMZA_ANAHTARI_B64` (`yukleme.p12.b64`'ün içeriği),
     `IMZA_PAROLASI`, `IMZA_TAKMA_ADI` = `yukleme`.
   - **Variables:** `OYUN_ADRESI` = `https://<alan adın>`,
     `ADMOB_UYGULAMA_KIMLIGI` = AdMob'daki `ca-app-pub-…~…`.

3. Run workflow → sürüm adı (`1.0.0`). Koşu bitince **lordlar-aab-…**
   yapıtını indir (zip; içindeki `.aab`'yi) ve Play Console → Test →
   Kapalı test → Yeni sürüm'e yükle. Sürüm kodu koşu numarasından,
   kendiliğinden artıyor.

Depo herkese açık: anahtar ne depoya ne yapıta giriyor; yalnız gizli
değişkende duruyor. Yapıttaki `.aab` imzalı uygulamanın kendisi —
herkesin indirebilmesi bir sakınca değil, Play'e yalnız senin hesabın
yükleyebiliyor.
