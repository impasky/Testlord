/**
 * Pasif etkinin OKUNUR adı.
 *
 * Ham anahtar ("ordu_saldiri") oyuncuya hiçbir şey söylemiyor. Bu eşleme
 * üç ekranda birden gerekiyordu — savaş raporu, generaller, demirhane —
 * ve üçü de kendi kopyasını taşıyordu. Kopyalar ayrıştı:
 *
 *   · Savaş raporundaki liste generals.json'daki altı anahtarı hiç
 *     tanımıyordu; "yagma" pasifli bir general raporda ham anahtarla
 *     yazıyordu.
 *   · Demirhane eşleme yerine `etki.replace('ordu_', 'Ordu ')` yapıyordu
 *     ve ekranda "Ordu saldiri" görünüyordu — şapkasız, yarı Türkçe.
 *
 * Bu yüzden tek kaynak: veri dosyalarındaki her `etki` anahtarının
 * burada bir karşılığı olduğunu `etki-adi.test.ts` doğruluyor.
 *
 * Adlar KÜÇÜK harfle yazılıyor. Üç kullanım yerinin üçünde de metin bir
 * başlıktan ya da iki noktadan sonra geliyor, yani cümle ortası. Baş
 * harfi çalışma anında büyütmek ise dile bağlı bir tuzak: Türkçede
 * `i → İ`, İngilizcede `i → I`.
 */
export const ETKI_ADI: Record<string, string> = {
  ordu_saldiri: 'ordu saldırısı',
  ordu_savunma: 'ordu savunması',
  ordu_can: 'ordu canı',
  savunmada_ordu_savunma: 'savunmada ordu savunması',
  okcu_saldiri: 'okçu saldırısı',
  mizrakci_savunma: 'mızrakçı savunması',
  kusatma_saldiri: 'mancınık saldırısı',
  lord_savas_katkisi: 'lord savaş katkısı',
  yagma: 'yağma',
  bolge_geliri: 'bölge geliri',
  ordu_bakim_maliyeti: 'ordu bakım maliyeti',
  yuruyus_suresi: 'yürüyüş süresi',
  kayip_geri_donus: 'kayıpların geri dönüşü',
};

/** Bilinmeyen anahtar ham hâliyle dönüyor: eksik ad ekranı boş bırakmasın. */
export function etkiAdi(anahtar: string): string {
  return ETKI_ADI[anahtar] ?? anahtar;
}
