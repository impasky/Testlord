# 10 — Ortaçağ Oyunlarında En Sevilen Şeyler

Bu doküman bir soruya cevap veriyor: **ortaçağ temalı oyunlarda oyuncuların
en çok sevdiği şey ne ve bizde hangisi yok?**

`docs/09` türün *sistemlerine* bakıyordu (ittifak, sezon, günlük görev).
Burası **temaya** bakıyor: aynı mekanikler uzay gemisiyle de kurulabilirdi,
oyuncuyu ortaçağa bağlayan şey ne?

---

## 1. Bulgular

Araştırmada tekrar tekrar öne çıkan beş şey:

### 1.1 Heraldik — arma, sancak, renk

En çok tekrar eden tema bu. Ortaçağ oyunlarının etrafında **arma üreticileri**
ayrı bir ekosistem kurmuş; oyuncular kendi armasını yapmak için oyunun
dışına çıkıyor. Kale bayrağını renk ve sembolle özelleştirmek başlı başına
bir oynanış ögesi sayılıyor.

**Neden bu kadar sevildiği belli:** arma, ortaçağın **kimlik** teknolojisidir.
Bir savaş alanında kim olduğunu söyleyen şeydi ve oyunda da aynı işi görüyor —
"bu benim" demenin tek görsel yolu.

**Bizde durum:** yok. Oyuncunun tek görsel kimliği adı. `sancak` diye bir
ekipman slotu var ama o bir güç kalemi, bir kimlik değil; herkesin sancağı
aynı görünüyor.

### 1.2 Unvan ve soyluluk kademesi

Travian Kingdoms'ın en çok konuşulan yanı rol sistemi: **Vali → Dük →
Vekil Kral → Kral**. Oyuncular "hangi rolü oynamayı seviyorsun" diye
birbirine soruyor. Rol, oyuncunun kendini tarif etme biçimi oluyor.

**Bizde durum:** kısmen. Taht sahibi "Diyarın Lordu" unvanını alıyor —
ama o **tek kişi**. Geri kalan herkes sadece "lord". Aradaki 119 oyuncu
için unvan diye bir şey yok.

### 1.3 Kuşatma

Kale kuşatmak ortaçağ oyunlarının imzası: kuşatma makinesi, duvar, surların
altında bekleyen ordu.

**Bizde durum:** var ama görünmez. Mancınık kale savunmasına ×2, tahkimat
bonusu %30'a kadar çıkıyor — mekanik tam. Eksik olan **an**: kuşatma bir
savaş türü değil, sadece bir çarpan.

### 1.4 Kale inşası ve özelleştirme

Oyuncular kalelerini kurmayı, büyütmeyi, kendine benzetmeyi seviyor.

**Bizde durum:** bölge geliştirme var (seviye 1→5, her seviyede yeni ad ve
görsel). "Kaleni kur" hissi yok ama "diyarını büyüt" hissi var. Modüler kale
inşası bu oyunun ölçeğine uymuyor — mobil, bekleme tabanlı bir oyunda
duvar duvar kale dizmek başka bir oyun olurdu.

### 1.5 Topluluk ve diplomasi

Uzun ömürlü ortaçağ oyunlarının hepsinde aynı cevap: **oyuncuyu tutan şey
diğer oyuncular.**

**Bizde durum:** yapıldı (docs/01 §7d — ittifak, sohbet, ortak hedef,
takviye).

---

## 2. Ne yapıyoruz

| Bulgu | Bizde | Karar |
|---|---|---|
| Heraldik / arma | **yok** | **YAPILIYOR** — oyuncunun kendi arması, her yerde görünür |
| Unvan kademesi | tek kişilik | **YAPILIYOR** — şöhretten türeyen unvanlar |
| Kuşatma | mekanik var, an yok | Savaş raporu kuşatmayı ayrıca anlatıyor (K2); yeni sistem gerekmiyor |
| Kale inşası | bölge geliştirme var | Bu ölçeğe uymuyor; genişletmiyoruz |
| Topluluk | yapıldı | — |

### 2.1 Arma (heraldik)

Oyuncu kendi armasını seçiyor: **kalkan biçimi + zemin deseni + iki renk +
sembol**. Kombinasyon sayısı binlerle ölçülüyor ama içerik maliyeti sıfır —
hepsi SVG, hepsi kodda çizilen biçimler.

Arma **her yerde** görünüyor: lord adının yanında, sıralamada, ittifak üye
listesinde, savaş raporunda, haritada sahip olunan bölgede.

Kurallar:
- Arma **hiçbir sayıya dokunmaz.** Saf görünüş (docs/09 §5 kural 1).
- **Bedava.** Kimlik satılmaz; kimliğin parayla alınması, parası olmayanın
  kimliksiz kalması demektir.
- İstendiği zaman değiştirilebilir. Ortaçağda arma kalıcıydı ama oyunda
  değiştirememek bir ceza olurdu.

### 2.2 Unvan

Unvan **şöhretten türetiliyor** — yeni bir tablo, yeni bir sayaç yok. Şöhret
zaten oyunun tek "sen ne kadar büyüksün" ölçüsü ve zaten sıralamanın da
ölçüsü; ikinci bir ölçü icat etmek iki ayrı büyüklük fikri yaratırdı.

Kademeler `data/unvanlar.json` içinde. Taht sahibi olan herkesin unvanını
**Diyarın Lordu** eziyor: taht zaten oyunun tepesi ve orada iki farklı unvan
görünmesi anlamsız olurdu.

---

## 3. Neden bu ikisi

Üçü de aynı sebeple: **kalıcı dünyada kimlik, ilerlemeden daha uzun yaşar.**

Sezonu kapattık (docs/09 §2.2), yani oyuncu aynı lordla yıllarca oynayacak.
Yıllarca oynanan bir oyunda "ben kimim" sorusunun görsel bir cevabı olmalı;
şöhret sayısı o cevabı vermiyor. Arma ve unvan bunu veriyor, üstelik
`balance.json`'a hiç dokunmadan.
