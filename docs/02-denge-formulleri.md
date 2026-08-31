# 02 — Denge ve Formüller

> **Kural:** Bu dosyadaki hiçbir sayı koda gömülmez. Kod `data/balance.json`
> okur. Denge değişikliği = tek dosyada değişiklik + sunucu yeniden başlatma.

Tüm değerler `tools/` altındaki simülasyonla doğrulandı (bkz. bu dokümanın sonu).

---

## 1. Kaynak üretimi

### Malikâne (herkesin taban geliri, kaybedilemez)

```
saatlik = taban + seviye_bonusu × lord_seviyesi
```

| | Taban | Seviye başına | Lv1 | Lv30 | Lv60 |
|---|---|---|---|---|---|
| Altın | 100 | +6 | 106 | 280 | 460 |
| Demir | 40 | +3 | 43 | 130 | 220 |
| Erzak | 120 | +8 | 128 | 360 | 600 |

**Neden seviyeyle büyüyor:** Sabit olsaydı, geç oyundaki ordu bakımı taban geliri
ezer ve bölgesini kaybeden oyuncu geri dönüşü olmayan bir açlık sarmalına
girerdi. Büyüyen taban, "dibe vurdum ama ayaktayım" durumunu garanti eder.

### Bölge geliri

```
saatlik = taban_gelir × ring_çarpanı × (1 + 0.25 × (bölge_seviyesi − 1))
```

| Tip | Taban/saat | ring4 (×1.0) | ring1 (×2.0) | ring1 + Lv5 |
|---|---|---|---|---|
| Tarla | 140 erzak | 140 | 280 | 560 |
| Şehir | 200 altın | 200 | 400 | 800 |
| Maden | 100 demir | 100 | 200 | 400 |
| Kale | 80 altın + 4 şöhret | 80 | 160 | 320 |
| Taht | 300/150/200 + 20 şöhret | — | — | 900/450/600 |

### Gelir hesaplama tekniği — "lazy accrual"

Sunucu **hiçbir zaman periyodik gelir tick'i çalıştırmaz.** Her satırda
`last_tick_at` tutulur; oyuncu veya bir işlem o satıra dokunduğunda:

```
geçen_saat = (şimdi − last_tick_at) / 3600
kaynak    += saatlik_üretim × geçen_saat        (depo kapasitesiyle sınırlı)
last_tick_at = şimdi
```

120 oyuncu için de 120.000 oyuncu için de sunucu maliyeti aynıdır. Bu, projedeki
en önemli tek teknik karardır.

### Depo

`kapasite = 20.000 + 3.000 × lord_seviyesi`. Dolunca üretim durur.
**Neden:** Oyuncuyu düzenli giriş yapmaya iten tek mekanik bu. Ayrıca yağmanın
bir anlamı olması için depoda bir şey birikmesi gerekir.

---

## 2. Lord ilerlemesi

```
XP(n → n+1) = 120 × n^1.55
```

| Aşama | Gereken XP | Kümülatif |
|---|---|---|
| Lv1 → 2 | 120 | 120 |
| Lv10 → 11 | 4.263 | ~23.000 |
| Lv30 → 31 | 25.116 | ~400.000 |
| Lv59 → 60 | 70.827 | **1.576.298** |

### XP kaynakları

| Kaynak | Değer |
|---|---|
| PvP galibiyet | `80 × rakip_lord_seviyesi` |
| PvP mağlubiyet | `20 × rakip_lord_seviyesi` |
| Bölge ele geçirme | `1500 × ring_çarpanı` |
| Bölge yükseltme | `500 × yeni_seviye` |
| NPC garnizonu temizleme | `4 × npc_birim_sayısı` |

**Doğrulanmış tempo** (günde 6 savaş oynayan aktif oyuncu):

| Hedef | Süre |
|---|---|
| Lv10 | 9 gün |
| Lv30 | 40 gün |
| Lv45 | 70 gün |
| Lv60 | **109 gün** |

Mağlubiyetin de XP vermesi kasıtlı: sürekli kaybeden oyuncu bile ilerler, ve
ilerledikçe rakiplerine yaklaşır. Bu sessiz bir "rubber band"dir.

---

## 3. Ordu

### Birim tablosu

| Birim | Sld | Sav | Can | Hız | Yer | Eğitim | Altın | Demir | Erzak | Bakım/sa |
|---|---|---|---|---|---|---|---|---|---|---|
| Köylü Milis | 10 | 8 | 40 | 6 | 1 | 45sn | 50 | — | 20 | 1 |
| Mızrakçı | 18 | 30 | 70 | 5 | 1 | 90sn | 120 | 30 | 40 | 2 |
| Okçu | 32 | 12 | 55 | 6 | 1 | 110sn | 150 | 40 | 35 | 2 |
| Süvari | 55 | 25 | 110 | 12 | 3 | 240sn | 320 | 90 | 80 | 5 |
| Mancınık | 90 | 5 | 150 | 3 | 5 | 600sn | 600 | 200 | 60 | 8 |

### Karşı çarpanları

| Saldıran | Hedef | Çarpan |
|---|---|---|
| Mızrakçı | Süvari | ×1.5 savunma |
| Okçu | Mızrakçı | ×1.5 saldırı |
| Süvari | Okçu | ×1.5 saldırı |
| Mancınık | Kale savunması | ×2.0 |
| Mancınık | Birim | ×0.5 |

Listede olmayan her eşleşme ×1.0.

### Komuta kapasitesi

```
kapasite = 50 + Liderlik × 8 + general_bonusları
```

| Liderlik | Yer | ≈ Süvari | General slotu |
|---|---|---|---|
| 5 (başlangıç) | 90 | 30 | 1 |
| 25 | 250 | 83 | 1 |
| 50 | 450 | 150 | 2 |
| 100 | 850 | 283 | 3 |

### Bakım dengesi — doğrulandı

| Aşama | Ordu | Bakım/sa | Erzak geliri | Sonuç |
|---|---|---|---|---|
| Lv1 başlangıç | 20 mızrakçı + 15 okçu | 70 | 128 (malikâne) | ✅ rahat |
| Lv15 orta | 60/50/15 süvari | 295 | 380 (malikâne + 1 tarla) | ✅ tutar |
| Lv60 endgame | 150/120/150/20 | 1450 | 1860 (malikâne + 3 tarla) | ✅ tarla şart |

Yani: **başlangıçta açlık yok, geç oyunda tarlasız büyük ordu yok.** İstenen tam olarak buydu.

### Ordu donanım hatları

```
Lv N maliyeti: altın = 2000 × 1.7^(N−1),  demir = 1200 × 1.7^(N−1)
Lv N süresi:   1 saat × 1.6^(N−1)
```

| Seviye | Altın | Demir | Süre | Kümülatif bonus |
|---|---|---|---|---|
| 1 | 2.000 | 1.200 | 1 sa | +%3 |
| 5 | 16.700 | 10.000 | 6,5 sa | +%15 |
| 10 | 236.000 | 141.600 | 69 sa | **+%30** |

Tek hattı sonuna kadar açmak ~570.000 altın. Üç hat ~1,7 milyon.
Bu, geç oyunun ana altın deliğidir ve enflasyonu tek başına dengeler.

---

## 4. Ekipman

```
ItemPower = tier_taban × nadirlik_çarpanı × (1 + 0.08 × yükseltme)
```

| Tier | Taban güç | Açılış seviyesi | Üretim maliyeti | Süre |
|---|---|---|---|---|
| T1 | 12 | Lv1 | 400 altın + 200 demir | 5 dk |
| T2 | 28 | Lv10 | 1.500 + 800 | 15 dk |
| T3 | 60 | Lv22 | 4.000 + 2.000 | 45 dk |
| T4 | 120 | Lv36 | 12.000 + 6.000 | 2 sa |
| T5 | 220 | Lv50 | 35.000 + 18.000 | 5 sa |

| Nadirlik | Çarpan |
|---|---|
| Sıradan | ×1.00 |
| Usta işi | ×1.25 |
| Nadir | ×1.60 |
| Efsanevi | ×2.10 |
| Kadim | ×2.80 |

### Üretim nadirlik tablosu

| Tier | Sıradan | Usta | Nadir | Efsanevi | Kadim |
|---|---|---|---|---|---|
| T1 | %60 | %30 | %9 | %1 | — |
| T2 | %50 | %32 | %15 | %3 | — |
| T3 | %40 | %32 | %20 | %7 | %1 |
| T4 | %30 | %32 | %26 | %10 | %2 |
| T5 | %20 | %30 | %32 | %14 | **%4** |

T5 Kadim %4 → ortalama 25 denemede bir. Tek eşya ~35.000 altın olduğuna göre,
bir Kadim T5 eşyanın beklenen maliyeti ~875.000 altın. Kasıtlı olarak
**ulaşılabilir ama efsanevi**: sunucuda bir avuç insanda olur.

### Yükseltme

```
+N → +N+1:  altın = 500 × 1.55^N × tier^1.5,  demir = yarısı
```

| Seviye | Başarı şansı |
|---|---|
| +0 → +5 | %100 (garanti) |
| +6 | %80 |
| +7 | %70 |
| +8 | %55 |
| +9 | %40 |
| +10 | %25 |

Başarısızlıkta **sadece malzeme gider.** Eşya kırılmaz, seviye düşmez.

### Güç tavanı — doğrulandı

| | Değer |
|---|---|
| Tek eşya maksimum (T5 Kadim +10) | 1.109 |
| 6 slot toplam | 6.653 |
| Lord savaş katkısı (Güç 100 + tam set) | 5.622 |
| 280 süvarilik ordu (donanım + general) | 23.023 |
| **Lordun toplam güçteki payı** | **%20** ✅ |

---

## 5. Savaş motoru

### Girdiler

```
saldırı  = Σ(sayı × birim_saldırı × karşı_çarpanı)
           × (1 + silahlık_bonusu)
           × (1 + general_saldırı_bonusu)
           × (1 + Liderlik × 0.005)
           + lord_katkısı

savunma  = Σ(sayı × birim_savunma × karşı_çarpanı)
           × (1 + zırhhane_bonusu)
           × (1 + general_savunma_bonusu)
           × (1 + kale_bonusu)

lord_katkısı = Güç × 3 + toplam_ekipman_gücü × 0.8
```

### Çözüm

```
R = saldırı / (saldırı + savunma)

kazananın kaybı  = min((1 − R) × 0.70, 0.45)
kaybedenin kaybı = min(0.60 + (R − 0.5) × 0.6, 0.90)
```

5 tur, her turda seed'li **±%7** varyans.

| Senaryo | R | Kazanan kaybı | Kaybeden kaybı |
|---|---|---|---|
| Ezici (3×) | 0,75 | %17,5 | %75,0 |
| Belirgin (1,5×) | 0,60 | %28,0 | %66,0 |
| Başabaş (1,05×) | 0,51 | %34,1 | %60,7 |
| Zayıf saldırı (0,6×) | 0,38 | %43,8 | %52,5 |

**Kazananın kaybı hiçbir zaman sıfır değildir.** Oyun ekonomisinin çalışması
buna bağlı: savaş kaynak yakar, kaynak yakılınca üretim anlamlı kalır.

### Yağma

```
yağma = min(savunan_deposu × 0.25 × (1 + Kurnazlık × 0.01), taşıma_kapasitesi)
```

Taşıma/birim: Milis 30, Mızrakçı 25, Okçu 25, Süvari 60, Mancınık 10.

### Yürüyüş süresi

```
dakika = hex_mesafesi × 12 × (6 / en_yavaş_birim_hızı)     [10 dk .. 6 saat]
```

Sadece süvari → hızlı baskın. Mancınık kattığın an ordu ağırlaşır. Bu,
"kuşatma getirsem mi?" sorusunu gerçek bir maliyetle donatır.

---

## 6. Şöhret ve sıralama

```
Şöhret = lord_seviyesi × 120
       + Σ(bölge: 400 × seviye × tip_çarpanı)
       + toplam_ekipman_gücü × 0.6
       + ordu_gücü × 0.03
       + pvp_galibiyet × 40
       + kale_şöhret_birikimi
```

Tip çarpanı: Tarla 0,9 · Maden 0,95 · Şehir 1,0 · **Kale 1,4** · **Taht 4,0**
Ordu gücü: `Σ(sayı × (saldırı + savunma + can/4))`
Diyarın Lordu unvanı: toplam şöhrete **+%20.**

Altı kaynağın hepsi katkı verir → tek bir stratejiyle zirveye çıkılamaz.
Ama ağırlıklar bölge ve kaleyi öne çıkarır → harita her zaman kavga sebebidir.

**Kılıç sıralaması** ayrı ve ELO tabanlıdır (başlangıç 1200, K=24). Bölgesiz bir
oyuncunun da birinci olabileceği tek merdiven budur.

---

## 7. Doğrulama

`data/balance.json` değiştirildiğinde **`python3 tools/check_balance.py`**
çalıştırılır. Script şu 8 kontrolü uygular ve sapma varsa sıfırdan farklı
çıkış kodu döner:

| # | Kontrol | Beklenen |
|---|---|---|
| 1 | Lv60'a ulaşma süresi | 100–130 gün |
| 2 | Lv1 ordusu bakım vs malikâne | Gelir > bakım |
| 3 | Lv60 ordusu bakım vs malikâne + 3 tarla | Gelir > bakım |
| 4 | İlk NPC bölgesi (ring 4) | 1. günün ordusuyla R ≥ 0,60 ve maliyet ≤ başlangıç kaynağı |
| 5 | Bölge Lv1→Lv5 geri ödemesi | 7–12 gün |
| 6 | Lordun toplam savaş gücündeki payı | %15–25 |
| 7 | Kazananın kaybı (ezici zafer) | > %0 |
| 8 | Bölge / oyuncu oranı | < 0,75 (kıtlık korunmalı) |

Mevcut durum: **8/8 geçiyor.**

```
$ python3 tools/check_balance.py
  [GEÇTİ] 1. Lv60'a ulaşma süresi          109 gün (hedef 100-130)
  [GEÇTİ] 2. Lv1 ordu bakımı               gelir 128 vs bakım 70
  [GEÇTİ] 3. Lv60 ordu bakımı              gelir 1860 vs bakım 1450
  [GEÇTİ] 4. 1. gün ilk fetih mümkün       R=0.66, maliyet 4.650 ≤ bütçe 7.544
  [GEÇTİ] 5. Bölge yükseltme geri ödemesi  8,4 gün
  [GEÇTİ] 6. Lordun savaş gücündeki payı   %19,6 (hedef %15-25)
  [GEÇTİ] 7. Ezici zaferde bile kayıp var  kazanan kaybı %17,5
  [GEÇTİ] 8. Bölge kıtlığı korunuyor       60 bölge / 120 oyuncu = 0,50
SONUÇ: 8/8 kontrol geçti. Denge tutarlı.
```

M8'de bu kontroller `apps/api` içinde bir test dosyasına dönüştürülür ve CI'da
koşar; böylece bir denge değişikliği oyunu sessizce bozamaz.
