/**
 * Araştırma ağacı (docs/20).
 *
 * Neden var: aynı seviyedeki iki lord bugün birebir aynı. Araştırma,
 * oyuncunun diyarını kendi seçimleriyle şekillendirdiği katman.
 *
 * HOI4 TARZI. İlk ağaç üç düz zincirdi ve bilerek "yasak değil, sıra"
 * diyordu: karşılıklı dışlayan dal yoktu, çünkü geri alınamayan bir yanlış
 * seçim aylar süren bir dünyada oyuncuyu hesabını silmeye iterdi. Oyuncu
 * HOI4'ün ağacını istedi ve o endişeye kendisi cevap verdi: dışlayan
 * seçimler var ama BEDELLE değiştirilebiliyor (docs/20 §5). Yanlış seçim
 * telafi edilebilir; ucuz değil, bu yüzden seçim hâlâ bir karar.
 *
 * Kurallar burada, sayılar balance.json'da, içerik data/arastirma.json'da.
 * Arayüz hiçbir kuralı yeniden hesaplamıyor: hangi düğüm açık, hangisi
 * kapalı ve NEDEN — hepsi `arastirmaDurumlari` çıktısında.
 *
 * Etkiler tek bir yerde toplanıp (arastirmaBonusu) motorun mevcut bonus
 * yollarına giriyor. Yeni bir düğüm eklemek çoğu zaman koda dokunmadan
 * veri dosyasına bir kayıt.
 */
import {
  ARASTIRMA_CAGLARI,
  ARASTIRMA_DALLARI,
  ARASTIRMA_GRUPLARI,
  B,
  TAKTIKLER,
} from './balance.js';
import type { Resources, UnitType } from './types.js';
import { UNIT_TYPES } from './types.js';

export interface ArastirmaDugumu {
  key: string;
  ad: string;
  aciklama: string;
  /** Çağ (1-6). Bedeli ve süreyi belirliyor. */
  kademe: number;
  /** Kapı. Erken araştırma bunun `erken_pencere_seviye` altına iniyor. */
  lord_seviyesi: number;
  /** Sekmedeki hat (HOI4'teki sütun). Yalnız görünüş. */
  sutun: number;
  /** HEPSİ gereken düğümler. */
  onkosul: string[];
  /** Bu düğüm bir dışlayan grubun SEÇENEĞİ mi. */
  grup?: string;
  /** Hangi yola ait (seçenek dahil). Yolsuz düğüm ortak. */
  yol?: string;
  etki: Record<string, number>;
}

export interface ArastirmaDali {
  key: string;
  ad: string;
  ozet: string;
  sutunlar: string[];
  dugumler: ArastirmaDugumu[];
}

export interface ArastirmaCagi {
  no: number;
  ad: string;
  seviye: number;
}

export interface ArastirmaGrubu {
  key: string;
  ad: string;
  aciklama: string;
}

export interface ArastirmaBonusu {
  depoCarpani: number;
  malikaneGeliri: number;
  bolgeGeliri: number;
  egitimHizi: number;
  egitimMaliyeti: number;
  bakimIndirimi: number;
  komutaKapasitesi: number;
  orduSaldiri: number;
  orduSavunma: number;
  yuruyusHizi: number;
  yagma: number;
  kaleSavunmasi: number;
  bolgeYukseltmeHizi: number;
  casusMaliyeti: number;
  gunlukSaldiri: number;
  arastirmaHizi: number;
  arastirmaYuvasi: number;
  binaHizi: number;
  altinGeliri: number;
  demirGeliri: number;
  erzakGeliri: number;
  /** Birime özel; generallerin `birimSaldiri`siyle TOPLANIYOR. */
  birimSaldiri: Partial<Record<UnitType, number>>;
  birimSavunma: Partial<Record<UnitType, number>>;
  /** Taktik anahtarı → ustalık (0,3 = artılar ×1,3, eksiler ×0,7). */
  taktikUstaligi: Record<string, number>;
}

export function bosArastirmaBonusu(): ArastirmaBonusu {
  return {
    depoCarpani: 0,
    malikaneGeliri: 0,
    bolgeGeliri: 0,
    egitimHizi: 0,
    egitimMaliyeti: 0,
    bakimIndirimi: 0,
    komutaKapasitesi: 0,
    orduSaldiri: 0,
    orduSavunma: 0,
    yuruyusHizi: 0,
    yagma: 0,
    kaleSavunmasi: 0,
    bolgeYukseltmeHizi: 0,
    casusMaliyeti: 0,
    gunlukSaldiri: 0,
    arastirmaHizi: 0,
    arastirmaYuvasi: 0,
    binaHizi: 0,
    altinGeliri: 0,
    demirGeliri: 0,
    erzakGeliri: 0,
    birimSaldiri: {},
    birimSavunma: {},
    taktikUstaligi: {},
  };
}

type SayiAlani = {
  [K in keyof ArastirmaBonusu]: ArastirmaBonusu[K] extends number ? K : never;
}[keyof ArastirmaBonusu];

const ETKI_ALANI: Record<string, SayiAlani> = {
  depo_carpani: 'depoCarpani',
  malikane_geliri: 'malikaneGeliri',
  bolge_geliri: 'bolgeGeliri',
  egitim_hizi: 'egitimHizi',
  egitim_maliyeti: 'egitimMaliyeti',
  bakim_indirimi: 'bakimIndirimi',
  komuta_kapasitesi: 'komutaKapasitesi',
  ordu_saldiri: 'orduSaldiri',
  ordu_savunma: 'orduSavunma',
  yuruyus_hizi: 'yuruyusHizi',
  yagma: 'yagma',
  kale_savunmasi: 'kaleSavunmasi',
  bolge_yukseltme_hizi: 'bolgeYukseltmeHizi',
  casus_maliyeti: 'casusMaliyeti',
  gunluk_saldiri: 'gunlukSaldiri',
  arastirma_hizi: 'arastirmaHizi',
  arastirma_yuvasi: 'arastirmaYuvasi',
  bina_hizi: 'binaHizi',
  altin_geliri: 'altinGeliri',
  demir_geliri: 'demirGeliri',
  erzak_geliri: 'erzakGeliri',
};

/**
 * Birime ve taktiğe özel etki anahtarları KURALLA çözülüyor, tabloyla
 * değil: `okcu_saldiri`, `taktik_hilal`. Yeni bir birim ya da taktik
 * eklenince tabloya satır yazmayı unutmak, araştırmanın sessizce hiçbir
 * şey yapmaması demekti.
 */
function birimEtkisi(
  etki: string,
): { birim: UnitType; alan: 'birimSaldiri' | 'birimSavunma' } | null {
  const m = /^([a-z]+)_(saldiri|savunma)$/.exec(etki);
  if (!m || !(UNIT_TYPES as readonly string[]).includes(m[1]!)) return null;
  return { birim: m[1] as UnitType, alan: m[2] === 'saldiri' ? 'birimSaldiri' : 'birimSavunma' };
}

function taktikEtkisiAnahtari(etki: string): string | null {
  if (!etki.startsWith('taktik_')) return null;
  const key = etki.slice('taktik_'.length);
  return TAKTIKLER.some((t) => t.key === key) ? key : null;
}

/** Etki anahtarı motorda bir yere bağlı mı. Veri testi bunu soruyor. */
export function etkiMotoraBagliMi(etki: string): boolean {
  return etki in ETKI_ALANI || birimEtkisi(etki) !== null || taktikEtkisiAnahtari(etki) !== null;
}

export const ARASTIRMALAR: ArastirmaDali[] = ARASTIRMA_DALLARI as ArastirmaDali[];
export const CAGLAR: ArastirmaCagi[] = ARASTIRMA_CAGLARI as ArastirmaCagi[];
export const GRUPLAR: ArastirmaGrubu[] = ARASTIRMA_GRUPLARI as ArastirmaGrubu[];

const DUGUMLER: ArastirmaDugumu[] = ARASTIRMALAR.flatMap((d) => d.dugumler);
const DUGUM = new Map(DUGUMLER.map((d) => [d.key, d]));

export function arastirmaDugumleri(): ArastirmaDugumu[] {
  return DUGUMLER;
}

export function arastirmaDugumu(key: string): ArastirmaDugumu | null {
  return DUGUM.get(key) ?? null;
}

export function arastirmaDali(key: string): ArastirmaDali | null {
  return ARASTIRMALAR.find((d) => d.dugumler.some((x) => x.key === key)) ?? null;
}

export function arastirmaOnkosullari(key: string): ArastirmaDugumu[] {
  const d = DUGUM.get(key);
  return d ? d.onkosul.map((k) => DUGUM.get(k)).filter((x): x is ArastirmaDugumu => !!x) : [];
}

/** Bir yolun bütün düğümleri (seçenek dahil). */
export function yolDugumleri(yol: string): ArastirmaDugumu[] {
  return DUGUMLER.filter((d) => d.yol === yol);
}

/** Grubun seçenek düğümleri — her biri bir yolun başı. */
export function grupSecenekleri(grup: string): ArastirmaDugumu[] {
  return DUGUMLER.filter((d) => d.grup === grup);
}

/** Yolun ait olduğu grup (seçenek düğümünden). */
export function yolunGrubu(yol: string): string | null {
  return DUGUMLER.find((d) => d.yol === yol && d.grup)?.grup ?? null;
}

export function arastirmaMaliyeti(kademe: number): Resources {
  const t = B.arastirma.maliyet_taban;
  const k = Math.pow(kademe, B.arastirma.maliyet_us);
  return {
    altin: Math.round(t.altin * k),
    demir: Math.round(t.demir * k),
    erzak: Math.round(t.erzak * k),
  };
}

export interface SureCarpani {
  /** Süreye uygulanan çarpan (hız hariç). */
  carpan: number;
  /** Kapının kaç seviye altında başlatılıyor (0 = erken değil). */
  erkenSeviye: number;
  /** İndirim kazandıran fazla seviye (0 = yok). */
  gerideSeviye: number;
}

/**
 * HOI4'ün "zamanından önce" cezası ve geride kalma indirimi (docs/20 §2).
 * Pencere dışındaki erkenlik burada değil `arastirmaDurumlari`nda
 * reddediliyor; bu fonksiyon yalnız süreyi söylüyor.
 */
export function arastirmaSureCarpani(
  dugum: { lord_seviyesi: number },
  lordSeviyesi: number,
): SureCarpani {
  const a = B.arastirma;
  const erken = Math.max(0, dugum.lord_seviyesi - lordSeviyesi);
  if (erken > 0) {
    return { carpan: 1 + erken * a.erken_ceza_seviye_basina, erkenSeviye: erken, gerideSeviye: 0 };
  }
  const geride = Math.max(0, lordSeviyesi - dugum.lord_seviyesi - a.geride_esik_seviye);
  const indirim = Math.min(a.geride_azami_indirim, geride * a.geride_indirim_seviye_basina);
  return { carpan: 1 - indirim, erkenSeviye: 0, gerideSeviye: indirim > 0 ? geride : 0 };
}

/**
 * Araştırmanın süresi (saniye). Ön izleme ile kuyruk AYNI fonksiyonu
 * kullanıyor: ekranda "5sa" yazıp 6 saat sürdürmemek için.
 *
 * `lordSeviyesi` verilmezse çağın ham süresi (erken/geride yok).
 */
export function arastirmaSuresiSn(
  dugum: { kademe: number; lord_seviyesi: number },
  lordSeviyesi?: number,
  bonus?: { arastirmaHizi: number },
): number {
  const taban = B.arastirma.sure_taban_dakika * Math.pow(dugum.kademe, B.arastirma.sure_us) * 60;
  const carpan = lordSeviyesi === undefined ? 1 : arastirmaSureCarpani(dugum, lordSeviyesi).carpan;
  return Math.round((taban * carpan) / (1 + (bonus?.arastirmaHizi ?? 0)));
}

const YUZDE = (x: number) => `%${Math.round(Math.abs(x) * 100)}`;

export function etkiCumlesi(etki: string, deger: number): string {
  const yuzde = YUZDE(deger);
  switch (etki) {
    case 'depo_carpani':
      return `Depo kapasitesi +${yuzde}`;
    case 'malikane_geliri':
      return `Malikâne geliri +${yuzde}`;
    case 'bolge_geliri':
      return `Bölge geliri +${yuzde}`;
    case 'egitim_hizi':
      return `Asker eğitimi +${yuzde} hızlı`;
    case 'egitim_maliyeti':
      return `Asker maliyeti −${yuzde}`;
    case 'bakim_indirimi':
      return `Ordu bakımı −${yuzde}`;
    case 'komuta_kapasitesi':
      return `Komuta kapasitesi +${Math.round(deger)}`;
    case 'ordu_saldiri':
      return `Ordu saldırısı +${yuzde}`;
    case 'ordu_savunma':
      return `Ordu savunması +${yuzde}`;
    case 'yuruyus_hizi':
      return `Yürüyüş +${yuzde} hızlı`;
    case 'yagma':
      return `Yağma +${yuzde}`;
    case 'kale_savunmasi':
      return `Tahkimat +${yuzde} (savunmada)`;
    case 'bolge_yukseltme_hizi':
      return `Bölge geliştirme +${yuzde} hızlı`;
    case 'casus_maliyeti':
      return `Casusluk −${yuzde} ucuz`;
    case 'gunluk_saldiri':
      return `Günde +${Math.round(deger)} saldırı hakkı`;
    case 'arastirma_hizi':
      return `Araştırma +${yuzde} hızlı`;
    case 'arastirma_yuvasi':
      return `+${Math.round(deger)} araştırma yuvası`;
    case 'bina_hizi':
      return `Bina yapımı +${yuzde} hızlı`;
    case 'altin_geliri':
      return `Altın üretimi +${yuzde}`;
    case 'demir_geliri':
      return `Demir üretimi +${yuzde}`;
    case 'erzak_geliri':
      return `Erzak üretimi +${yuzde}`;
  }
  const b = birimEtkisi(etki);
  if (b) {
    const ad = BIRIM_AD[b.birim];
    return `${ad} ${b.alan === 'birimSaldiri' ? 'saldırısı' : 'savunması'} +${yuzde}`;
  }
  const t = taktikEtkisiAnahtari(etki);
  if (t) {
    const ad = TAKTIKLER.find((x) => x.key === t)?.ad ?? t;
    return `${ad} ustalığı +${yuzde}`;
  }
  // Motorda karşılığı olmayan etki: veri dosyasına yeni bir anahtar
  // eklenip buraya satır yazılmamış demektir. Sessizce boş geçmek
  // yerine anahtarı gösteriyoruz ki gözden kaçmasın.
  return `${etki}: ${deger}`;
}

// Cümle içinde "Okçu saldırısı": birim adının tekil, büyük harfle başlayan
// hâli. balance.ts'teki unitName ÇOĞUL değil ama "Köylü Milis" gibi uzun;
// hap satırında kısa ad okunuyor.
const BIRIM_AD: Record<UnitType, string> = {
  milis: 'Milis',
  mizrakci: 'Mızrakçı',
  okcu: 'Okçu',
  suvari: 'Süvari',
  kusatma: 'Kuşatma',
};

/** Bir gruptaki seçili yol (tamamlanan seçenek düğümünden), yoksa null. */
export function grupSecimi(
  tamamlanan: ReadonlySet<string> | readonly string[],
  grup: string,
): string | null {
  const bitmis = tamamlanan instanceof Set ? tamamlanan : new Set(tamamlanan);
  return grupSecenekleri(grup).find((d) => bitmis.has(d.key))?.yol ?? null;
}

export interface ArastirmaDurumu extends ArastirmaDugumu {
  dal: string;
  dalAdi: string;
  maliyet: Resources;
  /** BU lord için süre: erken/geride çarpanı ve araştırma hızı dahil. */
  sureSn: number;
  /** Erken/geride notu ("Çağından 3 seviye erken: süre +%45"), yoksa null. */
  sureNotu: string | null;
  /** Etkinin okunur hâli: "Depo kapasitesi +%50". */
  etkiSatirlari: string[];
  /** Önkoşulların adıyla tamam mı durumu (detay sayfası). */
  onkosulDurumu: { key: string; ad: string; tamam: boolean }[];
  tamamlandi: boolean;
  /** Şu an kuyrukta. */
  suruyor: boolean;
  /** Grubunda başka bir yol seçildiği için bu düğüm kapalı. */
  kapali: boolean;
  /** Kapısından önce başlatılabiliyor (süre cezalı). */
  erken: boolean;
  /** Başlatılabilir mi. */
  acik: boolean;
  /** Açık değilse sebebi; açıksa null. */
  engel: string | null;
}

function adlarlaBagla(adlar: string[]): string {
  if (adlar.length <= 1) return adlar[0] ?? '';
  return `${adlar.slice(0, -1).join(', ')} ve ${adlar[adlar.length - 1]}`;
}

/**
 * Bütün düğümlerin bu lord için durumu.
 *
 * Engel METNİ burada üretiliyor, arayüzde değil: "neden başlatamıyorum"
 * sorusunun cevabı motorun kendi kuralından çıkmalı. İki yerde yazılsa
 * kural değiştiğinde biri sessizce eskir.
 *
 * `suren`: kuyruktaki araştırmaların anahtarları. Bir grubun seçeneği
 * araştırılırken öbür seçenekleri de kapalı sayılıyor — yoksa iki öğreti
 * aynı anda başlatılıp ikisi birden bitebilirdi.
 */
export function arastirmaDurumlari(
  tamamlanan: readonly string[],
  lordSeviyesi: number,
  secenek: { suren?: readonly string[]; bonus?: { arastirmaHizi: number } } = {},
): ArastirmaDurumu[] {
  const bitmis = new Set(tamamlanan);
  const suren = new Set(secenek.suren ?? []);
  // Grup → seçili yol: tamamlanan ya da SÜREN seçenek.
  const secili = new Map<string, string>();
  for (const g of GRUPLAR) {
    const s = grupSecenekleri(g.key).find((d) => bitmis.has(d.key) || suren.has(d.key));
    if (s?.yol) secili.set(g.key, s.yol);
  }
  const pencere = B.arastirma.erken_pencere_seviye;

  const out: ArastirmaDurumu[] = [];
  for (const dal of ARASTIRMALAR) {
    for (const d of dal.dugumler) {
      const tamamlandi = bitmis.has(d.key);
      const suruyor = suren.has(d.key);
      const grup = d.yol ? yolunGrubu(d.yol) : null;
      const kapali = !tamamlandi && !!grup && secili.has(grup) && secili.get(grup) !== d.yol;
      const onkosulDurumu = arastirmaOnkosullari(d.key).map((o) => ({
        key: o.key,
        ad: o.ad,
        tamam: bitmis.has(o.key),
      }));
      const eksik = onkosulDurumu.filter((o) => !o.tamam).map((o) => o.ad);
      const sc = arastirmaSureCarpani(d, lordSeviyesi);

      let engel: string | null = null;
      if (tamamlandi) engel = null;
      else if (suruyor) engel = 'Araştırılıyor.';
      else if (kapali) {
        const g = GRUPLAR.find((x) => x.key === grup);
        const secilen = grupSecenekleri(grup!).find((x) => x.yol === secili.get(grup!));
        engel = `${g?.ad ?? 'Bu seçim'}: ${secilen?.ad ?? 'başka bir yol'} seçili. Bu yol kapalı.`;
      } else if (eksik.length) engel = `Önce ${adlarlaBagla(eksik)} gerekiyor.`;
      else if (lordSeviyesi < d.lord_seviyesi - pencere)
        // Sayıya ek yok: "13'ten", "10'dan", "20'den" okunuşa göre değişiyor.
        engel = `Lord seviyesi ${d.lord_seviyesi} gerekiyor. Erken araştırma seviye ${d.lord_seviyesi - pencere} ile açılır.`;

      const sureNotu =
        sc.erkenSeviye > 0
          ? `Çağından ${sc.erkenSeviye} seviye erken: süre +${YUZDE(sc.carpan - 1)}`
          : sc.gerideSeviye > 0
            ? `Çağının gerisindesin: süre −${YUZDE(1 - sc.carpan)}`
            : null;

      out.push({
        ...d,
        dal: dal.key,
        dalAdi: dal.ad,
        maliyet: arastirmaMaliyeti(d.kademe),
        sureSn: arastirmaSuresiSn(d, lordSeviyesi, secenek.bonus),
        sureNotu,
        etkiSatirlari: Object.entries(d.etki).map(([k, v]) => etkiCumlesi(k, v)),
        onkosulDurumu,
        tamamlandi,
        suruyor,
        kapali,
        erken: !tamamlandi && sc.erkenSeviye > 0,
        acik: !tamamlandi && engel === null,
        engel,
      });
    }
  }
  return out;
}

/**
 * Araştırmanın SAVAŞA giren kısmı (`Side.arastirma`).
 *
 * Tek yerde: savaş tarafını kuran iki yer var (gerçek savaş ve ön izleme)
 * ve ikisi alanları elle kopyalıyordu. Yeni bir savaş etkisi eklenince
 * birinde unutulsa ön izleme ile savaş ayrışırdı — oyuncuya "kazanırsın"
 * deyip kaybettirmek.
 */
export function savasArastirmasi(b: ArastirmaBonusu): {
  orduSaldiri: number;
  orduSavunma: number;
  kaleSavunmasi: number;
  yagma: number;
  birimSaldiri: Partial<Record<UnitType, number>>;
  birimSavunma: Partial<Record<UnitType, number>>;
  taktikUstaligi: Record<string, number>;
} {
  return {
    orduSaldiri: b.orduSaldiri,
    orduSavunma: b.orduSavunma,
    kaleSavunmasi: b.kaleSavunmasi,
    yagma: b.yagma,
    birimSaldiri: b.birimSaldiri,
    birimSavunma: b.birimSavunma,
    taktikUstaligi: b.taktikUstaligi,
  };
}

/** Tamamlanan araştırmaların toplam etkisi. */
export function arastirmaBonusu(tamamlanan: readonly string[]): ArastirmaBonusu {
  const b = bosArastirmaBonusu();
  for (const key of tamamlanan) {
    const d = DUGUM.get(key);
    if (!d) continue; // veri dosyasından kaldırılmış düğüm: sessizce yok say
    for (const [etki, deger] of Object.entries(d.etki)) {
      const alan = ETKI_ALANI[etki];
      if (alan) {
        b[alan] += deger;
        continue;
      }
      const birim = birimEtkisi(etki);
      if (birim) {
        b[birim.alan][birim.birim] = (b[birim.alan][birim.birim] ?? 0) + deger;
        continue;
      }
      const taktik = taktikEtkisiAnahtari(etki);
      if (taktik) b.taktikUstaligi[taktik] = (b.taktikUstaligi[taktik] ?? 0) + deger;
    }
  }
  return b;
}

/**
 * Kaç düğüm bitti / kaç düğüm ARAŞTIRILABİLİR.
 *
 * Toplam 60 değil: bir lord her gruptan tek yol alabiliyor. Seçilmemiş
 * grupta en uzun yol sayılıyor — oyuncu hangisini seçerse seçsin çubuk
 * aynı yerde bitsin.
 */
export function arastirmaIlerlemesi(tamamlanan: readonly string[]): {
  biten: number;
  toplam: number;
} {
  const bitmis = new Set(tamamlanan);
  let toplam = DUGUMLER.filter((d) => !d.yol).length;
  for (const g of GRUPLAR) {
    const secili = grupSecimi(bitmis, g.key);
    const boylar = grupSecenekleri(g.key).map((s) => yolDugumleri(s.yol!).length);
    toplam += secili ? yolDugumleri(secili).length : Math.max(0, ...boylar);
  }
  return {
    biten: tamamlanan.filter((k) => DUGUM.has(k)).length,
    toplam,
  };
}

export interface YolBirakmaPlani {
  grup: string;
  yol: string;
  /** Silinecek tamamlanmış düğümler. */
  silinecek: string[];
  /** Geri verilecek kaynak (silinenlerin bedelinin `yol_degisim_iadesi` kadarı). */
  iade: Resources;
}

/**
 * Seçili yolu bırakmanın sonucu (docs/20 §5). Kuralın kendisi: silinen
 * düğümlerin bedelinin yarısı geri gelir, yarısı yanar. Bekleme ve
 * "sürerken bırakılamaz" denetimi API'de; burada saf hesap var.
 */
export function yolBirakmaPlani(
  tamamlanan: readonly string[],
  grup: string,
): YolBirakmaPlani | null {
  const bitmis = new Set(tamamlanan);
  const yol = grupSecimi(bitmis, grup);
  if (!yol) return null;
  const silinecek = yolDugumleri(yol)
    .filter((d) => bitmis.has(d.key))
    .map((d) => d.key);
  const oran = B.arastirma.yol_degisim_iadesi;
  const iade = { altin: 0, demir: 0, erzak: 0 };
  for (const key of silinecek) {
    const m = arastirmaMaliyeti(DUGUM.get(key)!.kademe);
    iade.altin += Math.floor(m.altin * oran);
    iade.demir += Math.floor(m.demir * oran);
    iade.erzak += Math.floor(m.erzak * oran);
  }
  return { grup, yol, silinecek, iade };
}

/**
 * Veri dosyasının kuralları. Test bunları soruyor; bir liste döndürüyor ki
 * hata mesajı hangi düğümün neyi bozduğunu söylesin.
 */
export function agacHatalari(): string[] {
  const h: string[] = [];
  const anahtarlar = new Set<string>();
  const hucreler = new Set<string>();
  for (const dal of ARASTIRMALAR) {
    for (const d of dal.dugumler) {
      if (anahtarlar.has(d.key)) h.push(`${d.key}: anahtar iki kez`);
      anahtarlar.add(d.key);

      const hucre = `${dal.key}/${d.sutun}/${d.kademe}`;
      if (hucreler.has(hucre)) h.push(`${d.key}: ${hucre} hücresinde başka düğüm var`);
      hucreler.add(hucre);
      if (d.sutun < 0 || d.sutun >= dal.sutunlar.length) h.push(`${d.key}: sütun ${d.sutun} yok`);

      const cag = CAGLAR.find((c) => c.no === d.kademe);
      if (!cag) h.push(`${d.key}: çağ ${d.kademe} yok`);
      else if (d.lord_seviyesi < cag.seviye)
        h.push(`${d.key}: kapısı (${d.lord_seviyesi}) çağının seviyesinden (${cag.seviye}) önce`);

      for (const k of d.onkosul) {
        const o = DUGUM.get(k);
        if (!o) {
          h.push(`${d.key}: önkoşul ${k} yok`);
          continue;
        }
        if (o.kademe > d.kademe) h.push(`${d.key}: önkoşulu ${k} daha geç bir çağda`);
        if (o.lord_seviyesi > d.lord_seviyesi) h.push(`${d.key}: önkoşulu ${k} daha yüksek kapılı`);
        // Yolsuz düğüm bir yola bağlanamaz; yol düğümü yalnız kendi
        // yoluna ya da ortak düğümlere bağlanabilir (docs/20 §1).
        if (o.yol && o.yol !== d.yol) h.push(`${d.key}: başka bir yolun düğümüne (${k}) bağlı`);
      }
      for (const [etki] of Object.entries(d.etki))
        if (!etkiMotoraBagliMi(etki)) h.push(`${d.key}: ${etki} motora bağlı değil`);
      if (d.grup && !GRUPLAR.some((g) => g.key === d.grup))
        h.push(`${d.key}: grup ${d.grup} tanımsız`);
      if (d.grup && !d.yol) h.push(`${d.key}: seçenek ama yolu yok`);
    }
  }
  for (const d of DUGUMLER) {
    if (d.yol && !DUGUMLER.some((x) => x.yol === d.yol && x.grup))
      h.push(`${d.key}: yolu ${d.yol} hiçbir grubun seçeneği değil`);
  }
  // Döngü: aynı çağda iki düğüm birbirini isterse ikisi de sonsuza kadar
  // kilitli kalır. Çağ ve kapı sırası bunu çoğu zaman engelliyor ama aynı
  // seviyedeki iki düğümü engellemiyor.
  const durum = new Map<string, 'geziliyor' | 'bitti'>();
  const gez = (key: string, iz: string[]): void => {
    if (durum.get(key) === 'bitti') return;
    if (durum.get(key) === 'geziliyor') {
      h.push(`döngü: ${[...iz, key].join(' → ')}`);
      return;
    }
    durum.set(key, 'geziliyor');
    for (const o of DUGUM.get(key)?.onkosul ?? []) gez(o, [...iz, key]);
    durum.set(key, 'bitti');
  };
  for (const d of DUGUMLER) gez(d.key, []);
  return h;
}
