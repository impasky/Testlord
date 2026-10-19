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
 * Harita artık GERÇEK DÜNYA (docs/27): her şehir bir bölge, komşuluk
 * şehirlerin topraklarının birbirine değmesinden ve karşılıklı kıyılar
 * arasındaki deniz yollarından geliyor (`tools/gercek-dunya-uret.mjs`).
 * Gelir çarpanı ve NPC garnizonu şehrin nüfusundan; her ülkenin başkenti
 * bir TAHT.
 *
 * ── x/y'yi motor OKUMAZ ───────────────────────────────────────────────
 *
 * Bölgelerin `x`/`y` alanı yalnızca çizim içindir: haritanın resmi
 * üzerinde işaretçinin duracağı yer. Mesafe ve komşuluk buradan
 * hesaplanmaz. Bu kasıtlı — harita resmini yeniden ürettiğimizde
 * işaretçileri yeniden yerleştirmek gerekecek ve o iş oyunun kurallarını
 * kaydırmamalı. (Ülke ve toprak çizgileri `dunyaGeo.json`da, aynı
 * izdüşümle.)
 */
/**
 * MESAFE SATIRLARI İSTENDİKÇE.
 *
 * 121 bölgelik haritada bütün çiftler açılışta hesaplanıyordu. Gerçek
 * dünyada 3.000'i aşkın şehir var: bütün çiftler dokuz milyon kayıt
 * demek — sunucuda yüzlerce MB, telefonda saniyeler. Oysa bir istek
 * yalnız birkaç KAYNAKTAN soruyor (lordun evi ve toprakları). Satır o
 * kaynak ilk sorulduğunda bir genişlik-öncelikli aramayla kuruluyor
 * (3.000 bölge, ~17.000 kenar: milisaniyenin altında) ve saklanıyor.
 */
const ULASILAMAZ = 0xffff;

export function satirKurucu(komsuluk: ReadonlyMap<number, readonly number[]>) {
  const kimlikler = [...komsuluk.keys()];
  const sira = new Map(kimlikler.map((id, i) => [id, i]));
  const komsuSira = kimlikler.map((id) =>
    (komsuluk.get(id) ?? []).map((k) => sira.get(k)).filter((k): k is number => k !== undefined),
  );
  const satirlar = new Map<number, Uint16Array>();
  const satir = (bas: number): Uint16Array | undefined => {
    const hazir = satirlar.get(bas);
    if (hazir) return hazir;
    const i0 = sira.get(bas);
    if (i0 === undefined) return undefined;
    const d = new Uint16Array(kimlikler.length).fill(ULASILAMAZ);
    d[i0] = 0;
    // Dizi + okuma imleci: shift() büyük kuyrukta O(n).
    const kuyruk = new Int32Array(kimlikler.length);
    let son = 0;
    kuyruk[son++] = i0;
    for (let k = 0; k < son; k++) {
      const su = kuyruk[k]!;
      for (const n of komsuSira[su]!) {
        if (d[n] !== ULASILAMAZ) continue;
        d[n] = d[su]! + 1;
        kuyruk[son++] = n;
      }
    }
    satirlar.set(bas, d);
    return d;
  };
  /** Grafiğin çapı: iki uçlu tarama (alt sınır, pratikte tam). Bir kez. */
  let cap: number | null = null;
  const enUzak = (): number => {
    if (cap !== null) return cap;
    cap = 0;
    let bas = kimlikler[0];
    for (let tur = 0; tur < 4 && bas !== undefined; tur++) {
      const d = satir(bas)!;
      let en = 0;
      let enId = bas;
      d.forEach((v, i) => {
        if (v !== ULASILAMAZ && v > en) {
          en = v;
          enId = kimlikler[i]!;
        }
      });
      cap = Math.max(cap, en);
      bas = enId;
    }
    return cap;
  };
  const mesafe = (a: number, b: number): number => {
    if (a === b) return 0;
    const d = satir(a)?.[sira.get(b) ?? -1];
    return d === undefined || d === ULASILAMAZ ? enUzak() : d;
  };
  return { mesafe, enUzak, bolgeSayisi: kimlikler.length };
}

/*
 * ─── DÜNYANIN KENDİ GRAFİĞİ ──────────────────────────────────────────
 *
 * Yukarıdaki KOMSULUK kanonik dosyadan geliyor ve tek bir haritaya
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
  /** Bölgenin komşuları. */
  komsular(a: number): readonly number[];
  /** Grafiğin çapı — "çok uzak"ın sonlu karşılığı. İlk soruluşta hesaplanıyor. */
  readonly enUzak: number;
  readonly bolgeSayisi: number;
}

/**
 * Komşuluk listesinden gezilebilir bir grafik kurar.
 *
 * Mesafe satırı kaynak başına BİR KEZ hesaplanıyor (genişlik-öncelikli
 * arama) ve sonra her sorgu tek dizi okuması. Sunucunun sıcak yolu —
 * hedef önerisi bütün bölgelere mesafe soruyor — ama hep aynı birkaç
 * kaynaktan (lordun evi ve toprakları).
 */
export function haritaGrafi(komsuluk: ReadonlyMap<number, readonly number[]>): HaritaGrafi {
  const k = satirKurucu(komsuluk);
  return {
    mesafe: k.mesafe,
    komsuMu: (a, b) => (komsuluk.get(a) ?? []).includes(b),
    komsular: (a) => komsuluk.get(a) ?? [],
    get enUzak() {
      return k.enUzak();
    },
    bolgeSayisi: k.bolgeSayisi,
  };
}

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
 * SINIR KURALI (docs/27) — bu hedefe saldırabilir miyim?
 *
 * Oyuncu bir ülke seçip orada başlıyor. Kendi ülkesinin her şehri açık;
 * başka bir ülkenin şehri ancak SINIRDAN: evinin ya da tuttuğu bir
 * toprağın komşusuysa (kara sınırı ya da deniz yolu). Böylece yayılma
 * haritada bir çizgi izliyor — Ankara'dan Berlin'e atlanmıyor, Edirne'den
 * Bulgaristan'a geçiliyor.
 *
 * Ev bölgesinin kendisi de açık: kampın yanındaki şehir ilk hedef.
 */
export function sinirdanMi(
  graf: Pick<HaritaGrafi, 'komsuMu'>,
  hedef: { mapId: number; province: string },
  lord: { ulke: string | null; evBolgeId: number; topraklar: readonly number[] },
): boolean {
  if (lord.ulke !== null && hedef.province === lord.ulke) return true;
  if (hedef.mapId === lord.evBolgeId || graf.komsuMu(lord.evBolgeId, hedef.mapId)) return true;
  return lord.topraklar.some((t) => t === hedef.mapId || graf.komsuMu(t, hedef.mapId));
}

/**
 * HARİTA KUŞAĞI (docs/27). Sürüm her düzenlemede değişiyor ve oyunculu
 * bir dünyanın haritasına dokunulmuyor; kuşak ise haritanın TÜRÜ. Eski
 * dünyalar 1. kuşakta (121 bölgelik hayalî diyar), gerçek dünya 2. kuşak.
 * Kuşağı geride kalan dünya — oyuncusu olsa da — yeni haritaya göçüyor:
 * şehri, ordusu, eşyası yerinde; toprakları sıfırdan.
 */
export const HARITA_KUSAGI = 2;
