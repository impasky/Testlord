/**
 * React kökünün "animationiteration" dinleyicisini kesiyor: Şehir'deki
 * kasmanın asıl kaynağı buydu (docs/24 "Hareket").
 *
 * React kökü, kullanılsın kullanılmasın HER DOM olayını dinliyor. Sayfada
 * tek bir "animationiteration" dinleyicisi olunca Chromium (Android
 * WebView'u da) sonsuz dönen her CSS animasyonunun her tur sınırında ana
 * iş parçacığını uyandırıyor ve canlı öğelerin stilini yeniden hesaplıyor,
 * animasyon bileşikleyicide (GPU'da) koşsa bile. Şehir sahnesinde ~60
 * canlı parça (bayrak, ağaç, asker, duman, su, ışık) ayrı ritimde dönüyor:
 * her kare böyle bir kareye dönüyordu. Ölçüm (telefon taklidi, 6× yavaş
 * CPU, boşta): ana iş parçacığı saniyede 441 ms → 39 ms, stil hesabı
 * saniyede 40 → 2.
 *
 * Oyunda `onAnimationIteration` YOK; olursa çalışmaz, bu yüzden burada
 * duruyor. Portal (`createPortal`) da yok: React onun kabını da dinlerdi.
 */
export function turOlayiniKes(kok: EventTarget): void {
  const ekle = kok.addEventListener.bind(kok);
  kok.addEventListener = (tur, dinleyici, secenek) => {
    if (tur !== 'animationiteration') ekle(tur, dinleyici, secenek);
  };
}
