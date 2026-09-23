/**
 * Seviye atlama kutlaması.
 *
 * Lord seviyesi savaştan, görevden, akından, günlük ödülden gelebiliyor;
 * ama yalnız savaş raporu "Seviye atladın" diyordu. Görev ödülüyle
 * atlayan oyuncu bunu üst çubuktaki küçük rozetin sessizce değişmesinden
 * anlıyordu — ya da hiç anlamıyordu. Oysa seviye bu oyunda kapı açıyor:
 * araştırma çağları, ekipman kademeleri, bölge tavanı.
 *
 * Kutlama bir bildirim, perde değil: ekranın üstünde üç saniye duruyor,
 * DOKUNMAYI ENGELLEMİYOR (`pointer-events-none`) ve kendiliğinden
 * kayboluyor. Oyuncu o sırada bir düğmeye basıyorsa basabilmeli — rehber
 * ışığı ve öğretici gibi zorunlu katmanların üstüne ikinci bir zorunluluk
 * eklemek hapsetmek olurdu. Ses yok: savaş raporu zaten zafer sesi
 * çalıyor, ikisi üst üste binerdi.
 *
 * İlk açılışta çalmıyor: önceki seviye bilinmeden "atladın" demek, her
 * girişte kutlama demek olurdu.
 */
import { CAGLAR } from '@lordlar/shared';
import { useEffect, useRef, useState } from 'react';

/** Kutlamanın ekranda kalma süresi; CSS animasyonuyla aynı. */
const SURE_MS = 3200;

export function SeviyeKutlamasi({ seviye }: { seviye: number }) {
  const onceki = useRef<number | null>(null);
  const [kutlama, setKutlama] = useState<{ seviye: number; not: string | null } | null>(null);

  useEffect(() => {
    const eski = onceki.current;
    onceki.current = seviye;
    if (eski === null || seviye <= eski) return;
    // Aradaki seviyelerde açılan araştırma çağı: bir ödülle birden çok
    // seviye atlanabiliyor, en yenisi söyleniyor.
    const cag = [...CAGLAR].reverse().find((c) => c.seviye > eski && c.seviye <= seviye);
    setKutlama({ seviye, not: cag ? `Araştırmada yeni çağ açıldı: ${cag.ad}` : null });
    const id = setTimeout(() => setKutlama(null), SURE_MS);
    return () => clearTimeout(id);
  }, [seviye]);

  if (!kutlama) return null;
  return (
    // Anahtar seviye: kutlama sürerken bir seviye daha gelirse öğe yeniden
    // kuruluyor ve animasyon baştan başlıyor. Aynı öğe kalsaydı animasyon
    // ilk kutlamanın saatiyle biter, ikinci kutlama saydam dururdu.
    <div
      key={kutlama.seviye}
      role="status"
      aria-live="polite"
      className="seviye-kutlama pointer-events-none fixed left-1/2 z-[56] -translate-x-1/2 rounded-2xl border-2 border-altin/70 bg-derin px-5 py-2.5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
      style={{ top: 'calc(var(--ust-bar, 64px) + 10px)' }}
    >
      <p className="baslik text-[16px] leading-tight text-altin">{`Seviye ${kutlama.seviye}`}</p>
      <p className="text-[12px] text-parsomen">{kutlama.not ?? 'Seviye atladın, lordum.'}</p>
    </div>
  );
}
