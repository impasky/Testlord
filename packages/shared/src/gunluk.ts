/**
 * Günlük görevler ve giriş serisi.
 *
 * Omurga (docs/08 İ4) "şimdi ne yapmalısın" sorusuna cevap veriyor. Bu
 * dosya farklı bir soruya bakıyor: **oyuncu neden YARIN geri gelsin?**
 * Türün en ucuz ve en etkili aracı bu (docs/09 §2.5).
 *
 * Görev ilerlemesi TÜRETİLİYOR: saldırı `Battle`, eğitim ve üretim
 * `Queue` kayıtlarında zaten duruyor (kuyruklar çözüldükten sonra
 * silinmiyor, `resolved` işaretleniyor). Yeni sayaç tutmak, o sayaçla
 * gerçeğin birbirinden sapması demekti.
 *
 * Seri ise türetilemiyor: tek bir `lastSeenAt` damgası "kaç gün üst üste"
 * sorusunu cevaplayamaz, çünkü o bir geçmiş. O yüzden iki kolonu var.
 */

/** Bir günlük görev ve o günkü ilerlemesi. */
export interface GunlukGorev {
  key: string;
  ad: string;
  aciklama: string;
  hedef: number;
  simdi: number;
  tamam: boolean;
}

export interface GunlukSayaclar {
  /** Bugün gönderilen saldırı sayısı. */
  saldiri: number;
  /** Bugün başlatılan asker eğitimi sayısı. */
  egitim: number;
  /** Bugün başlatılan üretim/geliştirme sayısı (craft + upgrade_*). */
  imar: number;
}

/**
 * Üç görev, sabit.
 *
 * Rastgele görev üretmedik. Sebep: rastgelelik "bugün şanssızım" hissi
 * yaratıyor ve oyuncunun planlamasını bozuyor. Üç sabit iş oyunun üç
 * ekseni — savaş, ordu, imar — ve her gün aynı olması bir alışkanlık
 * kuruyor.
 */
export function gunlukGorevler(s: GunlukSayaclar): GunlukGorev[] {
  const yap = (
    key: string,
    ad: string,
    aciklama: string,
    simdi: number,
    hedef: number,
  ): GunlukGorev => ({ key, ad, aciklama, hedef, simdi, tamam: simdi >= hedef });

  return [
    yap('saldiri', 'Bir akın', 'Bir bölgeye saldırı gönder', s.saldiri, 1),
    yap('egitim', 'Ordunu büyüt', 'Asker eğitimi başlat', s.egitim, 1),
    yap('imar', 'Diyarını imar et', 'Ekipman üret ya da bölge geliştir', s.imar, 1),
  ];
}

/** Kaç görev tamamlandı. */
export function gunlukSayaci(gorevler: GunlukGorev[]): { tamam: number; toplam: number } {
  return { tamam: gorevler.filter((g) => g.tamam).length, toplam: gorevler.length };
}

/**
 * Bir tarihin "gün numarası" — UTC gününe göre.
 *
 * Yerel saat dilimi kullanılmıyor: oyuncu seyahat ederse serisi kopardı ya
 * da bedava bir gün kazanırdı. Sunucu tek otorite olduğu için UTC tek
 * tutarlı ölçü. Karşılığı: bazı oyuncular için gün ortasında değişiyor,
 * ama tutarsız bir seri sayacından iyi.
 */
export function gunNumarasi(t: Date): number {
  return Math.floor(t.getTime() / 86_400_000);
}

export interface SeriSonucu {
  seri: number;
  /** Bugün ilk giriş mi — arayüz "seri +1" göstersin diye. */
  bugunIlk: boolean;
}

/**
 * Giriş serisini günceller.
 *
 * - Aynı gün ikinci giriş: hiçbir şey değişmez.
 * - Dün girmişse: seri +1.
 * - Daha eski ya da hiç: seri 1'e döner.
 *
 * Saf fonksiyon: sunucu bunu çağırıp sonucu yazıyor. Kural burada
 * durduğu için testle sabitlenebiliyor — tarih aritmetiği elle yazıldığı
 * her yerde sessizce yanlış oluyor.
 */
export function seriGuncelle(mevcutSeri: number, sonGiris: Date | null, simdi: Date): SeriSonucu {
  const bugun = gunNumarasi(simdi);
  if (sonGiris === null) return { seri: 1, bugunIlk: true };

  const son = gunNumarasi(sonGiris);
  if (son === bugun) return { seri: Math.max(1, mevcutSeri), bugunIlk: false };
  if (son === bugun - 1) return { seri: Math.max(1, mevcutSeri) + 1, bugunIlk: true };
  return { seri: 1, bugunIlk: true };
}
