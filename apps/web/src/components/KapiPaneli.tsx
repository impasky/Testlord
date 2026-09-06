/**
 * Kapı paneli — konusunun içinde açılan pop-up sayfa.
 *
 * Oyuncu referans bir oyunu göstererek anlattı:
 *
 *   "ana sayfada nav bar ile gidebileceğimiz yerler sadece 5 tane... onun
 *    dışında her şeyi 5 ana sayfanın içinde pop-up pencereleri şeklinde
 *    ayarlamış. Mesela generaller ayrı bir sayfa olmasın; Lord sekmesine
 *    bir general bölümü eklensin, tıklanınca general sayfası pop-up gibi
 *    açılsın — haritada bir altıgene tıkladığımızda açılan panel gibi."
 *
 * Fikir tam olarak o: oyuncu bulunduğu yerden KOPMUYOR. Sekme değişmiyor,
 * ekran yeniden kurulmuyor; işini görüp kapatıyor ve kaldığı yerde
 * buluyor kendini.
 *
 * ── Katman sırası ─────────────────────────────────────────────────────
 *
 * Alt gezinme çubuğunun (z-50) ÜSTÜNDE: kapı açıkken sekme değiştirmek
 * bir kapıyı yarım bırakıp gitmek olurdu, referans da öyle yapmıyor.
 * Rehber ışığının (z-55) ise ALTINDA: zorunlu ilk tur her şeyin önünde
 * kalmalı.
 */
import { useEffect, type ReactNode } from 'react';
import { IkonKapali } from './Ikonlar';

export function KapiPaneli({
  baslik,
  onKapat,
  children,
}: {
  baslik: string;
  onKapat: () => void;
  children: ReactNode;
}) {
  // Panel açıkken arkadaki sayfa kaymasın: kapanınca oyuncu baktığı yerde
  // kalsın diye gövde kilitleniyor (öğreticide de aynı davranış).
  useEffect(() => {
    const eski = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = eski;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onKapat}
        aria-label={`${baslik} panelini kapat`}
        className="fixed inset-0 z-[52] bg-black/65"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        /*
         * Yükseklik SABİT, `max-h` değil.
         *
         * Panel alt kenara yapışık: içerik geldikçe büyüyünce ÜST kenarı
         * yukarı kayıyor ve altındaki her şey onunla birlikte zıplıyordu
         * (ittifak panelinde ölçülen CLS 0,66). Sabit kutu bir kere
         * yerleşiyor, sonra yalnız içindeki kaydırıcı doluyor.
         */
        className="fixed inset-x-0 bottom-0 z-[53] mx-auto flex h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl border-t-2 border-kenar-acik bg-derin"
      >
        {/* Başlık şeridi: panelin adı ve tek çıkış. Referansta da panelin
            kendi başlığı ve kendi kapatma düğmesi var. */}
        <div className="relative flex items-center gap-2 border-b border-kenar px-3 py-2.5">
          {/* Tutamak: bunun sürüklenebilir bir sayfa olduğunu söyleyen
              görsel ipucu. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-kenar-acik"
          />
          <h2 className="baslik min-w-0 flex-1 truncate pt-1 text-[15px] text-altin">{baslik}</h2>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="bas -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-solgun"
          >
            <IkonKapali boyut={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </>
  );
}
