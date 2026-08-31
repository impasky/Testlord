# Lordlar Çağı

Ortaçağ temalı, tarayıcıda oynanan, sürekli dünyalı strateji-RPG.
Bir lord olarak karakterini ve ekipmanını güçlendirir, bölgeler ele geçirip gelir
kazanır, ordu kurar, ordunun donanımını üretir, generaller kiralar ve
sıralamada yükselirsin.

> **Durum: Tasarım dondurulmuş, kod yazılmadı.**
> Bu repoda şu an sadece tasarım ve veri var. Amaç bilinçli: her sayı, her formül
> ve her sistem koda başlamadan önce netleştirildi ki geliştirme sırasında
> kapsam büyümesin.

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
tools/
  generate_map.py         Haritayı üreten script
  check_balance.py        Denge doğrulayıcı — balance.json değişince çalıştır
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
