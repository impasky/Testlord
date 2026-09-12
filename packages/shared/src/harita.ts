/**
 * Harita topolojisi — mesafe ve komşuluk.
 *
 * ── Neden altıgen ızgara kalktı ───────────────────────────────────────
 *
 * Oyuncunun cümlesi kısaydı: "hex sistemi olmasın." Altıgenler oyunu bir
 * diyar değil bir tablo gibi gösteriyordu. Ama ızgaranın MEKANİK olarak
 * yaptığı üç iş vardı — yürüyüş mesafesi, komşuluk kuralı, vilayet
 * gruplaması — ve üçü de aslında koordinat aritmetiğine değil tek bir
 * soruya bağlıydı: HANGİ BÖLGE HANGİSİNE BİTİŞİK.
 *
 * O soruyu doğrudan veriye yazınca altıgene hiç ihtiyaç kalmıyor. Artık
 * her bölge komşularını `world-map.json` içinde açıkça taşıyor ve mesafe
 * bu grafikte en kısa yol.
 *
 * İlk geçişte komşuluklar eski altıgen komşuluklarından TÜRETİLMİŞTİ ve
 * bu, altıgeni sökmeden görüntüsünü sökmek anlamına geliyordu: grafik
 * hâlâ bir kafesti. Ölçüldü — 61 bölgenin 37'sinin tam 6, 18'inin tam 4
 * komşusu vardı. Her yer birbirine benziyordu; bir geçidi tutmakla
 * ovanın ortasında oturmak arasında fark yoktu.
 *
 * Harita artık ÇİZİLMİŞ ZEMİNDEN türetiliyor (`tools/harita-kur.py`,
 * docs/12 §11): bölgeler araziye serpiliyor, komşuluk Delaunay'dan çıkıp
 * budanıyor, dağın arkasına yalnız GEÇİTLERDEN geçiliyor. Derece dağılımı
 * artık 2'den 7'ye yayılıyor — yani haritada dar boğaz da var kavşak da.
 * Dengenin omurgası değişmedi: gelir çarpanı ve NPC garnizonu hâlâ Taht
 * Kalesi'ne uzaklıktan geliyor.
 *
 * ── x/y'yi motor OKUMAZ ───────────────────────────────────────────────
 *
 * Bölgelerin `x`/`y` alanı yalnızca çizim içindir: haritanın resmi
 * üzerinde işaretçinin duracağı yer. Mesafe ve komşuluk buradan
 * hesaplanmaz. Bu kasıtlı — harita resmini yeniden ürettiğimizde
 * işaretçileri yeniden yerleştirmek gerekecek ve o iş oyunun kurallarını
 * kaydırmamalı. (Ters yönü de doğru: x/y artık RESİMDEN geliyor, yani
 * zemin değişirse harita da değişir ve `harita-kur.py` yeniden koşar.)
 */
import { WORLD_MAP } from './balance.js';

/** Bölge kimliği → komşularının kimlikleri. */
export const KOMSULUK: ReadonlyMap<number, readonly number[]> = new Map(
  WORLD_MAP.regions.map((r) => [r.id, Object.freeze([...r.komsular])]),
);

/**
 * GEÇİTLER — dağı aşan komşuluklar.
 *
 * Haritanın bütün meselesi bunlar. Komşuluk grafiği Delaunay'dan çıkıp
 * budanırken dağ aşan her kenar atılıyor; sonra dağın arkasına ulaşmak
 * için EN KISA olanlar geri ekleniyor (`tools/harita-kur.py`). Sonuç:
 * sıradağın öte yanı ancak birkaç noktadan geçilebiliyor ve o noktaları
 * tutan bölge -- çoğu zaman bir KALE -- arkasındaki her şeyi tutuyor.
 *
 * Motor için geçit ayrı bir kural DEĞİL: komşuluk komşuluktur. Ayrım
 * arayüzde: oyuncu dar boğazı görmeden orayı tutmanın değerini anlayamaz.
 */
const gecitAnahtari = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export const GECITLER: ReadonlySet<string> = new Set(
  ((WORLD_MAP as { gecitler?: number[][] }).gecitler ?? []).map(([a, b]) => gecitAnahtari(a!, b!)),
);

/** Bu iki bölge arasındaki yol bir dağ geçidi mi. */
export function gecitMi(a: number, b: number): boolean {
  return GECITLER.has(gecitAnahtari(a, b));
}

/** Haritadaki bütün bölge kimlikleri, dosyadaki sırayla. */
export const BOLGE_IDLERI: readonly number[] = WORLD_MAP.regions.map((r) => r.id);

/**
 * Bütün çiftler için mesafe, modül yüklenirken bir kez hesaplanır.
 *
 * 61 bölge için 61 kez genişlik-öncelikli arama; toplam birkaç bin adım,
 * yani ölçülemeyecek kadar ucuz. Her çağrıda yeniden aramak yerine
 * hazır tablo tutmak, sunucunun sıcak yolundaki (hedef önerisi, saldırı
 * önizlemesi) yüzlerce mesafe sorgusunu tek bir tablo okumasına indiriyor.
 */
function mesafeTablosu(
  komsuluk: ReadonlyMap<number, readonly number[]>,
): Map<number, Map<number, number>> {
  const tablo = new Map<number, Map<number, number>>();
  for (const bas of komsuluk.keys()) {
    const uzaklik = new Map<number, number>([[bas, 0]]);
    // Dizi + okuma imleci: shift() büyük kuyrukta O(n), burada gereksiz.
    const kuyruk: number[] = [bas];
    for (let i = 0; i < kuyruk.length; i++) {
      const su = kuyruk[i]!;
      const d = uzaklik.get(su)!;
      for (const komsu of komsuluk.get(su) ?? []) {
        if (uzaklik.has(komsu)) continue;
        uzaklik.set(komsu, d + 1);
        kuyruk.push(komsu);
      }
    }
    tablo.set(bas, uzaklik);
  }
  return tablo;
}

const MESAFE: ReadonlyMap<number, ReadonlyMap<number, number>> = mesafeTablosu(KOMSULUK);

/** Haritanın çapı: birbirine en uzak iki bölge arasındaki adım sayısı. */
export const EN_UZAK_MESAFE: number = (() => {
  let en = 0;
  for (const satir of MESAFE.values()) for (const d of satir.values()) en = Math.max(en, d);
  return en;
})();

/**
 * İki bölge arasındaki mesafe: komşuluk grafiğinde en kısa yol.
 *
 * Bilinmeyen ya da ulaşılamayan bölge için `EN_UZAK_MESAFE` döner —
 * sonsuz değil. Sonsuz dönseydi çağıran taraftaki her süre hesabı NaN'a
 * düşerdi; en uzak mesafe hem sonlu hem de "çok uzak" anlamını taşıyor.
 */
export function bolgeMesafesi(a: number, b: number): number {
  if (a === b) return 0;
  return MESAFE.get(a)?.get(b) ?? EN_UZAK_MESAFE;
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

/*
 * ─── DÜNYANIN KENDİ GRAFİĞİ ──────────────────────────────────────────
 *
 * Yukarıdaki KOMSULUK/MESAFE kanonik dosyadan geliyor ve tek bir haritaya
 * bağlı. Bu, açık bir riskti (docs/12 §14): `world-map.json` değişince
 * CANLI dünyalar da değişiyordu. Daha sinsisi, motorla veri ayrışıyordu —
 * bölgenin komşuları veritabanı satırında yazılı, ama mesafe kanonik
 * dosyadan okunuyordu. İkisi ayrılırsa oyun yalan söyler: haritada
 * çizilmeyen bir yoldan yürüyüş "1 adım" sürer.
 *
 * `haritaGrafi` o bağı kesiyor: bir dünyanın grafiği KENDİ bölge
 * satırlarından kuruluyor. Kanonik dosya yalnız YENİ dünya açarken
 * okunuyor; açılmış dünya kendi haritasını taşıyor.
 */

/** Bir dünyanın komşuluk grafiği üzerinde mesafe ve bitişiklik. */
export interface HaritaGrafi {
  /** İki bölge arası en kısa yol; ulaşılamıyorsa grafiğin çapı. */
  mesafe(a: number, b: number): number;
  komsuMu(a: number, b: number): boolean;
  /** Grafiğin çapı — "çok uzak"ın sonlu karşılığı. */
  readonly enUzak: number;
  readonly bolgeSayisi: number;
}

/**
 * Komşuluk listesinden gezilebilir bir grafik kurar.
 *
 * Mesafe tablosu BİR KEZ hesaplanıyor (bölge başına bir genişlik-öncelikli
 * arama) ve sonra her sorgu tek tablo okuması. Sunucunun sıcak yolu —
 * hedef önerisi 121 bölgenin hepsine mesafe soruyor — bu yüzden çağrı
 * başına yeniden aramaya dayanamaz.
 */
export function haritaGrafi(komsuluk: ReadonlyMap<number, readonly number[]>): HaritaGrafi {
  const tablo = mesafeTablosu(komsuluk);
  let enUzak = 0;
  for (const satir of tablo.values()) for (const d of satir.values()) enUzak = Math.max(enUzak, d);
  return {
    mesafe: (a, b) => (a === b ? 0 : (tablo.get(a)?.get(b) ?? enUzak)),
    komsuMu: (a, b) => (komsuluk.get(a) ?? []).includes(b),
    enUzak,
    bolgeSayisi: tablo.size,
  };
}

/** Kanonik haritanın grafiği — yeni dünyaların ve testlerin başlangıcı. */
export const KANONIK_GRAFIK: HaritaGrafi = haritaGrafi(KOMSULUK);

/**
 * Ordunun bir hedefe mesafesi, VERİLEN grafik üzerinde.
 *
 * `yakinlikMesafesi` ile aynı kural (en yakın toprağından ölçülür), tek
 * farkı hangi haritaya baktığının çağıranca söylenmesi.
 */
export function yakinlikMesafesiGraf(
  graf: HaritaGrafi,
  evBolgeId: number,
  topraklarim: readonly number[],
  hedefBolgeId: number,
): number {
  let enAz = graf.mesafe(evBolgeId, hedefBolgeId);
  for (const t of topraklarim) {
    const d = graf.mesafe(t, hedefBolgeId);
    if (d < enAz) enAz = d;
  }
  return enAz;
}

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
