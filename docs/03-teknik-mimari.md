# 03 — Teknik Mimari

## 1. Teknoloji seçimi

| Katman | Seçim | Neden |
|---|---|---|
| Arayüz | React 18 + TypeScript + Vite | Ekip bilgisi yaygın, build hızlı |
| Durum | Zustand + TanStack Query | Sunucu durumu zaten otorite; global store'a az iş düşer |
| Stil | Tailwind CSS | Tasarım sistemi yazmadan tutarlı arayüz |
| Sunucu | Node.js 22 + Fastify + TypeScript | Tek dil, tek tip tanımı, hızlı |
| Veri | PostgreSQL 16 + Prisma | İlişkisel model bu oyuna birebir; migration hazır gelir |
| Kimlik | JWT (access + refresh), argon2 | Basit, dışa bağımlılık yok |
| Worker | Ayrı Node süreci, 10 sn döngü | Yürüyüş ve kuyruk çözümü |
| Paketleme | pnpm workspace monorepo | `shared` paketi iki tarafta da çalışır |
| Dağıtım | Docker Compose | Tek komutla ayağa kalkar |

**Kritik karar — paylaşılan çekirdek:** Savaş simülatörü, gelir hesabı ve tüm
formüller `packages/shared` içinde **tek bir yerde** yazılır. Sunucu otorite
olarak, istemci ise "saldırsam ne olur?" önizlemesi için **aynı kodu** çalıştırır.
İki ayrı uygulama = kaçınılmaz uyuşmazlık ve oyuncu güveninin kaybı.

## 2. Monorepo yapısı

```
lordlar-cagi/
├── data/                       balance.json, generals.json, world-map.json
├── packages/
│   └── shared/
│       ├── src/balance.ts      data/*.json'u tipli olarak yükler ve doğrular
│       ├── src/types.ts        Tüm ortak tipler
│       ├── src/combat.ts       Savaş simülatörü (SAF fonksiyon, I/O yok)
│       ├── src/economy.ts      Lazy accrual, depo, bakım, açlık
│       ├── src/progression.ts  XP, seviye, komuta kapasitesi, şöhret
│       ├── src/equipment.ts    ItemPower, üretim, yükseltme
│       └── src/rng.ts          Seed'li deterministik RNG (mulberry32)
├── apps/
│   ├── api/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── routes/         Uç noktalar
│   │       ├── services/       İş kuralları (shared'i çağırır)
│   │       ├── worker.ts       10 sn'lik döngü
│   │       └── seed.ts         world-map.json → veritabanı
│   └── web/
│       └── src/
│           ├── screens/        7 ekran
│           ├── components/
│           └── api/            Tipli istemci
└── docker-compose.yml
```

**Kural:** `packages/shared` hiçbir zaman veritabanı, HTTP veya `Date.now()`
bilmez. Saf fonksiyonlar alır, saf sonuç döner. Bu sayede test edilebilir ve
istemcide de çalışır.

## 3. Veritabanı şeması

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  lords        Lord[]
}

model World {
  id         String   @id @default(cuid())
  name       String
  playerCap  Int      @default(120)
  status     String   @default("open")   // open | full | closed
  openedAt   DateTime @default(now())
  lords      Lord[]
  regions    Region[]
}

model Lord {
  id              String   @id @default(cuid())
  userId          String
  worldId         String
  name            String
  level           Int      @default(1)
  xp              Int      @default(0)
  // statlar
  guc             Int      @default(5)
  dayaniklilik    Int      @default(5)
  liderlik        Int      @default(5)
  kurnazlik       Int      @default(5)
  statPoints      Int      @default(0)
  // kaynaklar
  altin           Int      @default(5000)
  demir           Int      @default(2000)
  erzak           Int      @default(3000)
  fame            Int      @default(0)
  elo             Int      @default(1200)
  pvpWins         Int      @default(0)
  pvpLosses       Int      @default(0)
  // zaman damgaları
  lastTickAt      DateTime @default(now())
  protectionUntil DateTime?
  woundedUntil    DateTime?
  dailyAttacks    Int      @default(0)
  dailyResetAt    DateTime @default(now())
  createdAt       DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id])
  world     World     @relation(fields: [worldId], references: [id])
  items     Item[]
  units     ArmyUnit[]
  gearLines GearLine[]
  generals  LordGeneral[]
  regions   Region[]
  queues    Queue[]

  @@unique([userId, worldId])          // kullanıcı başına dünyada tek lord
  @@index([worldId, fame])             // şöhret sıralaması
  @@index([worldId, elo])              // kılıç sıralaması
}

model Item {
  id           String  @id @default(cuid())
  lordId       String
  slot         String  // silah | kalkan | zirh | migfer | at | sancak
  tier         Int     // 1..5
  rarity       String  // siradan | usta | nadir | efsanevi | kadim
  upgradeLevel Int     @default(0)
  equipped     Boolean @default(false)
  createdAt    DateTime @default(now())
  lord Lord @relation(fields: [lordId], references: [id])

  @@index([lordId, equipped])
}

model ArmyUnit {
  id           String  @id @default(cuid())
  lordId       String
  unitType     String  // milis | mizrakci | okcu | suvari | kusatma
  count        Int
  locationType String  // home | region | march
  locationId   String? // regionId veya marchId
  lord Lord @relation(fields: [lordId], references: [id])

  @@unique([lordId, unitType, locationType, locationId])
  @@index([locationType, locationId])
}

model GearLine {
  lordId String
  line   String  // silahlik | zirhhane | nalbant
  level  Int     @default(0)
  lord Lord @relation(fields: [lordId], references: [id])
  @@id([lordId, line])
}

model LordGeneral {
  id         String @id @default(cuid())
  lordId     String
  generalKey String              // generals.json'daki key
  level      Int    @default(1)
  xp         Int    @default(0)
  slotIndex  Int?                // null = kadroda ama sahada değil
  restUntil  DateTime?
  lord Lord @relation(fields: [lordId], references: [id])

  @@unique([lordId, generalKey])
}

model Region {
  id            Int      @id            // world-map.json'daki id
  worldId       String
  name          String
  type          String   // tarla | maden | sehir | kale | taht
  province      String
  q             Int
  r             Int
  ring          Int
  level         Int      @default(1)
  ownerLordId   String?               // null = NPC
  npcGarrison   Json                  // ele geçirilince temizlenir
  storeAltin    Int      @default(0)  // yağmalanabilir depo
  storeDemir    Int      @default(0)
  storeErzak    Int      @default(0)
  lastTickAt    DateTime @default(now())
  shieldUntil   DateTime?
  world World @relation(fields: [worldId], references: [id])
  owner Lord? @relation(fields: [ownerLordId], references: [id])

  @@unique([worldId, q, r])
  @@index([worldId, ownerLordId])
}

model March {
  id           String   @id @default(cuid())
  worldId      String
  lordId       String
  fromRegionId Int?                 // null = malikâne
  toRegionId   Int
  kind         String               // attack | return
  army         Json                 // { mizrakci: 50, okcu: 40, ... }
  generalIds   Json                 // string[]
  loot         Json?
  departAt     DateTime
  arriveAt     DateTime
  resolved     Boolean  @default(false)

  @@index([resolved, arriveAt])     // worker'ın tek sorgusu
}

model Battle {
  id             String   @id @default(cuid())
  worldId        String
  regionId       Int
  attackerLordId String
  defenderLordId String?             // null = NPC
  seed           String
  result         String              // attacker_win | defender_win
  captured       Boolean  @default(false)
  log            Json                // tur tur özet
  createdAt      DateTime @default(now())

  @@index([attackerLordId, createdAt])
  @@index([defenderLordId, createdAt])
}

model Queue {
  id         String   @id @default(cuid())
  lordId     String
  kind       String   // train | craft | upgrade_item | upgrade_gear | upgrade_region
  payload    Json
  startedAt  DateTime @default(now())
  finishAt   DateTime
  resolved   Boolean  @default(false)
  lord Lord @relation(fields: [lordId], references: [id])

  @@index([resolved, finishAt])
  @@index([lordId, resolved])
}
```

**Notlar**
- `Region.id` haritadan gelir (1..61), rastgele değil → seed tekrar edilebilir.
- Yağmalanabilir depo **bölgede** tutulur, lordun kasasında değil. Yani yağma
  bölgeyi vurur, oyuncunun toplam servetini sıfırlamaz.
- `March` ve `Queue` tabloları worker'ın tek sorgusuyla taranır:
  `WHERE resolved = false AND (arriveAt|finishAt) <= now()`.

## 4. API uç noktaları

Hepsi `/api` altında, JWT ile korunur (auth hariç).

### Kimlik
```
POST   /auth/register           { email, password, lordName }
POST   /auth/login              { email, password }
POST   /auth/refresh
```

### Lord ve durum
```
GET    /me                      Lord + kaynaklar + aktif kuyruklar (tick uygulanmış)
POST   /me/stats                { guc?, dayaniklilik?, liderlik?, kurnazlik? }
```

### Ekipman
```
GET    /items
POST   /items/craft             { tier }              → kuyruk
POST   /items/:id/equip
POST   /items/:id/upgrade
POST   /items/:id/sell
```

### Ordu ve donanım
```
GET    /army
POST   /army/train              { unitType, count }   → kuyruk
POST   /army/disband            { unitType, count }
GET    /gear
POST   /gear/:line/upgrade      → kuyruk
```

### Generaller
```
GET    /generals                Kadro + sahip olunanlar
POST   /generals/:key/hire
POST   /generals/:key/assign    { slotIndex | null }
```

### Harita ve savaş
```
GET    /map                     61 bölge + sahiplik (dünya geneli)
GET    /map/:regionId           Detay + görünür garnizon (Casus Leyla varsa tam)
POST   /map/:regionId/upgrade   → kuyruk
POST   /map/:regionId/garrison  { army }  Garnizon bırak/geri al
POST   /march                   { toRegionId, army, generalIds } → March
DELETE /march/:id               İlk %25 içindeyse iptal
POST   /battle/preview          { toRegionId, army, generalIds } → tahmini sonuç
GET    /battles                 Savaş raporları (sayfalı)
GET    /battles/:id
```

### Sıralama
```
GET    /rankings/:board         board = fame | conquest | elo, ?page=
```

**Tasarım notu:** `/battle/preview` sunucuda çalışır ama **durumu değiştirmez**
ve `Casus Leyla` yoksa savunanın ordusunu tahmini olarak verir. Böylece
"kör saldırı" yok, ama tam istihbarat da bir generalin ödülü olarak kalır.

## 5. Savaş motoru sözleşmesi

```ts
// packages/shared/src/combat.ts

export interface Side {
  units: Record<UnitType, number>;
  gearBonus: { attack: number; defense: number; health: number };
  generalBonus: GeneralBonus;
  lordContribution: number;   // Güç×3 + ekipman×0.8 (savunanda 0 olabilir)
  leadership: number;
  fortressBonus: number;      // sadece savunanda
}

export interface BattleResult {
  winner: 'attacker' | 'defender';
  rounds: RoundLog[];
  attackerLosses: Record<UnitType, number>;
  defenderLosses: Record<UnitType, number>;
  captured: boolean;
  loot: Resources;
}

export function simulateBattle(
  attacker: Side,
  defender: Side,
  seed: string,
): BattleResult;
```

**Kesin kurallar**
1. Fonksiyon **saftır**: aynı girdi + aynı seed → her zaman aynı sonuç.
2. `Date.now()`, `Math.random()`, veritabanı **yasaktır.**
3. Seed `Battle.seed` içinde saklanır → her savaş sonsuza dek yeniden üretilebilir.
4. İstemci aynı fonksiyonu önizleme için çağırır; sunucunun sonucu otoritedir.

RNG: `mulberry32(hash(seed + roundIndex))` — 32-bit, hızlı, deterministik.

## 6. Worker döngüsü

Tek Node süreci, her 10 saniyede:

```
1. SELECT * FROM March WHERE resolved = false AND arriveAt <= now()
     → kind = attack  : savaşı çöz, Battle yaz, bölgeyi devret, dönüş yürüyüşü aç
     → kind = return  : sağ kalanları eve yaz, yağmayı kasaya ekle
2. SELECT * FROM Queue WHERE resolved = false AND finishAt <= now()
     → train          : birimleri orduya ekle
     → craft          : nadirliği seed'li çek, Item yarat
     → upgrade_item   : başarı şansını seed'li çek
     → upgrade_gear   : GearLine.level++
     → upgrade_region : Region.level++
3. Erzak açlığı taraması (saatte bir): erzak < 0 olan lordlarda %5 firar
4. Sıralama tablolarını yenile (5 dakikada bir)
```

Her adım **tek transaction** içinde ve **idempotent**: `resolved` bayrağı
transaction'ın içinde yazılır, worker iki kez çalışsa da savaş iki kez çözülmez.

## 7. Güvenlik ve hile önleme

| Risk | Önlem |
|---|---|
| İstemci kaynak/güç uydurur | Sunucu tek otorite; istemci hiçbir sayı yazamaz |
| İstek tekrarı (replay) | Kuyruk ve yürüyüşte `resolved` bayrağı + transaction |
| Çoklu hesap (multi-account) | Kullanıcı başına dünyada tek lord (`@@unique`); IP başına kayıt limiti |
| Savaş sonucu manipülasyonu | Seed saklanır, sonuç yeniden üretilebilir |
| Bot / spam saldırı | Günlük 12 saldırı limiti + uç nokta rate limit |
| Zaman oynaması | Tüm zaman sunucu saatinden; istemci saati hiç kullanılmaz |
| Parola | argon2id, ham parola loglanmaz |

## 8. Performans hedefleri

| Metrik | Hedef | Nasıl |
|---|---|---|
| `/me` yanıtı | < 80 ms | Tek sorgu + lazy accrual, tick yok |
| `/map` yanıtı | < 120 ms | 61 satır, 60 sn önbellek |
| Savaş çözümü | < 5 ms | Saf fonksiyon, 5 tur, I/O yok |
| Worker turu | < 500 ms | İki indeksli sorgu |
| Eşzamanlı oyuncu (shard) | 120 | Tek Postgres örneği fazlasıyla yeter |

Ölçek gerekirse çözüm hazır: yeni **shard**. Dünyalar birbirinden tamamen
bağımsız olduğu için yatay büyüme, veritabanını bölmekten ibarettir.

## 9. Yerel kurulum

```bash
pnpm install
docker compose up -d postgres
pnpm --filter api prisma migrate dev
pnpm --filter api seed          # world-map.json → veritabanı, ilk dünyayı açar
pnpm dev                        # web :5173, api :3000, worker
```
