/**
 * Kimlik: arma ve unvan.
 *
 * docs/10'un iki bulgusu burada buluşuyor. Ortaçağ oyunlarında en çok
 * sevilen şey **kimlik**: arma ortaçağın kimlik teknolojisiydi, unvan da
 * oyuncunun kendini tarif etme biçimi.
 *
 * Neden şimdi: sezonu kapattık (docs/09 §2.2), yani oyuncu aynı lordla
 * yıllarca oynayacak. Kalıcı bir dünyada "ben kimim" sorusunun görsel bir
 * cevabı olmalı ve şöhret sayısı o cevabı vermiyor.
 *
 * İkisi de `balance.json`'a hiç dokunmuyor: saf görünüş.
 */
import { ARMA, UNVANLAR } from './balance.js';

/** Bir armanın tanımı — beş küçük sayı/anahtar. */
export interface Arma {
  kalkan: string;
  desen: string;
  renk1: string;
  renk2: string;
  sembol: string;
}

export function varsayilanArma(): Arma {
  return { kalkan: 'sivri', desen: 'duz', renk1: 'kirmizi', renk2: 'altin', sembol: 'yok' };
}

function gecerliMi(liste: { key: string }[], key: string): boolean {
  return liste.some((x) => x.key === key);
}

/**
 * Gelen armayı doğrular; geçersiz parçaları varsayılanla değiştirir.
 *
 * Reddetmek yerine DÜZELTİYOR: arma bir kimlik, hata mesajı verilecek bir
 * form değil. Eski bir kayıtta artık var olmayan bir sembol kalmışsa
 * oyuncunun arması bozuk görünmemeli, sadece o parçası varsayılana
 * dönmeli.
 */
export function armaDuzelt(giren: Partial<Arma> | null | undefined): Arma {
  const v = varsayilanArma();
  if (!giren) return v;
  return {
    kalkan: gecerliMi(ARMA.kalkanlar, giren.kalkan ?? '') ? giren.kalkan! : v.kalkan,
    desen: gecerliMi(ARMA.desenler, giren.desen ?? '') ? giren.desen! : v.desen,
    renk1: gecerliMi(ARMA.renkler, giren.renk1 ?? '') ? giren.renk1! : v.renk1,
    renk2: gecerliMi(ARMA.renkler, giren.renk2 ?? '') ? giren.renk2! : v.renk2,
    sembol: gecerliMi(ARMA.semboller, giren.sembol ?? '') ? giren.sembol! : v.sembol,
  };
}

/** Bir renk anahtarının gerçek rengi. */
export function armaRengi(key: string): string {
  return ARMA.renkler.find((r) => r.key === key)?.kod ?? '#a8342a';
}

/**
 * Lord adından kararlı bir arma üretir.
 *
 * Yeni oyuncunun arması boş kalmasın diye: herkesin aynı kırmızı kalkanla
 * başlaması, armanın kimlik olma özelliğini daha ilk günden yok ederdi.
 * Addan türetiliyor, yani aynı ad her zaman aynı armayı veriyor ve
 * kayıt sırasında saklanacak bir şey yok.
 */
export function addanArma(ad: string): Arma {
  let h = 2166136261;
  for (let i = 0; i < ad.length; i++) {
    h ^= ad.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const sec = <T>(liste: T[], kaydir: number): T =>
    liste[Math.floor((h / Math.pow(2, kaydir)) % liste.length)]!;

  const renk1 = sec(ARMA.renkler, 6).key;
  // İkinci renk birincisinden farklı olmalı: aynı iki renk deseni
  // görünmez yapar ve arma düz bir lekeye döner.
  const digerler = ARMA.renkler.filter((r) => r.key !== renk1);
  return {
    kalkan: sec(ARMA.kalkanlar, 0).key,
    desen: sec(ARMA.desenler, 3).key,
    renk1,
    renk2: sec(digerler, 12).key,
    sembol: sec(ARMA.semboller, 18).key,
  };
}

export interface Unvan {
  ad: string;
  aciklama: string;
  /** Bir sonraki kademeye kaç şöhret kaldı; en üstteyse null. */
  sonrakiEsik: number | null;
  sonrakiAd: string | null;
}

/**
 * Şöhretten unvan.
 *
 * Taht sahibi olan herkesin unvanını "Diyarın Lordu" eziyor — taht zaten
 * oyunun tepesi ve orada iki farklı unvan görmek anlamsız olurdu.
 */
export function unvan(sohret: number, tahtSahibi = false): Unvan {
  if (tahtSahibi) {
    return {
      ad: UNVANLAR.taht_unvani,
      aciklama: 'Taht senin. Diyar seni tanıyor.',
      sonrakiEsik: null,
      sonrakiAd: null,
    };
  }
  const k = UNVANLAR.kademeler;
  let i = 0;
  for (let n = 0; n < k.length; n++) if (sohret >= k[n]!.esik) i = n;
  const sonraki = k[i + 1] ?? null;
  return {
    ad: k[i]!.ad,
    aciklama: k[i]!.aciklama,
    sonrakiEsik: sonraki ? sonraki.esik : null,
    sonrakiAd: sonraki ? sonraki.ad : null,
  };
}
