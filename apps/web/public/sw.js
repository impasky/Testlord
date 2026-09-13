/*
 * Lordlar Çağı — service worker.
 *
 * TEK İŞİ push bildirimi. Bilerek önbellekleme YOK: çevrimdışı oyun
 * zaten mümkün değil (her ekran sunucudan geliyor) ve yarım önbellek,
 * oyuncuya eski kaynak sayılarını gösteren bir hata kaynağı olurdu.
 * Sessiz yanlış veri, açık bir "bağlantı yok"tan kötüdür.
 *
 * Dosya `public/` altında ve olduğu gibi sunuluyor: service worker'ın
 * kapsamı (`scope`) bulunduğu klasör ve altı. Kökte olması gerekiyor ki
 * bütün sayfalar kapsamda kalsın.
 */

// Yeni sürüm beklemeden devralsın: kullanıcı sekmeyi kapatıp açmadan da
// düzeltilmiş bildirim koduna geçsin.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  // Gövdesiz bir push de gelebilir (bazı servisler "uyandırma" gönderir).
  // O durumda bile bir şey göstermek ZORUNDAYIZ: tarayıcılar gösterimsiz
  // push'ları kötüye kullanım sayıp izni geri alabiliyor.
  let veri;
  try {
    veri = e.data ? e.data.json() : {};
  } catch {
    veri = {};
  }

  const baslik = veri.baslik || 'Lordlar Çağı';
  const secenek = {
    body: veri.govde || 'Diyarda bir şey oldu.',
    icon: '/simge-192.png',
    badge: '/simge-192.png',
    // Aynı etiketli bildirim üstüne yazıyor: üç eğitim üst üste bitince
    // bildirim merkezinde üç satır değil bir satır olsun.
    tag: veri.etiket || 'lordlar',
    renotify: true,
    lang: 'tr',
    data: { yol: veri.yol || '/' },
  };
  e.waitUntil(self.registration.showNotification(baslik, secenek));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const yol = (e.notification.data && e.notification.data.yol) || '/';
  const hedef = new URL(yol, self.location.origin).href;

  // AÇIK SEKME VARSA ONA ODAKLAN, yenisini açma. Yoksa oyuncu her
  // bildirimde yeni bir sekme biriktirir ve hepsinde aynı oyun açıktır.
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const istemci of liste) {
        if (istemci.url.startsWith(self.location.origin) && 'focus' in istemci) {
          istemci.navigate(hedef).catch(() => undefined);
          return istemci.focus();
        }
      }
      return self.clients.openWindow(hedef);
    }),
  );
});
