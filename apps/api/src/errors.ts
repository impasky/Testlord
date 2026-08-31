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
