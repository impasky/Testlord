/**
 * Hesap başına giriş freni — parola tahminine karşı.
 *
 * Giriş ucunun tek freni IP başınaydı (dakikada 60). Bu, tek bir hesaba
 * tek bir makineden günde seksen bin tahmin demek; IP değiştirmek de
 * ucuz. Fren ADRESE bağlı olunca kaç makineden gelindiği fark etmiyor.
 *
 * Kural: pencere içinde `HATA_TAVANI` hatalı denemeden sonra o adrese
 * giriş, pencere dolana kadar kapalı — doğru parolayla bile. Açık
 * bıraksaydık saldırgan denemeye devam eder, doğruyu bulduğu an girerdi.
 * Kilitlenen gerçek oyuncunun yolu kapalı değil: parola sıfırlama bu
 * frenden etkilenmiyor.
 *
 * Kayıtlı OLMAYAN adres de aynı sayılıyor: yalnız kayıtlıları saysaydık
 * "kilitlendi" cevabı adresin kayıtlı olduğunu söylerdi.
 *
 * Sayaç BELLEKTE. Tek servisli dağıtımda (docs/05) bu yeterli; birden
 * çok sunucuya bölünürse her biri kendi sayacını tutar ve tavan sunucu
 * sayısıyla çarpılır — o gün sayaç veritabanına taşınmalı.
 */
export const HATA_TAVANI = 10;
export const PENCERE_MS = 15 * 60_000;
/** Bu kadar kayıt birikince süresi geçenler temizleniyor: bellek sınırsız büyümesin. */
const TEMIZLIK_ESIGI = 10_000;

interface Kayit {
  sayi: number;
  baslangic: number;
}

export function girisFreniKur() {
  const kayitlar = new Map<string, Kayit>();

  function canli(anahtar: string, simdi: number): Kayit | undefined {
    const k = kayitlar.get(anahtar);
    if (k && simdi - k.baslangic >= PENCERE_MS) {
      kayitlar.delete(anahtar);
      return undefined;
    }
    return k;
  }

  return {
    /** Adres kilitli mi; kilitliyse kaç dakika kaldı. */
    durum(anahtar: string, simdi = Date.now()): { kilitli: boolean; kalanDk: number } {
      const k = canli(anahtar, simdi);
      if (!k || k.sayi < HATA_TAVANI) return { kilitli: false, kalanDk: 0 };
      return {
        kilitli: true,
        kalanDk: Math.max(1, Math.ceil((k.baslangic + PENCERE_MS - simdi) / 60_000)),
      };
    },
    hata(anahtar: string, simdi = Date.now()): void {
      if (kayitlar.size >= TEMIZLIK_ESIGI) {
        for (const [a, k] of kayitlar) if (simdi - k.baslangic >= PENCERE_MS) kayitlar.delete(a);
      }
      const k = canli(anahtar, simdi);
      if (k) k.sayi++;
      else kayitlar.set(anahtar, { sayi: 1, baslangic: simdi });
    },
    /** Başarılı giriş sayacı sıfırlıyor: ara sıra parolasını şaşıran oyuncu birikmesin. */
    temizle(anahtar: string): void {
      kayitlar.delete(anahtar);
    },
  };
}

export const girisFreni = girisFreniKur();
