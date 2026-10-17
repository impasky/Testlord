/**
 * Açılışta bekleyen migration var mı — Prisma CLI'yı başlatmadan.
 *
 * `prisma migrate deploy` her açılışta koşuyordu ve bekleyen migration
 * yokken bile 0,1 CPU'lu sunucuda (Render ücretsiz) 17-22 saniye
 * sürüyordu: Node, npm ve Prisma'nın şema motoru ayrı ayrı açılıyor.
 * Ücretsiz sunucu 15 dakika boşta kalınca uyuyor ve her uyanış bu bedeli
 * yeniden ödüyordu; oyuncu o sürede boş ekrana bakıyordu.
 *
 * Kayıt Prisma'nın kendi tablosunda (`_prisma_migrations`): klasördeki her
 * migration orada bitmiş ve geri alınmamış görünüyorsa CLI'ya gerek yok.
 * Şüphede (tablo yok, yarım kalmış kayıt, okunamadı) CLI koşuyor —
 * karar ve hata mesajı yine onun.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface MigrationKaydi {
  ad: string;
  bitti: boolean;
  geriAlindi: boolean;
}

/** Klasörde olup veritabanında uygulanmış görünmeyen migration'lar. */
export function bekleyenMigrationlar(
  klasorler: readonly string[],
  kayitlar: readonly MigrationKaydi[],
): string[] {
  const uygulanan = new Set(kayitlar.filter((k) => k.bitti && !k.geriAlindi).map((k) => k.ad));
  return klasorler.filter((ad) => !uygulanan.has(ad));
}

/** `prisma/migrations` altındaki migration klasörleri (sıralı). */
export function migrationKlasorleri(kok: string): string[] {
  const dizin = join(kok, 'prisma', 'migrations');
  if (!existsSync(dizin)) return [];
  return readdirSync(dizin, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dizin, d.name, 'migration.sql')))
    .map((d) => d.name)
    .sort();
}
