/**
 * Lord satırı kilidi — çift harcamaya karşı.
 *
 * NEDEN VAR — ölçülmüş bir açık. İşlemler Postgres'in varsayılan
 * yalıtımında (READ COMMITTED) koşuyor ve kalıp hep aynıydı: lordu OKU,
 * kaynağı KONTROL ET, düş. İki istek aynı anda gelince ikisi de aynı
 * eski bakiyeyi okuyor, ikisi de "yetiyor" diyordu. Üstüne `tickLord`
 * bakiyeyi MUTLAK değer olarak geri yazıyordu (`altin: hesaplanan`); geç
 * kalan işlem öncekinin düşümünü eski değerle eziyordu.
 *
 * Ölçüm: yalnız BİR eğitime yetecek 1.620 altınla aynı anda gönderilen on
 * eğitimden dördü geçti, son bakiye 540 — üç eğitim bedava. Aynı kalıp
 * elması, stat puanını, günlük hakları ve kuyruk sınırını da açıyordu.
 *
 * ÇÖZÜM satır kilidi: işlem lordun satırını `SELECT … FOR UPDATE` ile
 * kilitleyerek başlıyor, ikinci işlem birincisi bitene kadar bekliyor ve
 * sonra TAZE bakiyeyi okuyor. Kuyruğa girmek yavaşlatmıyor: kilit yalnız
 * aynı lordun işlemlerini sıraya diziyor, başka lordlarınkini değil.
 *
 * `Serializable` yalıtım da aynı açığı kapatırdı ama çakışan işlemi
 * ÖLDÜREREK: her uca yeniden deneme döngüsü gerekirdi, yoksa oyuncu
 * sebepsiz "sunucu hatası" görürdü. Kilit bekletiyor, öldürmüyor.
 */
import { prisma, type Tx } from '../db.js';

/** Lordun satırını bu işlem bitene kadar kilitler. Aynı işlemde tekrar çağrılabilir. */
export async function lordKilitle(tx: Tx, lordId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "Lord" WHERE id = ${lordId} FOR UPDATE`;
}

/**
 * Bir lordun kaynağına, ordusuna ya da sayaçlarına dokunan işlem.
 *
 * KURAL: böyle her işlem bununla açılır, çıplak `prisma.$transaction`
 * ile değil. Kilit işlemin İLK adımı olmalı: kilitten önce yapılan bir
 * okuma (örn. "bugün kaç bağış yaptım") yine eski veriyi görür ve sınırı
 * aşmaya açık kalır.
 */
export function lordIslemi<T>(lordId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lordKilitle(tx, lordId);
    return fn(tx);
  });
}
