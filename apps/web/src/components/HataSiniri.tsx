/**
 * Arayüz hata sınırı.
 *
 * React'te bir bileşen render sırasında patlarsa tüm ağaç sökülür ve
 * oyuncu bomboş beyaz bir ekran görür — ne olduğunu, ne yapması
 * gerektiğini bilemez. Sınır o hatayı yakalayıp anlaşılır bir ekran
 * gösterir ve hatayı izlemeye taşır.
 *
 * Sınıf bileşeni olmasının sebebi React: componentDidCatch'in kanca
 * karşılığı yok.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Durum {
  hata: Error | null;
}

export class HataSiniri extends Component<{ children: ReactNode }, Durum> {
  override state: Durum = { hata: null };

  static getDerivedStateFromError(hata: Error): Durum {
    return { hata };
  }

  override componentDidCatch(hata: Error, bilgi: ErrorInfo): void {
    // Sunucuya taşımanın yolu şimdilik konsol: tarayıcı tarafında izleme
    // kurulu değil. Konsola yazmak en azından test koşularında ve
    // geliştirici araçlarında hatayı görünür kılıyor.
    console.error('Arayüz hatası:', hata, bilgi.componentStack);
  }

  override render(): ReactNode {
    const { hata } = this.state;
    if (!hata) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="baslik text-[18px] text-kirmizi">Bir şeyler ters gitti</h1>
        <p className="max-w-xs text-[13px] text-solgun">
          Ekran yüklenirken beklenmedik bir hata oluştu. Sayfayı yenilemek çoğu zaman
          yeterlidir; sürerse ilerlemen kaybolmadı, sunucuda duruyor.
        </p>

        {/* Hata metni açıkta değil ama ulaşılabilir: oyuncuyu korkutmadan,
            bildirmek isteyene kopyalayacak bir şey bırakıyor. */}
        <details className="max-w-xs text-left">
          <summary className="bas cursor-pointer text-[11px] text-sonuk">Teknik ayrıntı</summary>
          <pre className="oyuk mt-2 max-h-40 overflow-auto rounded-lg border border-kenar p-2 text-[10px] whitespace-pre-wrap text-sonuk">
            {hata.message}
          </pre>
        </details>

        <button
          onClick={() => window.location.reload()}
          className="bas baslik rounded-xl border border-altin-koyu bg-gradient-to-b from-altin to-altin-koyu px-5 py-3 text-[14px] text-gece"
        >
          Sayfayı yenile
        </button>
      </div>
    );
  }
}
