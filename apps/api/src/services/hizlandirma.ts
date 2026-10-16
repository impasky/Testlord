/**
 * Kuyruk hızlandırma — elmasla, reklam bankasıyla ya da reklam ödülüyle
 * (docs/25).
 *
 * Tek kapı: hızlandırmanın üç yolu da aynı fonksiyondan geçiyor ve aynı
 * kuralları görüyor — kuyruk lordun mu, bitmemiş mi, türü
 * hızlandırılabilir mi (PvP'ye dokunan türler asla). Kısaltma yalnız
 * `finishAt`i öne çekiyor; çözümü kuyruk motoru yapıyor, beklenerek
 * bitenle AYNI yoldan (`gecikmisIsleriCoz`). Burada çözseydik çözümün
 * ikinci bir kopyası olurdu ve er ya da geç ayrışırdı.
 */
import { hizlandirilabilirMi } from '@lordlar/shared';
import type { Tx } from '../db.js';
import { GameError } from '../errors.js';

export interface KuyrukDurumu {
  id: string;
  kind: string;
  kalanSaniye: number;
}

/** Lordun hızlandırılabilir, sürmekte olan kuyruğu; değilse anlaşılır bir hata. */
export async function hizlandirilacakKuyruk(
  tx: Tx,
  lordId: string,
  kuyrukId: string,
  simdi: Date,
): Promise<KuyrukDurumu> {
  const q = await tx.queue.findFirst({
    where: { id: kuyrukId, lordId },
    select: { id: true, kind: true, finishAt: true, resolved: true },
  });
  if (!q) throw new GameError('Böyle bir iş yok.', 404, 'KUYRUK_YOK');
  if (!hizlandirilabilirMi(q.kind)) {
    throw new GameError(
      'Bu iş hızlandırılamaz: yalnız kendi gelişim işlerin hızlanıyor.',
      400,
      'HIZLANDIRILAMAZ',
    );
  }
  const kalanSaniye = Math.ceil((q.finishAt.getTime() - simdi.getTime()) / 1000);
  if (q.resolved || kalanSaniye <= 0) {
    throw new GameError('Bu iş zaten bitti.', 400, 'BEKLEME_YOK');
  }
  return { id: q.id, kind: q.kind, kalanSaniye };
}

/** Kuyruğun bitişini `saniye` öne çeker; kalan süreyi döndürür. */
export async function kuyruguKisalt(
  tx: Tx,
  k: KuyrukDurumu,
  saniye: number,
  simdi: Date,
): Promise<number> {
  const kisalan = Math.min(saniye, k.kalanSaniye);
  const yeniKalan = k.kalanSaniye - kisalan;
  await tx.queue.update({
    where: { id: k.id },
    data: { finishAt: new Date(simdi.getTime() + yeniKalan * 1000) },
  });
  return yeniKalan;
}
