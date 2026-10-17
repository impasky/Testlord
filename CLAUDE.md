# Claude için çalışma notları

## Dosya bulmak: önce HARITA.md

- Bir dosyayı, fonksiyonu, bileşeni, API ucunu ya da ortam değişkenini
  ararken ÖNCE `HARITA.md`de ara (Grep'i yalnız o dosyada koştur). Depoda
  dosya dosya tarama yapma: harita her dosyanın ne yaptığını, dışa açtığı
  adları, API uçlarını ve sunucu ayarlarını tek satırda veriyor.
- Konudan başlıyorsan (ör. "e-posta doğrulama", "mağaza", "rehber ışığı")
  `HARITA.md` → **Konu dizini**.
- Haritada yoksa (iç, dışa açılmayan bir fonksiyon; bir metin parçası) ancak
  o zaman depoda ara — aramayı haritanın gösterdiği klasörle sınırla.
- Dosya ekleyince, silince, taşıyınca ya da dışa açılan bir adı değiştirince
  `pnpm harita` ile yeniden üret ve aynı commit'e kat. CI (`denetim.yml` →
  "Proje haritası güncel mi") eski haritayı reddeder.
- Yeni dosyanın ilk satırına ne yaptığını söyleyen bir yorum yaz: harita
  açıklamayı oradan alıyor. Konu dizini elle tutuluyor: `tools/harita.mjs`
  → `KONULAR` (yollar denetleniyor).
