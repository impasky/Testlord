/**
 * Yayın kontrolü, komut satırından (docs/05 §6).
 *
 *   pnpm yayin-kontrolu
 *
 * Sunucunun kabuğunda (Render → Shell) koşuluyor; sunucunun gördüğü
 * ortam değişkenlerini ve veritabanını okuyup eksikleri yazıyor. Hiçbir
 * ayarın değerini yazmıyor. Eksik varsa çıkış kodu 1: bir dağıtım betiği
 * bunu yayın kapısı olarak kullanabilir.
 */
import { yayinOzeti } from '@lordlar/shared';
import { prisma } from './db.js';
import { izlemeBaslat } from './izleme.js';
import { yayinKontrolu, yayinRaporu } from './services/yayin.js';

// İzleme açılabiliyor mu, sunucudaki gibi denensin (DSN yazım hatası).
izlemeBaslat();
const bulgular = await yayinKontrolu();
console.log(yayinRaporu(bulgular));
await prisma.$disconnect();
process.exit(yayinOzeti(bulgular).eksik > 0 ? 1 : 0);
