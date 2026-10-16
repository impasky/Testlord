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

**Hesap silme ve kaynak alma yok.** Moderasyon aracı içeriğe dokunuyor,
oyunun kendisine değil.

> **Karar değişti — hesap yasağı eklendi.** Bu belge başta "ban yok"
> diyordu ve gerekçesi doğruydu: kötü bir söz için hesabı kapatmak
> ölçüsüz. Ama o gerekçe bir soruyu cevapsız bırakıyordu — bot hesabı,
> hile, aynı kişinin açtığı yirmi hesap. Bunların karşılığı susturma
> değil; susturmak onları yalnız sessizleştirirdi, oynamaya devam
> ederlerdi. Yasak bu yüzden var ve susturmadan AYRI: susturma sohbete,
> yasak oyuna dokunuyor. İkisi de geri alınabiliyor, ikisi de sebebini
> oyuncuya söylüyor ve ikisi de kayda geçiyor.

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

## Yönetici paneli — şikâyet beklemeden

Kuyruk bir SIRA: kim şikâyet edildiyse o görünüyor. Uzun süre yetti,
yetmediği yer şurası: **bot hesabını kimse şikâyet etmiyor.** Hile de,
aynı kişinin açtığı yirmi hesap da kuyrukta hiç görünmüyor.

Panel bir ARAMA: lord adını yazıp oyuncuyu buluyorsun ve dosyası
açılıyor. Dosya karar için gerekeni yan yana koyuyor — hesabın öteki
lordları (aynı kişi mi), moderasyon geçmişi (bu kaçıncı), son mesajlar
(bağlam). Üçü ayrı ekranda olsaydı karar anında üç kez beklemek
gerekirdi.

| İşlem             | Neye dokunur | Süre                            |
| ----------------- | ------------ | ------------------------------- |
| Sustur            | Sohbete      | 1 saat · 1 gün · 7 gün          |
| Hesabı yasakla    | Oyuna        | 1 gün · 7 gün · 30 gün · kalıcı |
| Mesajı kaldır     | Tek mesaja   | —                               |
| Kaldır (ikisi de) | —            | —                               |

Kurallar kuyruktakiyle aynı ve üçü de bilinçli:

- **Sebep zorunlu** (yasakta). Neden giremediğini bilmeyen oyuncu
  davranışını değiştiremez; sebep hem oyuncuya gösteriliyor hem kayda
  giriyor.
- **Kalıcı yasak iki dokunuş istiyor.** Geri alınabilir olması,
  yanlışlıkla basılabilir olmasını mazur göstermiyor.
- **Yönetici kendini yasaklayamıyor.** Tek yöneticili bir oyunda
  panelin kendini kilitlemesi, kurtarılması sunucuya girmeyi gerektiren
  bir hata olurdu.

### Yasak neye bağlı, nasıl işliyor

Yasak **kullanıcıya** yazılıyor (`User.yasakli`), lorda değil: yeni bir
lord açarak yasaktan kaçılamaz — `yonetici` ile aynı gerekçe.

İşlemesi iki yerde: girişte jeton hiç verilmiyor, ve `requireAuth` her
istekte veritabanından okuyor. İkincisi olmasaydı yasak ancak elindeki
jeton ölünce (yedi gün) başlardı — yasak değil, temenni olurdu.

### E-posta maskeli

Panel `yun***@gmail.com` gösteriyor. Yöneticinin hesapları eşleştirmesi
için bir tutamak gerekiyor ama adresin tamamı gerekmiyor; panel bir
kimlik defteri değil. Tam adres yalnız sunucudaki `pnpm yonetici`
aracında.

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

## Çoklu hesap — ceza değil, bakılacak liste

İkinci bir hesap açıp ana hesabı BESLEMEK bu türün bilinen istismarı:
yeni hesap kaynağını, askerini ya da pazardaki altınını tek yönlü
ötekine akıtıyor. İttifak içi ticaret ve takviye açıldığından beri kapı
açık; görmenin yolu yoktu.

Yönetici paneli → **"Çoklu hesap şüphesi"** (katlı; başlık sayıyı
taşıyor) son 7 günde üç izden birini taşıyan lord çiftlerini listeliyor:

| İz       | Ne zaman işaret                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sevkiyat | Bir lord ötekine ≥ 30.000 (altın karşılığı) gönderdi ve karşı yön bunun %20'si altında — iki gün tam günlük tavan                   |
| Takviye  | Aynı lordun bölgelerine ≥ 3 takviye yürüyüşü                                                                                        |
| Pazar    | Aynı iki lord arasında ≥ 3 eşya pazarı işlemi (pazar anonim ve kurayla eşleşiyor; aynı çiftin tekrar buluşması kendiliğinden olmaz) |
| Ağ       | Aralarında herhangi bir akış olan iki lord, pencerede ≥ 2 AYRI gün aynı ağdan girdi (aşağıya bak)                                   |

Kartta besleyen → alan, iki lordun adı (dokununca dosyası açılıyor),
izlerin büyüklüğü ve besleyen hesap yeniyse (3 günden genç) bir not.
Eşikler `balance.json` → `moderasyon.coklu_hesap`.

Üç ilke:

- **Önce davranış.** Sevkiyat, takviye, pazar: oyunun zaten tuttuğu izler.
- **Ağ yalnız ağırlaştırır.** İlk sürümde ağ izi hiç yoktu ve en güçlü
  işaret eksikti: besleme hesabı çoğu zaman aynı evden açılıyor. Ama
  aynı ev aynı kişi değil (iki kardeş, bir yurt), o yüzden ağ tek
  başına kimseyi listeye SOKMUYOR — yalnız aralarında akış olan çifte
  "Aynı ağ · N gün" işareti ekliyor. Eşiğin altında kalan küçük bir
  besleme böylece görünür oluyor; ortak ağı olup birbirine hiçbir şey
  göndermeyen iki lord görünmüyor.
- **Otomatik ceza yok.** Arkadaşlar da birbirine yardım eder; güçlü
  olanın zayıfı kaldırması tamamen meşru olabilir. Karşılıklı yardım
  (karşı yön %20'yi geçiyorsa) listeye hiç girmiyor. Liste bir insanın
  bakması için; karar iki dosyaya bakıp yöneticinin.

### Ağ izi — nasıl tutuluyor

- **Düz adres hiçbir yere yazılmıyor.** `/me` her açılışta lordun o gün
  girdiği ağın özetini `AgIzi` tablosuna yazıyor (lord, özet, gün).
  Özet HMAC-SHA256, anahtarı `JWT_SECRET`ten alan ayrımıyla türetiliyor
  (`services/agIzi.ts`); anahtar olmadan dört milyar IPv4'ü denemek işe
  yaramıyor. İstek günlüğünden de adres çıkarıldı (index.ts).
- **"Ağ" ne demek:** IPv4'te adresin tamamı (evdeki cihazlar dışarıya tek
  adresle çıkıyor), IPv6'da ilk 64 bit (cihazların adresi değişiyor,
  evin öneki değişmiyor). `services/ag.ts`.
- **Kalabalık ağ yok sayılıyor.** Pencerede 6'dan çok lordun girdiği ağ
  mobil operatörün ortak adresi (CGNAT), okul ya da yurt: orada aynı
  adres aynı kişi demek değil.
- **Kısa ömür.** 14 günden eski iz worker'da saatte bir siliniyor; hesap
  silinince izleri de gidiyor. Pencere 7 gün; bir hafta pay, yöneticinin
  işaretli bir çifte bakabilmesi için.
- **Tek okuyucu.** Yalnız bu liste; panoya ne adres ne özet çıkıyor,
  yalnız ortak gün sayısı.
- **Adresin doğru okunması** şart: vekil arkasında yanlış ayarla herkes
  aynı ağda görünür ve kalabalık sayılıp sessizce elenir (docs/18,
  `ISTEMCI_IP_BASLIGI`). Yönetici panosundaki yayın kontrolü bunu
  yöneticinin kendi isteğiyle ölçüyor.
- Gizlilik metni (Aydınlatma Metni → "Ne topluyoruz", "Ne kadar süre")
  buna göre yazıldı; saklama süresi metne `balance.json`'dan geliyor.

Takviyenin gittiği lord, bölgenin ŞİMDİKİ sahibinden okunuyor
(yürüyüş anındaki sahip saklanmıyor); arada el değiştiren bölge yanlış
çifte yazılabilir. Silinmiş hesabın bağı listeden düşüyor.

Kod: `packages/shared/src/cokluHesap.ts` (saf kural, birim testi
yanında), `routes/yonetici.ts` (`/yonetici/coklu-hesap`).
`tools/yonetici-testi.mjs` iki günlük tek yönlü beslemeyi kurup bağın
listede, besleyenin doğru tarafta ve "yeni" notuyla göründüğünü ölçüyor;
ağ için aynı IPv6 evinden iki lordun küçük akışının yalnız ağ işaretiyle
girdiğini, akışsız komşuların girmediğini, panoya adres ya da özet
çıkmadığını ve süresi dolan izin silindiğini. Kalabalık ağ ve aynı gün
kuralı birim testinde (`cokluHesap.test.ts`), adres seçimi ve özet
`services/ag.test.ts`te.

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
| Yönetici paneli (uçlar)                    | `apps/api/src/routes/yonetici.ts`                                      |
| Yönetici paneli (ekran)                    | `apps/web/src/screens/YoneticiPaneli.tsx`                              |
| Yasağın uygulanması                        | `apps/api/src/auth.ts`, `apps/api/src/routes/auth.ts`                  |
| Test                                       | `packages/shared/src/moderasyon.test.ts`, `tools/moderasyon-testi.mjs` |

`tools/yonetici-testi.mjs` panelin zincirini ölçüyor: ara → bul →
yasakla → oyuncu gerçekten giremiyor (hem giriş hem ESKİ JETON) →
kaldır → yeniden girebiliyor; üstüne yetki sınırını ve arayüzden
verilen yasağın sunucuya işlediğini.

`tools/moderasyon-testi.mjs` zincirin tamamını ölçüyor: şikâyet →
kuyrukta görünüyor → karar → gerçekten etkisi var; üstüne yetki sınırını
ve arayüzden verilen kararın sunucuya işlediğini.
