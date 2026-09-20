/**
 * LİSTE BİRLEŞTİRME — "altın ve demir", "a, b ve c".
 *
 * `join(' ve ')` göründüğü kadar masum değil: ayraç ayrı bir dizge
 * olarak çeviri listesine düşüyor ve tek başına çevrilemiyor. " ve "
 * satırını gören çevirmen onu hangi cümlenin ortasında durduğunu
 * bilmeden çeviremez; `parcaMi()` de bu yüzden onu listeye hiç
 * koymuyordu. Sonuç: oyun İngilizceyken "gold ve iron" yazıyordu.
 *
 * Buradaki şablon `{0} ve {1}` olarak çeviriye giriyor ve İngilizcede
 * `{0} and {1}` oluyor. Ayraç değil CÜMLE çevriliyor.
 *
 * Üç ve daha fazlası için baştakiler virgülle bağlanıyor; virgül her
 * iki dilde de aynı.
 */
export function veListesi(parcalar: readonly (string | number)[]): string {
  const p = parcalar.map(String).filter((s) => s.length > 0);
  const son = p.pop();
  if (son === undefined) return '';
  if (p.length === 0) return son;
  return `${p.join(', ')} ve ${son}`;
}
