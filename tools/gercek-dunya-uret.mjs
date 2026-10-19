/**
 * GERÇEK DÜNYA HARİTASI ÜRETİCİSİ (docs/27): Natural Earth verisinden oyunun
 * dünyasını üretir — ülkeler, şehir toprakları, komşuluklar, deniz yolları.
 *
 *   node tools/gercek-dunya-uret.mjs
 *
 * Üç dosya yazıyor:
 *   data/world-map.json                          motor: bölgeler, komşuluk, garnizon, gelir
 *   data/dunya-ozet.json                         ülkeler ve şehir sayısı (telefonun ana paketi)
 *   apps/web/src/components/harita/dunyaGeo.json çizim: ülke kıyıları, şehir toprakları, deniz yolları
 *
 * Kaynak sabit bir sürüm (Natural Earth v5.1.2, kamu malı); ilk koşuda
 * `tools/.dunya-kaynak/` altına iniyor. Sayılar (nüfus eşiği, deniz yolu,
 * garnizon ve gelir kademeleri) `data/balance.json` → `gercek_dunya`.
 *
 * Nasıl:
 *  1. Sınırlar: Natural Earth'ün Türkiye bakış açısı (Kırım Ukrayna'da, KKTC
 *     ayrı); Keşmir'de fiilî kontrol hattı. Bağımlı topraklar (Porto Riko,
 *     Hong Kong, Grönland...) egemen ülkeye katılıyor.
 *  2. Şehirler: nüfusu eşiğin üstündekiler ve her ülkenin başkenti; ülkesi
 *     sınır verisindeki yerinden. Aynı ülkede çok yakın iki nokta tek şehir.
 *     Şehri olmayan büyük adaya (Grönland, Fransız Guyanası) en kalabalık
 *     yerleşimi.
 *  3. İzdüşüm: Natural Earth 1; noktalar 0,1 birime oturtuluyor — komşu iki
 *     ülkenin ortak sınırı iki yanda da aynı noktalar, arada boşluk yok.
 *  4. Toprak: her ülkenin karası, KENDİ şehirleri arasında Voronoi
 *     hücrelerine bölünüyor. Şehirden uzak, şehirsiz parça sahipsiz kalıyor.
 *  5. Kara komşuluğu: hücreler bir ızgaraya basılıyor; birbirine değen iki
 *     hücre komşu — ülke sınırının iki yakasındakiler de.
 *  6. Deniz yolu: karşılıklı kıyı şehirleri (yakınsa). Harita kopuk
 *     kalmasın diye her kopuk parça en yakın kıyıya bağlanıyor.
 *  7. Tür, gelir, garnizon: nüfus kademesinden; başkent TAHT.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Delaunay } from 'd3-delaunay';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import ClipperLib from 'clipper-lib';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAK = join(KOK, 'tools/.dunya-kaynak');
const SURUM = 'v5.1.2';
const DOSYALAR = [
  'ne_10m_populated_places_simple',
  'ne_10m_admin_0_countries_tur',
  'ne_10m_admin_0_countries',
];
const BALANCE = JSON.parse(readFileSync(join(KOK, 'data/balance.json'), 'utf8'));
const B = BALANCE.gercek_dunya;
const BIRIMLER = Object.keys(BALANCE.birimler);

/** İzdüşümün eni (birim); boyu dünyadan çıkıyor. Izgara da bu çözünürlükte. */
const EN = 4000;
/** Noktaların oturtulduğu ızgara (birimin kesri) ve çizim dosyasının çarpanı. */
const OLCEK = 10;
/** Çizim dosyasında sınır sadeleştirme payı (birim). */
const SADELIK = 0.5;
/** Bundan küçük adacık (birim², ~100 km²) haritaya girmiyor; ülkenin en büyüğü hep giriyor. */
const ADACIK = 1;
/** Bundan büyük şehirsiz kara parçasına (birim², ~15.000 km²) en kalabalık yerleşimi ekleniyor. */
const BUYUK_ADA = 150;
/** Şehirsiz parça bu uzaklıktan (birim, ~300 km) yakınsa en yakın şehrin toprağı; uzaksa sahipsiz. */
const UZAK_PARCA = 30;
/** Kara komşuluğunda temas sayılan en az piksel (köşe değmesi sayılmasın). */
const EN_AZ_TEMAS = 3;

/* ── Kaynak ───────────────────────────────────────────────────────────── */

async function kaynakOku(ad) {
  const yol = join(KAYNAK, `${ad}.geojson`);
  if (!existsSync(yol)) {
    mkdirSync(KAYNAK, { recursive: true });
    const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${SURUM}/geojson/${ad}.geojson`;
    console.log(`indiriliyor: ${url}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    writeFileSync(yol, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(readFileSync(yol, 'utf8'));
}

const [yerler, turBakisi, fiili] = await Promise.all(DOSYALAR.map(kaynakOku));

/* ── Ülkeler ──────────────────────────────────────────────────────────── */

/** Keşmir'de Türkiye bakış açısı yerine fiilî kontrol hattı (Siachen Hindistan'da). */
const FIILI = new Set(['IND', 'PAK', 'KAS']);
/**
 * Elle katılanlar. Yabancı üsler bulundukları ülkenin: Limasol'un noktası
 * Akrotiri üssüne düşüyor, Birleşik Krallık'ın şehri olmasın.
 */
const KATILAN = { KAS: 'IND', ESB: 'CYP', WSB: 'CYP', USG: 'CUB' };
/** Egemenine katılan türler; tartışmalı ve belirsizler (Kosova, Filistin) kendi başına. */
const KATILAN_TUR = new Set(['Dependency', 'Country', 'Lease', 'Sovereignty']);
/** Şehir verisindeki kodun sınır verisindeki karşılığı. */
const KOD_ESI = { SSD: 'SDS' };
/** Oyuna alınmayan. */
const ALINMAYAN = new Set(['GIB']);
/** Birden çok başkenti olan ülkede resmî olanı. */
const RESMI_BASKENT = {
  ZAF: 'Pretoria',
  BOL: 'Sucre',
  CIV: 'Yamoussoukro',
  MMR: 'Naypyidaw',
  TZA: 'Dodoma',
};
/** Veride konumu yanlış yerleşim (Vila Velha, Vitória'nın karşı yakası, Amapá'ya düşmüş). */
const KONUM_DUZELT = { 'BRA:Vila Velha': [-20.33, -40.29] };
/**
 * Alınmayan şehir. Melilla İspanya'nın Fas kıyısındaki toprağı; ızgarada
 * bir hücre bile tutmuyor ve Fas'a düşüyordu.
 */
const ALINMAYAN_SEHIR = new Set(['ESP:Melilla']);
/** Şehir verisinde olmayan başkent. */
const EK_SEHIR = [{ ulke: 'CYN', ad: 'Lefkoşa', lat: 35.19, lon: 33.36, nufus: 0, baskent: true }];
/** Uzun resmî adların oyunda kısa hâli. */
const KISA_AD = {
  CHN: ['Çin', 'China'],
  USA: ['ABD', 'United States'],
  GBR: ['Birleşik Krallık', 'United Kingdom'],
  PRK: ['Kuzey Kore', 'North Korea'],
  KOR: ['Güney Kore', 'South Korea'],
  COD: ['Kongo Demokratik Cumhuriyeti', 'DR Congo'],
  COG: ['Kongo', 'Congo'],
  RUS: ['Rusya', 'Russia'],
  TWN: ['Tayvan', 'Taiwan'],
  CYN: ['KKTC', 'Northern Cyprus'],
  CYP: ['Güney Kıbrıs', 'Cyprus'],
};
/**
 * Veride İngilizce ya da eski yazılan şehirlerin oyundaki adı: Türkçede
 * yerleşmiş bir adı olan başkentler ve büyük şehirler (Atina, Moskova,
 * Kahire). Anahtar "ülke:verideki ad"; aynı ad başka ülkede de var
 * (ABD'de bir Athens, bir Alexandria).
 */
const SEHIR_ADI = {
  'TUR:Istanbul': 'İstanbul',
  'TUR:Icel': 'Mersin',
  'TUR:Corum': 'Çorum',
  'TUR:Afyon': 'Afyonkarahisar',
  'TUR:Elâzığ': 'Elazığ',
  'TUR:Adapazarı': 'Sakarya',
  // Başkentler
  'USA:Washington, D.C.': 'Washington',
  'AFG:Kabul': 'Kabil',
  'AUT:Vienna': 'Viyana',
  'AZE:Baku': 'Bakü',
  'BEL:Brussels': 'Brüksel',
  'GBR:London': 'Londra',
  'BIH:Sarajevo': 'Saraybosna',
  'BGR:Sofia': 'Sofya',
  'DZA:Algiers': 'Cezayir',
  'CZE:Prague': 'Prag',
  'CHN:Beijing': 'Pekin',
  'DNK:København': 'Kopenhag',
  'PSX:Gaza City': 'Gazze',
  'KOR:Seoul': 'Seul',
  'GEO:Tbilisi': 'Tiflis',
  'IND:New Delhi': 'Yeni Delhi',
  'IRQ:Baghdad': 'Bağdat',
  'IRN:Tehran': 'Tahran',
  'ISR:Jerusalem': 'Kudüs',
  'ITA:Rome': 'Roma',
  'CYP:Nicosia': 'Güney Lefkoşa',
  'KWT:Kuwait City': 'Kuveyt',
  'MKD:Skopje': 'Üsküp',
  'LBY:Tripoli': 'Trablus',
  'LBN:Beirut': 'Beyrut',
  'LUX:Luxembourg': 'Lüksemburg',
  'EGY:Cairo': 'Kahire',
  'MDA:Chișinău': 'Kişinev',
  'RUS:Moscow': 'Moskova',
  'SRB:Belgrade': 'Belgrad',
  'SYR:Damascus': 'Şam',
  'SAU:Riyadh': 'Riyad',
  'UZB:Tashkent': 'Taşkent',
  'TKM:Ashgabat': 'Aşkabat',
  'KGZ:Bishkek': 'Bişkek',
  'TJK:Dushanbe': 'Duşanbe',
  'POL:Warsaw': 'Varşova',
  'PRT:Lisbon': 'Lizbon',
  'ROU:Bucharest': 'Bükreş',
  'GRC:Athens': 'Atina',
  'UKR:Kyiv': 'Kiev',
  'OMN:Muscat': 'Maskat',
  'YEM:Sanaa': 'Sana',
  'MEX:Mexico City': 'Meksiko',
  'PAN:Panama City': 'Panama',
  'GTM:Guatemala City': 'Guatemala',
  'SOM:Mogadishu': 'Mogadişu',
  'SDN:Khartoum': 'Hartum',
  'ALB:Tirana': 'Tiran',
  'KOS:Pristina': 'Priştine',
  'VAT:Vatican City': 'Vatikan',
  'KAZ:Nur-Sultan': 'Astana',
  'MNG:Ulaanbaatar': 'Ulan Batur',
  'NPL:Kathmandu': 'Katmandu',
  'BGD:Dhaka': 'Dakka',
  'SGP:Singapore': 'Singapur',
  'ARM:Yerevan': 'Erivan',
  // Büyük şehirler
  'CHN:Shanghai': 'Şanghay',
  'CHN:Shenyeng': 'Shenyang',
  'IND:Kolkata': 'Kalküta',
  'PAK:Karachi': 'Karaçi',
  'JPN:Ōsaka': 'Osaka',
  'EGY:Alexandria': 'İskenderiye',
  'SAU:Jeddah': 'Cidde',
  'SAU:Makkah': 'Mekke',
  'SAU:Medina': 'Medine',
  'SYR:Aleppo': 'Halep',
  'SYR:Homs': 'Humus',
  'SYR:Hamah': 'Hama',
  'SYR:Latakia': 'Lazkiye',
  'IRQ:Mosul': 'Musul',
  'IRQ:Kirkuk': 'Kerkük',
  'IRQ:Najaf': 'Necef',
  'IRQ:Karbala': 'Kerbela',
  'IRN:Tabriz': 'Tebriz',
  'IRN:Isfahan': 'İsfahan',
  'IRN:Mashhad': 'Meşhed',
  'IRN:Shiraz': 'Şiraz',
  'IRN:Qom': 'Kum',
  'GRC:Thessaloniki': 'Selanik',
  'BGR:Plovdiv': 'Filibe',
  'GEO:Batumi': 'Batum',
  'UKR:Sevastopol': 'Sivastopol',
  'UKR:Kharkiv': 'Harkov',
  'ITA:Venice': 'Venedik',
  'ITA:Milan': 'Milano',
  'ITA:Naples': 'Napoli',
  'ITA:Genoa': 'Cenova',
  'ITA:Florence': 'Floransa',
  'DEU:Munich': 'Münih',
  'DEU:Cologne': 'Köln',
  'DEU:Hanover': 'Hannover',
  'CHE:Geneva': 'Cenevre',
  'NLD:The Hague': 'Lahey',
  'ESP:Seville': 'Sevilla',
  'MAR:Casablanca': 'Kazablanka',
  'MAR:Marrakesh': 'Marakeş',
  'LBY:Banghazi': 'Bingazi',
  'LBY:Tubruq': 'Tobruk',
  'LBY:Darnah': 'Derne',
  'UZB:Samarkand': 'Semerkant',
  'UZB:Bukhara': 'Buhara',
  'AZE:Naxcivan': 'Nahçıvan',
};

const kaynakUlkeler = [
  ...turBakisi.features.filter((f) => !FIILI.has(f.properties.ADM0_A3)),
  ...fiili.features.filter((f) => FIILI.has(f.properties.ADM0_A3)),
].filter((f) => f.properties.CONTINENT !== 'Antarctica' && !ALINMAYAN.has(f.properties.ADM0_A3));

// Egemenin ana birimi: FR1 → FRA (adı egemenin adı olan birim).
const ANA = new Map();
for (const f of kaynakUlkeler)
  if (f.properties.ADMIN === f.properties.SOVEREIGNT)
    ANA.set(f.properties.SOV_A3, f.properties.ADM0_A3);
const BIRIM = new Map();
for (const f of kaynakUlkeler) {
  const p = f.properties;
  const ana = ANA.get(p.SOV_A3);
  BIRIM.set(p.ADM0_A3, KATILAN[p.ADM0_A3] ?? (KATILAN_TUR.has(p.TYPE) && ana ? ana : p.ADM0_A3));
}

/** Ülke kodu → { kod, ad, adEn, renk, geo[] } */
const ULKE = new Map();
for (const f of kaynakUlkeler) {
  const p = f.properties;
  const kod = BIRIM.get(p.ADM0_A3);
  if (!ULKE.has(kod)) ULKE.set(kod, { kod, geo: [] });
  const u = ULKE.get(kod);
  if (kod === p.ADM0_A3) {
    const [kisa, kisaEn] = KISA_AD[kod] ?? [];
    Object.assign(u, { ad: kisa ?? p.NAME_TR, adEn: kisaEn ?? p.NAME_EN, renk: p.MAPCOLOR7 });
  }
  u.geo.push(f.geometry);
}

/* ── İzdüşüm ve kara ──────────────────────────────────────────────────── */

const izdusum = geoNaturalEarth1().fitWidth(EN, {
  type: 'FeatureCollection',
  features: kaynakUlkeler.map((f) => ({ type: 'Feature', geometry: f.geometry })),
});
const BOY = Math.ceil(
  geoPath(izdusum).bounds({ type: 'FeatureCollection', features: kaynakUlkeler })[1][1],
);
const otur = (v) => Math.round(v * OLCEK) / OLCEK;

/** GeoJSON geometrisini izdüşümdeki halkalara çevirir (antimeridyen kesiliyor). */
function halkalar(geometri) {
  const sonuc = [];
  let h = null;
  geoPath(izdusum, {
    moveTo(x, y) {
      h = [[otur(x), otur(y)]];
      sonuc.push(h);
    },
    lineTo(x, y) {
      const n = [otur(x), otur(y)];
      const s = h[h.length - 1];
      if (n[0] !== s[0] || n[1] !== s[1]) h.push(n);
    },
    closePath() {
      const [a, s] = [h[0], h[h.length - 1]];
      if (h.length > 1 && a[0] === s[0] && a[1] === s[1]) h.pop();
    },
    arc() {},
  })(geometri);
  return sonuc;
}

/** Halkanın alanı (yönsüz). Kapalı ya da açık halka. */
function alan(h) {
  let s = 0;
  for (let i = 0, j = h.length - 1; i < h.length; j = i++)
    s += (h[j][0] + h[i][0]) * (h[j][1] - h[i][1]);
  return Math.abs(s / 2);
}

/** Nokta halkanın içinde mi (çift-tek). */
function icinde(h, x, y) {
  let ic = false;
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
    const [xi, yi] = h[i];
    const [xj, yj] = h[j];
    if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) ic = !ic;
  }
  return ic;
}
const cokgendeMi = (p, x, y) => icinde(p[0], x, y) && !p.slice(1).some((d) => icinde(d, x, y));

function kutu(mp) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of mp)
    for (const r of p)
      for (const [x, y] of r) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  return [x0, y0, x1, y1];
}

/**
 * Çokgen işlemi (Clipper: tamsayı ızgarada, kıyıların binlerce kenarında
 * sağlam). Girdi ve çıktı çokgen dizisi ([dış, ...delikler]), çift-tek kuralı.
 */
function kirp(tur, ozne, kesen) {
  const C = ClipperLib;
  const yola = (mp) =>
    mp.flatMap((p) =>
      p.map((r) => r.map(([x, y]) => ({ X: Math.round(x * OLCEK), Y: Math.round(y * OLCEK) }))),
    );
  const c = new C.Clipper();
  c.AddPaths(yola(ozne), C.PolyType.ptSubject, true);
  if (kesen) c.AddPaths(yola(kesen), C.PolyType.ptClip, true);
  const agac = new C.PolyTree();
  c.Execute(C.ClipType[tur], agac, C.PolyFillType.pftEvenOdd, C.PolyFillType.pftEvenOdd);
  const cikti = [];
  const gez = (dugum) => {
    for (const dis of dugum.Childs()) {
      const p = [dis.Contour()];
      for (const delik of dis.Childs()) {
        p.push(delik.Contour());
        gez(delik); // gölün içindeki ada
      }
      cikti.push(p.map((r) => r.map((q) => [q.X / OLCEK, q.Y / OLCEK])));
    }
  };
  gez(agac);
  return cikti;
}

// Ülkenin karası: çok küçük adacıklar düşüyor (en büyüğü hep kalıyor),
// çift-tek kuralıyla tek çokgen (komşu birimlerin ortak kenarı siliniyor,
// içteki ülke delik). Izgaraya sığmayan ülke (Vatikan) boş kalıyor.
for (const u of ULKE.values()) {
  let h = u.geo.flatMap(halkalar).filter((r) => r.length >= 3);
  const enBuyuk = Math.max(...h.map(alan));
  h = h.filter((r) => alan(r) >= ADACIK || alan(r) === enBuyuk);
  u.kara = h.length
    ? kirp(
        'ctUnion',
        h.map((r) => [r]),
      )
    : [];
  u.parcaKutu = u.kara.map((p) => kutu([p]));
}

/* ── Izgara ───────────────────────────────────────────────────────────── */

/** Çokgeni (çift-tek) ızgaraya basar; basılan piksel sayısı. */
function bas(iz, id, mp) {
  const kenar = [];
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const p of mp)
    for (const r of p)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xa, ya] = r[j];
        const [xb, yb] = r[i];
        if (ya === yb) continue;
        kenar.push([xa, ya, xb, yb]);
        ymin = Math.min(ymin, ya, yb);
        ymax = Math.max(ymax, ya, yb);
      }
  let n = 0;
  for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(BOY - 1, Math.ceil(ymax)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const [xa, ya, xb, yb] of kenar)
      if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc))
        xs.push(xa + ((yc - ya) * (xb - xa)) / (yb - ya));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(EN - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) {
        iz[y * EN + x] = id;
        n++;
      }
    }
  }
  return n;
}

/** Ülke ızgarası: 0 deniz, yoksa ülke sırası + 1. */
const ULKE_SIRA = [...ULKE.values()];
const IZ_U = new Uint16Array(EN * BOY);
ULKE_SIRA.forEach((u, i) => bas(IZ_U, i + 1, u.kara));

/** Noktanın ülkesi: üstündeki, denizdeyse 3 birim içindeki en yakın kara. */
function noktaninUlkesi(x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let r = 0; r <= 3; r++) {
    let enIyi = null;
    for (let yy = cy - r; yy <= cy + r; yy++)
      for (let xx = cx - r; xx <= cx + r; xx++) {
        if (xx < 0 || yy < 0 || xx >= EN || yy >= BOY) continue;
        const v = IZ_U[yy * EN + xx];
        if (!v) continue;
        const d = (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2;
        if (!enIyi || d < enIyi[0]) enIyi = [d, v];
      }
    if (enIyi) return ULKE_SIRA[enIyi[1] - 1].kod;
  }
  return null;
}

/* ── Şehirler ─────────────────────────────────────────────────────────── */

const RAD = Math.PI / 180;
/** İki nokta arası büyük daire uzaklığı (km). */
function km(a, b) {
  const s1 = Math.sin(((b.lat - a.lat) * RAD) / 2);
  const s2 = Math.sin(((b.lon - a.lon) * RAD) / 2);
  const h = s1 * s1 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * s2 * s2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ülkenin ızgarada (x, y)'ye `r` piksel içinde bir karesi var mı. */
const ULKE_NO = new Map(ULKE_SIRA.map((u, i) => [u.kod, i + 1]));
function yakinindaMi(x, y, kod, r) {
  const no = ULKE_NO.get(kod);
  for (let yy = Math.floor(y) - r; yy <= Math.floor(y) + r; yy++)
    for (let xx = Math.floor(x) - r; xx <= Math.floor(x) + r; xx++)
      if (xx >= 0 && yy >= 0 && xx < EN && yy < BOY && IZ_U[yy * EN + xx] === no) return true;
  return false;
}

// Her yerleşimin ülkesi sınır verisindeki yerinden (Sivastopol Ukrayna'da,
// Hargeisa Somali'de). Başkent kendi ülkesinde kalıyor: Lefkoşa'nın iki yakası
// aynı pikselde. Sınırın bir piksel (~10 km) yanındaki şehirde verideki ülke
// geçiyor: Detroit, Buffalo, El Paso, Basel, Nusaybin ızgarada karşı yakaya
// düşüyordu. Kerç iki piksel ötede; Kırım şehirleri Ukrayna'da kalıyor.
const tumYerler = [];
const KULLANILAN_AD = new Set();
for (const f of yerler.features) {
  const p = { ...f.properties, name: f.properties.name.replace(/\s+/g, ' ') };
  if (ALINMAYAN_SEHIR.has(`${p.adm0_a3}:${p.name}`)) continue;
  const duzelt = KONUM_DUZELT[`${p.adm0_a3}:${p.name}`];
  if (duzelt) [p.latitude, p.longitude] = duzelt;
  const [x, y] = izdusum([p.longitude, p.latitude]);
  const veride = BIRIM.get(KOD_ESI[p.adm0_a3] ?? p.adm0_a3);
  const baskentAday =
    p.featurecla === 'Admin-0 capital' &&
    veride &&
    ULKE.has(veride) &&
    veride === (KOD_ESI[p.adm0_a3] ?? p.adm0_a3);
  const sinirda = noktaninUlkesi(x, y);
  const ulke =
    baskentAday || (ULKE.has(veride) && sinirda !== veride && yakinindaMi(x, y, veride, 1))
      ? veride
      : (sinirda ?? (ULKE.has(veride) ? veride : null));
  if (!ulke) continue;
  const yeniAd = SEHIR_ADI[`${ulke}:${p.name}`];
  if (yeniAd) KULLANILAN_AD.add(`${ulke}:${p.name}`);
  tumYerler.push({
    ulke,
    ad: yeniAd ?? p.name,
    nufus: p.pop_max ?? 0,
    lat: p.latitude,
    lon: p.longitude,
    x,
    y,
    baskentAday,
  });
}
// Tablodaki bir ad veride yoksa (yazım değişti, şehir başka ülkeye düştü) söyle.
for (const k of Object.keys(SEHIR_ADI))
  if (!KULLANILAN_AD.has(k)) throw new Error(`SEHIR_ADI eşleşmedi: ${k}`);
for (const e of EK_SEHIR) {
  const [x, y] = izdusum([e.lon, e.lat]);
  tumYerler.push({ ...e, x, y, baskentAday: true });
}

let sehirler = tumYerler.filter((s) => s.nufus >= B.nufus_esigi || s.baskentAday);

// Her ülkenin tek başkenti: resmî olan, yoksa verideki, o da yoksa en büyük şehir.
for (const u of ULKE.values()) {
  const s = sehirler.filter((x) => x.ulke === u.kod);
  if (!s.length) continue;
  const resmi = RESMI_BASKENT[u.kod];
  const secilen =
    (resmi && s.find((x) => x.ad === resmi)) ??
    s.filter((x) => x.baskentAday).sort((a, b) => b.nufus - a.nufus)[0] ??
    [...s].sort((a, b) => b.nufus - a.nufus)[0];
  for (const x of s) x.baskent = x === secilen;
}
sehirler = sehirler.filter((x) => x.baskent || x.nufus >= B.nufus_esigi);

// Aynı ülkede çok yakın iki nokta tek şehir: başkent, yoksa büyüğü kalıyor.
{
  const sira = [...sehirler].sort(
    (a, b) => Number(b.baskent) - Number(a.baskent) || b.nufus - a.nufus,
  );
  const kalan = [];
  for (const s of sira) {
    if (kalan.some((k) => k.ulke === s.ulke && km(k, s) < B.birlesme_km)) continue;
    kalan.push(s);
  }
  sehirler = kalan;
}

// Şehri olmayan ülke oyunda yok.
for (const kod of [...ULKE.keys()]) if (!sehirler.some((s) => s.ulke === kod)) ULKE.delete(kod);

// Şehirsiz büyük kara parçasına (Grönland, Fransız Guyanası, Sahalin) en
// kalabalık yerleşimi: yoksa ya sahipsiz kalırdı ya da okyanusun öbür
// yakasındaki bir şehrin toprağı olurdu.
let eklenen = 0;
for (const u of ULKE.values())
  u.kara.forEach((p, i) => {
    if (alan(p[0]) < BUYUK_ADA) return;
    const [x0, y0, x1, y1] = u.parcaKutu[i];
    const icindeki = (s) =>
      s.ulke === u.kod &&
      s.x >= x0 &&
      s.x <= x1 &&
      s.y >= y0 &&
      s.y <= y1 &&
      cokgendeMi(p, s.x, s.y);
    if (sehirler.some(icindeki)) return;
    const aday = tumYerler.filter(icindeki).sort((a, b) => b.nufus - a.nufus)[0];
    if (!aday) return;
    sehirler.push({ ...aday, baskent: false });
    eklenen++;
  });

/* ── Kimlik ───────────────────────────────────────────────────────────── */

const trSira = new Intl.Collator('tr');
const ULKELER = [...ULKE.values()].sort((a, b) => trSira.compare(a.ad, b.ad));
sehirler.sort(
  (a, b) =>
    trSira.compare(ULKE.get(a.ulke).ad, ULKE.get(b.ulke).ad) ||
    Number(b.baskent) - Number(a.baskent) ||
    b.nufus - a.nufus ||
    trSira.compare(a.ad, b.ad),
);
sehirler.forEach((s, i) => (s.id = i + 1));

/* ── Toprak: ülke içinde Voronoi, kıyıya ve sınıra kırpılmış ──────────── */

const daire = (x, y, r) => [
  [
    Array.from({ length: 8 }, (_, k) => [
      otur(x + r * Math.cos((k * Math.PI) / 4)),
      otur(y + r * Math.sin((k * Math.PI) / 4)),
    ]),
  ],
];
/** Çokgenin noktaya en yakın köşesinin uzaklığı. */
const uzaklik = (p, x, y) =>
  Math.sqrt(Math.min(...p[0].map(([a, b]) => (a - x) ** 2 + (b - y) ** 2)));

let sahipsiz = 0;
for (const u of ULKELER) {
  const s = sehirler.filter((x) => x.ulke === u.kod);
  if (!u.kara.length) continue;
  let hucreler;
  if (s.length === 1) hucreler = [u.kara];
  else {
    const [x0, y0, x1, y1] = kutu(u.kara);
    const vor = Delaunay.from(s.map((x) => [x.x, x.y])).voronoi([x0 - 5, y0 - 5, x1 + 5, y1 + 5]);
    hucreler = s.map((_, i) => {
      const c = vor.cellPolygon(i);
      if (!c) return [];
      const [cx0, cy0, cx1, cy1] = kutu([[c]]);
      const yakin = u.kara.filter((_, k) => {
        const [a, b, c2, d] = u.parcaKutu[k];
        return a <= cx1 && c2 >= cx0 && b <= cy1 && d >= cy0;
      });
      return yakin.length ? kirp('ctIntersection', [[c]], yakin) : [];
    });
  }
  s.forEach((x, i) => {
    // Şehri içermeyen ve uzak parça (başka bir kıyıdaki şehirsiz ada) sahipsiz.
    x.hucre = hucreler[i].filter((p) => {
      const tut = cokgendeMi(p, x.x, x.y) || uzaklik(p, x.x, x.y) <= UZAK_PARCA;
      if (!tut) sahipsiz++;
      return tut;
    });
  });
}
// Karaya düşmeyen (adacığı haritaya sığmayan) şehre küçük bir toprak.
for (const s of sehirler) if (!s.hucre?.length) s.hucre = daire(s.x, s.y, 2);
for (const u of ULKELER)
  if (!u.kara.length) u.kara = sehirler.filter((s) => s.ulke === u.kod).flatMap((s) => s.hucre);

/* ── Izgara: kara komşuluğu ve kıyı ───────────────────────────────────── */

const IZ = new Uint16Array(EN * BOY);
for (const s of sehirler) s.piksel = bas(IZ, s.id, s.hucre);
// Izgaraya sığmayan küçük toprak (Vatikan, Monako): şehrin olduğu yer.
for (const s of sehirler) {
  if (s.piksel > 0) continue;
  const cx = Math.floor(s.x);
  const cy = Math.floor(s.y);
  const ulke = ULKE_SIRA.indexOf(ULKE.get(s.ulke)) + 1;
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= EN || y >= BOY) continue;
      IZ[y * EN + x] = s.id;
      if (!IZ_U[y * EN + x]) IZ_U[y * EN + x] = ulke;
    }
}

const KOMSU_KAYMA = [
  [1, 0],
  [2, 0],
  [0, 1],
  [0, 2],
  [1, 1],
  [-1, 1],
  [1, 2],
  [-1, 2],
  [2, 1],
  [-2, 1],
];
const temas = new Map();
const kiyi = new Uint8Array(sehirler.length + 1);
const denizMi = (x, y) => x < 0 || y < 0 || x >= EN || y >= BOY || !IZ_U[y * EN + x];
for (let y = 0; y < BOY; y++)
  for (let x = 0; x < EN; x++) {
    const a = IZ[y * EN + x];
    if (!a) continue;
    if (denizMi(x - 1, y) || denizMi(x + 1, y) || denizMi(x, y - 1) || denizMi(x, y + 1))
      kiyi[a] = 1;
    for (const [dx, dy] of KOMSU_KAYMA) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || xx >= EN || yy >= BOY) continue;
      const b = IZ[yy * EN + xx];
      if (!b || b === a) continue;
      const k = a < b ? a * 65536 + b : b * 65536 + a;
      temas.set(k, (temas.get(k) ?? 0) + 1);
    }
  }

const KOMSU = new Map(sehirler.map((s) => [s.id, new Set()]));
const DENIZ = [];
const bagla = (a, b) => {
  KOMSU.get(a).add(b);
  KOMSU.get(b).add(a);
};
for (const [k, n] of temas) if (n >= EN_AZ_TEMAS) bagla(Math.floor(k / 65536), k % 65536);
// Tek pikselle değen minik toprak (Vatikan): bir temas da yeter.
for (const s of sehirler)
  if (!KOMSU.get(s.id).size)
    for (const [k] of temas) {
      const a = Math.floor(k / 65536);
      const b = k % 65536;
      if (a === s.id || b === s.id) bagla(a, b);
    }

/* ── Deniz yolları ve tek parça harita ────────────────────────────────── */

function parcalar() {
  const ana = new Map(sehirler.map((s) => [s.id, s.id]));
  const bul = (x) => {
    while (ana.get(x) !== x) {
      ana.set(x, ana.get(ana.get(x)));
      x = ana.get(x);
    }
    return x;
  };
  for (const [a, ks] of KOMSU) for (const b of ks) ana.set(bul(a), bul(b));
  return bul;
}

/** Şehirden şehre düz çizgi denizden geçiyor ve üçüncü bir ülkeye değmiyor mu. */
function denizdenMi(a, b) {
  if (Math.abs(a.x - b.x) > EN / 2) return true; // antimeridyenin iki yakası
  let deniz = 0;
  const N = 32;
  for (let k = 1; k < N; k++) {
    const x = Math.floor(a.x + ((b.x - a.x) * k) / N);
    const y = Math.floor(a.y + ((b.y - a.y) * k) / N);
    if (denizMi(x, y)) deniz++;
    else {
      const u = ULKE_SIRA[IZ_U[y * EN + x] - 1].kod;
      if (u !== a.ulke && u !== b.ulke) return false;
    }
  }
  return deniz / (N - 1) >= 0.25;
}

{
  const kara = parcalar();
  const kiyidakiler = sehirler.filter((s) => kiyi[s.id]);
  const aday = [];
  for (let i = 0; i < kiyidakiler.length; i++)
    for (let j = i + 1; j < kiyidakiler.length; j++) {
      const a = kiyidakiler[i];
      const b = kiyidakiler[j];
      if (KOMSU.get(a.id).has(b.id)) continue;
      if (a.ulke === b.ulke && kara(a.id) === kara(b.id)) continue;
      const d = km(a, b);
      if (d <= B.deniz_yolu_km) aday.push([d, a, b]);
    }
  aday.sort((x, y) => x[0] - y[0]);
  const derece = new Map();
  for (const [, a, b] of aday) {
    if ((derece.get(a.id) ?? 0) >= B.sehir_basina_deniz_yolu) continue;
    if ((derece.get(b.id) ?? 0) >= B.sehir_basina_deniz_yolu) continue;
    if (!denizdenMi(a, b)) continue;
    bagla(a.id, b.id);
    DENIZ.push([a.id, b.id]);
    derece.set(a.id, (derece.get(a.id) ?? 0) + 1);
    derece.set(b.id, (derece.get(b.id) ?? 0) + 1);
  }
}

// Kopuk parçalar en yakın kıyıya (Kruskal: parçalar arası en kısa yollar).
let zorunlu = 0;
for (;;) {
  const bul = parcalar();
  const koklar = new Set(sehirler.map((s) => bul(s.id)));
  if (koklar.size === 1) break;
  const enIyi = new Map();
  const kiyidakiler = sehirler.filter((s) => kiyi[s.id]);
  for (let i = 0; i < kiyidakiler.length; i++)
    for (let j = i + 1; j < kiyidakiler.length; j++) {
      const a = kiyidakiler[i];
      const b = kiyidakiler[j];
      const ka = bul(a.id);
      const kb = bul(b.id);
      if (ka === kb) continue;
      const anahtar = ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
      const d = km(a, b);
      const e = enIyi.get(anahtar);
      if (!e || d < e[0]) enIyi.set(anahtar, [d, a.id, b.id]);
    }
  const kenarlar = [...enIyi.values()].sort((x, y) => x[0] - y[0]);
  const ana = new Map([...koklar].map((k) => [k, k]));
  const kbul = (x) => (ana.get(x) === x ? x : kbul(ana.get(x)));
  for (const [, a, b] of kenarlar) {
    const ka = kbul(bul(a));
    const kb = kbul(bul(b));
    if (ka === kb) continue;
    ana.set(ka, kb);
    bagla(a, b);
    DENIZ.push([a, b]);
    zorunlu++;
  }
}

/* ── Tür, gelir, garnizon ─────────────────────────────────────────────── */

function kararli(metin) {
  let h = 2166136261;
  for (const c of metin) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}
const turler = Object.entries(B.tur_agirliklari);
const turToplam = turler.reduce((t, [, a]) => t + a, 0);
function karisikTur(s) {
  let r = kararli(`${s.ulke}:${s.ad}`) % turToplam;
  for (const [t, a] of turler) {
    if (r < a) return t;
    r -= a;
  }
  return turler[0][0];
}
const ordu = (o, oran = 1) =>
  Object.fromEntries(BIRIMLER.map((b) => [b, Math.round((o[b] ?? 0) * oran)]));
const sehirSayisi = new Map();
for (const s of sehirler) sehirSayisi.set(s.ulke, (sehirSayisi.get(s.ulke) ?? 0) + 1);

const regions = sehirler.map((s) => {
  let type;
  let gelir;
  let garnizon;
  if (s.baskent) {
    const k = B.baskent;
    const n = sehirSayisi.get(s.ulke);
    const oran = Math.min(
      1,
      k.garnizon_en_az_oran +
        ((1 - k.garnizon_en_az_oran) * (n - 1)) / (k.garnizon_tam_sehir_sayisi - 1),
    );
    type = k.tur;
    gelir = k.gelir_carpani;
    garnizon = ordu(k.garnizon, oran);
  } else {
    const k = B.kademeler.find((x) => s.nufus >= x.en_az_nufus);
    type = k.tur ?? karisikTur(s);
    gelir = k.gelir_carpani;
    // Kale köyden zor: kademenin garnizonu türün çarpanıyla.
    garnizon = ordu(k.garnizon, B.tur_garnizon_carpani[type] ?? 1);
  }
  return {
    id: s.id,
    name: s.ad,
    type,
    arazi: 'ova',
    kiyi: Boolean(kiyi[s.id]),
    province: s.ulke,
    x: Math.round((s.x / EN) * 100000) / 1000,
    y: Math.round((s.y / BOY) * 100000) / 1000,
    lat: Math.round(s.lat * 100) / 100,
    lon: Math.round(s.lon * 100) / 100,
    nufus: s.nufus,
    komsular: [...KOMSU.get(s.id)].sort((a, b) => a - b),
    level: 1,
    income_mult: gelir,
    npc_garrison: garnizon,
    unique: Boolean(s.baskent),
  };
});

const ust = {
  schema: 'lordlar-cagi/world-map@2',
  _not:
    'GERCEK DUNYA (docs/27). Elle duzenlenmez: tools/gercek-dunya-uret.mjs Natural Earth ' +
    SURUM +
    ' verisinden uretiyor, sayilar balance.json -> gercek_dunya. province = ulke kodu (ADM0_A3); her ulkenin baskenti TAHT. ' +
    'Komsuluk: toprak hucreleri birbirine degiyorsa (ulke sinirinin iki yakasi da) ya da karsilikli kiyilar denizden yakinsa (deniz_yollari). ' +
    'x/y yuzdelik, YALNIZ cizim icin (dunyaGeo.json ile ayni izdusum); motor mesafeyi komsuluk grafiginden aliyor.',
  region_count: regions.length,
  deniz_yollari: DENIZ.map(([a, b]) => (a < b ? [a, b] : [b, a])).sort(
    (p, q) => p[0] - q[0] || p[1] - q[1],
  ),
  provinces: ULKELER.map((u) => ({
    key: u.kod,
    name: u.ad,
    name_en: u.adEn,
    baskent: sehirler.find((s) => s.ulke === u.kod && s.baskent).id,
    renk: u.renk,
  })),
};
// Satır başına bir kayıt: dosya küçük, fark okunur.
const dizi = (d) => `[\n${d.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`;
const metin =
  '{\n' +
  Object.entries({ ...ust, regions })
    .map(
      ([k, v]) =>
        `  ${JSON.stringify(k)}: ${Array.isArray(v) && typeof v[0] === 'object' ? dizi(v) : JSON.stringify(v)}`,
    )
    .join(',\n') +
  '\n}\n';

/* ── Çizim dosyası: ülke kıyıları ve toprak hücreleri ─────────────────── */

/** Douglas-Peucker; kapalı halkada ilk nokta sona eklenip öyle sadeleşiyor. */
function sadelestir(halka, pay) {
  const n = halka.length;
  if (n < 4) return halka;
  const ilk = halka[0];
  const son = halka[n - 1];
  const nokta = ilk[0] === son[0] && ilk[1] === son[1] ? halka : [...halka, ilk];
  const tut = new Uint8Array(nokta.length);
  tut[0] = tut[nokta.length - 1] = 1;
  const yigin = [[0, nokta.length - 1]];
  while (yigin.length) {
    const [a, b] = yigin.pop();
    const [ax, ay] = nokta[a];
    const [bx, by] = nokta[b];
    const dx = bx - ax;
    const dy = by - ay;
    const uz = Math.hypot(dx, dy);
    let enUzak = -1;
    let i = -1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = nokta[k];
      const d = uz ? Math.abs((px - ax) * dy - (py - ay) * dx) / uz : Math.hypot(px - ax, py - ay);
      if (d > enUzak) {
        enUzak = d;
        i = k;
      }
    }
    if (enUzak > pay) {
      tut[i] = 1;
      yigin.push([a, i], [i, b]);
    }
  }
  const sonuc = nokta.filter((_, k) => tut[k]);
  sonuc.pop();
  return sonuc;
}

/** Halka → tamsayı, ilk nokta mutlak, sonrakiler fark. */
function kodla(h) {
  const cikti = [];
  let px = 0;
  let py = 0;
  for (const [x, y] of h) {
    const ix = Math.round(x * OLCEK);
    const iy = Math.round(y * OLCEK);
    if (cikti.length && ix === px && iy === py) continue;
    cikti.push(ix - px, iy - py);
    px = ix;
    py = iy;
  }
  return cikti;
}
/** Çokgen → kodlu halkalar; sadeleşince üç noktanın altına düşen halka (en büyüğü değilse) atılıyor. */
function cizimHalkalari(mp) {
  const halkalar = mp.flatMap((p) => p.map((r) => sadelestir(r, SADELIK)));
  const enBuyuk = Math.max(...halkalar.map(alan));
  return halkalar.filter((r) => r.length >= 3 || alan(r) === enBuyuk).map(kodla);
}
const geo = {
  _not: 'tools/gercek-dunya-uret.mjs uretiyor (docs/27). Koordinat = birim x olcek, halkada ilki mutlak, sonrakiler fark. Cift-tek kurali.',
  en: EN,
  boy: BOY,
  olcek: OLCEK,
  ulkeler: ULKELER.map((u) => ({ k: u.kod, h: cizimHalkalari(u.kara) })),
  hucreler: sehirler.map((s) => cizimHalkalari(s.hucre)),
  /** Deniz yolları: bölge kimliği çiftleri (kesik çizgi). */
  deniz: ust.deniz_yollari,
};

writeFileSync(join(KOK, 'data/world-map.json'), metin);
// Telefonun ana paketine giren özet: ülke adları ve sayılar. Haritanın
// tamamı (bir MB'a yakın) yalnız sunucuda; arayüz bölgeleri API'den alıyor.
const ozet = {
  _not: 'tools/gercek-dunya-uret.mjs uretiyor (docs/27): world-map.json ozeti.',
  region_count: regions.length,
  provinces: ust.provinces,
};
writeFileSync(
  join(KOK, 'data/dunya-ozet.json'),
  `{\n  "_not": ${JSON.stringify(ozet._not)},\n  "region_count": ${ozet.region_count},\n  "provinces": ${dizi(ozet.provinces)}\n}\n`,
);
writeFileSync(
  join(KOK, 'apps/web/src/components/harita/dunyaGeo.json'),
  JSON.stringify(geo) + '\n',
);

/* ── Özet ─────────────────────────────────────────────────────────────── */

const derece = regions.map((r) => r.komsular.length);
const say = (f) => regions.filter(f).length;
console.log(
  `ülke ${ULKELER.length} · şehir ${regions.length} (büyük adaya eklenen ${eklenen}) · taht ${say((r) => r.type === 'taht')} · kıyı ${say((r) => r.kiyi)}`,
);
console.log(
  `komşuluk derecesi: en az ${Math.min(...derece)}, ortalama ${(derece.reduce((a, b) => a + b, 0) / derece.length).toFixed(2)}, en çok ${Math.max(...derece)}`,
);
console.log(
  `deniz yolu ${DENIZ.length} (kopukluğu gideren ${zorunlu}) · sahipsiz kara parçası ${sahipsiz}`,
);
console.log(
  `türler: ${JSON.stringify(Object.fromEntries(['koy', 'tarla', 'maden', 'sehir', 'kale', 'taht'].map((t) => [t, say((r) => r.type === t)])))}`,
);
