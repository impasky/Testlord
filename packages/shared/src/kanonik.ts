/**
 * KANONİK HARİTA — `data/world-map.json`un kendisi ve ondan türeyenler
 * (docs/27). YALNIZ SUNUCU VE TESTLER: `@lordlar/shared/kanonik` yolundan
 * okunuyor, paketin ana girişinden değil.
 *
 * Neden ayrı: gerçek dünya haritası bir MB'a yakın. Ana girişten
 * dışa açılsaydı telefonun ilk indirdiği pakete girerdi; oysa arayüz
 * bölgeleri zaten API'den alıyor ve ülke adlarını küçük bir özetten
 * (`ulkeler.ts`) okuyor.
 */
import worldMapJson from '../../../data/world-map.json';
import type { RegionDef } from './types.js';
import { DUNYA_OZETI, type UlkeDef } from './ulkeler.js';
import { haritaGrafi, satirKurucu, type HaritaGrafi } from './harita.js';

export const WORLD_MAP = worldMapJson as unknown as {
  region_count: number;
  provinces: UlkeDef[];
  /** Kıyıdan kıyıya yollar (docs/27): komşulukta zaten var, ayrımı çizim için. */
  deniz_yollari: [number, number][];
  regions: RegionDef[];
};

/** Bölge kimliği → komşularının kimlikleri. */
export const KOMSULUK: ReadonlyMap<number, readonly number[]> = new Map(
  WORLD_MAP.regions.map((r) => [r.id, Object.freeze([...r.komsular])]),
);

/**
 * DENİZ YOLLARI — kıyıdan kıyıya komşuluklar (docs/27).
 *
 * Motor için ayrı bir kural DEĞİL: komşuluk komşuluktur. Ayrım çizimde:
 * oyuncu denizi aşan yolu görmeden İngiltere'nin Fransa'ya neden komşu
 * olduğunu anlayamaz.
 */
const yolAnahtari = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export const DENIZ_YOLLARI: ReadonlySet<string> = new Set(
  (WORLD_MAP.deniz_yollari ?? []).map(([a, b]) => yolAnahtari(a, b)),
);

/** Bu iki bölge arasındaki yol denizden mi geçiyor. */
export function denizYoluMu(a: number, b: number): boolean {
  return DENIZ_YOLLARI.has(yolAnahtari(a, b));
}

/** Haritadaki bütün bölge kimlikleri, dosyadaki sırayla. */
export const BOLGE_IDLERI: readonly number[] = WORLD_MAP.regions.map((r) => r.id);

const KANONIK = satirKurucu(KOMSULUK);

/**
 * Haritanın çapı: birbirine en uzak iki bölge arasındaki adım sayısı.
 * İlk soruluşta hesaplanıyor (açılışta değil: telefon da bu paketi yüklüyor).
 */
export function enUzakMesafe(): number {
  return KANONIK.enUzak();
}

/**
 * İki bölge arasındaki mesafe: komşuluk grafiğinde en kısa yol.
 *
 * Bilinmeyen ya da ulaşılamayan bölge için `enUzakMesafe()` döner —
 * sonsuz değil. Sonsuz dönseydi çağıran taraftaki her süre hesabı NaN'a
 * düşerdi; en uzak mesafe hem sonlu hem de "çok uzak" anlamını taşıyor.
 */
export function bolgeMesafesi(a: number, b: number): number {
  return KANONIK.mesafe(a, b);
}

/** İki bölge bitişik mi. */
export function komsuMu(a: number, b: number): boolean {
  return (KOMSULUK.get(a) ?? []).includes(b);
}

/**
 * Ordunun bir hedefe GERÇEK mesafesi: en yakın toprağından ölçülür.
 *
 * Eskiden mesafe yalnız malikâneden ölçülüyordu ve ızgara bu yüzden boş
 * bir süstü: bölgenin senin bölgene bitişik olmasıyla haritanın öbür
 * ucunda olması arasında fark yoktu. Şimdi aldığın her bölge bir çıkış
 * noktası — toprak sahibi olmak haritayı AÇIYOR.
 *
 * Kartopu riski yok: tutulabilecek bölge sayısı seviyeye bağlı. Ev her
 * zaman listede, yani toprağı olmayan lord eskisi gibi oynamaya devam
 * eder.
 */
export function yakinlikMesafesi(
  evBolgeId: number,
  topraklarim: readonly number[],
  hedefBolgeId: number,
): number {
  let enAz = bolgeMesafesi(evBolgeId, hedefBolgeId);
  for (const t of topraklarim) {
    const d = bolgeMesafesi(t, hedefBolgeId);
    if (d < enAz) enAz = d;
  }
  return enAz;
}

/** Kanonik haritanın grafiği — yeni dünyaların ve testlerin başlangıcı. */
export const KANONIK_GRAFIK: HaritaGrafi = haritaGrafi(KOMSULUK);

/**
 * HARİTA SÜRÜMÜ — kanonik haritanın içeriğinden türetilir.
 *
 * Elle yazılan bir sürüm numarası er ya da geç unutulur: haritayı
 * değiştirip sürümü artırmayan bir commit, tam da korunmak istenen
 * kazayı yapar. Bu yüzden sürüm haritanın KENDİSİNDEN çıkıyor —
 * bölgenin yerini, adını, türünü ve komşuluğunu değiştiren her düzenleme
 * sürümü kendiliğinden değiştiriyor, unutulacak bir adım yok.
 *
 * Gelir çarpanı ve NPC garnizonu da içeride: ikisi de "burası neresi"
 * sorusunun parçası ve ikisi de denge ayarıyla değişiyor.
 *
 * Hash 32 bit FNV-1a: kriptografik değil, çakışmaya karşı da değil —
 * "aynı mı, değil mi" sorusuna cevap veren kısa ve okunabilir bir imza.
 */
export const HARITA_SURUMU: string = (() => {
  const ozet = WORLD_MAP.regions
    .map((r) =>
      [
        r.id,
        r.name,
        r.type,
        r.province,
        r.x,
        r.y,
        r.level,
        r.income_mult,
        [...r.komsular].sort((a, b) => a - b).join('.'),
        Object.entries(r.npc_garrison ?? {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('.'),
      ].join('|'),
    )
    .sort()
    .join('\n');

  let h = 0x811c9dc5;
  for (let i = 0; i < ozet.length; i++) {
    h ^= ozet.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `h${WORLD_MAP.regions.length}-${h.toString(16).padStart(8, '0')}`;
})();

/**
 * Haritanın sağlığı — sunucu açılışta denge doğrulamasının yanında
 * çağırıyor (`validateBalance` ana girişte; harita burada, çünkü haritanın
 * kendisi burada).
 */
export function haritayiDogrula(): void {
  const hatalar: string[] = [];
  if (WORLD_MAP.regions.length !== WORLD_MAP.region_count) {
    hatalar.push('world-map.json: region_count ile gerçek bölge sayısı uyuşmuyor');
  }
  /*
   * HER ÜLKENİN TEK TAHTI, o da başkenti (docs/27). Taht kuralları
   * (kaybetme koruması, günlük hakka sayılmaması) bir bölgenin türüne
   * bağlı; başkent olmayan bir taht ya da tahtı olmayan bir ülke kuralı
   * sessizce bozardı.
   */
  const ulkeler = new Map(WORLD_MAP.provinces.map((p) => [p.key, p]));
  if (ulkeler.size !== WORLD_MAP.provinces.length) hatalar.push('world-map.json: tekrar eden ülke');
  const bolge = new Map(WORLD_MAP.regions.map((r) => [r.id, r]));
  for (const p of WORLD_MAP.provinces) {
    const b = bolge.get(p.baskent);
    if (!b || b.type !== 'taht' || b.province !== p.key) {
      hatalar.push(`${p.name}: başkenti (${p.baskent}) bu ülkenin tahtı değil`);
    }
  }
  for (const r of WORLD_MAP.regions) {
    const u = ulkeler.get(r.province);
    if (!u) hatalar.push(`${r.name}: olmayan ülke (${r.province})`);
    else if (r.type === 'taht' && u.baskent !== r.id)
      hatalar.push(`${r.name}: başkent olmayan taht`);
  }

  /*
   * KOMŞULUK GRAFİĞİ (docs/12 §1).
   *
   * Altıgen ızgara kalkınca mesafe artık aritmetikten değil elle yazılmış
   * bir listeden geliyor. Elle yazılan liste bozulabilir ve bozulduğunda
   * sessizce bozulur: tek yönlü bir kenar, oraya giden yürüyüşü uzun,
   * dönüşü kısa yapar ve kimse fark etmez. Grafiğin sağlığı bu yüzden
   * denge doğrulamasının parçası.
   */
  if (bolge.size !== WORLD_MAP.regions.length) {
    hatalar.push('world-map.json: tekrar eden bölge kimliği var');
  }
  for (const r of WORLD_MAP.regions) {
    if (r.komsular.includes(r.id)) hatalar.push(`${r.name}: kendi kendine komşu`);
    for (const k of r.komsular) {
      const karsi = bolge.get(k);
      if (!karsi) {
        hatalar.push(`${r.name}: olmayan bölgeye komşu (${k})`);
        continue;
      }
      // Komşuluk KARŞILIKLI olmalı. Tek yönlü kenar, gidiş ve dönüş
      // sürelerinin farklı çıkmasına yol açardı.
      if (!karsi.komsular.includes(r.id)) {
        hatalar.push(`${r.name} → ${karsi.name} komşuluğu tek yönlü`);
      }
    }
    if (r.komsular.length === 0) hatalar.push(`${r.name}: hiçbir bölgeye komşu değil`);
    if (r.x < 0 || r.x > 100 || r.y < 0 || r.y > 100) {
      hatalar.push(`${r.name}: harita üzerindeki yeri (${r.x}, ${r.y}) 0-100 dışında`);
    }
  }
  // Harita TEK PARÇA olmalı: kopuk bir küme, oraya hiç saldıramamak demek.
  {
    const komsuluk = new Map(WORLD_MAP.regions.map((r) => [r.id, r.komsular]));
    const gorulen = new Set<number>();
    const kuyruk = [WORLD_MAP.regions[0]?.id].filter((x): x is number => x !== undefined);
    gorulen.add(kuyruk[0]!);
    for (let i = 0; i < kuyruk.length; i++) {
      for (const k of komsuluk.get(kuyruk[i]!) ?? []) {
        if (gorulen.has(k)) continue;
        gorulen.add(k);
        kuyruk.push(k);
      }
    }
    if (gorulen.size !== WORLD_MAP.regions.length) {
      hatalar.push(
        `world-map.json: harita kopuk — ${WORLD_MAP.regions.length} bölgenin ${gorulen.size} tanesine ulaşılıyor`,
      );
    }
  }

  /*
   * ÖZET haritanın kendisinden üretiliyor (`data/dunya-ozet.json`) ve
   * telefonun ana paketi ülkeleri oradan okuyor. İkisi ayrışırsa arayüz
   * olmayan bir ülkeyi gösterir ya da sayısını yanlış yazar.
   */
  if (DUNYA_OZETI.region_count !== WORLD_MAP.region_count) {
    hatalar.push('dunya-ozet.json: şehir sayısı world-map.json ile uyuşmuyor');
  }
  if (JSON.stringify(DUNYA_OZETI.provinces) !== JSON.stringify(WORLD_MAP.provinces)) {
    hatalar.push(
      'dunya-ozet.json: ülkeler world-map.json ile uyuşmuyor (tools/gercek-dunya-uret.mjs)',
    );
  }
  if (hatalar.length > 0) {
    throw new Error(`Harita verisi geçersiz:\n  - ${hatalar.join('\n  - ')}`);
  }
}
