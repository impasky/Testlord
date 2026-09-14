# 14 — Moderasyon

> **Tez:** Otomatik süzgeç kusursuz olamaz. Kaçanı bir insanın önüne
> koyan bir yol yoksa, "şikâyet et" düğmesi yalan söylüyor demektir.

## Neden yazıldı

Oyunda şikâyet mekanizmasının **yarısı** vardı: Sıralama ekranından bir
lordu şikâyet edebiliyordun, kayıt `Report` tablosuna düşüyordu ve
oyuncuya "inceleyeceğiz" deniyordu.

Kimse incelemiyordu. `prisma.report` bütün kod tabanında **bir kez**
geçiyordu, o da yazma işlemiydi. Okuyan hiçbir uç, hiçbir ekran yoktu.

Bu, şikâyet düğmesi olmamasından daha kötü: olmayan bir düğme oyuncuya
hiçbir söz vermiyor, çalışmayan bir düğme veriyor ve tutmuyor.

Eksik olan ikinci parça: **sohbet mesajı şikâyet edilemiyordu.** Şikâyet
lord seviyesindeydi ve yalnız sıralamadan açılıyordu; gece yarısı ittifak
sohbetine hakaret yazan birine karşı oyuncunun elinde hiçbir şey yoktu.

---

## Tasarımın tek kuralı: otomatik ceza yok

Bir şikâyet, şikâyet edilene **hiçbir şey yapmaz.** Yapsaydı süzgeç değil
silah olurdu: üç kişi anlaşıp beğenmedikleri bir oyuncuyu oyundan
attırırdı. Şikâyetin tek yetkisi bir insanın **bakmasını** istemek.

Tek istisna otomatik **gizleme** ve o da ceza değil:

- Mesaj görünmez olur, **yazana hiçbir şey olmaz.**
- Metin silinmez, yönetici kuyruğunda olduğu gibi durur.
- Yönetici "yok say" derse mesaj **geri gelir.**

Sebebi zaman dilimi: gece yarısı yazılan bir hakaret, yönetici uyanana
kadar sekiz saat ekranda duramaz. Eşik `balance.json → moderasyon`da ve
**farklı** şikâyetçi sayar — aynı kişinin beş kez basması bir mesajı
gizlemeye yetmez. Eşiğin ikiden büyük olması da bilinçli: iki kişi
birbiriyle anlaşabilir.

---

## Üç karar, üçü de geri alınabilir bir iz bırakıyor

| Karar             | Ne yapar                                   | Ne yapmaz                     |
| ----------------- | ------------------------------------------ | ----------------------------- |
| **Yok say**       | Şikâyeti kapatır, varsa gizlemeyi kaldırır | —                             |
| **Mesajı kaldır** | Mesajı görünmez yapar                      | Metni SİLMEZ (kanıt)          |
| **Sustur**        | Sohbete yazmayı süreli engeller            | Oyunun geri kalanına dokunmaz |

**Kalıcı susturma yok** ve bu bilinçli: kalıcı susturma, hesabı silmenin
oyuncuya hiç söylenmeyen hâlidir. Süreler `balance.json`da (1 saat,
1 gün, 7 gün). Tekrarlayan birini oyundan çıkarmak ittifak liderinin
(atma) işi, susturmak yöneticinin.

**Hesap silme, ban, kaynak alma yok.** Moderasyon aracı sohbete
dokunuyor, oyuna değil.

### Yumuşak silme — neden metin duruyor

Silinen mesajın metni veritabanında kalıyor, yalnız görünürlüğü gidiyor.
Sebebi: o metin, şikâyeti sonradan inceleyenin **tek kanıtı**. Kararı
verenin de denetlenebilir olması gerekiyor.

Buna karşılık metin **sunucudan hiç çıkmıyor**: kaldırılmış bir mesajın
yerine `/ittifak/sohbet` sabit bir not döndürüyor. Gönderip arayüzde
gizlemek, gizlemek değildir — ağı dinleyen herkes metni görürdü.

### Susturulan oyuncu neden susturulduğunu öğreniyor

Karar anında olay kaydı düşüyor, sohbet kutusunun yerini sebep ve kalan
süre alıyor, Hesap ekranında da yazıyor. Sebebini bilmeyen oyuncu
davranışını değiştiremez.

---

## Yetki

Yöneticilik **lorda değil kullanıcıya** bağlı (`User.yonetici`): yetki
oyundaki karaktere değil arkasındaki insana verilir ve dünya değişince
kaybolmaz.

```bash
pnpm yonetici liste            # yetkili hesaplar
pnpm yonetici ver ornek@site.com
pnpm yonetici al  ornek@site.com
```

Elle SQL yerine bir araç, çünkü yetki vermek nadir ama kritik bir iş ve
elle yazılan bir `UPDATE`in `WHERE`ini unutmak bütün hesapları yönetici
yapar.

İki koruma katmanı:

1. Yetki **her istekte veritabanından** okunuyor, jetondan değil — yetki
   alınan bir hesabın elindeki jeton yedi gün daha geçerli kalırdı.
2. Yetkisiz için uç **hiç yokmuş gibi** davranıyor (404, 403 değil):
   kuyruğun varlığı da bir bilgidir.

Kuyruğun girişi Hesap ekranında ve yetkisi olmayan için **hiç
çizilmiyor**. `moderasyon` kapısı `KAPILAR` içinde ama
`OYUNCU_KAPILARI` dışında — "ana sayfa dokuz kapıyı geçmesin" kuralı
görünen kapıları sayıyor ve görünmeyen bir kapı o duvara taş koymuyor.

---

## Kuyruk neyi gösteriyor

Her satır kararı vermek için gereken **her şeyi** yanında taşıyor:

- Şikâyetin sebebi (hazır sebep + isteğe bağlı açıklama)
- Şikâyet edilen mesajın **metni** — metni görmeden karar verilemez
- Hedefin **moderasyon geçmişi** — "bu kaçıncı" sorusu karar anında
  cevaplanabilsin; geçmiş olmadan beşinci kez aynı şeyi yapana ilk
  seferki cezayı vermek zorunda kalırsın

Aynı hedefe gelen şikâyetler tek satırda toplanmıyor: yönetici kaç
kişinin rahatsız olduğunu görmeli ve her şikâyetin kendi sebebi var.
Buna karşılık aynı MESAJA gelen şikâyetler tek kararla birlikte
kapanıyor — bir mesaj bir kez incelenir.

Süresi geçmiş susturma kaydı **temizlenmiyor**; "aktif mi" sorusu her
seferinde tarihe bakılarak cevaplanıyor. Geçmişi silmek, yöneticinin
"bu kaçıncı" sorusunu cevaplamasını imkânsız kılardı.

---

## Sınırlar — bilerek yapılmayanlar

- **Genel sohbet yok**, dolayısıyla moderasyon yükü de yok. Sohbet
  yalnız ittifak içi: kapalı bir gruba yazmak, herkese açık bir kanala
  yazmaktan bambaşka bir sorumluluk (docs/09 B3).
- **Oyuncudan oyuncuya özel mesaj yok.**
- **Otomatik ceza yok** (yukarı bak).
- **Yönetici bildirimi yok**: kuyruk yoklanarak bakılıyor, bekleyen sayı
  Hesap ekranında yazıyor. Tek yöneticili bir oyunda bu yeterli; ekip
  büyürse bildirim gerekir.

---

## Kod nerede

| Katman                                     | Dosya                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Saf mantık (süreler, eşik, karar denetimi) | `packages/shared/src/moderasyon.ts`                                    |
| Sayılar                                    | `data/balance.json → moderasyon`                                       |
| Yetki, susturma kontrolü, karar kaydı      | `apps/api/src/services/moderasyon.ts`                                  |
| Uçlar                                      | `apps/api/src/routes/moderasyon.ts`                                    |
| Otomatik süzgeç (ad / mesaj)               | `apps/api/src/services/adDenetimi.ts`, `mesajDenetimi.ts`              |
| Şikâyet kutusu (iki yerden tek kutu)       | `apps/web/src/components/SikayetSayfasi.tsx`                           |
| Kuyruk ekranı                              | `apps/web/src/screens/Moderasyon.tsx`                                  |
| Test                                       | `packages/shared/src/moderasyon.test.ts`, `tools/moderasyon-testi.mjs` |

`tools/moderasyon-testi.mjs` zincirin tamamını ölçüyor: şikâyet →
kuyrukta görünüyor → karar → gerçekten etkisi var; üstüne yetki sınırını
ve arayüzden verilen kararın sunucuya işlediğini.
