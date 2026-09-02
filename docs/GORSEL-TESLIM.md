# Görsel teslim yolu

Sohbete eklenen görseller bazen Claude'a **dosya olarak ulaşmıyor**:
görüntü görünüyor ama diske yazılmıyor, dolayısıyla işlenemiyor. Üç turda
üst üste yaşandı (5 kılıç, 1 kılıç, 5 kılıç) ve aynı sohbette altı ekran
zemini sorunsuz inmişti — yani ne dosya türüyle ne boyutla ilgili, sohbet
yüklemesinin kendisi kararsız.

Kalan ~60 görsel için sohbete güvenmek yerine depo üzerinden teslim:

## Yol: `gorsel-gelen` dalına yükle

Dal **hazır**, açman gerekmiyor: kod içermeyen, kopuk geçmişli, içinde tek
bir `gelen/BENIOKU.md` olan ayrı bir dal.

1. GitHub'da depoya git, üstteki dal seçiciden **`gorsel-gelen`**'i seç
2. `gelen/` klasörüne gir, **Add file → Upload files** ile görselleri sürükle
3. **Commit changes**
4. Sohbette "yükledim" de

Dosya adlarını oyunun beklediği adla verirsen (`kalkan_t1.png`,
`migfer_t3.png`, `tarla_5.png`…) iş tek komuta iner. Bilmiyorsan sohbette
ne olduklarını yaz, eşleştirilir. Tam liste: `docs/GORSEL-ISTEMLERI.md`.

Sonrası Claude'da:

```bash
git fetch origin gorsel-gelen
git checkout origin/gorsel-gelen -- gelen/
python3 tools/gorsel-koy.py ekipman silah_t1=gelen/a.png silah_t2=gelen/b.png ...
rm -rf gelen/
```

İşlenen WebP'ler çalışma dalına giriyor; ham dosyalar hiçbir zaman oraya
girmiyor. `gorsel-gelen` dalı iş bitince silinebilir — ham görsellerin
geçmişi onunla birlikte gider, çalışma dalı şişmez. Silinirse aynı adla
yenisi açılabilir; dalın içeriği tek bir açıklama dosyasından ibaret.

**Neden ayrı dal:** ham görseller 1–2 MB. Çalışma dalına commit edilip
sonra silinseler bile git geçmişinde kalıcı olurlar; 72 görsellik set
~100 MB eder. Ayrı dal, silinince bu yükü de götürüyor.
