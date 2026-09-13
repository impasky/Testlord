# Çeviri dosyası — Lordlar Çağı

Oyundaki **2067** metnin tamamı burada. İkisi de aynı içerik, hangisi
kolayına gelirse:

| Dosya           | Ne zaman                                |
| --------------- | --------------------------------------- |
| `metinler.json` | Metin düzenleyiciyle çalışacaksan       |
| `metinler.csv`  | Excel / Google E-Tablolar kullanacaksan |

Dosyaları `tools/metin-cikar.mjs` üretiyor; **elle düzenlenmiyor.** Oyunun
metni değişince aynı komut yeniden koşuyor:

```
node tools/metin-cikar.mjs
```

## Ne yapman gerekiyor

Her kaydın `en` alanı **boş**. Oraya İngilizcesini yaz, `tr` alanına
dokunma. CSV'de `ingilizce` sütunu aynı işi görüyor.

```json
"t3a91f4c2": {
  "grup": "arayuz",
  "tr": "Ordun yetiyor. Bölge senin olunca kazanacakların:",
  "en": "",
  "nerede": ["apps/web/src/components/Omurga.tsx:611"]
}
```

`anahtar` (`t3a91f4c2`) **değişmemeli** — çeviriyi metne o bağlıyor.

## Üç kural

**1. `{0}`, `{1}` yer tutucudur, olduğu gibi kalır.** Oyun onların yerine
sayı ya da ad koyuyor. Yeri değişebilir, kendisi değişemez:

```
tr: "Günde en fazla {0} saldırı yapabilirsin."
en: "You can attack at most {0} times a day."
```

**2. Baştaki ve sondaki boşluk anlamlıdır.** Bazı metinler cümlenin
ortasına ekleniyor: `" · {0} bölgen"` kaydındaki baştaki boşluk
kaybolursa ekranda sözcükler birbirine yapışır.

**3. Boş bıraktığın kayıt Türkçe kalır.** Dil ayarı geldiğinde çevirisi
olmayan metin Türkçesiyle gösterilecek — yarım bir çeviri oyunu
bozmuyor, yalnız bazı satırlar Türkçe kalıyor.

## Gruplar

| Grup     | Adet | Ne                                                  |
| -------- | ---- | --------------------------------------------------- |
| `arayuz` | 1062 | Ekranlar, kartlar, düğmeler, uyarılar               |
| `motor`  | 356  | Birim ve bölge adları, rütbeler, öğretici, ipuçları |
| `sunucu` | 269  | Hata mesajları, bildirimler, e-postalar             |
| `veri`   | 253  | Binalar, generaller, araştırma, başarımlar, akınlar |
| `harita` | 127  | Bölge ve vilayet adları                             |

`harita` grubunu **çevirmeden bırakabilirsin**: 121 bölge ve 6 vilayet adı
özel isim (Kayınlık Köyü, Karaorman). İngilizce oyunda Türkçe kalmaları
tuhaf durmaz; istersen çevir, istersen dokunma.

## Bilmen gereken bir kusur

Yaklaşık 400 kayıt bir cümlenin **parçası**. Arayüzde metnin arasına sayı
girdiğinde cümle ikiye bölünüyor ve iki ayrı kayıt oluyor:

```
"Bölgen "        <- parça 1
" · {0} seviye"  <- parça 2
```

İngilizcede sözcük sırası değiştiği için bu parçaların bazıları tek
başına doğru çevrilemiyor. Takıldığın yerde **çevirme, işaretle** —
`nerede` alanı hangi dosyanın kaçıncı satırı olduğunu söylüyor, o
satırları cümle bütünlüğü bozulmayacak şekilde ben yeniden yazarım.

## Dosyayı bana nasıl geri verirsin

Doldurduğun dosyayı sohbete yükle. Sonrasında dil ayarını ben kuruyorum:
Hesap ekranına Türkçe/İngilizce seçeneği, seçimin cihazda saklanması ve
bütün metinlerin sözlükten okunması.
