# Görsel İstemleri

Oyunun ihtiyacı olan **111 görselin** kopyala-yapıştır istemleri.
Her istem üç parçadan oluşur: **konu** + **kategori kompozisyonu** +
**taban üslup**. Taban üslup hepsinde aynıdır; tutarlılık oradan gelir.

**Bu dosya elle düzenlenmez.** Kaynağı `tools/gorsel-uret.py` içindeki
`ISTEKLER`, `KATEGORI` ve `TABAN_USLUP`. Değişiklik oraya yapılır, sonra:

```bash
python3 tools/gorsel-uret.py --istemler > docs/GORSEL-ISTEMLERI.md
```

## Nasıl kullanılır

1. İstemi kopyala, görsel üreten bir araca yapıştır (Gemini, ChatGPT,
   Midjourney, Stable Diffusion — fark etmez).
2. Çıkan görseli sohbete ekle ve **hangi başlığa ait olduğunu söyle**.
3. Gerisi bende: kırpma, boyutlandırma, WebP dönüşümü, doğru adla depoya
   koyma. Boyut ya da format ayarlamanla uğraşma, ham görsel yeter.

Hepsini bir arada göndermen gerekmiyor; geldiği kadarı kullanılır,
gelmeyenin yerinde siluet kalır ve oyun yine tutarlı durur.

**İpucu:** mümkünse hepsini aynı araçta ve aynı oturumda üret. Araç
değiştikçe üslup kayar ve otuz kılıç birbirinin akrabası olmaktan çıkar.

## Öncelik sırası

Hepsini birden yaptırmak gerekmiyor. Oyuna en çok katan sırayla:

| Sıra | Kategori                              | Adet | Neden                                                                    |
| ---- | ------------------------------------- | ---- | ------------------------------------------------------------------------ |
| 1    | Ekran zeminleri                       | 8    | Oyunun "gösterge paneli" değil bir yer gibi hissetmesi en çok buna bağlı |
| 2    | Ekipman                               | 30   | Demirhane şu an tamamen sayıdan ibaret                                   |
| 3    | Harita karoları                       | 6    | Haritanın okunurluğu; sahne görselleri karo olarak bulanık kalıyor       |
| 4    | Bölge aşamaları                       | 8    | Geliştirmenin karşılığının GÖRÜNMESİ                                     |
| —    | Birimler, generaller, bölge tabanları | 22   | Zaten var                                                                |

## Taban üslup

Her istemin sonunda bu var; ayrıca yapıştırmana gerek yok:

```
medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Birimler — 5 görsel

Kışlada ve savaş ekranlarında görünür.

Çıktı: `apps/web/public/gorseller/birimler/<ad>.webp` · 512×512

Kompozisyon (her istemde var):

```
single character standing centered, full body, plain flat dark background, square 1:1 composition
```

### `birimler/milis.webp`

```
a ragged peasant militiaman gripping a pitchfork, no armor, patched linen tunic, wary expression, single character standing centered, full body, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `birimler/mizrakci.webp`

```
a footman in chainmail holding a long spear upright and a kite shield, steady stance, single character standing centered, full body, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `birimler/okcu.webp`

```
an archer in leather armor drawing a longbow, quiver at the hip, focused aim, single character standing centered, full body, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `birimler/suvari.webp`

```
an armored knight on a barded warhorse with a couched lance, charging pose, single character standing centered, full body, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `birimler/kusatma.webp`

```
a wooden catapult siege engine loaded with a boulder, rope tension visible, single character standing centered, full body, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Bölge sahneleri — 13 görsel

Bölge sayfasının tepesinde tam genişlikte görünür — oyuncunun "oradaymış" gibi hissettiği yer burası. Aşama görselleri (`_3`, `_5`) bölge geliştikçe devreye girer; yoksa taban görsel kullanılmaya devam eder.

Çıktı: `apps/web/public/gorseller/bolgeler/<ad>.webp` · 512×512

Kompozisyon (her istemde var):

```
establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition
```

### `bolgeler/tarla.webp`

```
golden wheat fields with a wooden barn and a windmill on the horizon, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/maden.webp`

```
a timbered mine entrance in a rocky hillside with ore carts and a lift, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/sehir.webp`

```
a walled medieval market town, tiled roofs and a market square, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/kale.webp`

```
a stone fortress with square towers on a rocky crag, banners flying, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/taht.webp`

```
a grand throne hall, golden throne on a stepped dais, tall columns and hanging banners, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/tarla_3.webp`

```
a prosperous farming estate, ordered green and gold fields, a large stone granary, two windmills, laden ox carts on the lane, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/maden_3.webp`

```
a busy mining works cut into the hillside, timber headframe and winch tower, several tunnel mouths, smoking ore furnaces, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/sehir_3.webp`

```
a thriving walled trade city, crowded market square with awnings, guild halls, a river quay with moored barges, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/kale_3.webp`

```
a great castle with concentric curtain walls and a barbican gate, many banners, a drilling yard inside the walls, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/tarla_5.webp`

```
a vast breadbasket valley, terraced fields stretching to the horizon, great stone granaries and grain barges on a canal, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/maden_5.webp`

```
a monumental mining complex carved into a mountain, aqueducts and ore lifts, glowing forges, cliffside walkways, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/sehir_5.webp`

```
a grand capital city seen from above, cathedral and palace domes, wide avenues, a great harbour crowded with ships, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `bolgeler/kale_5.webp`

```
an unassailable mountain citadel, towering walls and keeps stacked up the crag, storm light, countless banners, establishing scene from a low three-quarter aerial angle, the subject fills the frame, atmospheric depth, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Generaller — 12 görsel

General listesinde ve kartlarında görünür.

Çıktı: `apps/web/public/gorseller/generaller/<ad>.webp` · 512×512

Kompozisyon (her istemde var):

```
waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition
```

### `generaller/demirci_yusuf.webp`

```
a broad-shouldered blacksmith turned commander, leather apron over mail, soot-marked face, hammer on his shoulder, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/okcubasi_elif.webp`

```
a sharp-eyed woman archer captain in leather armor, longbow across her back, braided dark hair, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/suvari_bora.webp`

```
a young cavalry sergeant in light mail, riding cloak, helmet under his arm, windblown, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/erzakci_meryem.webp`

```
a stern quartermaster woman in practical wool robes, ledger and keys at her belt, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/mizrakci_kadir.webp`

```
a weathered spear captain in mail, spear butt planted, scarred jaw, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/kahya_sinan.webp`

```
a shrewd steward in fine dark robes, seal ring and rolled parchment, calculating look, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/kusatmaci_tarik.webp`

```
a siege master in reinforced leather, engineer tools and rope coils, calculating the walls, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/casus_leyla.webp`

```
a hooded woman spy in dark travel clothes, half-lit face, daggers concealed, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/sovalye_doruk.webp`

```
a proud knight in polished plate armor holding a banner lance, crimson surcoat, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/vaiz_bertan.webp`

```
an aging battlefield preacher in grey robes, wooden icon in hand, calm weary eyes, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/kumandan_alparslan.webp`

```
a legendary supreme commander in ornate gilded armor, fur-lined cloak, commanding gaze, greying beard, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `generaller/kale_bekcisi_sarya.webp`

```
a legendary woman castellan in heavy engraved plate armor, tower shield, unyielding stance, waist-up character portrait facing the viewer, plain flat dark background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Ekipman — 30 görsel

Demirhane envanterinde ve Lord ekranındaki kuşanma yuvalarında görünür. **Nadirlik için ayrı görsel gerekmez**: sıradan/usta/nadir/efsanevi/kadim ayrımı arayüzde çerçeve ve renkle yapılıyor. Tek değişken tier.

Çıktı: `apps/web/public/gorseller/ekipman/<ad>.webp` · 512×512

Kompozisyon (her istemde var):

```
a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition
```

### `ekipman/silah_t1.webp`

```
a straight double-edged arming sword, crude and plain, rough forged iron, plain leather grip and straps, nicked and dulled from use, no ornament at all, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/silah_t2.webp`

```
a straight double-edged arming sword, well made steel, clean lines, a single etched groove, sturdy brass rivets, modest and functional, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/silah_t3.webp`

```
a straight double-edged arming sword, masterwork, blued steel with brass fittings, engraved scrollwork along the edges, one small set gemstone, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/silah_t4.webp`

```
a straight double-edged arming sword, heroic and rich, gilded surfaces deeply engraved with interlace, inlaid gems, silk wrapping, a faint warm glow along the edges, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/silah_t5.webp`

```
a straight double-edged arming sword, ancient and mythic, dark meteoric metal veined with glowing golden runes, unearthly inner light, clearly the relic of a legend, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/kalkan_t1.webp`

```
a heater shield seen from the front, tilted slightly, crude and plain, rough forged iron, plain leather grip and straps, nicked and dulled from use, no ornament at all, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/kalkan_t2.webp`

```
a heater shield seen from the front, tilted slightly, well made steel, clean lines, a single etched groove, sturdy brass rivets, modest and functional, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/kalkan_t3.webp`

```
a heater shield seen from the front, tilted slightly, masterwork, blued steel with brass fittings, engraved scrollwork along the edges, one small set gemstone, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/kalkan_t4.webp`

```
a heater shield seen from the front, tilted slightly, heroic and rich, gilded surfaces deeply engraved with interlace, inlaid gems, silk wrapping, a faint warm glow along the edges, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/kalkan_t5.webp`

```
a heater shield seen from the front, tilted slightly, ancient and mythic, dark meteoric metal veined with glowing golden runes, unearthly inner light, clearly the relic of a legend, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/zirh_t1.webp`

```
a torso cuirass and pauldrons displayed on an invisible stand, crude and plain, rough forged iron, plain leather grip and straps, nicked and dulled from use, no ornament at all, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/zirh_t2.webp`

```
a torso cuirass and pauldrons displayed on an invisible stand, well made steel, clean lines, a single etched groove, sturdy brass rivets, modest and functional, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/zirh_t3.webp`

```
a torso cuirass and pauldrons displayed on an invisible stand, masterwork, blued steel with brass fittings, engraved scrollwork along the edges, one small set gemstone, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/zirh_t4.webp`

```
a torso cuirass and pauldrons displayed on an invisible stand, heroic and rich, gilded surfaces deeply engraved with interlace, inlaid gems, silk wrapping, a faint warm glow along the edges, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/zirh_t5.webp`

```
a torso cuirass and pauldrons displayed on an invisible stand, ancient and mythic, dark meteoric metal veined with glowing golden runes, unearthly inner light, clearly the relic of a legend, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/migfer_t1.webp`

```
a knight helmet, visor down, seen from a three-quarter angle, crude and plain, rough forged iron, plain leather grip and straps, nicked and dulled from use, no ornament at all, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/migfer_t2.webp`

```
a knight helmet, visor down, seen from a three-quarter angle, well made steel, clean lines, a single etched groove, sturdy brass rivets, modest and functional, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/migfer_t3.webp`

```
a knight helmet, visor down, seen from a three-quarter angle, masterwork, blued steel with brass fittings, engraved scrollwork along the edges, one small set gemstone, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/migfer_t4.webp`

```
a knight helmet, visor down, seen from a three-quarter angle, heroic and rich, gilded surfaces deeply engraved with interlace, inlaid gems, silk wrapping, a faint warm glow along the edges, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/migfer_t5.webp`

```
a knight helmet, visor down, seen from a three-quarter angle, ancient and mythic, dark meteoric metal veined with glowing golden runes, unearthly inner light, clearly the relic of a legend, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/at_t1.webp`

```
a shaggy short farm horse in plain rope tack, no armor, standing in profile, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/at_t2.webp`

```
a sturdy riding horse with a simple leather saddle and a plain wool caparison, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/at_t3.webp`

```
a trained warhorse wearing a mail chamfron and a quartered cloth barding, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/at_t4.webp`

```
a magnificent destrier in gilded plate barding with a plumed chamfron and silk trappings, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/at_t5.webp`

```
a legendary black warhorse in rune-etched barding, golden light in its mane, embers rising from its hooves, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/sancak_t1.webp`

```
a plain undyed linen banner on a rough wooden pole, frayed along the edge, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/sancak_t2.webp`

```
a dyed wool banner bearing one simple heraldic charge, plain iron finial, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/sancak_t3.webp`

```
an embroidered banner with a bordered heraldic device, brass finial and tassels, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/sancak_t4.webp`

```
a richly embroidered silk banner with gold thread heraldry and a gilded eagle finial, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `ekipman/sancak_t5.webp`

```
an ancient war standard of dark silk covered in glowing golden sigils, crowned finial, light spilling from the cloth, a single object presented as a game inventory icon, isolated, no hands, no character, no background scenery, the object is large and fills the frame edge to edge; long objects such as blades and poles run diagonally from lower left to upper right, compact objects sit centered and fill the square, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the object and the background, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Yerleşim zeminleri — 6 görsel

Şehir sayfasının zemini — oyuncunun her gün baktığı tek resim. Kademe yükseldikçe değişiyor: kamp, köy, kasaba, şehir, kale-şehir, metropol. Binalar bu zeminin ÜSTÜNE DOM olarak konuyor (`data/binalar.json` içindeki x/y yüzdeleri), o yüzden zeminde bina çizmiyoruz: çizersek iki kat bina görünür.

**Kural: karede HİÇ bina olmayacak.** İlk denemede kompozisyon "manzarayı kenarlara yasla" diyordu ve model kenarlara ev, çadır, kule çizdi. Sonuç, oyuncunun tarifiyle: binalar havada duruyor gibi görünüyordu — çünkü zeminin kendi boyalı binaları bizim sprite'larımızla yarışıyor, ikisi farklı ışık ve farklı kalemle çizildiği için sprite yapıştırılmış duruyordu.

Zemin artık YALNIZCA zemin: toprak, çimen, taş döşeme, dolanan bir patika, kenarda çit ve ağaç. Ekrandaki her bina bizim.

Çıktı: `apps/web/public/gorseller/yerlesim/<ad>.webp` · 1024×768

Kompozisyon (her istemde var):

```
an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition
```

### `yerlesim/kamp.webp`

```
wild green grassland with wide patches of trodden bare earth, a cold firepit ring of stones, scattered boulders and thin shrubs around the outer rim, an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `yerlesim/koy.webp`

```
a cleared village ground of packed brown earth and grass, deep cart ruts, a low split rail fence and tree stumps around the outer rim, an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `yerlesim/kasaba.webp`

```
a town ground where packed earth meets the first worn flagstones, gravel edges, a wooden fence line and young trees around the outer rim, an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `yerlesim/sehir.webp`

```
a city ground of fitted paving stones with grass growing between them, a stone kerb and a dry water channel crossing it, clipped garden hedges around the outer rim, an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `yerlesim/kale.webp`

```
a fortress bailey of hard packed gravel with wheel ruts and drill yard scuff marks, a thick stone curtain wall running along the outer rim only, an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `yerlesim/metropol.webp`

```
a grand imperial precinct of polished marble paving with gold inlay lines and a mosaic medallion, ornamental hedges and empty statue plinths around the outer rim, an empty buildable ground seen from a high three-quarter aerial view, open terrain filling the whole frame with a winding dirt path looping through it, ABSOLUTELY NO BUILDINGS anywhere in the image: no houses, huts, tents, towers, roofs, ruins or market stalls, only ground, path, grass, rocks, trees and low fences at the outer rim, the terrain fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no people, bright even daylight, 4:3 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Bina işaretçileri — 24 görsel

Yerleşim zeminine konan küçük yapı ikonları. Ekranda 44 piksel civarında duruyorlar — ayrıntı değil SİLUET okunmalı.

Her seviyeli binanın İKİ hâli var: `_1` temel (ahşap, küçük, sade), `_5` gelişmiş (taş, büyük, süslü). Aradaki seviyeler arayüzde rozetle gösteriliyor; üç ayrı görsel üretmenin karşılığı yok.

Çıktı: `apps/web/public/gorseller/binalar/<ad>.webp` · 256×256

Kompozisyon (her istemde var):

```
a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition
```

### `binalar/malikane_1.webp`

```
a modest timber and thatch manor house with a single chimney, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/malikane_5.webp`

```
a grand stone manor with a tiled roof, glazed windows, a walled courtyard and a banner over the door, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/kisla_1.webp`

```
a small wooden barracks hut with a weapon rack outside, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/kisla_5.webp`

```
a large stone barracks with an arched gate, a drill yard and spears stacked in rows, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/demirhane_1.webp`

```
a small open sided forge with an anvil and a stone chimney, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/demirhane_5.webp`

```
a large stone smithy with two chimneys venting smoke, a waterwheel driven trip hammer and racks of finished blades, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/hastane_1.webp`

```
a small timber infirmary tent with a herb bundle at the door, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/hastane_5.webp`

```
a stone hospice with arched windows, a walled herb garden and a tiled roof, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/pazar_1.webp`

```
a single market stall with a striped awning and crates, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/pazar_5.webp`

```
a covered stone market hall with arcades and hanging scales, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/surlar_1.webp`

```
a short wooden palisade section with a sharpened top, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/surlar_5.webp`

```
a tall stone curtain wall section with crenellations, a corner tower and an arrow slit, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/karargah_1.webp`

```
a plain command tent with a map table visible at the entrance, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/karargah_5.webp`

```
a stone command keep with a banner mast, a balcony and standards planted at the base, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/kutuphane_1.webp`

```
a small scriptorium hut with a shuttered window and a lectern, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/kutuphane_5.webp`

```
a domed stone library with tall arched windows and an astrolabe on the roof terrace, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/liman_1.webp`

```
a short wooden jetty with a single moored rowboat, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/liman_5.webp`

```
a stone quay with a crane derrick, warehouses and a moored trading cog, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/elcilik_1.webp`

```
a small guest lodge with a plain flagpole, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/elcilik_5.webp`

```
a stone embassy hall with a colonnaded porch and several foreign banners on tall poles, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/gorev_panosu.webp`

```
a wooden notice board on posts with pinned parchments and a small shingled roof, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/haberci_kulesi.webp`

```
a slender stone watchtower with a signal brazier at the top and a pennant, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/onur_meydani.webp`

```
a small stone monument plaza with a laurel wreathed pillar and a low step ring, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `binalar/arsa.webp`

```
an empty building plot marked out with rope and wooden stakes, a few cut stones and a shovel left on the bare earth, a single small building seen from a three-quarter aerial angle, isolated on a fully transparent background, the building fills the frame, strong readable silhouette, no ground plane, no shadow, no people, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Dünya haritası — 1 görsel

Tek bir resimli zemin ve üstünde 61 DOM işaretçisi (docs/12 §5). Altıgen karolar EMEKLİ: harita artık ızgara değil, çizilmiş bir diyar.

**Zeminde yazı yok** ve olamaz: bölge adları veriden geliyor, görsel modeli de okunabilir metin üretemiyor. İşaretçiler de resimde değil, üstünde.

**KARE ve çerçevesiz.** Kap `aspect-square` + `object-cover` (`DunyaHaritasi.tsx`): kare olmayan bir görselin yanları kırpılıyor. 4:3 üretilen ilk deneme, x=6 ile x=94 arasına yayılan 61 işaretçinin en dıştakilerini kırpılan şeride düşürüyordu. Parşömen çerçevesi de aynı sebeple istenmiyor: kenar süsü, işaretçilerin oturduğu alanı yiyor.

Çıktı: `apps/web/public/gorseller/harita/<ad>.webp` · 1024×1024

Kompozisyon (her istemde var):

```
hand drawn fantasy world map in the style of an old parchment atlas, seen straight from above, coastlines rivers forests and mountain ranges, land covers the entire square frame from corner to corner and runs off all four edges, water appears only as rivers lakes and a few small bays, no open ocean, no border, no frame, no torn parchment edge, no text, no labels, no letters, no compass rose, no grid, no hexagons, square 1:1 composition
```

### `harita/dunya.webp`

```
a single continent surrounded by sea, rocky northern mountains, central plains crossed by two rivers, dark forests to the west, a marsh delta to the south east, small unnamed islands offshore, hand drawn fantasy world map in the style of an old parchment atlas, seen straight from above, coastlines rivers forests and mountain ranges, land covers the entire square frame from corner to corner and runs off all four edges, water appears only as rivers lakes and a few small bays, no open ocean, no border, no frame, no torn parchment edge, no text, no labels, no letters, no compass rose, no grid, no hexagons, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Akın diyarları — 5 görsel

Beş NPC diyarının zemini (docs/12 §6). Akın sekmesinde diyar kartının kapağı olarak duruyor — oyuncunun "burası neresi" sorusunu tek bakışta cevaplaması gereken yer.

Diyarlar birbirine BENZEMEMELİ: beşi de aynı kahverengi manzara olursa oyuncu hangi diyarda olduğunu ancak yazıdan anlar.

Çıktı: `apps/web/public/gorseller/akin/<ad>.webp` · 1024×576

Kompozisyon (her istemde var):

```
wide establishing shot of a hostile landscape with an enemy encampment in the middle distance, cinematic composition, strong single colour mood, the scene fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no text, 16:9 composition
```

### `akin/kirik_sahil.webp`

```
a storm grey shoreline of black rock and broken ship ribs half buried in wet sand, pirate tents and a driftwood stockade above the tideline, cold blue green sea mist, wide establishing shot of a hostile landscape with an enemy encampment in the middle distance, cinematic composition, strong single colour mood, the scene fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no text, 16:9 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `akin/solgun_bataklik.webp`

```
a pale sunless marsh of reed beds and standing water, a deserter camp of army tents on a mud causeway, rusted shields hung on poles, sickly yellow green haze, wide establishing shot of a hostile landscape with an enemy encampment in the middle distance, cinematic composition, strong single colour mood, the scene fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no text, 16:9 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `akin/kuzey_buzulu.webp`

```
a blue white glacier field split by a deep crevasse, a barbarian camp of hide tents and reindeer pens on the wind scoured ice, hard white winter light, wide establishing shot of a hostile landscape with an enemy encampment in the middle distance, cinematic composition, strong single colour mood, the scene fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no text, 16:9 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `akin/kuller_vadisi.webp`

```
a black ash valley under a dead volcano, bandit forges and slag heaps smoking between basalt spurs, hot orange embers glowing in grey ash, wide establishing shot of a hostile landscape with an enemy encampment in the middle distance, cinematic composition, strong single colour mood, the scene fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no text, 16:9 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `akin/unutulmus_nekropol.webp`

```
a sunken city of tombs half swallowed by sand, broken obelisks and a stepped mausoleum, cult braziers burning cold violet in the dusk, wide establishing shot of a hostile landscape with an enemy encampment in the middle distance, cinematic composition, strong single colour mood, the scene fills the entire frame edge to edge with no background colour and no magenta visible anywhere, no text, 16:9 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Lord figürü — 5 görsel

Lord ekranının tepesinde, ordunun önünde durur. Beş görsel, kuşam seviyesine göre: oyuncu ekipmanını yükselttikçe lord gözle görülür değişir.

**Bunlar tek tek üretilmez, ZİNCİRLEME DÜZENLENİR.** `lord_1` metinden üretilir; `lord_2`, `lord_1`i GİRDİ alıp düzenleyerek, `lord_3` `lord_2`den… böyle devam eder. Sebep tutarlılık: metinden sıfırdan üretilen beş görsel beş ayrı adam veriyor. Aynı görseli girdi verip "aynı adam, aynı duruş, şimdi şu zırhı giyiyor" demek aynı adamı veriyor.

```bash
python3 tools/gorsel-uret.py lord_1
python3 tools/gorsel-uret.py lord_2 --kaynak apps/web/public/gorseller/lord/lord_1.webp
python3 tools/gorsel-uret.py lord_3 --kaynak apps/web/public/gorseller/lord/lord_2.webp
```

Elle üretiyorsan aynı şey: `lord_1`i araca yükle, sonraki istemi ver, çıkanı yükle, sonrakini ver.

Çıktı: `apps/web/public/gorseller/lord/<ad>.webp` · 768×1024

Kompozisyon (her istemde var):

```
a single full-body character standing and facing the viewer in a slight three-quarter turn, feet on the ground, heroic but grounded stance, the figure fills the frame top to bottom, no other characters, no background scenery, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the figure and the background, 3:4 portrait composition
```

### `lord/lord_1.webp`

```
a lean young Anatolian lord with dark hair and a short beard, no armor at all, patched wool tunic and a worn leather belt, a plain iron sword hanging at his hip, empty hands, wary and untested, a single full-body character standing and facing the viewer in a slight three-quarter turn, feet on the ground, heroic but grounded stance, the figure fills the frame top to bottom, no other characters, no background scenery, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the figure and the background, 3:4 portrait composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `lord/lord_2.webp`

```
SAME MAN, same face, same hair, same age, same stance, same framing and same scale as the input image. Only his gear changes: he now wears a plain steel cuirass over mail with brass rivets and a simple open helmet under one arm, a well made arming sword at his hip. Still weathered, still no ornament, a single full-body character standing and facing the viewer in a slight three-quarter turn, feet on the ground, heroic but grounded stance, the figure fills the frame top to bottom, no other characters, no background scenery, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the figure and the background, 3:4 portrait composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `lord/lord_3.webp`

```
SAME MAN, same face, same stance, same framing and same scale as the input image. Only his gear changes: blued steel armor with brass fittings and engraved scrollwork, a masterwork sword, a heater shield on his arm, a dark cloak. Confident now, a single full-body character standing and facing the viewer in a slight three-quarter turn, feet on the ground, heroic but grounded stance, the figure fills the frame top to bottom, no other characters, no background scenery, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the figure and the background, 3:4 portrait composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `lord/lord_4.webp`

```
SAME MAN, same face, same stance, same framing and same scale as the input image. Only his gear changes: gilded engraved plate armor with interlace and inlaid gems, crimson silk wrapping, a rich fur-lined cloak, a golden-hilted sword held point down before him. A commander, a single full-body character standing and facing the viewer in a slight three-quarter turn, feet on the ground, heroic but grounded stance, the figure fills the frame top to bottom, no other characters, no background scenery, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the figure and the background, 3:4 portrait composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `lord/lord_5.webp`

```
SAME MAN, older and scarred, same face, same stance, same framing and same scale as the input image. Only his gear changes: ancient dark meteoric armor veined with glowing golden runes, a crowned helm, a tattered crimson war cloak, a rune-lit blade raised. Unmistakably a legend, a single full-body character standing and facing the viewer in a slight three-quarter turn, feet on the ground, heroic but grounded stance, the figure fills the frame top to bottom, no other characters, no background scenery, plain flat dark background with no gradient, no vignette and no texture, no cast shadow falling on the background, crisp silhouette separation between the figure and the background, 3:4 portrait composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Ekran zeminleri — 10 görsel

Her ekranın tepesinde geniş bir şerit olarak durur ve alt kenarı arayüze eritilir. Oyunun "gösterge paneli" değil bir yer gibi hissettirmesi büyük ölçüde buna bağlı.

Çıktı: `apps/web/public/gorseller/zeminler/<ad>.webp` · 1024×640

Kompozisyon (her istemde var):

```
wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition
```

### `zeminler/malikane.webp`

```
a fortified lord's manor and its courtyard at dusk, warm lit windows, outbuildings and a walled garden, rolling farmland beyond, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/kisla.webp`

```
a barracks training yard at dawn, racks of spears and shields, straw targets, soldiers drilling in the distance, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/demirhane.webp`

```
a smithy interior lit by the forge, glowing anvil and coals, hanging tongs and half-finished blades, sparks in the air, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/generaller.webp`

```
a war council chamber, great map table with carved markers, hanging banners, candlelight, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/siralama.webp`

```
a long hall of honour lined with the banners of rival houses, shafts of light from high windows, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/gorevler.webp`

```
a scriptorium desk with an open ledger of tallies and seals, quill and inkpot, a wax-sealed writ, morning light, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/olaylar.webp`

```
a messenger's table in a keep, scattered opened letters and broken seals, a raven at the window, evening light, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/akin.webp`

```
a war camp on a ridge at first light, scouts pointing toward distant enemy fires on the plain below, horses saddled, spears planted in the earth, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/arastirma.webp`

```
a master builder's workshop, architectural drawings on vellum, wooden scale models of a granary and a watchtower, dividers and measuring rods, afternoon light through a high window, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `zeminler/giris.webp`

```
a lord in a dark cloak standing on a ridge at dawn overlooking a wide valley of fields, towns and a distant citadel, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```
