/**
 * Sohbet mesajı denetimi.
 *
 * Ad denetiminden AYRI bir fonksiyon, aynı kelime listesini kullanıyor.
 * Neden ayrı: ad denetimi PARÇA arıyor ("s1k1ş" bir adın içine gizlenmiş
 * olabilir) ve bir cümlede aynı şeyi yapmak masum kelimeleri eler —
 * "sıkışık" normalize edilince "sikisik" oluyor ve içinde yasaklı bir
 * parça barındırıyor. Bir oyuncunun "burası sıkışık" yazamaması, süzgecin
 * kendisinin zararlı olması demekti.
 *
 * Bu yüzden mesajda KELİME sınırı aranıyor: her kelime tek tek normalize
 * edilip tam eşleşme kontrol ediliyor. "s1k1ş" hâlâ yakalanıyor, "sıkışık"
 * geçiyor.
 *
 * Liste tek: iki ayrı liste tutmak ikisinin birbirinden sapması demekti.
 */
import { YASAKLI, normalize } from './adDenetimi.js';

export interface MesajSonucu {
  uygun: boolean;
  sebep?: string;
}

export function mesajDenetle(metin: string): MesajSonucu {
  const t = metin.trim();
  if (t.length === 0) return { uygun: false, sebep: 'Boş mesaj gönderilemez.' };

  // Kelimelere böl: harf/rakam dışındaki her şey sınır.
  for (const parca of t.split(/[^\p{L}\p{N}]+/u)) {
    if (!parca) continue;
    const n = normalize(parca);
    if (n.length === 0) continue;
    if (YASAKLI.includes(n)) {
      return { uygun: false, sebep: 'Mesajın uygunsuz bir kelime içeriyor.' };
    }
  }
  return { uygun: true };
}
