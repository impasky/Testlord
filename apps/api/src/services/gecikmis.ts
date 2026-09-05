/**
 * Vadesi gelmiş işleri okuma anında kapatan tek kapı.
 *
 * Worker her 10 saniyede bir dönüyor ama tek servisli dağıtımda (Render
 * ücretsiz katmanı) API uykuya dalınca o da uyuyor ve biten kuyruğu kimse
 * çözmüyor. Bir oyuncu ekran görüntüsüyle yakaladı: "EĞİTİMDE 27 — bitti"
 * yazıyor ama "Evde 0", "0/90 komuta".
 *
 * ── Neden ÜÇ uçta birden ──────────────────────────────────────────────
 *
 * Önce yalnız `/me`'ye koymuştum ve hata yarısı kadar sürdü: istemci
 * kuyruğun bitişinde `/me` ile `/army`'yi AYNI ANDA tazeliyor, `/army`
 * önce varınca çözülmemiş hâli okuyup sıfır dönüyordu — ve bir daha
 * sorulmadığı için ekran "0/90 komuta"da donuyordu. Yarış istemci
 * tarafında sıralama yaparak da kapatılabilirdi ama o, doğruluğu çağırma
 * sırasına bağlamak olurdu: sayfayı yenileyen oyuncuda iki istek yine
 * aynı anda çıkıyor.
 *
 * Bu yüzden kural uçta: "şu an neyim var" sorusuna cevap veren her uç
 * önce gecikmiş işleri kapatıyor. Dördü de gerekli ve dördü de tek tek
 * ölçülerek eklendi:
 *
 *   /me       lordun durumu — kuyruk listesi, komuta yeri
 *   /army     ordu raporu   — "Evde N"
 *   /marches  yürüyüşler    — "ordun yolda" donmasın
 *   /map      ÖNERİ         — ordu üzerinden hesaplanıyor
 *
 * Sonuncusu en sinsisiydi: askerler orduya katılmışken öneri hâlâ eski
 * orduyla hesaplanınca "ordun yetmiyor" diyor, omurga oyuncuyu az önce
 * yaptığı işe geri yolluyor ve altın harcandığı için düğme kapalı
 * oluyordu.
 *
 * ── Neden global bir kanca değil ──────────────────────────────────────
 *
 * Her isteğe takılan bir kanca da düşünüldü. Bu dördü ilk oturumun
 * tamamını ve "şu an neyim var" sorularının hemen hepsini kapsıyor;
 * geri kalan uçlar (bölge detayı gibi) worker'a ve bu dördünün
 * tazelemesine güveniyor. Yeni bir uç bu soruya cevap veriyorsa listeye
 * girmeli — kural bu.
 *
 * İş idempotent (`resolved` koşullu updateMany), lorda özel ve sayıca
 * sınırlı.
 */
import { gecikmisYuruyusleriCoz } from './march.js';
import { gecikmisIsleriCoz } from './queue.js';

export async function gecikmisleriKapat(lordId: string, now = new Date()): Promise<void> {
  await Promise.all([gecikmisIsleriCoz(lordId, now), gecikmisYuruyusleriCoz(lordId, now)]);
}
