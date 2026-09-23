/**
 * Hedef adaylarının sıralaması — eşitlikte BELİRLİ.
 *
 * `onerilenHedef` adayları puana göre sıralıyor ve eşit puanlılarda
 * sıralama kararlı (stable) olduğu için veritabanının satır sırasına
 * düşüyordu. O sıra tanımsız: sorguda `ORDER BY` yok, Postgres satırları
 * sayfadaki fiziksel yerlerine göre döndürüyor ve işçi her turda bölge
 * satırlarını güncelliyor (depo, garnizon yenilenmesi, `lastTickAt`).
 * Taze bir dünyada sayfalar tıka basa dolu olduğundan ilk güncellemeler
 * satırları başka sayfalara taşıyor ve sıra değişiyor.
 *
 * Eşitlik nadir değil: kanonik haritada tür, seviye, gelir ve garnizonu
 * birebir aynı olup ortak bir komşusu olan 97 bölge çifti var. İkisinin
 * arasında doğan oyuncu için iki aday aynı puanı alıyor; oyuncu söylenen
 * askeri eğitirken hedef bir ikizden ötekine atlıyordu. CI'da
 * ilk-hedef-testi tam bunu yakaladı: "Susamlık 74 milis → Sarıova 33 milis"
 * — ikisi de 1. seviye tarla, aynı 28 kişilik garnizon; gereken sayının
 * farklı çıkması yalnız savaş örneklemesinin tohumu bölgeye bağlı olduğu
 * için.
 *
 * Son söz haritadaki kimlik (`mapId`): her dünyada aynı, hiç değişmiyor.
 */
export interface SiralanabilirAday {
  r: { mapId: number };
}

/** Önce büyük puan; eşitse küçük `mapId`. */
export function puanaGore<T extends SiralanabilirAday>(puan: (a: T) => number) {
  return (a: T, b: T): number => puan(b) - puan(a) || a.r.mapId - b.r.mapId;
}
