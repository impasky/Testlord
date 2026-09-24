# 21 — Mağaza uyumu: App Store ve Google Play (kod tarafı)

Oyuncunun isteği: "oyunu tam anlamıyla baştan sona test et, hiçbir butonun
işlevini es geçme — App Store ve Play Store'dan onay alacak şekilde kontrol
et."

Bu belge İKİ işi kaydediyor: bütün düğmeleri tek tek deneyen botun
bulduklarını (§1) ve mağaza inceleme kurallarının KOD tarafını (§2).
Mağaza hesabı, listeleme, yerel sarmalayıcı derlemesi (TWA / Capacitor) ve
formlar bu işin dışında — oyuncunun önceki kararı "mağaza işi yapma" ve o
adımlar zaten hesabın sahibinin elinde (§3).

Bu bir hukuki görüş değil. Metinler (Aydınlatma, Kullanım Koşulları) oyunun
gerçekten yaptığını anlatıyor; yayından önce bir hukukçuya okutulmalı.

## 1. Bütün düğmeler (`pnpm dugmeler`, `tools/tum-dugmeler-testi.mjs`)

Öteki uçtan uca testler bir AKIŞI sınıyor. Bu bot akış bilmiyor: beş
sekmeye, on bir kapıya ve iki yönetici paneline gidiyor, orada basılabilir
ne varsa basıyor, basınca açılanlara da basıyor (derinlemesine: sekmeye
basınca önce sekmenin içi). Aradığı:

- basınca konsola hata düşen ya da ekranı çökerten düğme,
- sunucuda 5xx ya da olmayan bir uca (404/405) giden düğme,
- görünür ve etkin olduğu hâlde üstü örtülü, basılamayan düğme,
- basılınca hiçbir şey olmayan düğme (uyarı: zaten seçili sekme hariç).

Kurulum yerleşmiş bir lord: şehir, bütün binalar, ordu, kuşanılmış ekipman,
general, ittifak (ikinci bir lord katılıp sohbete yazıyor — şikâyet ve
engel ancak başkasının mesajında çıkıyor), dolu hastane, sahada bir akın,
yönetici yetkisi. Aynı işi yapan düğmelerden (121 bölge, on akın grubu)
en çok üçüne basılıyor. Geri dönüşsüzler (ayrıl, sil, çıkar, iptal) her
yerin sonuna bırakılıyor; çıkış ve hesap silme `hesap-testi`nin işi.

**Son koşu (düzeltmelerden sonra): 18 yer, 230 basış, 0 hata.** Kalan
iki uyarı Pazar'daki yükseltme düğmeleri (−/+): değer +0…+10 arasında
değişiyor ama bot geri sayımlar gürültü yapmasın diye sayıları imzadan
atıyor, +0→+1'i göremiyor — düğme çalışıyor. İki 4xx bilgi satırı oyun
kuralı: ittifaktayken ikinci ittifak kurulamıyor, medeniyet değişimi
bekleme süresinde reddediliyor.

### Bulunan ve düzeltilen hatalar

| Hata                                                                                                                | Kök neden                                                                                                 | Düzeltme                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oyunun içinden "Hangi veriyi tutuyoruz"a basınca ekran ÇÖKÜYOR                                                      | Tembel yüklenen Aydınlatma Metni bir Suspense sınırının dışında çiziliyordu                               | `main.tsx`'te en dışta Suspense; parola sıfırlama ve e-posta doğrulama sayfaları da aynı risktiydi                                                              |
| Şehirde Elçilik'e dokunulamıyor — dokunan Malikâne'ye giriyor                                                       | Binalar bilerek çakışıyor ve dokunma bütün kare kutudaydı; Malikâne'nin boş üst kısmı Elçilik'i örtüyordu | Dokunma alanı sprite'ın gövdesi (`BINA_DOKUNMA`); on üç binanın hiçbirinin ortası örtülmüyor                                                                    |
| Şehirde "İptal" ve Araştırma'da "İptal et" sunucuya ulaşmıyor (tarayıcı isteği kesiyor)                             | CORS varsayılanı yalnız GET/HEAD/POST'a izin veriyordu; DELETE/PUT/PATCH başka kökenden engelleniyordu    | `index.ts`'te cors `methods` açıkça yazıldı. Hesap silme, geri çağırma, dizilim kaydı ve engel kaldırma da aynı yoldaydı; yerel sarmalayıcıda hepsi kırılacaktı |
| Akın sekmesinde ara sıra "Maximum update depth exceeded"                                                            | Üst çubuktaki kaynak sayacı `Date.now()`'ı çizim sırasında okuyup bir efekti her çizimde tetikliyordu     | Zaman bir durumda tutuluyor, saniyede bir güncelleniyor (`KaynakSayaci`)                                                                                        |
| Seçim çiplerinin (adet, kademe, yuva, sıralama sekmesi, pazar veren/alan) seçili olduğu ekran okuyucuya söylenmiyor | `aria-pressed` yoktu                                                                                      | Eklendi                                                                                                                                                         |

Botun kendi hataları da düzeltildi (araştırma alt sayfasının "Detayı
kapat"ı, haritada yakınlaştırmadan dokunulamayan örtülü işaretçiler, bir
panelden ötekine geçince yeri şaşırması, "English"e basınca arayüzün
dilini değiştirip sonraki yerlerde Türkçe etiket araması, "Öğreticiyi
tekrar oku"nun bilerek baştan açtığı öğretici ve kâhya turunun sonraki
yerleri örtmesi, zaten seçili fiyat satırını `aria-checked`'ten
tanımaması); raporu bunlarla karıştırmamak
için her yere taze bir sayfayla giriliyor.

## 2. İnceleme kuralları — kod tarafı

| #   | Kural                                                    | Mağaza                                | Durum                                                                                                                                                       |
| --- | -------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hesap uygulamanın İÇİNDEN silinebilmeli                  | Apple 5.1.1(v), Play Hesap silme      | ✓ Hesap → Hesabı Sil. `DELETE /me` gerçekten siliyor (lord, ordu, ekipman, bildirim aboneliği, engeller); bölgeler NPC'ye dönüyor.                          |
| 2   | Gizlilik politikası uygulamada ve girişte                | Apple 5.1.1(i), Play Kullanıcı Verisi | ✓ `#/gizlilik` kayıt ekranında ve Hesap'ta. Bu turda: içeriden açınca çöküyordu → düzeltildi. Hata izleme hizmeti metne eklendi.                            |
| 3   | Kullanıcı içeriği: KOŞULLAR (sıfır tolerans)             | Apple 1.2, Play UGC                   | ✓ YENİ `#/kosullar`; kayıt ekranında "diyara girerek kabul edersin" ve bağlantı; Hesap'ta bağlantı.                                                         |
| 4   | Kullanıcı içeriği: SÜZGEÇ                                | Apple 1.2, Play UGC                   | ✓ `mesajDenetimi` (sohbet), `adDenetimi` (lord ve ittifak adları).                                                                                          |
| 5   | Kullanıcı içeriği: ŞİKÂYET                               | Apple 1.2, Play UGC                   | ✓ Sohbette ⚑; yönetici kuyruğu (`Moderasyon`), susturma ve kaldırma kararları.                                                                              |
| 6   | Kullanıcı içeriği: kötüye kullananı ENGELLEME            | Apple 1.2                             | ✓ YENİ. Sohbette ⊘ → onay → o lordun mesajları sunucudan hiç gelmiyor (`LordEngel`, `GET/POST/DELETE /engel`). Hesap'ta "Engellediklerin" ve engeli kaldır. |
| 7   | Herkese açık İLETİŞİM yolu                               | Apple 1.2, Play geliştirici bilgisi   | ✓ Koşullar ve Aydınlatma'da destek satırı; adres `DESTEK_EPOSTA` ortam değişkeninden (`/api/destek`). **Adresi sen girmelisin (§3).**                       |
| 8   | Şikâyete 24 saat içinde işlem                            | Apple 1.2                             | Koşullarda söz verildi, kuyruk var. **Uygulamak senin işin (§3).**                                                                                          |
| 9   | Sanal para gerçek parayla satılıyorsa mağaza ödemesi     | Apple 3.1.1, Play Faturalandırma      | ✓ Gerekmiyor: elmas yalnız oynayarak kazanılıyor, satılmıyor (Koşullar'da yazılı). Satış eklenirse IAP / Play Billing zorunlu.                              |
| 10  | Rastgele ödül ihtimalleri açık                           | Apple 3.1.1, Play                     | ✓ Üretimde nadirlik oranları, akında ekipman ihtimali ekranda.                                                                                              |
| 11  | Üçüncü taraf giriş varsa Sign in with Apple              | Apple 4.8                             | ✓ Gerekmiyor: yalnız e-posta + parola.                                                                                                                      |
| 12  | Bildirim isteğe bağlı, oyuncunun eylemiyle               | Apple 4.5.4                           | ✓ İzin, Bildirim kartındaki düğmeyle isteniyor; açılışta değil.                                                                                             |
| 13  | Tamamlanmışlık: çökme yok, yer tutucu yok, ölü düğme yok | Apple 2.1, Play                       | ✓ §1 botu + 64 uçtan uca test; "lorem/yakında" taraması temiz.                                                                                              |
| 14  | Geliştirme uçları üretimde kapalı                        | Apple 2.1 (gizli özellik)             | ✓ `/test/*` yalnız `NODE_ENV !== production` iken yükleniyor.                                                                                               |
| 15  | Şifreleme ihracat beyanı                                 | Apple                                 | Yalnız standart HTTPS → muaf. Derlemede `ITSAppUsesNonExemptEncryption = false` (§3).                                                                       |

## 3. Kodun dışında kalanlar — hesabın sahibinin işi

1. **`DESTEK_EPOSTA`** — Render panelinden gir (render.yaml'da `sync: false`
   olarak tanımlı). Girmezsen iletişim satırı oyuncuyu şikâyet düğmesine
   yolluyor; mağazalar gerçek bir adres istiyor.
2. **İnceleyici için demo hesap** — Apple ve Google inceleme notuna bir
   e-posta/parola ister. Yerleşmiş bir lord hazırla (şehir, ordu, ittifak)
   ki inceleyici sohbet, şikâyet ve engeli görebilsin.
3. **Şikâyetlere 24 saat içinde bakmak** — Koşullarda söz verildi; yönetici
   kuyruğu Hesap → Şikâyet kuyruğu.
4. **Yaş derecelendirmesi anketi** — fantastik şiddet (savaş raporu,
   kayıp), kullanıcılar arası iletişim (sohbet). Beklenen: Apple 12+,
   IARC Genç / PEGI 12 civarı.
5. **Play Veri güvenliği formu** — toplanan: e-posta (hesap), kullanıcı
   kimliği, uygulama içi mesajlar (ittifak sohbeti), uygulama etkinliği
   (son giriş, son ekran — toplam olarak), bildirim jetonu, hata kayıtları.
   Satış/paylaşım yok; silme var; aktarım şifreli (HTTPS).
6. **Play hesap silme bağlantısı** — uygulamanın web adresi +
   `#/gizlilik` ("Haklarını nasıl kullanırsın": Hesap → Hesabı Sil).
7. **Yerel sarmalayıcı** — oyun bir PWA (manifest, simgeler hazır). Play
   için TWA, App Store için yerel bir kabuk gerekiyor. Apple 4.2 "yalnız web
   sitesini saran" uygulamayı reddedebiliyor: oyun gerçek işlev sunuyor ama
   kabukta bildirimler, çevrimdışı sayfa ve geri tuşu yerel davranmalı.
8. **Metinlerin hukuki okuması** — Aydınlatma Metni ve Kullanım Koşulları.
