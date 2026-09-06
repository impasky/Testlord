/**
 * İpuçları — diyar ekranında dönen kısa bilgiler.
 *
 * Oyuncu Malikâne'nin ne olacağını tarif etti: "sahip olduğumuz arazi
 * yönetimleri, ipuçları gibi içerikleri barındıran bir alan". Topraklar
 * ekranın kendisi; bu dosya da ipuçları.
 *
 * ── İki kural ─────────────────────────────────────────────────────────
 *
 * 1. Sayı geçen her ipucu sayıyı DENGEDEN alıyor. Elle yazılmış bir sayı
 *    denge dosyası değişince sessizce yalana dönerdi ve oyuncunun oyuna
 *    olan güvenini bozan tam olarak budur.
 *
 * 2. İpucu bir şey ÖĞRETİR, reklam yapmaz. "Generaller güçlüdür" değil,
 *    "general ordunun tamamını birden çarpar" — oyuncunun kararını
 *    değiştiren bilgi.
 */
import { B } from './balance.js';

export interface Ipucu {
  /** Kısa başlık. */
  baslik: string;
  /** Tek cümle. */
  metin: string;
}

export function ipuclari(): Ipucu[] {
  const kalkanSaat = B.korumalar.yeni_oyuncu_saat;
  const fetihKalkan = B.korumalar.bolge_ele_gecirme_sonrasi_saat;
  const gunlukSaldiri = B.korumalar.gunluk_saldiri_limiti;
  const firar = Math.round(B.erzak_acligi.saatlik_firar_orani * 100);

  return [
    {
      baslik: 'Sayı değil, eşleşme kazandırır',
      metin:
        'Mızrakçı süvariyi, süvari okçuyu, okçu mızrakçıyı yer. Karşıdakinin ne tuttuğunu ' +
        'bilmek, iki katı asker toplamaktan ucuza gelir.',
    },
    {
      baslik: 'Erzak eksiye düşerse ordu dağılır',
      metin: `Aç ordu saatte %${firar} firar verir. Tarla bölgesi almak, asker eğitmekten önce gelir.`,
    },
    {
      baslik: 'Yeni bölge bir süre dokunulmaz',
      metin: `Ele geçirilen bölge ${fetihKalkan} saat kalkan altında kalır — hem seninki hem düşmanınki.`,
    },
    {
      baslik: 'Garnizon bölgeyi tek başına savunur',
      metin:
        'Evdeki ordu bölgeni korumaz. Aldığın toprağa asker bırakmazsan ilk gelen geri alır.',
    },
    {
      baslik: 'Günlük saldırı hakkın sınırlı',
      metin: `Günde ${gunlukSaldiri} saldırı yapabilirsin; Taht Kalesi bu limitten muaf. Hedefini seçerek harca.`,
    },
    {
      baslik: 'General ordunun tamamını çarpar',
      metin:
        'Bir ekipman parçası yalnız lorda etki eder; general bütün orduya. Yuvan varsa boş bırakma.',
    },
    {
      baslik: 'Yeni lordlar korumalı',
      metin: `İlk ${kalkanSaat} saat kimse sana saldıramaz. O süre kurulmak için — sonrası için hazırlan.`,
    },
    {
      baslik: 'Bölge seviyesi geliri büyütür',
      metin:
        'Yeni bölge almak tek yol değil: elindekini yükseltmek de saatlik geliri artırır ve kimse onu senden alamaz.',
    },
  ];
}

/**
 * Sıradaki ipucu.
 *
 * Rastgele değil SIRAYLA: rastgele seçim aynı ipucunu üst üste
 * gösterebiliyor ve oyuncu "hep aynı şey yazıyor" diyor. Sıra, açılış
 * sayısından türüyor — saklanacak bir şey yok.
 */
export function ipucuSec(sayac: number): Ipucu {
  const liste = ipuclari();
  const i = ((sayac % liste.length) + liste.length) % liste.length;
  return liste[i]!;
}
