# 15 — Dil

> **Tez:** Türkçe metnin kendisi anahtar olursa i18n, kod tabanına
> dokunmadan eklenebilir bir katmana dönüşür.

## Tek karar, üç sonuç

Anahtar `ordu.yeterli` değil, **cümlenin kendisi**:

```ts
t('Ordun yetiyor.'); // anahtar = FNV-1a('Ordun yetiyor.')
```

Bu tek karardan üç şey birden çıkıyor:

**1. Kod okunur kalıyor.** `t('ordu.yeterli')` yazan bir dosyada ne
yazdığını görmek için ikinci bir dosyaya bakmak gerekir.

**2. Geri düşme kendiliğinden doğru.** Çeviri yoksa argüman dönüyor —
oyuncu boş kutu değil Türkçesini görüyor. Yarım çeviri oyunu kırmıyor.

**3. SUNUCUYA HİÇ DOKUNULMADI.** API Türkçe döndürüyor ve öyle kaldı.
İstemci gelen Türkçeyi kendi sözlüğünde bulabiliyor, çünkü anahtar
zaten o metnin özeti. Dil bilgisini her isteğe eklemek, her uçta çeviri
yapmak, sunucuda ikinci bir sözlük taşımak gerekmedi.

Bedeli: Türkçe cümle değişince anahtar değişiyor ve çeviri düşüyor. Bu
bir kusur değil — **değişmiş bir cümlenin eski çevirisi yanlış
çeviridir.**

---

## Kaynak kodda `t()` yok

Ekrana çizilen 1600 dizgeyi elle sarmak üç bedel getiriyordu: 1600 elle
düzenleme (çoğu ancak o ekran açılınca görülecek hatalar), okunaksız
kod, ve kuralların ayrışması.

Bunun yerine **derleme eklentisi** (`apps/web/vite-ceviri.mjs`) sarıyor:

```
<p>Ordun yetiyor.</p>   ->  <p>{__t("Ordun yetiyor.")}</p>
baslik="Şehir"          ->  baslik={__t("Şehir")}
`${n} bölge`            ->  __t("{0} bölge", n)
```

Kararı **çıkarıcının kendi kuralları** veriyor:
`tools/lib/metin-kurallari.mjs` hem `metin-cikar.mjs`in hem eklentinin
okuduğu tek dosya. Çevirmene sorulan her dizge sarılıyor, sorulmayan
hiçbiri sarılmıyor — **ayrışma yapısal olarak imkânsız.**

---

## Sözlük neden EŞZAMANLI yükleniyor

Mimarinin en ince yeri burası ve gerekçesi somut bir hata:

```ts
export const KADEME_OZETI = { kamp: t('Bir ateş, birkaç çadır…') };
```

Bu sabit **modül yüklenirken** değerini alıyor. Sözlük ağdan gelseydi —
yani bir söz beklenseydi — bu satır çoktan çalışmış ve Türkçeyi
yakalamış olurdu. Ekranın yarısı İngilizce, yerleşim açıklamaları
Türkçe kalıyordu; gerçekten öyle oldu ve `tools/dil-testi.mjs` onu
yakaladı.

Çözüm: paket bir kez indirilip `localStorage`a yazılıyor, sonraki her
açılışta oradan **eşzamanlı** okunuyor. Bu yüzden `dil.ts`
`packages/shared/src/index.ts` dosyasında **en üstte** duruyor: metin
taşıyan hiçbir modül değerlendirilmeden sözlük yerine oturuyor.

Aynı sebeple **dil değişimi sayfayı yeniliyor.** Sözlüğü çalışan
sayfaya yerleştirmek, modül düzeyinde hesaplanmış sabitleri Türkçe
bırakır.

---

## Sunucu metni

`apps/web/src/api/client.ts` her yanıtı gezip metinleri `ts()`den
geçiriyor. Alan alan seçmek, her yeni uçta unutulacak bir liste
demekti; tarama güvenli çünkü `ts()` **yalnız sözlükte karşılığı olan**
metni değiştiriyor — lord adı, bölge adı, kimlik ve sayı olduğu gibi
geçiyor.

Sunucu mesajları **yerleştirilmiş** geliyor (`"12 saat içinde"`),
sözlükte ise kalıp duruyor (`"{0} saat içinde"`). Doğrudan özet araması
ıskaladığı için yer tutuculu kayıtlar bir kez düzenli ifadeye çevrilip
gelen metin onlara uyduruluyor; yakalanan parçalar çeviriye **yeni
sıraya göre** yerleşiyor:

```
"3 lord, 8 bölge"  ->  "8 regions, 3 lords"
```

---

## Neler çevrilmiyor

| Ne                      | Kaç | Neden                                              |
| ----------------------- | --: | -------------------------------------------------- |
| Bölge ve vilayet adları | 126 | Özel ad                                            |
| Cümle parçaları         |  24 | Kodda birleşiyorlar; çeviriyle değil KODLA çözülür |

### Cümle parçası nedir, nasıl eridi

JSX'te bir cümlenin ortasına renk koymak onu üçe bölüyor:

```tsx
<p>
  Yalnız <span className="text-parsomen">nüfusu az</span> bir medeniyete geçebilirsin — kazanan
  tarafa geçiş yok.
</p>
```

Eklenti her JSX metnini ayrı sarıyor; çevirmene `"Yalnız"` ile `"bir
medeniyete geçebilirsin — kazanan tarafa geçiş yok."` diye iki satır
gidiyor. İkisi de tek başına çevrilemez — bağlam yok ve İngilizcede
sözcük sırası değişince parça yanlış yere düşer. `parcaMi()` bu yüzden
onları listeye hiç koymuyordu ve satır ekranda Türkçe kalıyordu.

Çözüm `<Cumle>`: cümle TEK dizge, vurgulu sözcük `{0}` yer tutucusunda.

```tsx
<Cumle
  metin="Yalnız {0} bir medeniyete geçebilirsin — kazanan tarafa geçiş yok."
  parca={[<span className="text-parsomen">nüfusu az</span>]}
/>
```

Çevirmen cümlenin tamamını görüyor, `{0}` çeviride İSTEDİĞİ YERE
gidiyor, vurgulanan ibare ayrıca kendi başına çevriliyor. `metin`
niteliği `METIN_NITELIGI` listesinde: kısa bir cümle şekil süzgecine
takılıp anahtar sanılmasın diye.

Sayı 291'le başlamıştı; önceki temizliklerle 39'a, `<Cumle>` ile dört
dosyada (LordEkrani, Medeniyet, SaldiriOnizleme, DunyaSeridi) 24'e
indi. Kalanın bir kısmı gerçekten çevrilemez (`T{0}`, `&nbsp;`),
gerisi aynı yöntemle kapatılacak — `ceviri/cevrilmeyecekler.txt`
hepsini kaynağıyla listeliyor.

---

## Kod nerede

| Katman                                              | Dosya                                                    |
| --------------------------------------------------- | -------------------------------------------------------- |
| Çözücü, anahtar, sunucu kalıpları, eşzamanlı açılış | `packages/shared/src/dil.ts`                             |
| Dil seçimi, paket indirme                           | `apps/web/src/lib/dil.tsx`                               |
| Vurgulu cümle (parça birleştirme)                   | `apps/web/src/components/Cumle.tsx`                      |
| Derleme eklentisi                                   | `apps/web/vite-ceviri.mjs`                               |
| Paylaşılan metin kuralları                          | `tools/lib/metin-kurallari.mjs`                          |
| Sunucu metni taraması                               | `apps/web/src/api/client.ts`                             |
| Sözlük paketi üretimi                               | `tools/ceviri-paket.mjs`                                 |
| Test                                                | `packages/shared/src/dil.test.ts`, `tools/dil-testi.mjs` |

```bash
pnpm ceviri         # metinleri çıkar, listeleri ve paketi yaz
pnpm ceviri-kalan   # yalnız çevrilmemiş satırları listele
```

`tools/dil-testi.mjs` oyunu iki dilde açıp karşılaştırıyor: gezinme
çubuğu, `html lang`, modül düzeyindeki sabitler, sunucu mesajının
istemcide çevrilmesi ve geri düşme.
