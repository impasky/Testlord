/**
 * İttifak seviyesi, bağış, rütbe ve duyuru testi (docs/09 B1e).
 *
 * Çekirdek üç şey:
 *  1. Bağış ittifakı GERÇEKTEN büyütüyor mu (XP ve seviye).
 *  2. Seviye somut bir şey değiştiriyor mu (ticaret tavanı).
 *  3. Günlük hak gerçekten sınırlıyor mu.
 *
 * SADECE GELİŞTİRME. API ayakta olmalı. node tools/ittifak-seviye-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `sev${damga}_${etiket}@lordlar.dev`,
    lordName: `Sev ${damga.toString(36).slice(-3)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (y, g) =>
      fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
        (x) => x.json(),
      ),
    get: (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json()),
  };
}

console.log('Lordlar Çağı — ittifak seviyesi testi\n');

const a = await lordKur('a');
const b = await lordKur('b');
for (const l of [a, b])
  await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
const A = await a.post('/ittifak/kur', {
  ad: `Seviye ${damga % 10000}`,
  etiket: `S${damga % 100}`,
});
// Kapıyı aç: ittifak varsayılan olarak BAŞVURUYLA üye alıyor (docs/09
// §2.1). Bu testin ölçtüğü şey başvuru değil; lider gibi davranıp
// kapıyı açıyoruz. Başvurunun kendisi ittifak-basvuru-testi'nde.
await a.post('/ittifak/ayarlar', { katilim: 'acik' });

await b.post(`/ittifak/${A.id}/katil`);
// İttifak kurmak 20.000 altın yiyor ve depo tavanı Lv1'de 23.000: kurma
// sonrası elde 3.000 altın kalıyordu, yani beş bağış hakkı dolmadan
// kaynak bitiyordu. Kurulduktan SONRA tekrar dolduruyoruz.
for (const l of [a, b])
  await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
kontrol('İttifak kuruldu ve ikinci üye katıldı', Boolean(A?.id), A?.ad ?? A?.code);

// --- Başlangıç
const ilk = await a.get('/ittifak/bagis');
kontrol(
  'Bağış ekranı geliyor',
  ilk?.maliyet?.altin > 0,
  `${ilk?.maliyet?.altin} altın, ${ilk?.kalanHak}/${ilk?.gunlukHak} hak`,
);
kontrol('İttifak birinci seviyede başlıyor', ilk?.seviye?.seviye === 1, `Sv${ilk?.seviye?.seviye}`);
kontrol(
  'Sonraki seviyenin ne getireceği söyleniyor',
  ilk?.sonrakiAyricaliklar?.ticaretTavani > ilk?.ayricaliklar?.ticaretTavani,
  `${ilk?.ayricaliklar?.ticaretTavani} -> ${ilk?.sonrakiAyricaliklar?.ticaretTavani}`,
);

const ticaretOnce = await a.get('/ticaret');
kontrol(
  'Ticaret tavanı Sv1 tavanı',
  ticaretOnce?.gunlukTavan === ilk?.ayricaliklar?.ticaretTavani,
  `${ticaretOnce?.gunlukTavan}`,
);

// --- Bağış ittifakı büyütüyor
const meOnce = (await a.get('/me')).lord;
const bagis = await a.post('/ittifak/bagis');
kontrol('Bağış yapılabiliyor', bagis?.bagislandi === true, bagis?.code ?? `+${bagis?.xp} xp`);
kontrol('İttifak XP kazandı', bagis?.seviye?.xp === ilk.kazandiracakXp, `${bagis?.seviye?.xp} xp`);

const meSonra = (await a.get('/me')).lord;
// Ödül LORD XP, şöhret DEĞİL: şöhret türetilen bir değer ve kaynakla
// doğrudan şöhret almak savaşmadan sıralamada yükselmek olurdu.
kontrol('Bağış yapan lord XP kazandı', meSonra.xp > meOnce.xp, `${meOnce.xp} -> ${meSonra.xp}`);
kontrol(
  'Bağış kaynaktan düştü',
  Math.floor(meSonra.resources.altin) < Math.floor(meOnce.resources.altin),
  `${Math.floor(meOnce.resources.altin)} -> ${Math.floor(meSonra.resources.altin)}`,
);

const ikinci = await a.get('/ittifak/bagis');
kontrol(
  'Günlük hak azaldı',
  ikinci?.kalanHak === ilk.kalanHak - 1,
  `${ilk.kalanHak} -> ${ikinci?.kalanHak}`,
);

// --- Günlük hak GERÇEKTEN sınırlıyor
for (let i = 0; i < ikinci.kalanHak; i++) await a.post('/ittifak/bagis');
const tukendi = await a.post('/ittifak/bagis');
kontrol(
  'Günlük hak bitince bağış reddediliyor',
  tukendi?.code === 'HAK_BITTI',
  tukendi?.code ?? 'bağış geçti',
);

// --- Seviye atlatma: b da bağış yapsın, sonra XP'yi test ucuyla itelim
await b.post('/ittifak/bagis');
const durum = await a.get('/ittifak/bagis');
kontrol(
  'İki üyenin bağışı da sayıldı',
  durum?.seviye?.xp > bagis.seviye.xp,
  `${durum?.seviye?.xp} xp`,
);

// XP'yi eşiğin HEMEN ALTINA itip son adımı GERÇEK bir bağışla atıyoruz.
// İlk hâlinde eşiği doğrudan geçiyordum ve seviye atlıyordu ama olay
// bildirimi hiç çalışmıyordu — çünkü bildirimi bağış ucu gönderiyor.
// Test, ölçmek istediği yolun kendisinden geçmeli.
const eksik = durum.seviye.sonrakiEsik - durum.seviye.seviyedeXp;
await a.post('/test/ittifak-xp', { miktar: eksik - 1 });
const bSon = await b.post('/ittifak/bagis');
kontrol('YETERLİ XP SEVİYE ATLATIYOR', bSon?.seviye?.seviye > 1, `Sv${bSon?.seviye?.seviye}`);
kontrol('Seviye atladığı bağış yanıtında söyleniyor', bSon?.seviyeAtladi === true);

// --- Seviye SOMUT bir şey değiştiriyor
const ticaretSonra = await a.get('/ticaret');
kontrol(
  'SEVİYE TİCARET TAVANINI BÜYÜTTÜ',
  ticaretSonra?.gunlukTavan > ticaretOnce?.gunlukTavan,
  `${ticaretOnce?.gunlukTavan} -> ${ticaretSonra?.gunlukTavan}`,
);
kontrol(
  'Üye de yeni tavanı görüyor',
  (await b.get('/ticaret'))?.gunlukTavan === ticaretSonra?.gunlukTavan,
);
kontrol(
  'Seviye atlayınca üyeler haber alıyor',
  (await b.get('/me')).events.some((e) => e.kind === 'ittifak_seviye'),
  (await b.get('/me')).events.find((e) => e.kind === 'ittifak_seviye')?.payload?.mesaj ??
    'olay yok',
);

// --- Haftalık katkı türetiliyor
const ozet = await a.get('/ittifak');
const benimSatir = ozet.ittifakim.uyeler.find((u) => u.lider);
kontrol(
  'Haftalık katkı hesaplanıyor',
  benimSatir?.haftalikKatki > 0,
  `${benimSatir?.haftalikKatki} puan`,
);
kontrol(
  'Bağış yapmayan üyenin katkısı daha az',
  ozet.ittifakim.uyeler.find((u) => !u.lider)?.haftalikKatki < benimSatir.haftalikKatki,
);

// --- Duyuru
const uyeDuyuru = await b.post('/ittifak/duyuru', { metin: 'ben yazamam' });
kontrol('Üye duyuru yazamıyor', uyeDuyuru?.code === 'YETKISIZ', uyeDuyuru?.code ?? 'yazdı');
const yazildi = await a.post('/ittifak/duyuru', { metin: 'Günde 5 bağış yapın.' });
kontrol(
  'Lider duyuru yazabiliyor',
  yazildi?.duyuru === 'Günde 5 bağış yapın.',
  yazildi?.code ?? yazildi?.duyuru,
);
kontrol(
  'Duyuru üyeye görünüyor',
  (await b.get('/ittifak')).ittifakim?.duyuru === 'Günde 5 bağış yapın.',
);

// --- Rütbe
const benimIdA = ozet.ittifakim.uyeler.find((u) => u.lider).id;
const bId = ozet.ittifakim.uyeler.find((u) => !u.lider).id;
const uyeRutbe = await b.post('/ittifak/rutbe', { lordId: benimIdA, rutbe: 'yasli' });
kontrol('Üye rütbe veremiyor', uyeRutbe?.code === 'YETKISIZ', uyeRutbe?.code ?? 'verdi');
const kendine = await a.post('/ittifak/rutbe', { lordId: benimIdA, rutbe: 'yasli' });
kontrol(
  'Lider kendi rütbesini değiştiremiyor',
  kendine?.code === 'KENDI_RUTBEN',
  kendine?.code ?? 'değiştirdi',
);

const verildi = await a.post('/ittifak/rutbe', { lordId: bId, rutbe: 'yasli' });
kontrol(
  'Lider yaşlı rütbesi verebiliyor',
  verildi?.rutbe === 'yasli',
  verildi?.code ?? verildi?.rutbe,
);
kontrol(
  'Rütbe üye listesinde görünüyor',
  (await a.get('/ittifak')).ittifakim.uyeler.find((u) => u.id === bId)?.rutbe === 'yasli',
);
kontrol(
  'Yaşlı da duyuru yazabiliyor',
  (await b.post('/ittifak/duyuru', { metin: 'yaşlı yazdı' }))?.duyuru === 'yaşlı yazdı',
);

const alindi = await a.post('/ittifak/rutbe', { lordId: bId, rutbe: 'uye' });
kontrol('Rütbe geri alınabiliyor', alindi?.rutbe === 'uye', alindi?.code ?? alindi?.rutbe);
kontrol(
  'Rütbesi alınan artık duyuru yazamıyor',
  (await b.post('/ittifak/duyuru', { metin: 'olmaz' }))?.code === 'YETKISIZ',
);

// --- İttifaksız oyuncu
const c = await lordKur('c');
const disaridan = await c.get('/ittifak/bagis');
kontrol(
  'İttifaksız oyuncu bağış ekranını göremiyor',
  disaridan?.code === 'ITTIFAK_YOK',
  disaridan?.code ?? 'gördü',
);
kontrol(
  'İttifaksız oyuncunun ticaret tavanı taban tavan',
  (await c.get('/ticaret'))?.gunlukTavan === ticaretOnce?.gunlukTavan,
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
