# Görsel İstemleri

Oyunun ihtiyacı olan **72 görselin** kopyala-yapıştır istemleri.
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

| Sıra | Kategori | Adet | Neden |
|---|---|---|---|
| 1 | Ekran zeminleri | 6 | Oyunun "gösterge paneli" değil bir yer gibi hissetmesi en çok buna bağlı |
| 2 | Ekipman | 30 | Demirhane şu an tamamen sayıdan ibaret |
| 3 | Harita karoları | 6 | Haritanın okunurluğu; sahne görselleri karo olarak bulanık kalıyor |
| 4 | Bölge aşamaları | 8 | Geliştirmenin karşılığının GÖRÜNMESİ |
| — | Birimler, generaller, bölge tabanları | 22 | Zaten var |

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

## Harita karoları — 6 görsel

Dünya haritasındaki altıgenlerin dolgusu. Bölge sahnelerinden AYRI: sahneler üç çeyrek açıdan bakan tablolar, karolar ise tam tepeden bakan arazi dokuları. Sahneyi karo olarak kullanmak haritayı bulanık bir kolaja çeviriyor.

Çıktı: `apps/web/public/gorseller/harita/<ad>.webp` · 512×512

Kompozisyon (her istemde var):

```
top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition
```

### `harita/tarla.webp`

```
ripe wheat farmland with hedgerows and a cart track, a few thatched roofs at one edge, top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `harita/maden.webp`

```
grey rocky ground with open quarry cuts, spoil heaps, timber props and a cart rail, top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `harita/sehir.webp`

```
densely packed tiled rooftops and narrow streets of a town district, top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `harita/kale.webp`

```
a fortress precinct, thick curtain walls and corner towers around a stone courtyard, top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `harita/taht.webp`

```
a royal citadel precinct, golden roofed keep at the centre ringed by walls and banner poles, top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

### `harita/deniz.webp`

```
deep open sea water with gentle swell and foam streaks, top-down orthographic terrain tile seen straight from above, flat even lighting with no strong shadows, texture reads clearly when shrunk to thumbnail size, edges continue naturally with no vignette and no border, square 1:1 composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

---

## Ekran zeminleri — 6 görsel

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

### `zeminler/giris.webp`

```
a lord in a dark cloak standing on a ridge at dawn overlooking a wide valley of fields, towns and a distant citadel, wide establishing shot, cinematic composition with the focal subject slightly above center, deep atmospheric perspective, empty darker area along the bottom third where interface will overlay, 16:10 landscape composition, medieval fantasy game asset, painted semi-realistic illustration, warm cel-shaded rendering with soft airbrushed volume, dark muted palette of deep browns and parchment cream with warm gold accents and crimson highlights, dramatic side lighting from the upper left, weathered and grounded, not glossy, not cartoonish, no text, no watermark, no border, no frame, no UI elements
```

