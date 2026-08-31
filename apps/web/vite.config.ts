import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true -> 0.0.0.0'a bağlanır. Aynı Wi-Fi'daki telefondan
  // http://<bilgisayarın-LAN-IP>:5173 ile açılabilsin diye.
  // host: true -> 0.0.0.0'a bağlanır, aynı Wi-Fi'daki telefondan
  // http://<bilgisayarın-LAN-IP>:5173 ile açılabilsin diye.
  // allowedHosts: true -> Vite'ın host denetimi IP ile erişimi 403'lemesin
  // (yoksa HMR websocket'i reddediliyor).
  server: { port: 5173, host: true, allowedHosts: true },
});
