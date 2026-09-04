/**
 * Tarayıcı testleri için: öğreticiyi geç.
 *
 * Öğretici (docs/09 — ilk giriş) yeni lorda TAM EKRAN açılıyor ve arkadaki
 * her şeyin tıklanmasını engelliyor. Bu doğru davranış — gerçek oyuncu da
 * önce onu görüyor — ama testlerin de gerçek oyuncu gibi davranması gerek:
 * kaydolduktan sonra "GEÇ"e basmadan oyuna ulaşamıyoruz.
 *
 * Öğreticinin kendi testi tools/ogretici-testi.mjs; buradaki iş yalnızca
 * yolu açmak.
 */
export async function ogreticiyiGec(page) {
  const kalkan = page.locator('[role=dialog][aria-label="Öğretici"]');
  // Kısa bekleme: öğretici /me yanıtıyla birlikte açılıyor, sayfa
  // yüklenmesinden bir kare sonra gelebiliyor.
  await kalkan.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  if (!(await kalkan.isVisible().catch(() => false))) return false;
  await page.getByRole('button', { name: 'Öğreticiyi geç' }).click();
  await kalkan.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
  return true;
}
