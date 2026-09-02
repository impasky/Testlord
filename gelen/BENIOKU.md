# Ham görselleri buraya bırak

Bu dal **kod içermez**. Tek işi, elle üretilmiş ham görselleri Claude'a
ulaştırmak. Sohbete eklenen görseller bazen diske inmiyor (görüntü
görünüyor, dosya yok); bu yol her zaman çalışıyor.

## Nasıl

1. Üstteki dal seçicide **`gorsel-gelen`** seçili olduğundan emin ol.
2. **Add file → Upload files** ile görselleri bu `gelen/` klasörüne sürükle.
3. **Commit changes**.
4. Sohbette Claude'a "yükledim" de.

## Dosya adları

Adını doğru verirsen tek komutta işlenir. Ad, oyunun beklediği dosya adı
olsun (uzantı ne olursa olsun — png, jpg, webp fark etmez):

```
silah_t1      kalkan_t1     zirh_t1      migfer_t1     at_t1     sancak_t1
   ...            ...          ...          ...          ...        ...
silah_t5      kalkan_t5     zirh_t5      migfer_t5     at_t5     sancak_t5
```

Diğer kategoriler için de aynı: `tarla_3`, `kale_5`, `malikane`, `okcu`,
`kusatmaci_tarik`… Tam liste: `docs/GORSEL-ISTEMLERI.md`.

Adını bilmiyorsan sorun değil — ne olduklarını sohbette yaz
("sırayla t1, t5, t4, t3, t2" gibi), Claude eşleştirir.

## Sonra ne oluyor

Claude dosyaları buradan alır, işler (filigran temizliği, zemin ayıklama,
orana kırpma, WebP) ve **işlenmiş** hâllerini çalışma dalına koyar. Ham
dosyalar çalışma dalına hiç girmez.

Bu dal iş bitince silinebilir; ham görsellerin geçmişi onunla gider ve
depo şişmez. Silersen sonra aynı adla yenisini açmak yeterli.
