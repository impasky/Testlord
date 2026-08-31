# Lordlar Çağı

Ortaçağ temalı, tarayıcıda oynanan, sürekli dünyalı strateji-RPG.
Bir lord olarak karakterini ve ekipmanını güçlendirir, bölgeler ele geçirip gelir
kazanır, ordu kurar, ordunun donanımını üretir, generaller kiralar ve
sıralamada yükselirsin.

> **Durum: M0–M8 tamam, oyun uçtan uca oynanabilir.**
> Kayıt ol, asker eğit, orduyla yürü, savaş, bölge al, gelir kazan, ekipman
> üret ve kuşan, general kirala, sıralamada yüksel — hepsi çalışıyor.
> Kalan: M9 (yayına hazırlık — yük testi, izleme, onboarding, dağıtım).

---

## Beş temel keyif ekseni

| # | Eksen | Oyunda karşılığı |
|---|-------|------------------|
| 1 | **Rekabet ve sıralama** | 3 ayrı sıralama + dünyada tek olan Taht Kalesi |
| 2 | **Karakter gücü** | 60 seviye, 4 stat, serbest puan dağıtımı |
| 3 | **Ekipman gücü** | 6 slot, 5 tier, 5 nadirlik, +0→+10 yükseltme |
| 4 | **Bölge ve gelir** | 61 bölgelik sabit harita, saatlik gelir, bölge seviyeleri |
| 5 | **Ordu, donanım, generaller** | 5 birim + taş-kağıt-makas, 3 donanım hattı, 12 general |

## Nasıl oynanır (30 saniyelik özet)

Malikânen sana her saat kaynak üretir — kimse elinden alamaz. O kaynakla asker
eğitir, ordunla haritadaki bir bölgeye yürürsün. Bölgeyi alırsan geliri senindir;
o gelirle daha iyi ekipman üretir, bölgeni yükseltir, daha büyük ordu beslersin.
Ama bölgeler kıt: 120 oyuncuya 60 bölge düşüyor. Yani bir noktada bölgeyi
NPC'den değil, başka bir lorddan almak zorundasın. Haritanın merkezindeki
**Taht Kalesi** dünyada tek — onu tutan "Diyarın Lordu" olur.

---

## Çalıştırma

```bash
pnpm install
docker compose up -d postgres           # ya da yerel bir PostgreSQL 16

cp .env.example apps/api/.env           # DATABASE_URL ve JWT_SECRET'i düzenle
pnpm --filter @lordlar/api prisma migrate dev
pnpm db:seed                            # 61 bölgeyi yazar, ilk dünyayı açar

pnpm dev                                # arayüz :5173, API :3000
pnpm worker                             # ayrı terminalde: yürüyüş ve kuyruk çözümü
```

Arayüz http://localhost:5173 adresinde. Kayıt ol, Kışla'da asker eğit,
Harita'dan kenardaki tahkimatsız bir bölgeye saldır.

## Doğrulama

```bash
pnpm test        # 40 birim testi (savaş motoru + tasarım garantileri)
pnpm balance     # aritmetik denge kontrolleri
pnpm typecheck   # üç paketin tip kontrolü
pnpm e2e         # API + worker + tarayıcı uçtan uca testleri (sunucu ayakta olmalı)
```

`pnpm e2e` gerçek Chromium açar ve yedi ekranı dolaşır. Tarayıcı testi
şimdiye kadar üç hatayı yakaladı — hiçbiri API testlerinde görünmüyordu.

## Repo yapısı

```
docs/
  00-ozet-ve-kapsam.md    Yönetici özeti + DONDURULMUŞ kapsam sınırı (önce bunu oku)
  01-oyun-tasarimi.md     Tüm sistemler, oynanış döngüleri, ekranlar
  02-denge-formulleri.md  Her formül ve tablo, gerekçeleriyle
  03-teknik-mimari.md     Stack, veritabanı şeması, API, savaş motoru
  04-yol-haritasi.md      9 kilometre taşı, ~30 iş günü
data/
  balance.json            TÜM sayısal denge — tek kaynak, kodda sabit sayı yok
  generals.json           12 generallik sabit kadro
  world-map.json          61 bölgelik sabit harita (üretilmiş çıktı)
packages/shared/          Sunucu ve arayüzün ortak çekirdeği (saf fonksiyonlar)
  src/balance.ts          data/*.json'u tipli yükler ve doğrular
  src/combat.ts           Savaş simülatörü — I/O yok, seed'li, deterministik
  src/economy.ts          Lazy accrual, depo, bakım, açlık
  src/progression.ts      XP, komuta kapasitesi, şöhret, ELO
  src/equipment.ts        ItemPower, üretim, yükseltme
  src/generals.ts         General pasif ve yeteneklerini tek bonusa toplar
  src/march.ts            Hex mesafesi ve yürüyüş süresi
apps/api/                 Fastify + Prisma + PostgreSQL
  src/routes/             Uç noktalar
  src/services/           İş kuralları
  src/worker.ts           10 sn aralıkla yürüyüş ve kuyruk çözümü
apps/web/                 React + Vite + Tailwind, yedi ekran
tools/
  generate_map.py         Haritayı üreten script
  check_balance.py        Aritmetik denge doğrulayıcı
  oyun-dongusu-testi.mjs  API üzerinden tam oyun döngüsü
  worker-testi.mjs        Worker'ın yürüyüşü kendiliğinden çözdüğünü doğrular
  tarayici-tam-akis.mjs   Gerçek tarayıcıda yedi ekran akışı
  smoke.mjs               Hızlı duman testi
```

## Nereden başlamalı

1. `docs/00-ozet-ve-kapsam.md` — özellikle **Kapsam Dışı** bölümü
2. `docs/04-yol-haritasi.md` — M0'dan başla
3. `data/balance.json` — kod yazarken bu dosyayı oku, sayıları koda gömme

```bash
python3 tools/check_balance.py    # dengeyi doğrula (8/8 geçmeli)
python3 tools/generate_map.py     # haritayı yeniden üret
```

## Teknoloji

React 18 + TypeScript + Vite (arayüz) · Node.js + Fastify + TypeScript (sunucu) ·
PostgreSQL + Prisma (veri) · pnpm monorepo · Docker Compose

Detay: `docs/03-teknik-mimari.md`
