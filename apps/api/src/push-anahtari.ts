/**
 * VAPID anahtar çifti üretir — push bildiriminin tek kurulum adımı.
 *
 * Dış bir servise kaydolmak gerekmiyor: VAPID, tarayıcının push
 * sunucusuna "bu bildirimi gönderen benim" demenin standart yolu ve
 * anahtarı sen üretiyorsun.
 *
 * ÇIKTIYI KOPYALA, DOSYAYA YAZDIRMA. Gizli anahtar ortam değişkeni
 * olarak duruyor; depoya girmesi, onu üreten tek koruma katmanını
 * ortadan kaldırır.
 *
 *   pnpm push-anahtari
 *
 * Sonra iki satırı sunucunun ortamına ekle:
 *   VAPID_ACIK_ANAHTAR=...
 *   VAPID_GIZLI_ANAHTAR=...
 *
 * Anahtarı DEĞİŞTİRMEK bütün abonelikleri geçersiz kılar: oyuncular
 * bildirim iznini yeniden vermek zorunda kalır. Bir kez üret, sakla.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nVAPID anahtar çifti üretildi. Sunucunun ortamına ekle:\n');
console.log(`VAPID_ACIK_ANAHTAR=${publicKey}`);
console.log(`VAPID_GIZLI_ANAHTAR=${privateKey}`);
console.log(
  '\nGizli anahtarı depoya yazma. Anahtarı değiştirmek bütün abonelikleri\n' +
    'geçersiz kılar — oyuncular izni yeniden vermek zorunda kalır.\n',
);
