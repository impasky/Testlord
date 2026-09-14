/**
 * ÇEVİRİ LİSTESİ — çevirmenin okuyacağı düz dosya.
 *
 * `metin-cikar.mjs` MAKİNE için yazıyor: hash anahtarları, dosya yolları,
 * JSON. Bu araç aynı içeriği İNSAN için yazıyor — numaralı düz cümleler.
 *
 * Oyuncunun sorusu şuydu: "2142 metni çeviremiyorum." Haklı, ve cevabı
 * sayıyı kandırmak değil, üç gerçek şey:
 *
 *   1. ÇEVRİLMEYECEKLERİ ÇIKAR. Bölge adları özel addır ("Akçakavak
 *      Köyü"), cümle parçaları ise tek başına çevrilemez (" ve ",
 *      ", boş") — onlar önce kodda birleştirilmeli.
 *   2. SIRALA. Oyuncunun ilk saatinde gördüğü metin, hiç açmadığı bir
 *      panelin ipucuyla aynı sırada bekleyemez.
 *   3. PARÇALA. Bir oturuşta bitmeyen iş, üç oturuşta biter; tek dosya
 *      olarak verince hiç başlanmıyor.
 *
 * Numaralar KALICI: `ceviri/numaralar.json` numarayı anahtara bağlıyor ve
 * yeni metin geldiğinde sona ekleniyor. Yeniden numaralandırmak, yarım
 * kalmış bir çeviriyi çöpe atmak demekti.
 *
 *   node tools/ceviri-liste.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KOK = new URL('../ceviri/', import.meta.url);
const sozluk = JSON.parse(readFileSync(new URL('metinler.json', KOK), 'utf8'));

/* ---------------------------------------------------------------- */
/* 1. Çevrilmeyecekler                                               */
/* ---------------------------------------------------------------- */

/**
 * Cümle parçası mı — yani tek başına çevrilemez mi.
 *
 * Kodda `<span>{ad}</span> ve <span>{soyad}</span>` gibi birleştirmelerden
 * doğuyorlar. Çevirmene " ve " diye bir satır vermek işe yaramaz: hangi
 * cümlenin ortasında durduğunu bilmeden çeviremez, üstelik başka dilde
 * sözcük sırası değişince parça yanlış yere düşer.
 */
function parcaMi(s) {
  if (/^\s/.test(s) || /\s$/.test(s)) return true;
  if (/^\s*[·—–,:;+|.]/.test(s)) return true;
  if (/[·—–,:;+|]\s*$/.test(s)) return true;
  if (/\b(ve|ile|veya|için|sonra|ama)\s*$/i.test(s.trim())) return true;

  /*
   * Küçük harfle başlayan, birden çok sözcüklü ve noktalamayla biten
   * dizge: bir cümlenin DEVAMI. Öğreticide bir cümle dizinin iki
   * elemanına bölünüyor ("... kalkanın var" + "buradan büyür.") ve
   * ikincisi tek başına çevrilemiyor.
   *
   * Üç şart da gerekli: `kapat` tek sözcük (gerçek düğme yazısı),
   * `parola, öğretici, çıkış` noktalamayla bitmiyor (gerçek alt başlık).
   * Üçünü birden sağlayan bir dizge cümle ortası demektir.
   */
  const t = s.trim();
  if (/\p{Ll}/u.test(t[0] ?? '') && /\s/.test(t) && /[.,;]$/.test(t)) return true;
  return false;
}

/* ---------------------------------------------------------------- */
/* 2. Sıra — oyuncu neyi ne zaman görüyor                            */
/* ---------------------------------------------------------------- */

/**
 * Partiler, oyuncunun onlarla karşılaşma sırasına göre.
 *
 * Ölçüt "kaç metin var" değil, "çevrilmezse oyun ne kadar kırık
 * görünür". 1. parti bitince oyun BAŞTAN SONA oynanabilir hâlde ve
 * yabancı bir oyuncu hiçbir yerde Türkçe duvara çarpmaz; 2. parti
 * derinliği, 3. parti nadir görülen kuyruğu açar.
 */
const PARTILER = [
  {
    no: 1,
    ad: 'Oyunu oynanır kılan',
    aciklama:
      'Gezinme, düğmeler, kaynak ve birim adları, ilk saatin ekranları ve öğretici. ' +
      'Bu parti bitince oyun baştan sona oynanabilir.',
    tutar: (y, g) =>
      g === 'motor' ||
      /ogretici|rehber|ipuclari/.test(y) ||
      /components\/(ui|MobilKabuk|Omurga|Zemin|BosHal|Ikonlar|Kaynak|Maliyet|Sure)\b/.test(y) ||
      /screens\/(Giris|Sehir|Kisla|Harita|LordEkrani|ParolaSifirla)\b/.test(y),
  },
  {
    no: 2,
    ad: 'Derinlik',
    aciklama:
      'Savaş raporu, demirhane, generaller, araştırma, ittifak, akın — ve bina, ' +
      'general, araştırma, başarım içerikleri.',
    tutar: (y, g) => g === 'veri' || /apps\/web\/src\//.test(y),
  },
  {
    no: 3,
    ad: 'Kuyruk',
    aciklama:
      'Sunucu hataları ve bildirimleri. Oyuncu bunları ancak bir şey ters gidince ' +
      'görüyor; en sona bırakılabilir ama atlanamaz.',
    tutar: () => true,
  },
];

function partiNo(v) {
  const y = v.nerede[0] ?? '';
  return PARTILER.find((p) => p.tutar(y, v.grup)).no;
}

/** İnsanın "nerede geçiyor" diye sorduğunda okuyacağı ad. */
function alanAdi(v) {
  const y = v.nerede[0] ?? '';
  if (v.grup === 'veri') return 'İçerik (bina, general, araştırma, başarım)';
  if (y.includes('apps/api')) return 'Sunucu mesajları';
  if (/ogretici/.test(y)) return 'Öğretici';
  if (/rehber|ipuclari/.test(y)) return 'Rehber ve ipuçları';
  const m = /apps\/web\/src\/(?:screens|components)\/([A-Za-z]+)/.exec(y);
  if (m) return m[1];
  if (/packages\/shared/.test(y)) return 'Oyun motoru';
  return 'Diğer';
}

/* ---------------------------------------------------------------- */
/* 3. Kalıcı numaralar                                               */
/* ---------------------------------------------------------------- */

const numaraYolu = new URL('numaralar.json', KOK);
/** numara -> anahtar. Bir kez verilen numara ASLA başka metne geçmiyor. */
const numaralar = existsSync(numaraYolu) ? JSON.parse(readFileSync(numaraYolu, 'utf8')) : {};
const anahtarNumarasi = new Map(Object.entries(numaralar).map(([n, a]) => [a, Number(n)]));
let siradaki = Math.max(0, ...Object.keys(numaralar).map(Number)) + 1;

/* ---------------------------------------------------------------- */

const cevrilecek = [];
const ozelAdlar = [];
const parcalar = [];

for (const [anahtar, v] of Object.entries(sozluk)) {
  if (v.grup === 'harita') {
    ozelAdlar.push(v.tr);
    continue;
  }
  if (parcaMi(v.tr)) {
    parcalar.push({ tr: v.tr, nerede: v.nerede[0] ?? '' });
    continue;
  }
  let n = anahtarNumarasi.get(anahtar);
  if (n === undefined) {
    n = siradaki++;
    numaralar[n] = anahtar;
    anahtarNumarasi.set(anahtar, n);
  }
  cevrilecek.push({ n, anahtar, tr: v.tr, parti: partiNo(v), alan: alanAdi(v), en: v.en });
}

writeFileSync(numaraYolu, JSON.stringify(numaralar, null, 0) + '\n');

/* ---------------------------------------------------------------- */
/* 4. Dosyaları yaz                                                  */
/* ---------------------------------------------------------------- */

const DOSYA = { 1: '1-once-bunlar.txt', 2: '2-sonra-bunlar.txt', 3: '3-en-son-bunlar.txt' };

for (const p of PARTILER) {
  const satirlar = cevrilecek.filter((c) => c.parti === p.no);
  // Alana göre öbekle: aynı ekranın metinleri yan yana olunca çevirmen
  // bağlamı bir kez kuruyor. Alan içinde numara sırası korunuyor.
  const alanlar = new Map();
  for (const c of satirlar) {
    if (!alanlar.has(c.alan)) alanlar.set(c.alan, []);
    alanlar.get(c.alan).push(c);
  }
  const sirali = [...alanlar.entries()].sort((a, b) => b[1].length - a[1].length);

  const govde = [
    `LORDLAR ÇAĞI — ÇEVİRİ ${p.no}/3: ${p.ad.toUpperCase()}`,
    '',
    kir(p.aciklama, 74),
    '',
    `Bu dosyada ${satirlar.length} satır var.`,
    '',
    'NASIL ÇEVİRİLİR',
    '  Her satırın başındaki numara DEĞİŞMEMELİ — çeviriyi metne o bağlıyor.',
    '  Türkçesinin yerine İngilizcesini yaz, numarayı ve noktayı bırak:',
    '',
    '      12. Ordun yetiyor.        ->   12. Your army is enough.',
    '',
    '  {0} ve {1} birer yer tutucu; oyun onların yerine sayı ya da ad',
    '  koyuyor. Sırası değişebilir, kendisi silinemez.',
    '',
    '  Bitince dosyayı olduğu gibi geri ver; gerisini ben hallederim.',
    '',
    '='.repeat(74),
    '',
  ];

  for (const [alan, kayitlar] of sirali) {
    govde.push(`--- ${alan} (${kayitlar.length}) ---`, '');
    for (const c of kayitlar.sort((a, b) => a.n - b.n)) {
      govde.push(`${c.n}. ${c.en || c.tr}`);
    }
    govde.push('');
  }

  writeFileSync(new URL(DOSYA[p.no], KOK), govde.join('\n'));
  console.log(`${DOSYA[p.no].padEnd(22)} ${String(satirlar.length).padStart(5)} satır — ${p.ad}`);
}

/* Çevrilmeyecekler: ayrı dosya, sebebiyle birlikte. */
writeFileSync(
  new URL('cevrilmeyecekler.txt', KOK),
  [
    'LORDLAR ÇAĞI — ÇEVİRİLMEYECEK METİNLER',
    '',
    kir(
      'Bu dosya çeviri için DEĞİL. Burada duranlar bilerek çeviri listesinin ' +
        'dışında bırakıldı; ne olduklarını ve neden dışarıda kaldıklarını ' +
        'görebilesin diye yazılıyor.',
      74,
    ),
    '',
    '='.repeat(74),
    '',
    `--- Bölge ve vilayet adları (${ozelAdlar.length}) ---`,
    '',
    kir(
      'Bunlar ÖZEL AD. "Akçakavak Köyü" İngilizce oynayan biri için de ' +
        "Akçakavak Köyü; Londra'nın Fransızcada Londra kalması gibi. Oyun " +
        "Anadolu'da geçiyor ve yer adları o dünyanın parçası.",
      74,
    ),
    '',
    ...ozelAdlar.sort().map((a) => `  ${a}`),
    '',
    `--- Cümle parçaları (${parcalar.length}) ---`,
    '',
    kir(
      'Bunlar tek başına çevrilemez, çünkü tek başına bir anlamı yok: kodda ' +
        'başka metinlerle birleşerek cümle oluyorlar (" ve ", ", boş" gibi). ' +
        'Bir çevirmene bunları vermek işe yaramaz — hangi cümlenin ortasında ' +
        'durduğunu bilmeden çeviremez, üstelik İngilizcede sözcük sırası ' +
        'değişince parça yanlış yere düşer. Bunların çözümü çeviri değil KOD: ' +
        'birleştirmelerin tek bir şablona dönmesi gerekiyor. Dil ayarını ' +
        'kurarken bu işi yapacağım.',
      74,
    ),
    '',
    ...parcalar
      .sort((a, b) => a.tr.localeCompare(b.tr, 'tr'))
      .map((p) => `  ${JSON.stringify(p.tr)}\n      ${p.nerede}`),
    '',
  ].join('\n'),
);

console.log(
  `cevrilmeyecekler.txt   ${String(ozelAdlar.length + parcalar.length).padStart(5)} satır — ` +
    `${ozelAdlar.length} özel ad, ${parcalar.length} cümle parçası`,
);
console.log(`\nÇevrilecek toplam: ${cevrilecek.length} (sözlükte ${Object.keys(sozluk).length})`);

/** Uzun açıklamayı sabit genişlikte satırlara böler. */
function kir(metin, en) {
  const cikti = [];
  let satir = '';
  for (const kelime of metin.split(/\s+/)) {
    if (satir && (satir + ' ' + kelime).length > en) {
      cikti.push(satir);
      satir = kelime;
    } else satir = satir ? satir + ' ' + kelime : kelime;
  }
  if (satir) cikti.push(satir);
  return cikti.join('\n');
}
