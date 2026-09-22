import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
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
          <App />
        </HataSiniri>
      </QueryClientProvider>
    </DilSaglayici>
  </StrictMode>,
);
