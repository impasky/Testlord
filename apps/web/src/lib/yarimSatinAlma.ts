/**
 * Yarım kalmış Google Play satın almaları (docs/25 §2.2).
 *
 * Jeton cihazda kalıyor: uygulama ödeme sırasında kapandıysa, ağ koptuysa
 * ya da ödeme sonradan onaylandıysa (bekleyen ödeme). Play onaylanmamış
 * satın almayı üç gün sonra İADE ediyor; toparlama yalnız Mağaza ekranına
 * bırakılsaydı o sürede Mağaza'ya girmeyen oyuncu elmasını hiç alamazdı.
 * Bu yüzden uygulama her açıldığında bir kez de burada koşuyor.
 *
 * Sunucu aynı jetonu bir kez işliyor; hepsini yeniden göndermek güvenli.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../api/client';
import { bekleyenPlaySatinAlmalari, uygulamadaMi } from './yerel';

/** Cihazdaki satın almaları sunucuya yollar; YENİ verilen elmasın toplamı. */
export async function yarimSatinAlmalariTamamla(hesapEtiketi: string): Promise<number> {
  const bekleyen = await bekleyenPlaySatinAlmalari(hesapEtiketi);
  let elmas = 0;
  for (const b of bekleyen) {
    const s = await api.playDogrula(b.urun, b.jeton).catch(() => null);
    if (s && s.durum === 'verildi') elmas += s.elmas;
  }
  return elmas;
}

let acilistaKostu = false;

/** Girişten sonra, uygulama başına bir kez. Web'de hiçbir şey yapmıyor. */
export function useYarimSatinAlmalar(girisli: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!girisli || acilistaKostu || !uygulamadaMi()) return;
    acilistaKostu = true;
    void (async () => {
      const m = await api.magaza();
      if (!m.play.acik) return;
      if ((await yarimSatinAlmalariTamamla(m.play.hesapEtiketi)) > 0) {
        void qc.invalidateQueries();
      }
    })().catch(() => {
      acilistaKostu = false; // bir sonraki girişte yeniden
    });
  }, [girisli, qc]);
}
