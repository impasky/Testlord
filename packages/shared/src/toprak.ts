/**
 * TOPRAK — dünya haritasının geometrisi (docs/23).
 *
 * Oyuncu: "nerenin ne olduğu anlaşılmıyor, hangi bölge kimin belli
 * değil." Harita bir NOKTA haritasıydı: her bölge 24 piksellik bir
 * madalyon, sahibi de etrafındaki ince bir halka. Oysa "burası kimin"
 * bir ALAN sorusu. Gözün cevabı renkli topraklardan ve sınırlardan
 * okuduğu bir soru.
 *
 * Bu dosya noktaları toprağa çeviriyor. Her bölge bir Voronoi hücresi:
 * ona diğer bölgelerden daha yakın olan her yer. Motor bunu OKUMUYOR,
 * yalnız çizim; komşuluk kuralı hâlâ `komsular` grafiğinde. Hücreler
 * bölgelerin x/y'sinden türediği için harita sürümüne (HARITA_SURUMU)
 * dokunmuyor ve canlı bir dünya kendi eski haritasını taşısa da onun
 * noktalarından kendi topraklarını çiziyor.
 *
 * SAF: veritabanı yok, DOM yok. Hesap istemcide yapılıyor (121 bölge
 * için birkaç milisaniye) ve buradaki testlerle sınanıyor.
 */

export interface Nokta {
  x: number;
  y: number;
}

export interface ToprakGirdisi extends Nokta {
  id: number;
}

/**
 * Bir bölgenin toprağı: dışbükey bir çokgen.
 *
 * `komsu[i]`, `kose[i] → kose[i+1]` kenarını HANGİ bölgenin çizdiği:
 * o kenar iki bölgenin ortak sınırı. `null` haritanın kenarı. Sınırlar
 * bu bilgiyle ayrı ayrı boyanıyor (aynı sahip ince, farklı lord kalın).
 */
export interface Hucre {
  id: number;
  kose: Nokta[];
  komsu: (number | null)[];
  merkez: Nokta;
  alan: number;
}

export interface Kutu {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const DUNYA: Kutu = { x0: 0, y0: 0, x1: 100, y1: 100 };
const EPS = 1e-9;

/**
 * Dışbükey çokgeni bir yarı düzlemle kırpar (Sutherland–Hodgman) ve her
 * kenarın kaynağını taşır.
 *
 * Yarı düzlem: p'ye q'dan yakın noktalar — `(x - m)·(q - p) <= 0`,
 * m orta nokta. Kırpmanın açtığı yeni kenar p ile q'nun ortak sınırı,
 * kaynağı q.
 */
function kirp(
  kose: Nokta[],
  komsu: (number | null)[],
  p: Nokta,
  q: ToprakGirdisi,
): { kose: Nokta[]; komsu: (number | null)[] } {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const deger = (a: Nokta) => (a.x - mx) * dx + (a.y - my) * dy;
  const kesis = (a: Nokta, b: Nokta): Nokta => {
    const da = deger(a);
    const db = deger(b);
    const t = da / (da - db);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  const yeniKose: Nokta[] = [];
  const yeniKomsu: (number | null)[] = [];
  const n = kose.length;
  for (let i = 0; i < n; i++) {
    const a = kose[i]!;
    const b = kose[(i + 1) % n]!;
    const ic = deger(a) <= EPS;
    const bic = deger(b) <= EPS;
    if (ic && bic) {
      yeniKose.push(a);
      yeniKomsu.push(komsu[i]!);
    } else if (ic && !bic) {
      yeniKose.push(a);
      yeniKomsu.push(komsu[i]!);
      yeniKose.push(kesis(a, b));
      yeniKomsu.push(q.id);
    } else if (!ic && bic) {
      yeniKose.push(kesis(a, b));
      yeniKomsu.push(komsu[i]!);
    }
  }
  return { kose: yeniKose, komsu: yeniKomsu };
}

function alanVeMerkez(kose: Nokta[]): { alan: number; merkez: Nokta } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < kose.length; i++) {
    const p = kose[i]!;
    const q = kose[(i + 1) % kose.length]!;
    const c = p.x * q.y - q.x * p.y;
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  a /= 2;
  if (Math.abs(a) < EPS) {
    const ort = kose.reduce((t, k) => ({ x: t.x + k.x, y: t.y + k.y }), { x: 0, y: 0 });
    return { alan: 0, merkez: { x: ort.x / kose.length, y: ort.y / kose.length } };
  }
  return { alan: Math.abs(a), merkez: { x: cx / (6 * a), y: cy / (6 * a) } };
}

/**
 * Bütün bölgelerin toprakları.
 *
 * Her bölge için kutudan başlayıp öteki her bölgenin orta dikmesiyle
 * kırpılıyor. Yakından uzağa sıralı: bir bölgenin orta dikmesi hücrenin
 * en uzak köşesinden de uzaktaysa ondan sonraki hiçbiri kırpamaz ve
 * döngü kesiliyor. 121 bölgede istemci için birkaç milisaniye.
 */
export function topraklar(
  noktalar: readonly ToprakGirdisi[],
  kutu: Kutu = DUNYA,
): Map<number, Hucre> {
  const sonuc = new Map<number, Hucre>();
  for (const p of noktalar) {
    let kose: Nokta[] = [
      { x: kutu.x0, y: kutu.y0 },
      { x: kutu.x1, y: kutu.y0 },
      { x: kutu.x1, y: kutu.y1 },
      { x: kutu.x0, y: kutu.y1 },
    ];
    let komsu: (number | null)[] = [null, null, null, null];
    const digerleri = noktalar
      .filter((q) => q.id !== p.id)
      .map((q) => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) }))
      .sort((a, b) => a.d - b.d);
    for (const { q, d } of digerleri) {
      if (d < EPS) continue; // aynı yerde iki bölge: veri hatası, çizimi bozmasın
      const enUzak = Math.max(...kose.map((k) => Math.hypot(k.x - p.x, k.y - p.y)));
      if (d / 2 > enUzak) break;
      ({ kose, komsu } = kirp(kose, komsu, p, q));
      if (kose.length < 3) break;
    }
    const { alan, merkez } = alanVeMerkez(kose);
    sonuc.set(p.id, { id: p.id, kose, komsu, merkez, alan });
  }
  return sonuc;
}

/** SVG `d` dizgesi: 0–100 uzayında, iki basamak — ekranda ~0,01 piksel. */
export function toprakYolu(h: Hucre): string {
  if (h.kose.length === 0) return '';
  const k = h.kose.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  return `M${k.join('L')}Z`;
}

/** Nokta dışbükey hücrenin içinde mi (kenar dahil). */
export function hucredeMi(h: Hucre, n: Nokta): boolean {
  let isaret = 0;
  for (let i = 0; i < h.kose.length; i++) {
    const a = h.kose[i]!;
    const b = h.kose[(i + 1) % h.kose.length]!;
    const c = (b.x - a.x) * (n.y - a.y) - (b.y - a.y) * (n.x - a.x);
    if (Math.abs(c) < 1e-7) continue;
    const s = Math.sign(c);
    if (isaret === 0) isaret = s;
    else if (s !== isaret) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Sınırlar                                                            */
/* ------------------------------------------------------------------ */

/** Bir toprağın kime ait olduğu — sınırın kalınlığını bu belirliyor. */
export interface Sahiplik {
  benim: boolean;
  /** Tutan lordun kimliği; sahipsizse null. */
  lord: string | null;
  /** Tutan medeniyetin kimliği; çekişmeliyse null. */
  medeniyet: string | null;
}

/**
 * İki komşu toprak arasındaki sınırın türü. Göz önce sınırı okur; dört
 * kademe var ve her biri bir soruyu cevaplıyor:
 *
 *   ben        senin toprağının kenarı — altın. "Benimki nerede bitiyor."
 *   lord       iki ayrı lordun ya da lordla sahipsizin arası — kalın.
 *              "Kimin toprağı nerede bitiyor."
 *   medeniyet  iki medeniyetin arası — orta. "Cephe hattı nerede."
 *   ic         aynı sahibin iki bölgesi — ince. Bölge yine seçilebilir
 *              ama toprak tek parça okunur.
 */
export type SinirTuru = 'ben' | 'lord' | 'medeniyet' | 'ic';

export function sinirTuru(a: Sahiplik, b: Sahiplik): SinirTuru {
  if (a.benim !== b.benim) return 'ben';
  if (a.lord !== b.lord && (a.lord !== null || b.lord !== null)) return 'lord';
  if (a.medeniyet !== b.medeniyet) return 'medeniyet';
  return 'ic';
}

export interface SinirKenari {
  a: number;
  b: number;
  p: Nokta;
  q: Nokta;
}

/** Her ortak kenar BİR kez (a < b): çift çizilen çizgi kalınlaşıp titrer. */
export function sinirKenarlari(hucreler: Map<number, Hucre>): SinirKenari[] {
  const liste: SinirKenari[] = [];
  for (const h of hucreler.values()) {
    for (let i = 0; i < h.kose.length; i++) {
      const b = h.komsu[i];
      if (b == null || b < h.id || !hucreler.has(b)) continue;
      liste.push({ a: h.id, b, p: h.kose[i]!, q: h.kose[(i + 1) % h.kose.length]! });
    }
  }
  return liste;
}

/* ------------------------------------------------------------------ */
/* Kümeler — lord adı toprağın ortasında, bir kez                     */
/* ------------------------------------------------------------------ */

export interface Kume {
  anahtar: string;
  idler: number[];
  /** Etiketin yeri: kümenin içinde kalması GARANTİ olan bir nokta. */
  merkez: Nokta;
  alan: number;
}

/**
 * Aynı anahtarı taşıyan BİTİŞİK toprakların kümeleri.
 *
 * Bitişiklik toprağın kendisinden (ortak kenar), oyunun yol grafiğinden
 * değil: etiket göze bitişik görünen bütünün ortasına konmalı. Bir
 * lordun iki ayrı parçası iki etiket alıyor — haritalarda da öyle.
 *
 * Etiketin yeri ağırlık merkezine en yakın ÜYE hücrenin merkezi: dışbükey
 * olmayan bir kümenin ağırlık merkezi kümenin dışına, başka bir lordun
 * toprağına düşebiliyordu.
 */
export function kumeler(
  hucreler: Map<number, Hucre>,
  anahtar: (id: number) => string | null,
): Kume[] {
  const goruldu = new Set<number>();
  const sonuc: Kume[] = [];
  for (const h of hucreler.values()) {
    const k = anahtar(h.id);
    if (k === null || goruldu.has(h.id)) continue;
    const idler: number[] = [];
    const yigin = [h.id];
    goruldu.add(h.id);
    while (yigin.length) {
      const id = yigin.pop()!;
      idler.push(id);
      for (const n of hucreler.get(id)!.komsu) {
        if (n == null || goruldu.has(n) || !hucreler.has(n) || anahtar(n) !== k) continue;
        goruldu.add(n);
        yigin.push(n);
      }
    }
    const uyeler = idler.map((id) => hucreler.get(id)!);
    const alan = uyeler.reduce((t, u) => t + u.alan, 0);
    const ax = uyeler.reduce((t, u) => t + u.merkez.x * u.alan, 0) / (alan || 1);
    const ay = uyeler.reduce((t, u) => t + u.merkez.y * u.alan, 0) / (alan || 1);
    const enYakin = uyeler.reduce((en, u) =>
      Math.hypot(u.merkez.x - ax, u.merkez.y - ay) < Math.hypot(en.merkez.x - ax, en.merkez.y - ay)
        ? u
        : en,
    );
    sonuc.push({ anahtar: k, idler, merkez: enYakin.merkez, alan });
  }
  return sonuc.sort((a, b) => b.alan - a.alan);
}

/* ------------------------------------------------------------------ */
/* Hedefler merceği                                                    */
/* ------------------------------------------------------------------ */

/** Bir bölgeye saldırmanın önündeki KALICI engel. */
export type HedefEngeli = 'cekirdek' | 'yoldas' | 'muttefik' | 'pakt' | 'kalkan';

export type HedefDurumu =
  { tur: 'benim' } | { tur: 'yasak'; sebep: HedefEngeli } | { tur: 'acik'; adim: number };

export interface HedefGirdisi {
  isMine: boolean;
  owner: { id: string } | null;
  medeniyet: { id: string } | null;
  cekirdek: boolean;
  shielded: boolean;
  paktli?: boolean;
  muttefik?: boolean;
  distance: number;
}

/**
 * "Buraya saldırabilir miyim" — sunucunun kurallarının haritadaki eşi.
 *
 * Sıra `routes/map.ts`deki kontrol sırasıyla aynı: kendi bölgen, çekirdek,
 * aynı medeniyetten bir LORDUN toprağı (medeniyetin tuttuğu ama lordu
 * olmayan bölge serbest — orada karşındaki yoldaşın değil NPC garnizonu),
 * ittifak üyesi, pakt, kalkan. Günlük hak ve lordun yarası geçici ve
 * bölgeye değil lorda ait; onlar bölge kartında söyleniyor.
 */
export function hedefDurumu(r: HedefGirdisi, benimMedeniyet: string | null): HedefDurumu {
  if (r.isMine) return { tur: 'benim' };
  if (r.cekirdek) return { tur: 'yasak', sebep: 'cekirdek' };
  if (r.owner && r.medeniyet && benimMedeniyet && r.medeniyet.id === benimMedeniyet) {
    return { tur: 'yasak', sebep: 'yoldas' };
  }
  if (r.owner && r.muttefik) return { tur: 'yasak', sebep: 'muttefik' };
  if (r.owner && r.paktli) return { tur: 'yasak', sebep: 'pakt' };
  if (r.shielded) return { tur: 'yasak', sebep: 'kalkan' };
  return { tur: 'acik', adim: r.distance };
}
