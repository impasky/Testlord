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
