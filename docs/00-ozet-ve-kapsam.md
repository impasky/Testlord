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

v1 şu olduğunda bitmiştir. **Yedisi de otomatik testle kanıtlı** — kutuyu
işaretleyen şey kanaat değil, `pnpm e2e` ve `pnpm yuk-testi`:

| # | Kriter | Kanıtı |
|---|---|---|
| 1 | ✅ Kayıt olup 5 dakikada ilk askerini eğitebiliyor | `onboarding-testi.mjs` — kayıttan eğitime saniyeler |
| 2 | ✅ İlk gününde bir NPC bölgesi ele geçirebiliyor | `oyun-dongusu-testi.mjs` — başlangıç ordusuyla fetih |
| 3 | ✅ Başka bir oyuncuya saldırıp savaş logunu okuyabiliyor | `pvp-testi.mjs` — oyuncu garnizonuna saldırı, iki taraf da raporu görüyor |
| 4 | ✅ Üç sıralamada da kendini ve ilk 100'ü görebiliyor | `tarayici-tam-akis.mjs` — üç sekme de yükleniyor |
| 5 | ✅ Ekipman üretip yükseltip kuşanabiliyor | `oyun-dongusu-testi.mjs` — üretim, kuşanma, yükseltme güce yansıyor |
| 6 | ✅ General kiralayıp savaşa sokabiliyor | `pvp-testi.mjs` — general sahaya sürülüyor ve savaştan XP kazanıyor |
| 7 | ✅ 120 oyuncu aynı dünyada, kimse çökmeden oynayabiliyor | `yuk-testi.mjs` — 120/120 kayıt, 5xx yok, en yavaş uç 408 ms p95 |

Bu 7 madde tuttuğunda oyun yayına hazırdır. Fazlası v1 değildir.

> **v1 kapsamı bilerek dondurulmuştu ve oyun bu sayede hızlı bitti. Ama o
> kararın bir bedeli vardı:** ittifak, sohbet ve sezon "sonra eklenecek
> güzellikler" diye sınıflandırıldı, oysa bu türde ittifak taşıyıcı
> duvardır. Bedelin ne olduğu ve nasıl ödeneceği
> [`docs/07-v2-kapsam.md`](07-v2-kapsam.md)'de.

**Neden "general kiralandı" demek yetmiyor:** kriter generali *savaşa
sokabilmek*. Kiralamayı test etmek generalin savaş hesabına katıldığını
göstermez; testi generalin savaştan XP kazanmasına bağladık — kazanıyorsa
gerçekten girmiştir.
