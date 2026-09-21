# 17 — E-posta doğrulama

> **Tez:** Doğrulanmamış bir adres, hesabın kilidi olmayan kapısıdır.
> Parolasını unutan oyuncu onu açamaz, açmaya çalışan başkası da.

## Neden yazıldı

Kayıt sırasında adresini yanlış yazan oyuncu, parolasını unuttuğunda
hesabını **kalıcı olarak** kaybediyordu: sıfırlama postası var olmayan
bir kutuya gidiyor, geri dönüşü olmuyor. Destek hattı da yok.

İkinci kazanç sürtünme: doğrulanmamış hesap bedava. Bot ağı kurmak,
yasaktan kaçmak için yeni hesap açmak, aynı kişinin yirmi lordla
oynaması — hepsinin önünde tek bir engel bile yoktu.

---

## Kapı KADEMELİ — ve bu kararın bedeli var

İlk oturum tamamen serbest. Kayıt olan oyuncu postayı hiç açmadan
oynuyor, ilk saldırısını yapıyor, öğreticiyi bitiriyor. `docs/08`'in
tek cümlesi bunu gerektiriyor: **ilk saldırı dakikalarda bitsin.** Yeni
oyuncuyu posta kutusuna göndermek, o cümleyi çöpe atmak olurdu.

Doğrulamadan kapalı olan iki kapı var ve ikisinin de ortak özelliği
**başka oyuncuya dokunmaları**:

| Kapalı          | Açık                                |
| --------------- | ----------------------------------- |
| İttifak sohbeti | Fetih, inşa, araştırma, akın, pazar |
| Kaynak gönderme | Öğretici, günlük görevler, sıralama |

Kötüye kullanımın geçtiği yer o iki kapı. Oyunun kendisini kapatmak
doğrulama değil, ceza olurdu.

**Serbest süre bitince giriş kapanıyor** (`balance.json →
eposta_dogrulama.serbest_gun`). Kapanmasaydı doğrulama bir temenni
olurdu: kimse doğrulamaz, parolasını unutan yine hesabını kaybederdi.
Süre `User.createdAt`ten sayılıyor, son gönderimden değil — son
gönderime bağlamak, "yeniden gönder" düğmesine basarak süreyi sonsuza
uzatmayı mümkün kılardı.

Kapı iki yerde kapanıyor, çünkü biri yetmiyor:

1. **Girişte** jeton hiç verilmiyor.
2. **`requireAuth`** her istekte veritabanından okuyor — açık oturumu
   olan oyuncu yoksa yedi gün daha oynardı ve kapı ancak jeton ölünce
   kapanırdı.

`/auth/dogrula`, `/auth/dogrulama-gonder` ve `/moderasyon/durum` bu
denetimden **muaf**: doğrulanmamış oyuncunun yapabilmesi gereken tek
şey doğrulamak. Muafiyet olmasaydı "e-postanı doğrula" diyen ekranda
doğrulama düğmesi de 403 alırdı.

---

## Jeton

`PasswordReset` ile aynı desen ve aynı gerekçe: jetonun **kendisi
değil, SHA-256 özeti** saklanıyor. Veritabanı sızarsa elindeki özetle
kimse hesap doğrulayamaz. Ham jeton yalnızca üretildiği anda, postaya
giderken var oluyor.

- Ömrü 24 saat — parola sıfırlamadan (30 dk) uzun, çünkü aciliyeti yok:
  oyuncu postayı akşam açabilir. Sonsuz da değil; ele geçirilmiş bir
  posta kutusu eski bir bağlantıyı sonsuza kadar kullanamamalı.
- Yeni jeton üretilince **eskiler geçersiz** oluyor: aynı anda birden
  çok açık jeton, saldırganın yüzeyini büyütür ve oyuncunun hangi
  postadaki bağlantıya basacağını belirsiz kılar.
- Tek kullanımlık (`usedAt`).

### Doğrulama ucu giriş istemiyor

Posta başka bir cihazda açılabilir ve oradaki tarayıcıda oturum
olmayabilir. Jetonun kendisi zaten kimliğin kanıtı; üstüne giriş
istemek, doğrulamayı **en çok ihtiyaç duyulduğu anda** (parolasını
unutmuş oyuncu) imkânsız kılardı.

---

## Gönderim freni

Frensiz bir "yeniden gönder" düğmesi, başkasının adresini yazıp basmaya
devam eden biri için posta kutusu bombalama aracıdır. İki fren birden:

- İki gönderim arası en az **bir dakika** — tek kişiyi durduruyor.
- Günde en fazla **beş** — sabırlı olanı durduruyor.

Kayıttaki ilk gönderim frenden muaf: o oyuncunun eylemi değil, bizim
borcumuz.

---

## Sınırlar — bilerek yapılmayanlar

- **E-posta değiştirme yok.** Yanlış yazılmış adresi düzeltmek ayrı bir
  akış: eski adrese "değişiyor" bildirimi, yeni adrese doğrulama. Şimdilik
  adresini yanlış yazan oyuncunun çözümü destek değil, yeni hesap.
- **Doğrulanmamış hesaplar silinmiyor.** Silmek geri alınamaz; kapı
  zaten kapanıyor ve hesap doğrulandığı an geri geliyor.
- **Yönetici bildirimi yok.** Doğrulanmamış hesap, yönetici panelinde
  oyuncunun dosyasında yazıyor; bot avında ilk bakılacak yer orası.

---

## Kod nerede

| Katman                                       | Dosya                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Saf mantık (süreler, fren, kapı)             | `packages/shared/src/epostaDogrulama.ts`                                          |
| Sayılar                                      | `data/balance.json → eposta_dogrulama`                                            |
| Jeton üretimi ve posta                       | `apps/api/src/services/epostaDogrulama.ts`                                        |
| Uçlar (`/auth/dogrula`, `/dogrulama-gonder`) | `apps/api/src/routes/auth.ts`                                                     |
| Kapının uygulanması                          | `apps/api/src/auth.ts`, `routes/ittifak.ts`, `routes/ticaret.ts`                  |
| Bağlantı ekranı                              | `apps/web/src/screens/EpostaDogrula.tsx`                                          |
| Durum ve yeniden gönder                      | `apps/web/src/screens/Hesap.tsx`                                                  |
| Test                                         | `packages/shared/src/epostaDogrulama.test.ts`, `tools/eposta-dogrulama-testi.mjs` |

---

## Yayına almadan önce (sunucu tarafı)

Posta taşıyıcısı varsayılan olarak `log`: doğrulama bağlantısı yalnız
sunucu günlüğüne yazılıyor, kimseye gitmiyor. Gerçek kutuya düşmesi için:

```bash
EPOSTA_TASIYICI=resend
EPOSTA_ANAHTAR=...            # sağlayıcının anahtarı
EPOSTA_GONDEREN="Lordlar Çağı <bildirim@alanadin.com>"
UYGULAMA_URL=https://alanadin.com
```

Üstüne alan adının **SPF ve DKIM** kayıtları. Bunlar olmadan posta
gidiyor ama spam klasörüne düşüyor — ve spam'e düşen bir doğrulama
postası, hiç gitmemiş postayla aynı şeydir.
