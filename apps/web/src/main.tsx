import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { HataSiniri } from './components/HataSiniri';
import { DilSaglayici } from './lib/dil';
// Yazı tipi oyunla paketleniyor, dışarıdan çekilmiyor (bkz. styles.css başı).
import '@fontsource-variable/rubik/wght.css';
import './styles.css';

/*
 * Sözlük burada YÜKLENMİYOR ve bu bilinçli.
 *
 * Motor (packages/shared/src/dil.ts) sözlüğü kendi modülü yüklenirken
 * `localStorage`dan EŞZAMANLI okuyor. Sebebi: derleme eklentisi
 * metinleri `t()` ile sarıyor ve bu çağrıların bir kısmı modül
 * düzeyinde — `const KADEME_OZETI = { kamp: t('…') }` gibi sabitler
 * daha buraya gelinmeden değerlerini alıyor. Burada beklenen bir söz
 * (Promise) onları kurtarmaya yetmezdi.
 */

/*
 * ÇİZİM GALERİSİ (docs/24): koddan çizilen bütün görseller tek sayfada —
 * yalnız geliştirmede, `#/cizim-galerisi` ile. Ekran görüntüsü alıp
 * çizimleri topluca denetlemek için. `import.meta.env.DEV` derlemede
 * `false` oluyor ve dal bütünüyle siliniyor: üretim paketinde galeri
 * parçası (chunk) hiç yok.
 */
const Galeri = import.meta.env.DEV
  ? lazy(() => import('./cizim/Galeri').then((m) => ({ default: m.Galeri })))
  : null;
const galeriAcik = Galeri !== null && window.location.hash.startsWith('#/cizim-galerisi');

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 5_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Dil sağlayıcı EN DIŞTA: hata ekranının metinleri de çevrilsin. */}
    <DilSaglayici>
      {/* Sınır sağlayıcının DIŞINDA değil içinde: sorgu hatalarını da
          yakalasın ama yenile düğmesi her durumda çizilebilsin. */}
      <QueryClientProvider client={queryClient}>
        <HataSiniri>
          {/*
            EN DIŞTAKİ Suspense: App'in ilk dönüşlerindeki tembel sayfalar
            (Aydınlatma Metni, Kullanım Koşulları, parola sıfırlama, e-posta
            doğrulama) içerideki sınırların DIŞINDA çiziliyordu. Oyunun
            içinden "Hangi veriyi tutuyoruz"a basan oyuncu çökme ekranı
            görüyordu ("A component suspended while responding to
            synchronous input") — tüm düğmeleri deneyen bot yakaladı. Boş
            yedek: sayfa yüklenirken tek bir kare boş kalıyor, o kadar.
          */}
          <Suspense fallback={null}>{galeriAcik && Galeri ? <Galeri /> : <App />}</Suspense>
        </HataSiniri>
      </QueryClientProvider>
    </DilSaglayici>
  </StrictMode>,
);
