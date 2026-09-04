/**
 * Takviye: bir bölgeyi başkasının askeriyle savunmak.
 *
 * İttifakın en somut faydası bu. Sohbette "yardım et" demek mümkündü,
 * gerçekten yardım etmek değildi.
 *
 * Bu dosyanın tek işi, savaşın en tehlikeli tarafını saf ve test edilebilir
 * tutmak: **kayıpları sahiplerine dağıtmak.** Garnizonda birden çok lordun
 * askeri varsa, savaş toplam bir kayıp veriyor ve o kaybın kime yazılacağı
 * bir bölme işlemi. Yuvarlama yanlış yapılırsa asker YOKTAN VAR OLUR ya da
 * sessizce kaybolur — ikisi de oyuncunun ordusunu çalar ve hiçbir hata
 * mesajı üretmez.
 */
import { UNIT_TYPES } from './types.js';
import type { Army, UnitType } from './types.js';

export interface GarnizonPayi {
  lordId: string;
  ordu: Army;
}

/**
 * Bölgedeki bütün orduları tek orduda toplar — savaşa giren şey bu.
 */
export function garnizonToplami(paylar: GarnizonPayi[]): Army {
  const toplam: Army = {};
  for (const p of paylar) {
    for (const t of UNIT_TYPES) {
      const n = p.ordu[t] ?? 0;
      if (n > 0) toplam[t] = (toplam[t] ?? 0) + n;
    }
  }
  return toplam;
}

/**
 * Toplam kaybı sahiplerine dağıtır.
 *
 * Her birim tipi ayrı hesaplanıyor ve **en büyük kalan** yöntemi
 * kullanılıyor: önce herkes payının tam sayı kısmını alıyor, artan kayıp
 * en büyük kesirli paya sahip olanlara birer birer veriliyor. Böylece
 * dağıtılan toplam, gelen kayba TAM eşit oluyor.
 *
 * Basit yuvarlama (her paya Math.round) bunu yapmaz: üç lordun 1/3'er
 * payı olduğu 10 kayıpta üçü de 3 alır ve 1 asker yoktan hayatta kalır.
 * Ters yönde (Math.floor) ise kayıp eksik dağıtılır ve garnizonda
 * olmayan asker görünür.
 *
 * Kimsenin o tipten askeri yoksa o tipin kaybı düşürülüyor: dağıtacak
 * yer yok demektir ve zorlamak negatif sayı üretirdi.
 */
export function kayipPaylastir(
  kayip: Army,
  paylar: GarnizonPayi[],
): Map<string, Army> {
  const sonuc = new Map<string, Army>();
  for (const p of paylar) sonuc.set(p.lordId, {});

  for (const t of UNIT_TYPES) {
    const toplamKayip = Math.max(0, Math.floor(kayip[t] ?? 0));
    if (toplamKayip === 0) continue;

    const sahipler = paylar
      .map((p) => ({ lordId: p.lordId, adet: p.ordu[t] ?? 0 }))
      .filter((x) => x.adet > 0);
    const toplamAdet = sahipler.reduce((s, x) => s + x.adet, 0);
    if (toplamAdet === 0) continue;

    // Kayıp mevcuttan büyük olamaz: savaş motoru zaten bunu garanti
    // ediyor ama burada da kırpıyoruz — bu fonksiyon savaşın dışından
    // da çağrılabilir ve negatif garnizon üretmesi felaket olurdu.
    const dagitilacak = Math.min(toplamKayip, toplamAdet);

    const ham = sahipler.map((x) => ({
      lordId: x.lordId,
      adet: x.adet,
      tam: Math.floor((dagitilacak * x.adet) / toplamAdet),
      kesir: ((dagitilacak * x.adet) % toplamAdet) / toplamAdet,
    }));

    let verilen = ham.reduce((s, x) => s + x.tam, 0);
    // Artanı en büyük kesirden başlayarak dağıt. Eşitlikte lordId'ye
    // göre sıralıyoruz: aynı girdi her zaman aynı sonucu vermeli, yoksa
    // savaş yeniden oynatıldığında farklı çıkar.
    const sira = [...ham].sort((a, b) => b.kesir - a.kesir || a.lordId.localeCompare(b.lordId));
    let i = 0;
    while (verilen < dagitilacak && sira.length > 0) {
      const aday = sira[i % sira.length]!;
      // Kimseye sahip olduğundan fazlasını yazma.
      if (aday.tam < aday.adet) {
        aday.tam += 1;
        verilen += 1;
      }
      i++;
      // Herkes doluysa çık: dagitilacak <= toplamAdet olduğu için
      // buraya normalde hiç gelinmiyor, ama sonsuz döngü riski
      // bırakmak istemedik.
      if (i > sira.length * 2 && sira.every((x) => x.tam >= x.adet)) break;
    }

    for (const x of ham) {
      if (x.tam <= 0) continue;
      const mevcut = sonuc.get(x.lordId) ?? {};
      mevcut[t as UnitType] = (mevcut[t as UnitType] ?? 0) + x.tam;
      sonuc.set(x.lordId, mevcut);
    }
  }

  return sonuc;
}

/** Bir ordudan kaybı düşer; negatife inmez. */
export function orduDus(ordu: Army, kayip: Army): Army {
  const kalan: Army = {};
  for (const t of UNIT_TYPES) {
    const n = (ordu[t] ?? 0) - (kayip[t] ?? 0);
    if (n > 0) kalan[t] = n;
  }
  return kalan;
}
