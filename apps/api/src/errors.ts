/** Oyuncuya gösterilebilir, Türkçe mesajlı hata. */
export class GameError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'OYUN_HATASI',
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export const hata = {
  yetersizKaynak: () => new GameError('Yeterli kaynağın yok.', 400, 'YETERSIZ_KAYNAK'),
  bulunamadi: (ne: string) => new GameError(`${ne} bulunamadı.`, 404, 'BULUNAMADI'),
  yetkisiz: () => new GameError('Bu işlem için yetkin yok.', 403, 'YETKISIZ'),
  yarali: (bitis: Date) =>
    new GameError(
      `Lordun yaralı. ${bitis.toLocaleString('tr-TR')} tarihine kadar saldıramazsın.`,
      400,
      'LORD_YARALI',
    ),
  korumali: () => new GameError('Hedef koruma altında.', 400, 'HEDEF_KORUMALI'),
  limitAsildi: (ne: string) => new GameError(`${ne} limitine ulaştın.`, 400, 'LIMIT_ASILDI'),
};

/**
 * Prisma benzersizlik ihlali (P2002) mi; öyleyse hangi alan.
 *
 * Kısıt yarışın son bekçisi: iki istek "bu ad boş mu" sorusundan birlikte
 * geçince ikincisini veritabanı durduruyor. Hangi alanın çakıştığını
 * bilmek, oyuncuya sunucu hatası yerine doğru cevabı vermek için gerekiyor.
 * Prisma alanı bazen ad listesi, bazen dizin adı olarak veriyor; ikisi de
 * alanın adını içeriyor.
 */
export function benzersizlikIhlali(e: unknown): string | null {
  const h = e as { code?: string; meta?: { target?: unknown } };
  if (h?.code !== 'P2002') return null;
  const hedef = Array.isArray(h.meta?.target)
    ? h.meta.target.join(',')
    : String(h.meta?.target ?? '');
  for (const alan of ['adAnahtari', 'email', 'name', 'tag']) {
    if (hedef.includes(alan)) return alan;
  }
  return '?';
}
