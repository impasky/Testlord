/**
 * AYNI ANDA gelen okumaları TEK işe indirmek.
 *
 * Ekran açılınca istemci aynı lord için 7-9 isteği birden yolluyor (`/me`,
 * `/sehir`, `/map`, `/army`, …). Her biri aynı önsözü koşuyordu: lordu bul,
 * vadesi gelenleri kapat (services/gecikmis.ts), lordu kilitleyip tick'le.
 * Şehir ekranı ~100 sorgu ediyordu, yarısı bu tekrardı; tick'ler de lord
 * satırının kilidinde birbirini sırayla bekliyordu. 0,1 CPU'lu ücretsiz
 * sunucuda her sorgu ~10 ms CPU — istekler 1-2 saniye sürüyordu.
 *
 * Burada aynı anahtarla HÂLÂ SÜREN bir iş varsa yenisi açılmıyor, sonucu
 * paylaşılıyor. Biten iş saklanmıyor: önbellek değil, yalnız uçuştaki işe
 * katılmak.
 *
 * ── Yazma sınırı ──────────────────────────────────────────────────────
 *
 * Katılan istek, uçuştaki işin BAŞLADIĞI andaki durumu görüyor. Bu ancak
 * arada hiçbir yazma isteği başlamadıysa ya da bitmediyse doğru: oyuncu
 * "eğit"e basıp cevabını aldıktan sonra gelen `/army`, eğitimden önce
 * başlamış bir tick'in eski sonucunu almamalı. Her yazma isteği (GET/HEAD
 * dışı) başlarken ve cevabı giderken `yazmaSiniri()` nesli artırıyor;
 * katılmak yalnız nesil aynıysa. Ölçü bilerek kaba (kimin yazdığına
 * bakmıyor): az oyunculu sunucuda neredeyse her ekran açılışı paylaşılıyor,
 * kalabalıkta paylaşım azalıyor ama yanlış sonuç hiç çıkmıyor.
 *
 * Worker'ın yazmaları sınır sayılmıyor: onlar oyuncunun isteğine bağlı
 * değil ve uçuştaki işe katılmak, isteği birkaç milisaniye önce atmışız
 * gibi okumak demek.
 */

let nesil = 0;
const ucusta = new Map<string, { nesil: number; is: Promise<unknown> }>();

/** Bir yazma isteği başladı ya da cevabı gidiyor. */
export function yazmaSiniri(): void {
  nesil++;
}

export function tekUcus<T>(anahtar: string, is: () => Promise<T>): Promise<T> {
  const suren = ucusta.get(anahtar);
  if (suren && suren.nesil === nesil) return suren.is as Promise<T>;
  const p = is();
  const kayit = { nesil, is: p };
  ucusta.set(anahtar, kayit);
  const birak = () => {
    if (ucusta.get(anahtar) === kayit) ucusta.delete(anahtar);
  };
  p.then(birak, birak);
  return p;
}

/** Testler için: uçuştaki iş sayısı. */
export function ucustakiSayisi(): number {
  return ucusta.size;
}
