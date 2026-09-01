# 04 — Yol Haritası

**Toplam: 9 kilometre taşı, ~34 iş günü** (tek geliştirici, tam zamanlı).

> **Durum: dokuz taşın dokuzu da bitti.** Oyun uçtan uca oynanabilir ve
> yayına hazır. Her taşın gerçekte ne çıkardığı ve hangi hataların
> yakalandığı git geçmişinde.
>
> **Sıradaki yol haritası v2'dir** — bu dokuz taş oyunu çalışır kıldı,
> v2 oyuncunun geri gelmesini sağlıyor: M10–M16,
> [`docs/07-v2-kapsam.md`](07-v2-kapsam.md).

Sıralama tesadüfi değil: her taş bir öncekinin üstüne oturur ve **her taşın
sonunda elle test edilebilir bir şey** olur. Hiçbir aşamada "çalışan bir şey yok,
üç hafta sonra göreceğiz" durumu yaşanmaz.

---

## M0 — İskelet · 3 gün  ✅

- pnpm monorepo, TypeScript, ESLint, Prettier
- Docker Compose (Postgres)
- Prisma şeması + ilk migration (tüm tablolar birden)
- `packages/shared`: `balance.ts` JSON'ları tipli yükler ve doğrular
- `apps/api`: Fastify + JWT kayıt/giriş
- `apps/web`: Vite + Tailwind + yönlendirme + giriş ekranı
- `seed.ts`: `world-map.json` → 61 bölge, ilk dünya açılır

**Biterse:** Kayıt olup giriş yapabiliyorsun, veritabanında 61 bölge var.

---

## M1 — Kaynaklar ve Malikâne · 3 gün  ✅

- `shared/economy.ts`: lazy accrual, depo kapasitesi, malikâne formülü
- `GET /me` — tick uygulanmış kaynaklarla
- **Ekran 1: Malikâne** — kaynak çubuğu, saatlik üretim, depo doluluk

**Biterse:** Sekmeyi kapatıp bir saat sonra açtığında kaynağın artmış oluyor.
Bu, tüm oyunun kalbidir; erken doğrulanması şart.

---

## M2 — Lord ve İlerleme · 2 gün  ✅

- `shared/progression.ts`: XP eğrisi, seviye atlama, komuta kapasitesi, şöhret
- `POST /me/stats` — puan dağıtımı
- **Ekran 2: Lord** — 4 stat, puan dağıtımı, boş ekipman slotları
- Geliştirici komutu: XP ver (test için)

**Biterse:** Seviye atlayıp puan dağıtabiliyorsun.

---

## M3 — Ekipman · 4 gün  ✅

- `shared/equipment.ts`: ItemPower, üretim tablosu, yükseltme şansı
- Kuyruk altyapısı (`Queue` tablosu + worker'ın ilk hali)
- `/items/*` uç noktaları
- **Ekran 3: Demirhane** (ekipman kısmı) + Ekran 2'ye envanter

**Biterse:** Ekipman üretip kuşanıp yükseltebiliyorsun. İlk "kumar" hissi burada
doğar — nadirlik çekilişini kendi gözünle görürsün.

---

## M4 — Ordu · 3 gün  ✅

- Birim tablosu, eğitim kuyruğu, komuta kapasitesi kontrolü
- Bakım hesabı + erzak açlığı firarı (worker)
- `/army/*` uç noktaları
- **Ekran 4: Kışla** — eğitim, ordu dağılımı, kapasite çubuğu

**Biterse:** Ordu kurup besleyebiliyorsun; erzağı bitirirsen asker kaçıyor.

---

## M5 — Harita ve Bölgeler · 4 gün  ✅

- Bölge geliri (lazy accrual, bölge deposu)
- Bölge yükseltme kuyruğu, bölge limiti kontrolü
- Garnizon bırakma / geri alma
- `/map/*` uç noktaları
- **Ekran 5: Harita** — 61 hex SVG, sahiplik renkleri, detay paneli

**Biterse:** Haritayı görüyor, bölge yükseltiyor, garnizon bırakıyorsun.
(Henüz fetih yok — bölgeler test için elle atanır.)

---

## M6 — Savaş Motoru · 5 gün · **en riskli taş**  ✅

- `shared/rng.ts` — mulberry32, deterministik
- `shared/combat.ts` — 5 tur, karşı çarpanları, kayıp formülleri, yağma
- **Birim testleri önce:** `docs/02` bölüm 5'teki senaryo tablosu birebir test
- Yürüyüş sistemi (`March`) + worker çözümü + dönüş
- `POST /march`, `POST /battle/preview`, `/battles`
- Savaş raporu modalı

**Biterse:** Gerçekten saldırıp bölge alabiliyorsun. Oyun bu noktada **oyun** olur.

> Bu taş neden en riskli: burada bir denge veya determinizm hatası, sonraki her
> şeyi zehirler. Bu yüzden testler koddan **önce** yazılır ve `docs/02`'deki
> beklenen çıktı tablosu kabul kriteridir.

---

## M7 — Generaller · 2 gün  ✅

- `generals.json` yükleme, kiralama, slot atama, general XP'si
- Pasif ve yeteneklerin savaş motoruna bağlanması
- **Ekran 6: Generaller**

**Biterse:** General kiralayıp savaşa sokabiliyorsun, etkisini raporda görüyorsun.

---

## M8 — Rekabet ve Cila · 4 gün  ✅

- Şöhret hesabı + 3 sıralama tablosu (5 dk'da bir yenilenir)
- **Ekran 7: Sıralama** (3 sekme)
- Beş koruma kuralı (yeni oyuncu, fetih sonrası, aynı saldırgan, seviye farkı, günlük limit)
- Taht Kalesi özel kuralları + "Diyarın Lordu" unvanı
- **`docs/02` bölüm 7'deki 8 denge kontrolü → CI'da koşan test dosyası**
- Olay akışı (saldırıya uğradın / bölge kaybettin / kuyruk bitti)

**Biterse:** Oyun tam. `docs/00`'daki 7 başarı kriteri kontrol edilir.

---

## M9 — Yayın · 4 gün  ✅

- **120 sanal oyuncuyla yük testi** — `tools/yuk-testi.mjs`. 120/120 kayıt,
  5xx yok, en yavaş uç 408 ms p95. Testi yazarken hız sınırının IP başına
  saydığı çıktı: operatör NAT'ı arkasındaki oyuncular birbirini kilitlerdi.
  Genel sınır oturuma bağlandı, kayıt/giriş IP başına ayrıldı.
- **Hata izleme ve yapılandırılmış log** — `apps/api/src/izleme.ts`. Sentry
  isteğe bağlı (`SENTRY_DSN` boşsa dışarıya hiçbir şey gitmez), yalnızca 5xx
  ve yakalanmamış istisnalar bildirilir. Log'da token ve parola maskeli.
- **Yedekleme** — `tools/yedekle.sh`, custom-format pg_dump + rotasyon.
  Geri yükleme boş bir veritabanına denendi.
- **Onboarding** — Malikâne'de dört adımlık İlk Adımlar rehberi. Durum
  saklamıyor, oyun durumundan türetiyor.
- **Dağıtım** — `render.yaml` (Blueprint) ve `docker-compose.yml`. Ortam
  değişkenleri, yedekleme zamanlaması ve yayın öncesi kontrol listesi
  `docs/05-dagitim.md`'de.

**Ayrıca:** `docs/00`'daki yedi başarı kriterinin yedisi de otomatik testle
bağlandı. Bu sırada üç boşluk çıktı ve kapatıldı: PvP saldırısı, ekipman
yükseltme ve generalle savaşa girme hiçbir testte yoktu.

**Bitti:** Gerçek oyuncular oynayabilir.

---

## Özet takvim

| Taş | Konu | Gün | Kümülatif |
|---|---|---|---|
| M0 | İskelet | 3 | 3 |
| M1 | Kaynaklar | 3 | 6 |
| M2 | Lord | 2 | 8 |
| M3 | Ekipman | 4 | 12 |
| M4 | Ordu | 3 | 15 |
| M5 | Harita | 4 | 19 |
| M6 | **Savaş** | 5 | 24 |
| M7 | Generaller | 2 | 26 |
| M8 | Rekabet + cila | 4 | 30 |
| M9 | Yayın | 4 | **34** |

~34 iş günü ≈ **7 hafta.**

## Hızlandırma seçenekleri

Süreyi kısaltmak gerekirse, oyunu bozmadan kesilebilecek tek yer şudur:

| Kesinti | Kazanç | Bedeli |
|---|---|---|
| M9'u atla (yerel/beta yayın) | −4 gün | İzleme ve yedekleme yok, gerçek yayın riskli |
| Ekran 6'yı Ekran 2'ye göm | −0,5 gün | Generaller arayüzde sıkışır |
| Harita SVG yerine liste | −1,5 gün | Görsel çekicilik ciddi düşer, önerilmez |

**Kesilmemesi gerekenler:** M6 test yazımı, M8 denge kontrolleri, M1 lazy accrual.
Bu üçü kesilirse tasarruf birkaç gün, bedeli haftalarca hata ayıklamadır.

## İlerleme kuralı

Her taşın sonunda:
1. `docs/00`'daki kapsam listesi tekrar okunur — yeni bir şey eklendi mi?
2. Denge sayısı değiştiyse `docs/02` bölüm 7'deki kontroller çalıştırılır.
3. Çalışan hâli elle test edilir, sonra bir sonraki taşa geçilir.

Bir taş bitmeden diğerine geçilmez. Yarım kalan sistem, kapsam büyümesinin
en sık girdiği kapıdır.
