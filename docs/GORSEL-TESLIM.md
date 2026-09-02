# Görsel teslim yolu

Sohbete eklenen görseller bazen Claude'a **dosya olarak ulaşmıyor**:
görüntü görünüyor ama diske yazılmıyor, dolayısıyla işlenemiyor. Üç turda
üst üste yaşandı (5 kılıç, 1 kılıç, 5 kılıç) ve aynı sohbette altı ekran
zemini sorunsuz inmişti — yani ne dosya türüyle ne boyutla ilgili, sohbet
yüklemesinin kendisi kararsız.

Kalan ~60 görsel için sohbete güvenmek yerine depo üzerinden teslim:

## Yol: geçici bir dala yükle

1. GitHub'da depoya git, **yeni bir dal** aç: `gorsel-gelen`
2. `gelen/` klasörüne görselleri sürükle-bırak
   (Add file → Upload files). Dosya adları serbest.
3. Hangi görselin hangi ekipman olduğunu commit mesajına ya da sohbete yaz
   (ör. "sırayla t1, t5, t4, t3, t2").

Sonrası Claude'da:

```bash
git fetch origin gorsel-gelen
git checkout origin/gorsel-gelen -- gelen/
python3 tools/gorsel-koy.py ekipman silah_t1=gelen/a.png silah_t2=gelen/b.png ...
rm -rf gelen/
```

İşlenen WebP'ler çalışma dalına giriyor; ham dosyalar hiçbir zaman oraya
girmiyor. `gorsel-gelen` dalı iş bitince silinebilir — ham görsellerin
geçmişi onunla birlikte gider, çalışma dalı şişmez.

**Neden ayrı dal:** ham görseller 1–2 MB. Çalışma dalına commit edilip
sonra silinseler bile git geçmişinde kalıcı olurlar; 72 görsellik set
~100 MB eder. Ayrı dal, silinince bu yükü de götürüyor.
