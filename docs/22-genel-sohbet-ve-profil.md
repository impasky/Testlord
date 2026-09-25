# 22 — Genel sohbet, profil kartı, profil resmi ve uygulama kasası

Oyuncunun istekleri:

1. "Tüm oyuncuların sohbet edebileceği genel sohbet yap, buna her sayfadan
   erişilebilsin."
2. "Mesaj yazan birinin ismine ya da profil resmine tıkladığında profili ve
   bazı bilgiler görünsün, kritik bilgiler görünmesin."
3. "Oyuncular mesajları rapor edebilsin ve başka oyuncuları sohbetten
   engelleyebilsin; engellediği zaman o oyuncunun mesajlarını ASLA bir daha
   görmesin."
4. "Footer'ı yukarı çekince tüm sayfalara erişilebilecek merkezi bir alan
   olsun; her biri isim + görsel butonu, Samsung uygulama kasası gibi."
5. "Profil resmi seçme ve yükleme olsun; resimler bir denetimden geçmeli,
   +18 veya benzeri içerik engellenmeli."

## 1. Genel sohbet

- **Tek kanal, bütün diyarlar.** "Tüm oyuncular" dendi. Lord adları bütün
  diyarlarda zaten benzersiz (`auth.ts`), yani aynı adlı iki kişi
  karışmıyor; profil kartı kimin hangi diyarda olduğunu söylüyor.
- **Her ekrandan.** Girişi üst çubukta (her sekmede duruyor) ve uygulama
  kasasında. Kapı (`KAPILAR` → `sohbet`) olarak açılıyor: oyuncu bulunduğu
  sekmeden kopmuyor. Ana sayfa ızgarasına taş koymuyor.
- **Okunmamış noktası.** Sohbet kapalıyken yalnız son mesajın ANI soruluyor
  (`GET /sohbet/genel/son`, 30 sn); açıkken liste 5 sn'de bir yoklanıyor.
  Son okunan an cihazda (`lib/sohbetOkundu.ts`).
- **Moderasyon ittifak sohbetiyle ORTAK.** Süzgeç (`mesajDenetle`),
  şikâyet + otomatik gizleme eşiği, susturma, engel, yönetici kuyruğu. İki
  kanal iki ayrı kural dili konuşmuyor.
- **Daha sıkı frenler** (`balance.json → genel_sohbet`): 200 harf, iki
  mesaj arası 5 sn, aynı söz 60 sn içinde tekrar yazılamıyor (büyük harf,
  boşluk ve noktalama farkı sayılmıyor — `ayniSozMu`). Yazmak doğrulanmış
  e-posta istiyor; okumak istemiyor.

## 2. Engel ve şikâyet

- Engel SUNUCUDA uygulanıyor: engellenenin mesajları engelleyene hiç
  gönderilmiyor — geçmiş mesajlar dahil, iki sohbette de. Gönderip arayüzde
  gizlemek gizlemek olmazdı. Engel sessiz ve tek yönlü.
- Şikâyet türleri: `lord`, `mesaj` (ittifak), `genel`, `resim`. Karar
  türlerine `resim_kaldir` eklendi. Şikâyet kaydı tek yardımcıdan geçiyor
  (`services/moderasyon.ts → sikayetKaydet`): sebep denetimi, 20 sn fren,
  tekil kayıt, farklı şikâyetçi sayısı.
- Eşikte (3 farklı oyuncu) mesaj gizleniyor, resim kalkıyor — ceza değil,
  yönetici "yok say" derse geri geliyor.

## 3. Profil kartı

Ada ya da resme dokununca (`ProfilKarti.tsx`, `GET /lord/:id/profil`).

| Kartta var                                                                                                                | Kartta YOK                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ad, resim, arma, seviye, unvan, şöhret, medeniyet (+ fayda rütbesi), ittifak (+ rütbe), bölge sayısı, diyar, katıldığı AY | e-posta, kaynaklar, ordu (sayı ve yer), ekipman, kampın yeri, son görülme, katıldığı GÜN |

Kartta yalnız oyunun zaten herkese gösterdiği bilgiler var (sıralama,
harita). Gizlenenlerin biri kişisel veri, gerisi bir saldırgana bedavaya
hedef seçtiren istihbarat — casusluk oyunda bir bedelle alınıyor.
`genel-sohbet-testi` kartın alanlarını tek tek sayıyor; yeni bir alan
eklenirse test kırılıyor ve karar bilinçli veriliyor.

Karttan engellenebiliyor, şikâyet edilebiliyor; yüklenmiş resim ayrıca
şikâyet edilebiliyor (hazır portreler değil — onları biz çizdik).

## 4. Profil resmi

Üç tür (`packages/shared/src/profil.ts → ProfilResmi`):

- **arma** — varsayılan. Arma addan türetildiği için herkesinki farklı.
- **hazır** — 22 portre: lord, general ve düşman şefi figürlerinden baş-omuz
  kırpması (`tools/portre-kirp.py` → `gorseller/portre/`). Denetim yok.
- **yüklenen** — oyuncunun resmi.

### Yüklenen resmin yolu

1. İstemci resmi tarayıcıda 768 piksele küçültüp JPEG olarak gönderiyor.
2. Sunucu (`services/resimDenetimi.ts`) biçimi İÇERİKTEN doğruluyor
   (yalnız JPEG/PNG/WebP), piksel bombasına sınır koyuyor, 256×256'ya
   kırpıyor, saydamlığı düzleştiriyor, webp olarak YENİDEN kodluyor. Bu
   sırada EXIF (konum, cihaz, tarih) ve dosyaya gizlenmiş her şey atılıyor.
   Sınıflandırılan görüntü, gösterilen görüntünün birebir aynısı.
3. **Sınıflandırıcı:** nsfwjs (MobileNetV2), sunucuda, AYRI BİR İŞ
   PARÇACIĞINDA (`apps/api/resim-iscisi.mjs`). Resim hiçbir dış hizmete
   gitmiyor. Saf JS arka uçta ~2 sn; ana iş parçacığında olsaydı her
   yükleme bütün oyuncuları dondururdu. İlk yüklemede açılıyor, 10 dk boşta
   kalınca kapanıyor (~100 MB).
4. **Karar** (`resimKarari`, eşikler `balance.json → profil_resmi`):
   - Porn + Hentai ≥ 0,7 ya da Sexy ≥ 0,85 → **red**: kimse görmüyor,
     BAYTLAR SAKLANMIYOR (uygunsuz görüntüyü "kanıt" diye tutmak onu
     dağıtmanın bir başka yolu olurdu); oyuncuya sebep söyleniyor.
   - Porn + Hentai + Sexy < 0,15 → **onay**: hemen görünüyor.
   - arası → **inceleme**: yalnız yükleyen (önizleme) ve yönetici görüyor.
     Oyunun kendi okçubaşı portresi Hentai 0,46 aldı — çizim sanatı
     sınıflandırıcıyı yanıltabiliyor, gri bölge insana gidiyor.
   - Sınıflandırıcı çalışmazsa (kapalı, zaman aşımı, çökme) → **inceleme**.
     Denetlenemeyen resim denetlenmiş sayılmıyor.
5. Onaylı resim `GET /profil-resmi/:id` ile herkese açık (img etiketi jeton
   gönderemiyor); onaylı olmayan için uç yokmuş gibi 404.
6. Günde en fazla 5 yükleme (reddedilenler de sayılıyor). Yüklemek
   doğrulanmış e-posta istiyor.

### Yönetici

Şikâyet kuyruğunun en üstünde **onay bekleyen profil resimleri**: resim,
sınıflandırıcının sayıları ve şikâyet sayısıyla. Onayla → görünür olur,
oyuncuya haber gider. Kaldır → baytlar silinir, oyuncu armasına döner,
haber gider. Resim şikâyetleri kuyrukta resmin kendisiyle görünüyor;
"resmi kaldır" kararı var.

Sınıflandırıcıyı kapatmak için `RESIM_SINIFLANDIRICI=kapali`: o zaman HER
resim yönetici onayına gidiyor (hiçbiri denetimsiz görünmüyor).

## 5. Uygulama kasası

Alt çubuğu yukarı çekince (ya da çubuğun tepesindeki tutamağa dokununca)
açılan ızgara (`UygulamaKasasi.tsx`): beş sekme ve bütün kapılar, her biri
görsel + ad. Yönetici kapıları yalnız yöneticiye.

- Hiçbir giriş yerinden kalkmadı; kasa hepsini TEK YERDE topluyor.
- İki açma yolu şart: sürükleme oyuncunun tarif ettiği hareket, tutamak
  sürükleyemeyen (ekran okuyucu, tek parmak) için.
- Sürükleme PENCEREDEN dinleniyor: parmak çubuğun dışına çıkınca olaylar
  çubuğa gelmiyor. İşaretçi yakalamak (pointer capture) olmazdı — bırakma
  çubuğa düşer, altındaki sekmeye basılmamış sayılırdı. Çekme altındaki
  sekmeye de basılmış sayılmıyor (`onClickCapture`).
- Kasa aşağı sürüklenerek, dışına dokunarak, Kapat ya da Esc ile kapanıyor.

## 6. Testler

- `tools/genel-sohbet-testi.mjs` — yazma/okuma, frenler, süzgeç,
  doğrulama, profil kartının alanları, engel (eski + yeni mesaj, tek yön),
  şikâyet + gizleme, yönetici kararı, susturma; tarayıcıda her sekmede
  sohbet düğmesi, okunmamış noktası, profil kartı, karttan engel, kasa
  (tutamak ve ÇEKME hareketi).
- `tools/profil-resmi-testi.mjs` — hazır portreler (her görsel gerçekten
  sunuluyor), GERÇEK sınıflandırıcıyla temiz yükleme, EXIF silinmesi,
  red (baytlar yok), inceleme → onay/kaldır, şikâyet eşiği, geçersiz dosya,
  GIF, günlük sınır, doğrulanmamış hesap; tarayıcıda seçici ve yükleme.
  Red yolu sınıflandırıcının cevabı taklit edilerek sınanıyor
  (`/test/resim-tahmini`, yalnız geliştirmede) — depoya uygunsuz resim
  konamaz.
- `packages/shared/src/profil.test.ts` — karar eşikleri (ölçülen okçubaşı
  örneği dahil), sütun çözümü, aynı söz.
- `tum-dugmeler-testi` iki yeni yer: `kapi:sohbet`, `kasa`.
