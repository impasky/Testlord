# 00 — Özet ve Kapsam Kilidi

## Tek cümlelik tanım

Tarayıcıda oynanan, sürekli dünyalı, asenkron PvP'li ortaçağ strateji-RPG'si:
lordunu güçlendir, bölge ele geçir, ordu besle, sıralamada yüksel.

## Temel kararlar (dondurulmuş)

| Karar | Seçim | Neden |
|---|---|---|
| Platform | **Sadece mobil** (mobil web) | Oyun telefonda oynanacak. Masaüstü düzeni yok; tek sütun, alt gezinme, dokunmatik hedefleri ≥44px. Render'a tek servis olarak kurulur, telefon tarayıcısından açılır. İleride Capacitor ile mağaza uygulamasına sarılabilir — yeniden yazmak gerekmez |
| Rakip | Gerçek oyuncular, **asenkron** PvP | Rakip online olmak zorunda değil; sunucu basit kalır, sıralama gerçek olur |
| Zaman | Sürekli dünya + timer | Oyuncu günde 2-3 kez girer; gelir "lazy accrual" ile hesaplanır, cron gerekmez |
| Dünya | Shard başına **120 oyuncu**, **61 bölge** | Bölge kıtlığı = zorunlu rekabet. Dolunca yeni shard açılır |
| Para birimi | Altın, Demir, Erzak (+ Şöhret puanı) | Üç kaynak üç farklı bölge tipini değerli kılar; dördüncüsü gereksiz karmaşa |

## Oyunun çekirdek döngüsü

```
   Malikâne + Bölgeler                Asker eğit
   saatlik kaynak üretir  ──────►     Ekipman üret      ──────►   Orduyla yürü
           ▲                          Donanım yükselt              (10dk - 6sa)
           │                          General kirala                    │
           │                                                            ▼
           └────────────  Bölge senin: gelir artar  ◄──────────  Savaş çözülür
                          Şöhret artar, sıralama yükselir         (5 tur, sunucuda)
```

Her tur bir üsttekini besler. Oyuncu her girişinde şunu sorar:
**"Bu kaynağı orduya mı, ekipmana mı, bölge yükseltmeye mi koyayım?"**
Oyunun tüm derinliği bu tek sorudan çıkar. Yeni sistem eklemeye gerek yok.

## Neden bölge kıtlığı bu kadar önemli

60 ele geçirilebilir bölge, 120 oyuncu → oyuncu başına ortalama **0,5 bölge**.
Yani oyuncuların yarısı bölgesiz. Bu bir hata değil, tasarımın motoru:

- Bölgesiz oyuncu ölmez — malikânesi seviyesiyle birlikte büyüyen taban gelir verir.
- Ama bölgeli oyuncu belirgin biçimde daha zengindir → herkes bölge ister.
- NPC bölgeleri bir süre sonra biter → tek kaynak diğer oyunculardır.
- Böylece PvP'yi biz zorlamayız; ekonomi kendiliğinden zorlar.

---

## KAPSAM DIŞI — v1'de KESİNLİKLE YOK

> Bu liste bir yapılacaklar listesi değil, **bir savunma hattıdır.**
> Geliştirme sırasında bu maddelerden biri aklına gelirse cevap hazır: hayır.
> v1 çıkıp gerçek oyuncu verisi görülmeden bu listeden hiçbir şey yukarı taşınmaz.

**Sosyal**
- Klan / lonca / ittifak sistemi
- Oyuncular arası sohbet, mesajlaşma, forum
- Diplomasi, ateşkes, savaş ilanı
- Arkadaş listesi, davet ödülleri

**Ekonomi**
- Oyuncular arası ticaret, pazar yeri, açık artırma
- Kaynak takası, hediye gönderme
- Mikro ödeme, premium para birimi, battle pass
- Dördüncü kaynak (taş, odun, kereste vb.)

**Savaş**
- Gerçek zamanlı / izlenebilir savaş animasyonu
- Kuşatma mekaniği detayı (duvar seviyesi, kule, hendek, koç başı)
- Birim tipi çeşitlendirmesi (5 birimden fazlası)
- Deniz savaşı, taşıma gemisi, nehir geçişi
- Moral, yorgunluk, hava durumu, mevsim, gece/gündüz

**İçerik**
- Hikâye kampanyası, görev zinciri, günlük görev
- NPC istilası / dünya boss'u / rastgele olay
- Hanedan, evlilik, veraset, karakter yaşlanması
- Teknoloji ağacı, araştırma
- Yeni general (12 sabit), yeni birim, yeni bölge tipi, yeni ekipman slotu
- Başarım / rozet sistemi
- Kozmetik: arma tasarımcısı, renk seçimi, avatar

**Platform**
- Mağaza uygulaması (iOS/Android paketi) — mobil web önce çalışsın
- Masaüstü düzeni — bilinçli olarak yok
- Push bildirimi
- Çoklu dil (v1 sadece Türkçe)

**Sonraya bırakılan tek "belki"**
- **Sezon sistemi** (8 haftada bir sıralama sıfırlama + ödül). Mevcut tasarımın
  üstüne sonradan temiz eklenir, çekirdeği değiştirmez. v1'de yok.

## Kapsam değişikliği kuralı

Bir şey eklemek için üç sorunun üçüne birden "evet" gerekir:

1. Beş temel eksenden birine mi hizmet ediyor? (rekabet / karakter / ekipman / bölge / ordu)
2. Mevcut bir sistemi silmeden eklenebiliyor mu?
3. v1 çıktıktan **sonra** mı ekleniyor?

Üçüne birden "evet" değilse, cevap hayır.

## Başarı kriteri

v1 şu olduğunda bitmiştir:

- [ ] Bir oyuncu kayıt olup 5 dakikada ilk askerini eğitebiliyor
- [ ] İlk gününde bir NPC bölgesi ele geçirebiliyor
- [ ] Başka bir oyuncuya saldırıp savaş logunu okuyabiliyor
- [ ] Üç sıralamada da kendini ve ilk 100'ü görebiliyor
- [ ] Ekipman üretip yükseltip kuşanabiliyor
- [ ] General kiralayıp savaşa sokabiliyor
- [ ] 120 oyuncu aynı dünyada, kimse çökmeden oynayabiliyor

Bu 7 madde tuttuğunda oyun yayına hazırdır. Fazlası v1 değildir.
