/**
 * Bağlantı durumu şeridi.
 *
 * İki ayrı sorunu ayırıyor, çünkü oyuncunun yapacağı şey farklı:
 *
 *   Cihaz çevrimdışı  → oyuncunun kendi bağlantısı yok, beklemesi gerek
 *   Sunucuya ulaşılamıyor → sunucu uyanıyor ya da düşmüş, yine beklemeli
 *     ama kendi ağını suçlamamalı
 *
 * Ücretsiz katmanda servis uykuya geçiyor ve ilk açılış 30–60 saniye
 * sürüyor. O sürede donmuş bir ekran, oyuncuya oyunun bozuk olduğunu
 * düşündürür.
 */
import { useEffect, useState } from 'react';

export function BaglantiDurumu({ sunucuyaUlasilamiyor }: { sunucuyaUlasilamiyor: boolean }) {
  const [cevrimdisi, setCevrimdisi] = useState(() => !navigator.onLine);

  useEffect(() => {
    const ac = () => setCevrimdisi(false);
    const kapa = () => setCevrimdisi(true);
    window.addEventListener('online', ac);
    window.addEventListener('offline', kapa);
    return () => {
      window.removeEventListener('online', ac);
      window.removeEventListener('offline', kapa);
    };
  }, []);

  if (!cevrimdisi && !sunucuyaUlasilamiyor) return null;

  return (
    <div
      role="status"
      className={`fixed inset-x-0 z-[60] px-3 py-2 text-center text-[12px] ${
        cevrimdisi ? 'bg-kirmizi text-white' : 'bg-turuncu text-gece'
      }`}
      style={{ top: 'var(--ust-bar)' }}
    >
      {cevrimdisi
        ? 'Bağlantın yok. İnternete döndüğünde oyun kaldığı yerden devam eder.'
        : 'Sunucuya ulaşılamıyor. Uykudaki sunucu uyanıyor olabilir, bu 30–60 saniye sürebilir.'}
    </div>
  );
}
