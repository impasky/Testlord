# Çeviri — Lordlar Çağı

> Buradaki dosyalar **el yazısıyla doldurulmak için**. Tek yapman gereken
> `1-once-bunlar.txt` dosyasını açıp her satırın Türkçesinin yerine
> İngilizcesini yazmak.

## Önce şunu bil: hepsini çevirmen gerekmiyor

Oyunda 2027 metin var ama çevirmen listesi **1628**. Aradaki 399'u
bilerek çıkardım — `cevrilmeyecekler.txt` neyin neden çıkarıldığını
yazıyor:

| Ne                      | Kaç | Neden                                                   |
| ----------------------- | --: | ------------------------------------------------------- |
| Bölge ve vilayet adları | 127 | Özel ad. "Akçakavak Köyü" İngilizcede de öyle kalır     |
| Cümle parçaları         | 272 | Tek başına çevrilemez; önce kodda birleştirilmesi gerek |

1628 da tek oturuşta bitmez. Bu yüzden **üçe bölünmüş** ve sıra
oyuncunun onlarla karşılaşma sırası:

| Dosya                 | Satır | Ne                                                        |
| --------------------- | ----: | --------------------------------------------------------- |
| `1-once-bunlar.txt`   |   502 | Gezinme, düğmeler, ilk saatin ekranları, öğretici         |
| `2-sonra-bunlar.txt`  |   868 | Savaş raporu, demirhane, general, araştırma, ittifak      |
| `3-en-son-bunlar.txt` |   258 | Sunucu hataları — oyuncu ancak bir şey ters gidince görür |

**Birincisi bitince oyun baştan sona İngilizce oynanabilir.** İkisi ve
üçü sonra gelebilir; yarım çeviri oyunu kırmaz, çevrilmemiş satır
Türkçe kalır.

## Nasıl çevrilir

Dosyayı aç. İçi böyle görünüyor:

```
--- Sehir (35) ---

142. Ordun yetiyor.
143. Günde en fazla {0} saldırı yapabilirsin.
144. Bölgeyi geliştir
```

Türkçenin yerine İngilizcesini yaz. **Numarayı ve noktayı bırak** —
çeviriyi metne bağlayan o:

```
142. Your army is enough.
143. You can attack at most {0} times a day.
144. Upgrade the region
```

### Üç kural

**1. Numara değişmez.** Satırları silme, sıralarını değiştirmen sorun
değil ama numara kaybolursa o çeviri kaybolur.

**2. `{0}` ve `{1}` yer tutucudur, olduğu gibi kalır.** Oyun onların
yerine sayı ya da ad koyuyor. Cümledeki **sırası değişebilir**, kendisi
silinemez:

```
tr: "{0} lord, {1} bölge"
en: "{1} regions, {0} lords"      ✔ sıra değişti, ikisi de duruyor
en: "several regions and lords"   ✘ oyun sayıları hiç göstermez
```

**3. Kısa tut.** Telefon ekranı dar. Türkçesi iki sözcükse İngilizcesi
de iki sözcük olsun; uzun çeviri düğmeden taşar.

`--- Sehir (35) ---` satırları hangi ekranda olduğunu söylüyor, çeviri
değil. Onlara dokunma.

## Bitince

Dosyayı olduğu gibi bana geri ver. Gerisini ben yaparım:

```bash
node tools/ceviri-al.mjs ceviri/1-once-bunlar.txt          # denetler
node tools/ceviri-al.mjs ceviri/1-once-bunlar.txt --uygula  # yazar
```

Denetim asıl iş: numarası silinmiş, boş bırakılmış, yer tutucusu düşmüş
ya da Türkçe kalmış her satırı sayıyla söylüyor ve **`--uygula`
demeden hiçbir şey yazmıyor.** Yarım çevrilmiş bir oyunun yayına
çıkması böyle engelleniyor.

## Makine çevirisi kullanacaksan

Kullanabilirsin — 1628 satırı elle çevirmek günler sürer. Dosyalar
düz metin ve satır yapısını koruyan her araç çalışır. Ama:

- **Yer tutucuları kontrol et.** Çoğu araç `{0}`'ı bozar. `ceviri-al.mjs`
  bozulanı yakalıyor, sen de listeye bak.
- **1. dosyayı elden geçir.** Oyuncunun en çok gördüğü metin orada;
  makine çevirisi anlaşılır olur ama tadı kaçar. 2 ve 3'te makine
  çevirisi fazlasıyla yeterli.

## Bu dosyalar nereden geliyor

| Dosya                    | Üreten                   | Elle düzenlenir mi       |
| ------------------------ | ------------------------ | ------------------------ |
| `1/2/3-*.txt`            | `tools/ceviri-liste.mjs` | **Evet — çeviri buraya** |
| `cevrilmeyecekler.txt`   | `tools/ceviri-liste.mjs` | Hayır, bilgi için        |
| `metinler.json` / `.csv` | `tools/metin-cikar.mjs`  | Hayır, makine dosyası    |
| `numaralar.json`         | `tools/ceviri-liste.mjs` | Hayır, numara–metin bağı |

Oyunun metni değişince:

```bash
node tools/metin-cikar.mjs    # kaynaktan metinleri topla
node tools/ceviri-liste.mjs   # listeleri yeniden yaz
```

Numaralar **kalıcı**: yeni metin sona ekleniyor, eskilerin numarası
değişmiyor. Yani yarım kalmış bir çeviri, oyun güncellenince çöpe
gitmiyor.

## Dil ayarı ne zaman gelecek

Çeviri dosyası geri geldiğinde. O iş üç parça: Hesap ekranında dil
seçimi, cihaz başına kayıt, ve metinlerin sözlükten okunması. Bir de
yukarıdaki 272 cümle parçasının kodda birleştirilmesi — çeviri
listesine giremeyen o satırlar ancak öyle çevrilebilir hâle gelir.
