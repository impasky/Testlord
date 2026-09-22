/**
 * Push gönderimi başarısız olunca ne yapılır — SAF karar.
 *
 * Neden ayrı bir dosya: `push.ts` veritabanına ve `web-push`a bağlı,
 * yani onu yükleyen bir test DATABASE_URL istiyor. Bu karar ise saf bir
 * eşleme ve CI'nın veritabanısız hızlı işinde sınanabilmeli — çünkü
 * yanlış karar vermenin bedeli yüksek:
 *
 *   - Ölü aboneliği SİLMEZSEN, her bildirimde var olmayan bir adrese
 *     istek atmaya devam edersin. Push servisleri bunu kötüye kullanım
 *     sayıyor ve sonu bütün bildirimlerin engellenmesi.
 *   - Geçici bir hatada SİLERSEN, oyuncunun aboneliğini sessizce
 *     kaybedersin ve o bir daha bildirim almaz — üstelik bunu fark
 *     etmesinin bir yolu yoktur, çünkü ekranda hâlâ "açık" yazar.
 *
 * Ayrım standartta net: 404 (adres yok) ve 410 (kalıcı olarak gitti)
 * aboneliğin bittiğini söylüyor. 429 (çok istek), 5xx (servis sorunu) ve
 * durum kodu olmayan hatalar (ağ kesintisi, TLS) GEÇİCİ — bir sonraki
 * bildirimde yeniden denenir.
 */
export type GonderimKarari = 'sil' | 'gunlukle';

export function gonderimKarari(durum?: number): GonderimKarari {
  return durum === 404 || durum === 410 ? 'sil' : 'gunlukle';
}

/**
 * Abonelik adresi kabul edilebilir mi — SSRF'e karşı.
 *
 * Adresi tarayıcı üretiyor ama sunucuya İSTEMCİ gönderiyor, ve sunucu her
 * bildirimde o adrese POST atıyor. Denetimsizken bir oyuncu
 * `http://169.254.169.254/…` (bulut üst verisi) ya da `http://127.0.0.1:5432`
 * gibi iç adresleri abone yapıp sunucumuzu kendi ağımızın içine istek
 * atan bir araca çevirebiliyordu; aboneliğin 404/410'da silinmesi de
 * hangi iç adresin cevap verdiğini söyleyen bir tarama aracı oluyordu.
 *
 * Kural: HTTPS ve bilinen push servislerinden biri. Tarayıcıların hepsi
 * bu dört servisten birini kullanıyor:
 *   Chrome/Android/Opera/Samsung → fcm.googleapis.com
 *   Firefox                      → *.push.services.mozilla.com
 *   Safari                       → *.push.apple.com
 *   Edge (Windows)               → *.notify.windows.com
 * Yeni bir tarayıcı başka bir servis kullanırsa abonelik 400 alır ve
 * burası genişletilir — sessizce iç ağa açılmaktan iyi.
 *
 * `.test` (RFC 2606) yalnız geliştirmede: internette hiçbir zaman
 * çözülmeyen, test için ayrılmış alan adı. e2e testleri teslim olmayan
 * ama biçimi geçerli adreslerle abone oluyor.
 */
const PUSH_SERVISLERI = [
  'fcm.googleapis.com',
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
];

export function pushAdresiGecerli(adres: string, uretim: boolean): boolean {
  let u: URL;
  try {
    u = new URL(adres);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (PUSH_SERVISLERI.some((s) => (s.startsWith('.') ? host.endsWith(s) : host === s))) {
    return true;
  }
  return !uretim && host.endsWith('.test');
}

/**
 * Bir lordun tutabileceği en fazla abonelik (cihaz).
 *
 * Sınırsızken bir oyuncu binlerce abonelik açıp tek bir bildirimi
 * binlerce isteğe çevirebiliyordu — sunucumuzu başkasına yük bindiren
 * bir çoğaltıcıya. On cihaz gerçek bir oyuncuya fazlasıyla yetiyor; yeni
 * cihaz gelince en eskisi düşüyor, oyuncu hiçbir zaman reddedilmiyor.
 */
export const AZAMI_ABONELIK = 10;
