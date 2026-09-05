/**
 * Rehberin kapatılma durumu — kart ve ışık aynı kararı okusun.
 *
 * Kâhya iki yerde görünüyor: Malikâne'deki kart (Rehber.tsx) ve ekranı
 * karartıp tek düğmeyi açıkta bırakan ışık (RehberIsigi.tsx). Oyuncu
 * "yeter, anladım" dediğinde İKİSİ birden susmalı.
 *
 * ── Neden sunucuda ────────────────────────────────────────────────────
 *
 * Bu karar önce `localStorage`da duruyordu ve SESSİZ bir hatası vardı:
 * anahtar tarayıcı başına yazılıyordu, hesap başına değil. Bir kez
 * kapatan oyuncunun aynı tarayıcıda açtığı HER YENİ HESAP rehbersiz
 * açılıyordu — sunucu "yepyeni lord" derken tarayıcı "zaten kapattım"
 * diyordu, ikisini kimse karşılaştırmıyordu. Yeni hesapla deneyen oyuncu
 * haklı olarak "yaptıran öğretici çalışmıyor" dedi.
 *
 * Artık karar lorda ait (`Lord.rehberBittiAt`) ve /me ile geliyor.
 * Buradaki oturum bayrağı yalnızca ARADAKİ BOŞLUĞU kapatıyor: /me otuz
 * saniyede bir tazeleniyor, oyuncu "yeter" dedikten sonra bir sonraki
 * yanıta kadar perde ekranda kalırdı. Kalıcı hâfıza değil.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const dinleyiciler = new Set<() => void>();
let oturumdaKapatildi = false;

/** Bu oturumda kapatıldı mı (sunucu yanıtı gelene kadarki köprü). */
export function rehberOturumdaKapaliMi(): boolean {
  return oturumdaKapatildi;
}

/**
 * Oyuncu rehberi kapattı: iki bileşen de ANINDA sussun.
 *
 * Sunucuya yazmayı `useRehberiKapat` yapıyor; bu işlev yalnız oturum
 * bayrağını çevirip dinleyicileri uyandırıyor.
 */
export function rehberiKapat(): void {
  oturumdaKapatildi = true;
  for (const d of [...dinleyiciler]) d();
}

/** Yeni bir lorda geçildi (çıkış/giriş): oturum bayrağı sıfırlansın. */
export function rehberOturumuSifirla(): void {
  if (!oturumdaKapatildi) return;
  oturumdaKapatildi = false;
  for (const d of [...dinleyiciler]) d();
}

/** Oturum bayrağını okuyan ve değişince yeniden çizilen kanca. */
export function useRehberOturumdaKapali(): boolean {
  const [kapali, setKapali] = useState(rehberOturumdaKapaliMi);
  useEffect(() => {
    const d = () => setKapali(rehberOturumdaKapaliMi());
    dinleyiciler.add(d);
    return () => {
      dinleyiciler.delete(d);
    };
  }, []);
  return kapali;
}

/**
 * "Yeter, anladım" / "GEÇ" düğmelerinin çağırdığı tek kapatma.
 *
 * Önce oturum bayrağını çeviriyor (perde parmağın altında hemen kalksın),
 * sonra sunucuya yazıyor (bir dahaki girişte, başka cihazda da kapalı
 * kalsın). Ağ hatası önemsiz: en kötü hâlde bir sonraki girişte rehber
 * bir kez daha görünür, oyun kilitlenmez.
 */
export function useRehberiKapat(): () => void {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: api.rehberBitti,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
  return () => {
    rehberiKapat();
    mut.mutate();
  };
}
