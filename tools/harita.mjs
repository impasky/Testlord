/**
 * PROJE HARİTASI — `HARITA.md`yi üretir: hangi dosya ne yapıyor, ne dışa
 * açıyor, hangi API uçlarını sunuyor.
 *
 * NEDEN ÜRETİLİYOR: elle yazılan bir harita ilk dosya eklendiğinde eskir
 * ve eski harita yanlış yere götürür — hiç olmamasından kötü. Bu projede
 * neredeyse her dosya ne yaptığını baştaki yorumunda söylüyor; açıklama
 * oradan, dışa açılan adlar `export`lardan, uçlar `app.get(...)`lerden
 * okunuyor. Elle tutulan tek kısım konu dizini (`KONULAR`); oradaki her
 * yol denetleniyor, silinen ya da taşınan dosya üretimi durduruyor.
 *
 * Kullanım:
 *   pnpm harita              HARITA.md'yi yazar
 *   pnpm harita --denetle    güncel değilse 1 ile çıkar (CI)
 *
 * Dosya listesi git'ten (izlenen + izlenmeyen ama yok sayılmayan): yeni
 * dosya commit'ten önce de haritaya giriyor.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const HEDEF = join(KOK, 'HARITA.md');

/*
 * KONU DİZİNİ — "X nerede?" sorusunun ilk durağı. Dosya adı ya da dışa
 * açılan ad aranacak kelimeyi her zaman taşımıyor (ör. "uyku", "kilit");
 * buradaki satırlar konudan dosyaya götürüyor.
 */
const KONULAR = [
  [
    'Sayılar ve denge (tek kaynak)',
    ['data/balance.json', 'packages/shared/src/balance.ts', 'tools/check_balance.py'],
  ],
  [
    'Sunucu açılışı, eklentiler, statik dosyalar, migration',
    ['apps/api/src/index.ts', 'apps/api/src/migrationDurumu.ts', 'apps/api/src/vtYoklama.ts'],
  ],
  ['Ortam değişkenleri (sunucu ayarları)', ['apps/api/src/env.ts', '.env.example']],
  [
    'Oturum, kimlik, giriş/kayıt, parola sıfırlama',
    ['apps/api/src/auth.ts', 'apps/api/src/routes/auth.ts', 'apps/web/src/screens/Giris.tsx'],
  ],
  [
    'E-posta doğrulama',
    [
      'packages/shared/src/epostaDogrulama.ts',
      'apps/api/src/services/epostaDogrulama.ts',
      'apps/web/src/screens/EpostaDogrula.tsx',
      'docs/17-eposta-dogrulama.md',
    ],
  ],
  [
    'Lord durumu, tick (kaynak birikmesi), /me',
    [
      'apps/api/src/services/lord.ts',
      'apps/api/src/routes/me.ts',
      'apps/api/src/services/kilit.ts',
    ],
  ],
  [
    'Aynı anda gelen okumalar (tek uçuş), vadesi gelenleri kapatma',
    ['apps/api/src/services/tekUcus.ts', 'apps/api/src/services/gecikmis.ts'],
  ],
  [
    'Kuyruk (inşa, eğitim, araştırma bitişi)',
    ['apps/api/src/services/queue.ts', 'apps/api/src/worker.ts'],
  ],
  [
    'Ordu, kışla, eğitim',
    [
      'apps/api/src/routes/army.ts',
      'apps/web/src/screens/Kisla.tsx',
      'packages/shared/src/combat.ts',
    ],
  ],
  [
    'Dünya haritası, yürüyüş, fetih, savaş',
    [
      'apps/api/src/routes/map.ts',
      'apps/api/src/services/haritaDurumu.ts',
      'apps/api/src/services/dunyaBolgeleri.ts',
      'apps/api/src/services/march.ts',
      'packages/shared/src/harita.ts',
      'apps/web/src/screens/Harita.tsx',
      'apps/web/src/components/harita/GercekHarita.tsx',
      'apps/web/src/components/harita/dunyaGeometri.ts',
    ],
  ],
  [
    'Gerçek dünya: ülkeler, sınır kuralı, ülke seçimi, göç',
    [
      'docs/27-gercek-dunya.md',
      'tools/gercek-dunya-uret.mjs',
      'packages/shared/src/kanonik.ts',
      'packages/shared/src/ulkeler.ts',
      'apps/api/src/services/ulke.ts',
      'apps/api/src/routes/ulke.ts',
      'apps/api/src/services/goc.ts',
      'apps/web/src/screens/UlkeSecimi.tsx',
      'apps/web/src/screens/Ulkem.tsx',
    ],
  ],
  [
    'Akın (NPC haritaları)',
    [
      'apps/api/src/routes/akin.ts',
      'apps/api/src/services/akin.ts',
      'packages/shared/src/akin.ts',
      'apps/web/src/screens/Akin.tsx',
    ],
  ],
  [
    'Şehir / Malikâne (yerleşke)',
    ['apps/api/src/routes/sehir.ts', 'apps/web/src/screens/Sehir.tsx'],
  ],
  [
    'Garnizon payı (bölge geliri bölüşümü)',
    ['packages/shared/src/garnizon.ts', 'apps/api/src/services/gelir.ts'],
  ],
  ['İttifak', ['apps/api/src/routes/ittifak.ts']],
  [
    'Sohbet ve moderasyon',
    [
      'apps/api/src/routes/sohbet.ts',
      'apps/api/src/routes/moderasyon.ts',
      'apps/web/src/screens/GenelSohbet.tsx',
    ],
  ],
  [
    'Mağaza (P2S): elmas, hızlandırma, Google Play, AdMob',
    [
      'packages/shared/src/magaza.ts',
      'apps/api/src/routes/magaza.ts',
      'apps/api/src/services/play.ts',
      'apps/api/src/services/reklam.ts',
      'apps/web/src/screens/Magaza.tsx',
      'docs/25-magaza.md',
    ],
  ],
  [
    'Öğretici ve zorunlu rehber (kâhya ışığı, omurga)',
    [
      'packages/shared/src/rehber.ts',
      'apps/web/src/components/Ogretici.tsx',
      'apps/web/src/components/RehberIsigi.tsx',
      'apps/web/src/components/Rehber.tsx',
    ],
  ],
  [
    'Çizim motoru (3B, GPU, kalıcı önbellek)',
    [
      'apps/web/src/cizim/uc.ts',
      'apps/web/src/cizim/Sahne.tsx',
      'apps/web/src/cizim/gl.ts',
      'apps/web/src/cizim/kalici.ts',
    ],
  ],
  [
    'Akıcılık, kasma, canlı sahne (bayrak, duman, su, ışık, hava)',
    [
      'apps/web/src/App.tsx',
      'apps/web/src/lib/turOlayi.ts',
      'apps/web/src/cizim/Sahne.tsx',
      'apps/web/src/styles.css',
      'apps/web/src/components/HavaKatmani.tsx',
      'apps/web/src/screens/yerleskeYakinligi.ts',
    ],
  ],
  [
    'Arayüz kabuğu, alt gezinme, API istemcisi',
    [
      'apps/web/src/App.tsx',
      'apps/web/src/components/MobilKabuk.tsx',
      'apps/web/src/api/client.ts',
    ],
  ],
  [
    'Çeviri (Türkçe → İngilizce)',
    [
      'tools/metin-cikar.mjs',
      'tools/ceviri-al.mjs',
      'apps/web/vite-ceviri.mjs',
      'packages/shared/src/dil.ts',
    ],
  ],
  [
    'Yayın kontrolü (eksik sunucu ayarları)',
    ['packages/shared/src/yayin.ts', 'apps/api/src/services/yayin.ts'],
  ],
  [
    'Dağıtım: Render, DigitalOcean, Docker',
    ['render.yaml', '.do/deploy.template.yaml', 'Dockerfile', 'docs/05-dagitim.md'],
  ],
  [
    'Derleme, sıkıştırma, CI',
    ['apps/web/vite.config.ts', 'apps/web/vite-sikistir.mjs', '.github/workflows/denetim.yml'],
  ],
  [
    'Android (Capacitor), APK ve Play paketi',
    [
      'apps/mobil/derle.mjs',
      'apps/mobil/android/app/build.gradle',
      '.github/workflows/android-apk.yml',
      '.github/workflows/android-yayin.yml',
    ],
  ],
  ['Veritabanı şeması', ['apps/api/prisma/schema.prisma', 'apps/api/src/db.ts']],
  ['Uçtan uca testler (zincir)', ['package.json', 'tools/lib/kayit.mjs', 'tools/lib/tarayici.mjs']],
];

/*
 * Klasör başlıkları. Listede olmayan klasör adıyla görünüyor; buradaki
 * cümle o klasörün NE İÇİN olduğunu söylüyor.
 */
const KLASORLER = {
  '.': 'Kök: proje ayarları, dağıtım tanımları',
  '.do': 'DigitalOcean App Platform kurulum şablonu',
  '.github/workflows': 'GitHub Actions: CI, Android APK ve Play paketi',
  'apps/api': 'Sunucu paketi (Fastify + Prisma)',
  'apps/api/prisma': 'Veritabanı şeması',
  'apps/api/src': 'Sunucu çekirdeği: açılış, ortam, kimlik, worker, betikler',
  'apps/api/src/routes': 'API uçları (hepsi /api altında)',
  'apps/api/src/services': 'Sunucu iş mantığı (uçların ve worker’ın kullandığı)',
  'apps/mobil': 'Android kabuğu (Capacitor)',
  'apps/web': 'Arayüz paketi (React + Vite)',
  'apps/web/src': 'Arayüz girişi',
  'apps/web/src/api': 'Sunucuyla konuşan istemci',
  'apps/web/src/cizim': 'Çizim motoru: 3B modeller, GPU, kalıcı resim önbelleği',
  'apps/web/src/components': 'Ortak bileşenler',
  'apps/web/src/screens': 'Ekranlar (alt gezinmenin ve kasanın sayfaları)',
  'apps/web/src/lib': 'Arayüz yardımcıları',
  'apps/web/public': 'Olduğu gibi sunulan dosyalar (PWA, simgeler, push işçisi)',
  ceviri: 'Çeviri kataloğu ve çevirmen dosyaları (araçlar üretir)',
  data: 'Oyun verisi: denge, harita, birimler (sayıların tek kaynağı)',
  docs: 'Tasarım ve işletim belgeleri',
  'packages/shared/src': 'Sunucu ve arayüzün ortak, saf mantığı',
  tools: 'Uçtan uca testler, denetimler ve bakım araçları',
  'tools/lib': 'Testlerin ortak yardımcıları',
};

/** Tek tek listelenmeyen, sayıyla özetlenen yerler. */
const OZET = [
  [/^apps\/api\/prisma\/migrations\//, 'apps/api/prisma/migrations', 'migration (SQL)'],
  [
    /^apps\/mobil\/android\/(?!app\/build\.gradle$|app\/src\/main\/AndroidManifest\.xml$|app\/src\/deneme\/)/,
    'apps/mobil/android',
    'Capacitor/Gradle üretimi dosya (elle dokunulanlar ayrıca listede)',
  ],
  [/^docs\/gorseller\//, 'docs/gorseller', 'belge görseli'],
  [/^tools\/fiksturler\//, 'tools/fiksturler', 'test fikstürü'],
  [/\.(png|jpe?g|webp|ico|woff2?)$/, null, 'görsel/yazı tipi'],
];

/** Yorumu olmayan veri dosyalarının açıklaması. */
const ELLE = {
  'package.json':
    'Kök betikler: `pnpm build`, `test`, `e2e` (uçtan uca zincir), `ceviri`, `harita`…',
  'pnpm-workspace.yaml': 'pnpm çalışma alanı: apps/*, packages/*',
  'tsconfig.base.json': 'Ortak TypeScript ayarları',
  '.prettierrc': 'Prettier ayarları',
  'data/balance.json': 'Bütün oyun sayıları (bina, birim, süre, ödül, mağaza…) — tek kaynak',
  'apps/mobil/capacitor.config.json': 'Capacitor: paket adı, web klasörü, https şeması',
  'apps/web/src/cizim/parmakizi.json': 'Görsel bozulma testinin kayıtlı izleri',
  'apps/web/public/manifest.webmanifest': 'PWA manifestosu',
  'ceviri/metinler.json': 'Bütün Türkçe metinler ve İngilizceleri (üretilir)',
  'ceviri/numaralar.json': 'Çevirmen dosyalarındaki satır numaraları (üretilir)',
  'apps/web/src/ceviri/en.json': 'Arayüzün İngilizce sözlüğü (üretilir)',
  'apps/web/src/ceviri/en-kaliplar.json':
    'Arayüzün İngilizce kalıpları — {0} yer tutuculu cümleler (üretilir)',
  'ceviri/metinler.csv': 'Çeviri kataloğunun tablo hâli (üretilir)',
  'docker-compose.yml': 'Yerel geliştirme için PostgreSQL (`docker compose up -d`)',
  'vitest.config.ts': 'Birim testlerinin ayarı: packages/** ve apps/** altındaki *.test.ts',
  'pnpm-lock.yaml': 'pnpm kilit dosyası (üretilir)',
  '.env.example': 'Sunucu ortam değişkenlerinin örneği; gerçek değerler `.env`te (depoda değil)',
  '.prettierignore': 'Prettier’ın biçimlemediği dosyalar (biçimini üreten aracın belirledikleri)',
  'README.md': 'Projeye giriş: kurulum, yerelde çalıştırma, dağıtım özeti',
  'apps/api/tsup.config.ts': 'Sunucu paketleyicisi (tsup): `dist/` çıktısı',
  'apps/api/src/index.ts':
    'Sunucunun girişi: eklentiler (sıkıştırma, CORS, JWT, güvenlik başlıkları, yazma sınırı), statik arayüz, uçların kaydı, açılış (veritabanı bekleme, migration, dünya)',
  'apps/api/src/auth.ts':
    'Parola özeti (argon2) ve `requireAuth`: jeton, yasak, oturum sürümü, e-posta doğrulama kapısı',
  'apps/api/src/db.ts': 'Prisma istemcisi: bağlantı havuzu ve işlem süreleri',
  'apps/api/src/env.ts': 'Bütün sunucu ortam değişkenleri, varsayılanları ve doğrulaması (zod)',
  'apps/api/src/routes/auth.ts': 'Kayıt, giriş, parola sıfırlama ve e-posta doğrulama uçları',
  'apps/api/src/routes/arastirma.ts': 'Araştırma ağacı uçları: durum, başlat, iptal',
  'apps/api/src/routes/me.ts':
    'Lordun durumu (`/me`), arma, istatistik puanı, öğretici/rehber bitişi, savunma düzeni',
  'apps/mobil/android/app/build.gradle':
    'Android derlemesi: release (Play AAB), deneme (doğrudan APK), debug; imza ve AdMob kimliği ortamdan',
  'apps/mobil/android/app/src/main/AndroidManifest.xml':
    'Android manifestosu: izinler, AdMob uygulama kimliği',
  'apps/web/index.html': 'Arayüzün HTML kabuğu',
  'apps/web/vite.config.ts': 'Vite: çeviri ve çizim sürümü eklentileri, derlemede sıkıştırma',
  'apps/web/src/App.tsx':
    'Arayüzün kökü: oturum, ekran yönlendirmesi, öğretici/rehber, sorgu ön yüklemesi',
  'apps/web/src/styles.css': 'Genel stiller: Tailwind, renk değişkenleri, animasyonlar',
  'apps/web/src/screens/Giris.tsx': 'Giriş ve kayıt ekranı (diyar seçimi, parola sıfırlama isteği)',
  'apps/web/src/main.tsx': 'Arayüzün girişi: React kökü, sorgu istemcisi, yazı tipi, dil',
  'packages/shared/src/index.ts':
    'Ortak paketin dışa açtıkları: bütün modüller (dil.js en üstte, sıra önemli)',
  '.gitignore': 'Git’in yok saydıkları (bağımlılıklar, derleme çıktısı, .env, ekran görüntüleri)',
  'apps/api/tsconfig.json': 'Sunucunun TypeScript ayarları',
  'apps/web/tsconfig.json': 'Arayüzün TypeScript ayarları',
  'packages/shared/tsconfig.json': 'Ortak paketin TypeScript ayarları',
};

const KISA = 150;

function kisalt(s) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= KISA) return s;
  const kes = s.slice(0, KISA);
  return kes.slice(0, kes.lastIndexOf(' ')) + '…';
}

/**
 * Paragrafın ilk cümlesi: yorum satırları birleşip ilk noktada kesiliyor.
 * Tek satır almak cümleleri yarıda bırakıyordu ("… imaj bir kayıt defterine").
 */
function ilkCumle(satirlar) {
  const metin = satirlar.join(' ').replace(/\s+/g, ' ').trim();
  for (const m of metin.matchAll(/[.!?](?=\s|$)/g)) {
    if (m.index < 15) continue;
    // "bkz.", "ör.", "1./7." cümle sonu değil.
    if (/(\b(bkz|ör|vb|vs|bk|krş|yak|no)|\d|\/)$/i.test(metin.slice(0, m.index))) continue;
    return kisalt(metin.slice(0, m.index + 1));
  }
  return kisalt(metin);
}

const AYRAC = /^[─━=\-–—*#_\s]+$/;

/** Dosyanın baştaki yorumundan ilk paragrafın ilk cümlesi. */
function aciklama(yol, metin) {
  if (ELLE[yol]) return ELLE[yol];
  const satirlar = metin.split('\n').slice(0, 150);
  if (yol.endsWith('.md')) {
    const b = satirlar.find((l) => /^#\s/.test(l));
    return b ? kisalt(b.replace(/^#+\s*/, '')) : '';
  }
  if (yol.endsWith('.json')) {
    try {
      const j = JSON.parse(metin);
      for (const k of ['_aciklama', '_', '_not', 'description']) {
        if (typeof j[k] === 'string') return ilkCumle([j[k]]);
      }
      if (typeof j.name === 'string') return `paket ${j.name}`;
    } catch {
      /* JSON değil */
    }
    return '';
  }
  if (yol.endsWith('.txt')) {
    const p = [];
    for (const l of satirlar) {
      if (!l.trim()) {
        if (p.length) break;
        continue;
      }
      p.push(l.trim());
    }
    return ilkCumle(p);
  }
  // Python: baştaki belge dizesi ("""…""").
  if (yol.endsWith('.py')) {
    const bas = satirlar.findIndex((l) => l.trim().startsWith('"""'));
    if (bas >= 0) {
      const p = [];
      for (const l of satirlar.slice(bas)) {
        const ic = l.replace(/"""/g, '').trim();
        if (!ic) {
          if (p.length) break;
          continue;
        }
        p.push(ic);
        if (p.length && l.trim().endsWith('"""') && l.trim() !== '"""') break;
      }
      return ilkCumle(p);
    }
  }
  // # yorumlu dosyalar (yml, sh, py, Dockerfile, ignore dosyaları, properties)
  if (/(\.(ya?ml|sh|py|toml|properties)|Dockerfile|ignore|\.env\.example)$/.test(yol)) {
    const p = [];
    for (const l of satirlar) {
      if (/^#!/.test(l)) continue;
      const m = /^\s*#\s?(.*)$/.exec(l);
      const ic = m ? m[1].trim() : null;
      if (ic === null || !ic || AYRAC.test(ic)) {
        if (p.length) break;
        if (ic === null && l.trim()) break; // yorumdan önce kod: yorum yok
        continue;
      }
      p.push(ic);
    }
    return ilkCumle(p);
  }
  // Blok ya da satır yorumu (ts, tsx, js, mjs, prisma, css, gradle, java, xml)
  return ilkCumle(dosyaYorumu(satirlar));
}

/**
 * Dosyayı anlatan yorum bloğu — bir fonksiyonu anlatan değil.
 *
 * Kabul edilen: dosyanın başındaki (koddan önceki) yorum ya da iki import
 * grubu arasındaki başlık. Bildirimin hemen üstündeki yorum o bildirimi
 * anlatıyor; dosya açıklaması sanılınca harita "Jetonun özeti saklanır"
 * gibi yanlış bir cümleyle yanlış yere götürüyordu.
 */
function dosyaYorumu(satirlar) {
  const bloklar = [];
  for (let i = 0; i < satirlar.length; i++) {
    const l = satirlar[i].trim();
    if (/^\/\*/.test(l)) {
      let son = i;
      while (son < satirlar.length && !satirlar[son].includes('*/')) son++;
      bloklar.push({ bas: i, son, ic: blokMetni(satirlar.slice(i, son + 1)) });
      i = son;
    } else if (/^\/\/(?!.*(eslint|@ts-|prettier-ignore))/.test(l)) {
      let son = i;
      while (son + 1 < satirlar.length && /^\s*\/\//.test(satirlar[son + 1])) son++;
      bloklar.push({
        bas: i,
        son,
        ic: satirlar.slice(i, son + 1).map((x) => x.trim().replace(/^\/\/\s?/, '')),
      });
      i = son;
    } else if (/^<!--/.test(l)) {
      let son = i;
      while (son < satirlar.length && !satirlar[son].includes('-->')) son++;
      bloklar.push({
        bas: i,
        son,
        ic: satirlar.slice(i, son + 1).map((x) => x.replace(/<!--|-->/g, '').trim()),
      });
      i = son;
    }
  }
  const kodMu = (l) => {
    const t = l.trim();
    return t !== '' && !/^(\/\/|\/\*|\*|<!--|<\?xml|#!|['"]use )/.test(t);
  };
  const ilkKod = satirlar.findIndex(kodMu);
  // İlk import OLMAYAN kod satırı: import bloğunun bittiği yer.
  const ilkGovde = satirlar.findIndex(
    (l, i) =>
      kodMu(l) &&
      !/^(import\b|\}\s*from\b|[A-Za-z_$][\w$]*,?$|type\s)/.test(l.trim()) &&
      i >= ilkKod,
  );
  for (const b of bloklar) {
    const sonraki = satirlar[b.son + 1]?.trim() ?? '';
    const bastaMi = ilkKod === -1 || b.bas < ilkKod;
    // İki import grubu arasındaki başlık: ardından yine import geliyor.
    const importlarArasi = /^import\b/.test(sonraki);
    // Import'lardan sonraki ilk blok yorum, ardından boş satır: dosya başlığı.
    // (Bildirimin yorumunun hemen ardından bildirim geliyor, boş satır değil.)
    const importSonrasi =
      /^\s*\/\*/.test(satirlar[b.bas]) && (ilkGovde === -1 || b.bas <= ilkGovde) && sonraki === '';
    if (bastaMi || importlarArasi || importSonrasi) {
      const p = ilkParagraf(b.ic);
      if (p.length) return p;
    }
    if (ilkGovde !== -1 && b.bas > ilkGovde) break;
  }
  return [];
}

function blokMetni(parca) {
  return parca.map((x) =>
    x
      .trim()
      .replace(/^\/\*\*?/, '')
      .replace(/\*\/$/, '')
      .replace(/^\*\s?/, '')
      .trim(),
  );
}

/** Boş satıra ya da ayraca kadar olan ilk paragraf; `@etiket`ler atlanıyor. */
function ilkParagraf(satirlar) {
  const p = [];
  for (const ic of satirlar) {
    if (!ic || AYRAC.test(ic) || ic.startsWith('@')) {
      if (p.length) break;
      continue;
    }
    p.push(ic);
  }
  return p;
}

/** Dışa açılan adlar (fonksiyon, bileşen, sabit, tip). */
function disaAcilanlar(metin) {
  const adlar = new Set();
  const tanim =
    /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const m of metin.matchAll(tanim)) adlar.add(m[1]);
  for (const m of metin.matchAll(/^export\s+(?:type\s+)?\{([^}]+)\}/gm)) {
    for (const parca of m[1].split(',')) {
      const ad = parca
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (ad) adlar.add(ad);
    }
  }
  return [...adlar];
}

/** API uçları: `app.get('/yol', …)` → `GET /api/yol`. */
function uclar(yol, metin) {
  const onek = yol.startsWith('apps/api/src/routes/') ? '/api' : '';
  return [...metin.matchAll(/\bapp\.(get|post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g)].map(
    (m) => `${m[1].toUpperCase()} ${onek}${m[2]}`,
  );
}

const ADLAR_SINIRI = 16;

function satir(yol, metin, testVar) {
  const parcalar = [`- \`${yol}\``];
  const a = aciklama(yol, metin);
  if (a) parcalar.push(`— ${a}`);
  if (/\.(ts|tsx|mjs|js|cjs)$/.test(yol)) {
    const ad = disaAcilanlar(metin);
    if (ad.length) {
      const goster = ad.slice(0, ADLAR_SINIRI).join(', ');
      parcalar.push(
        `· dışa: ${goster}${ad.length > ADLAR_SINIRI ? ` +${ad.length - ADLAR_SINIRI}` : ''}`,
      );
    }
    const u = uclar(yol, metin);
    if (u.length) parcalar.push(`· uçlar: ${u.join(', ')}`);
    // Ortam değişkenleri dışa açılan ad değil: "X ayarı nerede" de bulunsun.
    if (yol === 'apps/api/src/env.ts') {
      const ayarlar = [...metin.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*z\./gm)].map((m) => m[1]);
      if (ayarlar.length) parcalar.push(`· ayarlar: ${ayarlar.join(', ')}`);
    }
  }
  if (testVar) parcalar.push('· (testi var)');
  return parcalar.join(' ');
}

function dosyaListesi() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: KOK,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((y) => y !== 'HARITA.md' && existsSync(join(KOK, y)))
    .sort();
}

function uret() {
  const tum = dosyaListesi();
  const kume = new Set(tum);

  // Konu dizinindeki her yol gerçekten var mı: yoksa harita yalan söyler.
  const kayip = KONULAR.flatMap(([, d]) => d).filter((y) => !kume.has(y));
  if (kayip.length) {
    throw new Error(`Konu dizininde olmayan dosya: ${kayip.join(', ')} — tools/harita.mjs KONULAR`);
  }

  const ozetler = new Map();
  const klasorler = new Map();
  for (const yol of tum) {
    const oz = OZET.find(([re]) => re.test(yol));
    if (oz) {
      const anahtar = oz[1] ?? yol.slice(0, yol.lastIndexOf('/')) ?? '.';
      const k = ozetler.get(anahtar) ?? { sayi: 0, tur: oz[2] };
      k.sayi++;
      ozetler.set(anahtar, k);
      continue;
    }
    // Test dosyası kendi satırını almıyor; kaynağının satırına not düşülüyor.
    if (/\.test\.(ts|tsx|mjs)$/.test(yol) && kume.has(yol.replace(/\.test\./, '.'))) continue;
    const klasor = yol.includes('/') ? yol.slice(0, yol.lastIndexOf('/')) : '.';
    if (!klasorler.has(klasor)) klasorler.set(klasor, []);
    klasorler.get(klasor).push(yol);
  }

  const cikti = [];
  cikti.push('# Proje haritası');
  cikti.push('');
  cikti.push(
    '> ÜRETİLİR — elle düzenleme. `pnpm harita` (tools/harita.mjs) yeniden yazar; CI güncel olmayanı reddeder.',
  );
  cikti.push('');
  cikti.push('## Nasıl kullanılır');
  cikti.push('');
  cikti.push(
    '- Bir dosyayı, fonksiyonu, bileşeni ya da API ucunu ararken önce BU dosyada ara (ör. `tickLord`, `GET /api/map`, `Kisla`, `e-posta`). Depoda dosya dosya tarama yapma.',
  );
  cikti.push('- Konudan başlıyorsan aşağıdaki **Konu dizini**ne bak.');
  cikti.push(
    '- Satır biçimi: `yol` — baştaki yorumun ilk cümlesi · dışa: dışa açılan adlar · uçlar: API uçları · (testi var) = yanında `*.test.*` dosyası var.',
  );
  cikti.push('');
  cikti.push('## Konu dizini');
  cikti.push('');
  for (const [konu, yollar] of KONULAR) {
    cikti.push(`- **${konu}:** ${yollar.map((y) => `\`${y}\``).join(', ')}`);
  }
  cikti.push('');
  cikti.push('## Dosyalar');

  for (const klasor of [...klasorler.keys()].sort((a, b) =>
    a === '.' ? -1 : b === '.' ? 1 : a.localeCompare(b),
  )) {
    cikti.push('');
    const baslik = KLASORLER[klasor];
    cikti.push(`### ${klasor === '.' ? '(kök)' : klasor}${baslik ? ` — ${baslik}` : ''}`);
    cikti.push('');
    for (const yol of klasorler.get(klasor)) {
      const metin = readFileSync(join(KOK, yol), 'utf8');
      const testVar = [/\.(ts|tsx|mjs)$/].some(
        (re) => re.test(yol) && kume.has(yol.replace(/\.(ts|tsx|mjs)$/, '.test.$1')),
      );
      cikti.push(satir(yol, metin, testVar));
    }
  }

  cikti.push('');
  cikti.push('## Özetlenenler (tek tek listelenmiyor)');
  cikti.push('');
  for (const [yer, { sayi, tur }] of [...ozetler].sort((a, b) => a[0].localeCompare(b[0]))) {
    cikti.push(`- \`${yer}/\` — ${sayi} ${tur}`);
  }
  cikti.push('');
  return cikti.join('\n');
}

const metin = uret();
if (process.argv.includes('--denetle')) {
  const eski = existsSync(HEDEF) ? readFileSync(HEDEF, 'utf8') : '';
  if (eski !== metin) {
    console.error('HARITA.md güncel değil: `pnpm harita` ile yeniden üret ve commit et.');
    process.exit(1);
  }
  console.log('HARITA.md güncel.');
} else {
  writeFileSync(HEDEF, metin);
  console.log(
    `HARITA.md yazıldı: ${metin.split('\n').length} satır, ${Math.round(metin.length / 1024)} KB.`,
  );
}
