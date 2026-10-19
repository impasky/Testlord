# 27 — Gerçek dünya haritası

Oyuncunun isteği:

> "Güncel dünya haritasını yap, ülkeler vs hepsi olsun ve her şehri bir
> toprak olarak yap; her şehir ele geçirilebilir bir toprak olsun. Oyun
> başında oyuncu ülke seçsin, ona göre o ülkeye atansın. Diğer ülke
> topraklarına sınır varsa oyuncular orayı da ele geçirebilsin. Her
> ülkenin başkenti taht olsun."

Bu belge kararları, kuralları, göçü ve ölçülen sayıları kaydediyor. Eski
kurgu harita (`docs/12`, `docs/23`) ve medeniyet katmanı (`docs/16`)
bununla kalktı.

## 1. Oyuncunun seçtikleri

| Soru                          | Seçim                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Kaç şehir                     | ~3.100 (nüfusu 100.000'in üstündeki her şehir + her başkent)                         |
| Denizle ayrılan ülkeler       | Yakın kıyılar arası deniz yolu                                                       |
| Medeniyetler                  | Kalkıyor: herkes kendi adına; fethedilen şehir lordun                                |
| Bugünkü diyarlar ve oyuncular | Hepsi yeni haritaya göçüyor: şehir, binalar, ordu, eşya kalıyor; toprak sıfırlanıyor |

## 2. Kaynak ve bakış açısı

- **Veri:** Natural Earth v5.1.2 (kamu malı), üç dosya:
  `ne_10m_populated_places_simple` (şehirler),
  `ne_10m_admin_0_countries_tur` (sınırlar, **Türkiye bakış açısı**),
  `ne_10m_admin_0_countries` (yalnız Hindistan, Pakistan ve Keşmir).
- **Türkiye bakış açısı:** Kırım Ukrayna'da, KKTC ayrı bir ülke (başkenti
  Lefkoşa veride yok, elle eklendi), Batı Sahra Fas'ta, Somaliland
  Somali'de; Kosova, Tayvan ve Filistin ayrı ülkeler.
- **Keşmir:** fiilî kontrol hattı (iki yakası kimdeyse).
- **Bağımlı topraklar** egemen ülkeye katılıyor (Grönland Danimarka'ya,
  Porto Riko ABD'ye). Yabancı üsler bulundukları ülkenin: Akrotiri ve
  Dikelya Güney Kıbrıs'ın, Guantanamo Küba'nın.
- **Adlar:** ülke adları Türkçe (veride `NAME_TR`, uzun resmî adların kısa
  hâli elle). Türkiye'deki şehirler ve Türkçede yerleşmiş adı olan
  başkentler ile büyük şehirler Türkçe (Atina, Moskova, Kahire, Halep,
  Selanik, Bingazi…); gerisi verideki yazımla.
- **Başkent:** verideki "Admin-0 capital"; birden çok başkentli ülkede
  resmî olanı (Pretoria, Sucre, Yamoussoukro, Naypyidaw, Dodoma).

Siyasi seçimlerin hepsi üreticinin başındaki tablolarda, tek satırla
değişiyor (`KATILAN`, `RESMI_BASKENT`, `SEHIR_ADI`, `KISA_AD`). Bilerek
verideki gibi bırakılanlar: İsrail'in tahtı Kudüs, Filistin'in tahtı
Gazze (veride Filistin'in başkent noktası o).

## 3. Üretim

`node tools/gercek-dunya-uret.mjs` (~16 sn). Sayılar `data/balance.json`
→ `gercek_dunya`; üretici yalnız okuyor. Üç dosya yazıyor:

| Dosya                                          | Ne için                                                    |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `data/world-map.json`                          | Motor: bölgeler, komşuluk, deniz yolları, garnizon, gelir  |
| `data/dunya-ozet.json`                         | Ülke listesi (ad, renk, başkent, şehir sayısı) — ana paket |
| `apps/web/src/components/harita/dunyaGeo.json` | Çizim: ülke kıyıları, şehir toprakları — ayrı paket        |

Adımlar:

1. **Ülkeler** Natural Earth 1 izdüşümünde, 4.000 birim genişlikte. Noktalar
   0,1 birime oturtuluyor: iki komşu ülkenin ortak sınırı iki yanda da aynı
   noktalar, arada boşluk yok.
2. **Şehirler** nüfus eşiğinin üstündekiler ve her başkent. Şehrin ülkesi
   sınır verisindeki yerinden (Sivastopol Ukrayna'da, Hargeisa Somali'de);
   sınırın bir piksel (~10 km) yanındaki şehirde verideki ülke geçiyor
   (Detroit, Buffalo, El Paso, Basel, Nusaybin). Aynı ülkede 15 km'den yakın
   iki nokta tek şehir. Şehri olmayan büyük adaya en kalabalık yerleşimi
   ekleniyor (23 şehir: Grönland, Fransız Guyanası…).
3. **Toprak:** her ülkenin karası, KENDİ şehirleri arasında Voronoi
   hücrelerine bölünüyor (kırpma `clipper-lib`, tamsayı). Şehirden uzak,
   şehirsiz kara parçası sahipsiz kalıyor.
4. **Kara komşuluğu:** hücreler bir ızgaraya basılıyor; en az 3 pikselle
   değen iki hücre komşu — ülke sınırının iki yakasındakiler de.
5. **Deniz yolu:** 400 km'den yakın karşılıklı kıyı şehirleri (şehir başına
   en çok 2). Kopuk kalan parça (Yeni Zelanda, İzlanda) en yakın kıyıya
   bağlanıyor; harita tek parça.
6. **Tür, gelir, garnizon** nüfus kademesinden: megakent (5 M+) ve büyükşehir
   (1 M+) `sehir`; daha küçükler adından kararlı bir karıştırmayla köy, tarla,
   maden ya da kale. Kale, kademesindeki köyün iki katı garnizon
   (`tur_garnizon_carpani`): başlangıç ordusu kasaba köyünü alıyor, kasaba
   kalesini almıyor. Başkent TAHT; garnizonu ülkenin büyüklüğüne göre
   (tek şehirli ülkede %30, 20+ şehirlide tam).

Çıktı aynı girdiden bayt bayt aynı: CI üreticiyi koşturup üç dosyanın
değişmediğini ölçüyor ("Harita yeniden üretilebiliyor").

### Ölçülen sayılar

| Ölçü                  | Değer                                                      |
| --------------------- | ---------------------------------------------------------- |
| Ülke                  | 197 (her birinin tek tahtı)                                |
| Şehir (toprak)        | 3.047 — köy 651, tarla 841, maden 601, şehir 394, kale 363 |
| Kıyı şehri            | 1.235                                                      |
| Komşu sayısı          | en az 1, ortalama 5,48, en çok 23                          |
| Deniz yolu            | 419 (35'i kopukluğu gidermek için)                         |
| Sahipsiz kara parçası | 971 (çizimde ülke rengi, kimsenin değil)                   |
| Harita sürümü         | `h3047-…` (içerik özeti; `HARITA_SURUMU`)                  |

## 4. Kurallar

- **Ülke seçimi bir kez.** Ülkesi olmayan lord oyuna ülke seçim ekranından
  giriyor (`UlkeSecimi.tsx`, `POST /ulke/sec`). Kamp o ülkede, tahtı olmayan
  en zayıf sahipsiz şehrin yanına kuruluyor (`kampYeri`; eşitlikte önce
  yerleşim, sonra en az kamp); tek şehirli ülkede başkentin yanına. İkinci
  seçim reddediliyor (`ULKE_SECILDI`). Ülkesi olmayan lord saldıramıyor
  (`ULKE_SECILMEDI`).
- **İlk hedef bir yerleşim.** Şehir ancak köy, şehir ya da kale alınınca
  kuruluyor; tarla ve maden yalnız gelir. Başkenti olmayan lorda öneri önce
  yerleşim gösteriyor (`onerilenHedef`); yerleşim yapılabilir değilse
  (kazanılmıyor, eksik ordu karşılanamıyor) bütün şehirlere bakıyor.
- **Sınır kuralı** (`sinirdanMi`, `packages/shared/src/harita.ts`):
  kendi ülkenin her şehri açık; başka bir ülkenin şehri ancak evinin ya da
  tuttuğun bir şehrin komşusuysa — karadan ya da deniz yolundan. Sunucu
  saldırıda (`SINIR_YOK`), harita ve liste her şehirde (`sinirda`) aynı
  işlevi kullanıyor. Şehir alındıkça sınır genişliyor.
- **Herkes kendi adına.** Fethedilen şehir lordun (`ownerLordId`). Aynı
  ülkeden lordlar birbirine saldırabiliyor; ittifak içi saldırı yok (eski
  kural).
- **Her başkent bir taht.** Eski Taht Kalesi'nin kuralları her başkente
  işliyor: günlük saldırı hakkını yemiyor, el değiştirince 2 saat koruma,
  bölge sınırına sayılmıyor. Tutan lord o ülkenin hükümdarı; şöhreti %20
  artıyor (kaç taht tuttuğundan bağımsız).
- **Garnizon payı** kaldı (`garnizon_payi`): bölge geliri orada duran
  garnizonlar arasında yer oranında bölünüyor; pay alabilen bölgenin sahibi
  ve sahibin ittifakı (takviye).

## 5. Göç (bugünkü diyarlar)

`HARITA_KUSAGI` 2. Kuşağı eski olan her diyar, sunucu açılırken
(`index.ts`, migration'dan hemen sonra, worker başlamadan) ve `seed`te
kendi işleminde göçüyor (`eskiDunyalariGocur`, `apps/api/src/services/goc.ts`).
Üretim sunucusu `seed` koşmuyor; göçü yapan açılışın kendisi:

1. Çözülmemiş yürüyüşlerin ordusu ve yağması eve dönüyor.
2. Bölgelerdeki garnizonlar eve dönüyor.
3. Elde tutulan her bölge tazmin ediliyor (birleşmedeki kuralla) ve
   deposu lorda geçiyor.
4. Bölge yükseltme ve keşif kuyrukları siliniyor, ittifak hedefleri
   temizleniyor.
5. Eski bölgeler siliniyor, gerçek dünya yazılıyor.
6. Lordların ülkesi boşalıyor: her biri bir sonraki açılışta ülkesini
   seçiyor. NPC lordlar en az kalabalık ülkeye yerleşiyor.
7. Diyar yeni harita sürümüyle damgalanıyor, kapalıysa yeniden açılıyor.

Kalan: şehir (binalar), ordu, eşya, generaller, araştırma, kaynaklar,
ittifak. Kapalı ve boş diyar göçmüyor, yalnız eski haritası siliniyor.
Ölçüm: göç öncesi geliştirme veritabanının yedeği (38 diyar, 5.433 lord)
yüklendi ve yeni sunucu `AUTO_MIGRATE=true` ile açıldı: şema migration'ı ve
36 diyarın göçü 28 sn sürdü; göçen Lv60 bir lord ordusu ve kaynağıyla
ülkesini seçip oyuna girdi.

## 6. Kapasite

`dunya.oyuncu_kapasitesi` 240'tan 4.500'e. Kıtlık kuralı korunuyor
(tahtsız şehir / kapasite < 0,75): 2.850 / 4.500 = 0,63. Kapasite AKTİF
lorda bakıyor; diyar dolmadan şehirlerin çoğu NPC garnizonunda.

Bölge sınırı (`bolgeler.sahip_basina_max`) değişmedi; büyük haritada dar
gelirse tek sayı.

## 7. İstemci

- **Tuval harita** (`GercekHarita.tsx`): ülkeler, şehir toprakları, sınırlar
  ve deniz yolları bir taban katmanına çiziliyor ve ekranın her yanından
  240 piksel fazlasıyla saklanıyor; kaydırma yalnız üst katmanı (seçim,
  noktalar, yürüyüşler, adlar) yeniden çiziyor. Adlar hareket bitince bir
  kez, çakışanlar elenerek yerleşiyor: uzakta ülke adları, yakında şehir
  adları. Dokunma: 14 piksel içindeki şehir noktası, yoksa toprağın kendisi.
  Kenarda direnç ve geri yaylanma: harita hiçbir zaman ölü jest vermiyor.
- **İki görünüm** (`docs/23`'teki gibi): kim nerede ve Hedefler — sınır dışı,
  ittifak, paktlı ve kalkanlı toprak karanlık.
- **Liste:** Hedefler, Toprağım ve en yakın 250 şehir.
- **Paket bölme:** çizim verisi (`dunyaGeo.json`) ayrı paket ve yalnız harita
  açılınca iniyor; ana pakete yalnız ülke özeti giriyor.

| Paket              | Boyut                         |
| ------------------ | ----------------------------- |
| Ana (`index-*.js`) | 714 KB (gzip 255 KB)          |
| Harita ekranı      | 58 KB                         |
| Dünya çizimi       | 756 KB (gzip 273 KB), bir kez |
| `/api/map` yanıtı  | ~870 KB (gzip ~110 KB)        |

Ölçüm (telefon boyutu, başsız Chromium): harita 150 ms'de hazır, kaydırırken
kare aralığı p95 16,9 ms.

## 8. Testler

- `packages/shared/src/balance.test.ts`: harita doğrulaması, sınır kuralı,
  kademeler, kale.
- `tools/ulke-testi.mjs`: ülke listesi, kamp yeri, tek seçim, sınır kuralı,
  fetihle genişleyen sınır.
- `tools/harita-testi.mjs`, `tools/harita-dokunma-testi.mjs`: tuval haritada
  dokunma, mercek, adlar, görünümün hatırlanması, parmak jestleri — test
  kancası `window.__dunyaHaritasi` üzerinden.
- `tools/taht-testi.mjs`: ülkenin tahtı.
- Arayüzden kaydolan testler önce ülke seçiyor (`tools/lib/gezin.mjs` →
  `ulkeyiSec`); API'den kaydolanlar Türkiye'yle kaydoluyor
  (`tools/lib/kayit.mjs`).
