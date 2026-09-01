import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { HataSiniri } from './components/HataSiniri';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 5_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Sınır sağlayıcının DIŞINDA değil içinde: sorgu hatalarını da
        yakalasın ama yenile düğmesi her durumda çizilebilsin. */}
    <QueryClientProvider client={queryClient}>
      <HataSiniri>
        <App />
      </HataSiniri>
    </QueryClientProvider>
  </StrictMode>,
);
