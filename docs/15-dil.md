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
| Bölge ve vilayet adları | 127 | Özel ad                                            |
| Cümle parçaları         | 291 | Kodda birleşiyorlar; çeviriyle değil KODLA çözülür |

İkincisi hâlâ açık: `"31. sıradasın"` gibi satırlar ekranda Türkçe
kalıyor. Birleşen dizgelerin tek bir şablona dönmesi gerekiyor —
`ceviri/cevrilmeyecekler.txt` hepsini kaynağıyla listeliyor.

---

## Kod nerede

| Katman                                              | Dosya                                                    |
| --------------------------------------------------- | -------------------------------------------------------- |
| Çözücü, anahtar, sunucu kalıpları, eşzamanlı açılış | `packages/shared/src/dil.ts`                             |
| Dil seçimi, paket indirme                           | `apps/web/src/lib/dil.tsx`                               |
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
