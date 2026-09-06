/**
 * Savaş öncesi düzen: 4x4 dizilim + tek taktik.
 *
 * Bu dosya oyunun "savaşta karar yok" boşluğunu kapatıyor. Savaş hâlâ
 * sunucuda ve tek seferde çözülüyor — async bir oyunda canlı müdahale
 * zaten olamaz — ama YOLA ÇIKMADAN ÖNCE verilen iki karar sonucu
 * değiştiriyor: askeri nereye koydun, hangi taktiği seçtin.
 *
 * Üç kural, üçü de tek cümleyle anlatılabilir olsun diye seçildi. Oyuncu
 * kaybettiğinde raporda NEDEN kaybettiğini okuyabilmeli; okuyamadığı bir
 * ceza, ceza değil şanssızlıktır:
 *
 *   1. Her birimin bir ideal SATIRI var. Sapma ceza yazar. Mancınık en
 *      önde durursa en ağır cezayı alır — ilk çarpışmada dağılır.
 *   2. Kanat sütunları (1 ve 4) süvariye yarar, okçu ve mancınığa zarar.
 *   3. Ön satır boşsa (arkada yakın dövüş birimi beklerken) savunma
 *      cezası. Okçuyu öne sürüp mızrakçıyı saklamak bedava olmasın.
 *
 * Taktik bunun üstüne biniyor ve KOŞULLU: koşulu tutmayan taktik
 * seçilemez. Yarım tutan taktiğe yarım bonus vermek, oyuncuya neden az
 * aldığını anlatmayı imkânsız kılardı.
 *
 * SAFLIK: combat.ts gibi bu dosya da saf. Date.now(), Math.random(),
 * veritabanı yok. İstemci önizlemede aynı fonksiyonu çağırıyor ve
 * sunucunun bulduğu sonucun aynısını buluyor.
 */
import { B, TAKTIKLER, unitName } from './balance.js';
import type { Army, UnitType } from './types.js';
import { UNIT_TYPES } from './types.js';

const D = B.dizilim;

/** Toplam kare sayısı: 4x4 = 16. */
export const KARE_SAYISI = D.satir * D.sutun;

/**
 * Dizilim: 16 karelik dizi, her kare bir birim türü ya da boş.
 *
 * Neden düz dizi de matris değil: kayıtta JSON olarak duruyor, arayüzde
 * sürükle-bırak indeksle çalışıyor, ve satır/sütun tek bölmeyle
 * çıkıyor. Matris her üç yerde de fazladan çevrim isterdi.
 */
export type Dizilim = (UnitType | null)[];

export interface SavasDuzeni {
  dizilim: Dizilim;
  /** Taktik anahtarı; null = taktiksiz (ham dizilim). */
  taktik: string | null;
}

export interface DuzenEtkisi {
  /** Ham saldırı gücüne eklenen çarpan farkı (+0.12 = %12). */
  saldiri: number;
  savunma: number;
  ilkTurSaldiri: number;
  /** Savunanın tahkimatından düşülen oran (yalnız saldıranda işler). */
  kaleDelme: number;
  /** Rapora yazılacak insan cümleleri; sırası önem sırası. */
  satirlar: string[];
}

/** Satır 1 en ön, satır D.satir en arka. Kare indeksi 0 tabanlı. */
export function kareSatiri(indeks: number): number {
  return Math.floor(indeks / D.sutun) + 1;
}

export function kareSutunu(indeks: number): number {
  return (indeks % D.sutun) + 1;
}

export function kanattaMi(indeks: number): boolean {
  return (D.kanat_sutunlari as number[]).includes(kareSutunu(indeks));
}

/** Oyuncuya "3. kare" diye gösterilen 1 tabanlı numara. */
export function kareNo(indeks: number): number {
  return indeks + 1;
}

export function bosDizilim(): Dizilim {
  return Array.from({ length: KARE_SAYISI }, () => null);
}

function yerlesim(t: UnitType) {
  return D.birim_yerlesimi[t];
}

/**
 * Ordunun makul varsayılan dizilimi.
 *
 * Neden gerekli: dizilime hiç dokunmayan oyuncu CEZA ALMAMALI. Derinlik
 * isteyen oyuncuya seçenek sunmak başka, ilgilenmeyen oyuncuyu
 * cezalandırmak başka. Varsayılan her birimi kendi ideal satırına
 * koyuyor ve süvariyi kanada açıyor: nötr-iyi, ama en iyisi değil —
 * elle düzenleyenin kazanacağı bir pay kalıyor.
 */
export function varsayilanDizilim(ordu: Army): Dizilim {
  const d = bosDizilim();
  // Süvari önce yerleşsin: kanat kareleri onun, kalanlar merkeze düşsün.
  const sira: UnitType[] = ['suvari', 'kusatma', 'okcu', 'mizrakci', 'milis'];
  for (const t of sira) {
    if ((ordu[t] ?? 0) <= 0) continue;
    const y = yerlesim(t);
    const kanatIster = y.kanat_carpani > 0;
    const adaylar: number[] = [];
    for (let i = 0; i < KARE_SAYISI; i++) {
      if (d[i] !== null) continue;
      if (kareSatiri(i) !== y.ideal_satir) continue;
      adaylar.push(i);
    }
    // Kanat isteyen kanattan, istemeyen merkezden başlasın.
    adaylar.sort((a, b) => {
      const puan = (i: number) => (kanattaMi(i) === kanatIster ? 0 : 1);
      return puan(a) - puan(b) || a - b;
    });
    // İki kare yeter: tek kareye yığılma cezası var, dördü de doldurmak
    // diğer birimlere yer bırakmaz.
    for (const i of adaylar.slice(0, 2)) d[i] = t;
  }
  return d;
}

/** Bir birimin durduğu kare indeksleri. */
export function birimKareleri(dizilim: Dizilim, t: UnitType): number[] {
  const out: number[] = [];
  for (let i = 0; i < dizilim.length; i++) if (dizilim[i] === t) out.push(i);
  return out;
}

/**
 * Dizilim kaydedilebilir mi?
 *
 * Gevşek bilerek: orduda olmayan bir birimin karede durması hata değil
 * (asker eğitilir, dizilim kalır). Yalnız biçim doğrulanıyor.
 */
export function dizilimGecerliMi(dizilim: unknown): dizilim is Dizilim {
  if (!Array.isArray(dizilim) || dizilim.length !== KARE_SAYISI) return false;
  return dizilim.every(
    (k) => k === null || (typeof k === 'string' && (UNIT_TYPES as readonly string[]).includes(k)),
  );
}

function orduToplami(ordu: Army): number {
  return UNIT_TYPES.reduce((s, t) => s + (ordu[t] ?? 0), 0);
}

function yakinDovus(ordu: Army): number {
  return (ordu.milis ?? 0) + (ordu.mizrakci ?? 0);
}

/**
 * Bir birimin dizilimden aldığı çarpan farkı.
 *
 * Birim birden çok karede duruyorsa adet o karelere eşit bölünüyor ve
 * etki karelerin ORTALAMASI. Böylece "mancınığın yarısı arkada yarısı
 * önde" diye bir şey söylenebiliyor; hepsi ya da hiçbiri değil.
 */
function birimEtkisi(dizilim: Dizilim, t: UnitType): { etki: number; kareler: number[] } {
  const kareler = birimKareleri(dizilim, t);
  const y = yerlesim(t);
  // Karesiz birim ideal satırında sayılır: dizilime dokunmayan
  // oyuncu ceza almasın (varsayilanDizilim'in aynı gerekçesi).
  if (kareler.length === 0) return { etki: 0, kareler: [] };

  let toplam = 0;
  for (const i of kareler) {
    const sapma = Math.abs(kareSatiri(i) - y.ideal_satir);
    let e = -sapma * y.satir_sapma_cezasi;
    if (kanattaMi(i)) e += y.kanat_carpani;
    toplam += e;
  }
  return { etki: toplam / kareler.length, kareler };
}

function yuzde(x: number): string {
  return `%${Math.round(Math.abs(x) * 100)}`;
}

/**
 * Dizilimin ordu üzerindeki toplam etkisi + raporlanacak cümleler.
 *
 * Etki birim BAŞINA değil ordu ağırlıklı: 200 milisin yanlış yerde
 * durması 2 mancınığınkinden çok daha ağır basmalı.
 */
export function dizilimEtkisi(
  dizilim: Dizilim,
  ordu: Army,
): { saldiri: number; savunma: number; satirlar: string[] } {
  const toplam = orduToplami(ordu);
  const satirlar: string[] = [];
  if (toplam <= 0) return { saldiri: 0, savunma: 0, satirlar };

  let agirlikli = 0;
  for (const t of UNIT_TYPES) {
    const adet = ordu[t] ?? 0;
    if (adet <= 0) continue;
    const { etki, kareler } = birimEtkisi(dizilim, t);
    if (etki === 0 || kareler.length === 0) continue;
    agirlikli += (adet / toplam) * etki;

    const y = yerlesim(t);
    const satirAdi = kareler.map((i) => kareSatiri(i)).join(', ');
    if (etki < -0.001) {
      satirlar.push(
        `${unitName(t)} ${satirAdi}. satırda — ideal yeri ${y.ideal_satir}. satır. ${yuzde(etki)} güç kaybı.`,
      );
    } else if (etki > 0.001) {
      satirlar.push(`${unitName(t)} kanatta konuşlandı: +${yuzde(etki)} güç.`);
    }
  }

  // Açık cephe: orduda yakın dövüş varken ön satırda yoksa.
  let savunmaEk = 0;
  const onSatirBirimleri = dizilim.filter((k, i) => k !== null && kareSatiri(i) === 1);
  const onHattaYakinDovus = onSatirBirimleri.some((k) => k === 'milis' || k === 'mizrakci');
  if (yakinDovus(ordu) > 0 && onSatirBirimleri.length > 0 && !onHattaYakinDovus) {
    savunmaEk -= D.acik_cephe_cezasi;
    satirlar.push(
      `Ön hattın açıktı: milis ve mızrakçı arkada beklerken düşman doğrudan içeri girdi. ${yuzde(D.acik_cephe_cezasi)} savunma kaybı.`,
    );
  }

  const kis = (x: number) => Math.max(-D.azami_ceza, Math.min(D.azami_bonus, x));
  return { saldiri: kis(agirlikli), savunma: kis(agirlikli + savunmaEk), satirlar };
}

/* ---------------- Taktikler ---------------- */

export interface TaktikDurumu {
  key: string;
  ad: string;
  ozet: string;
  aciklama: string;
  uygun: boolean;
  /** Uygun değilse hangi koşulun tutmadığı; uygunsa boş. */
  engel: string | null;
}

function birimOrani(ordu: Army, birim: string): number {
  const toplam = orduToplami(ordu);
  if (toplam <= 0) return 0;
  const adet =
    birim === 'yakin_dovus' ? yakinDovus(ordu) : (ordu[birim as UnitType] ?? 0);
  return adet / toplam;
}

/** Tek bir koşulu sınar. Tutuyorsa null, tutmuyorsa engel metni döner. */
function kosulEngeli(
  kosul: Record<string, unknown> | null | undefined,
  ordu: Army,
  dizilim: Dizilim,
): string | null {
  if (!kosul) return null;
  const metin = String(kosul.metin ?? 'Koşul tutmuyor.');
  switch (kosul.tur) {
    case 'birim_orani':
      return birimOrani(ordu, String(kosul.birim)) >= Number(kosul.en_az) ? null : metin;
    case 'birim_en_az_adet':
      return (ordu[String(kosul.birim) as UnitType] ?? 0) >= Number(kosul.en_az) ? null : metin;
    case 'kanatta_birim': {
      const t = String(kosul.birim) as UnitType;
      const kareler = birimKareleri(dizilim, t);
      if (kareler.length === 0) return metin;
      const kanat = kareler.filter(kanattaMi).length;
      return kanat / kareler.length >= Number(kosul.en_az_oran) ? null : metin;
    }
    case 'birim_satirda': {
      const t = String(kosul.birim) as UnitType;
      const kareler = birimKareleri(dizilim, t);
      if (kareler.length === 0) return metin;
      const dogru = kareler.filter((i) => kareSatiri(i) === Number(kosul.satir)).length;
      return dogru / kareler.length >= Number(kosul.en_az_oran) ? null : metin;
    }
    case 'on_hatta_yakin_dovus': {
      const var_ = dizilim.some(
        (k, i) => kareSatiri(i) === 1 && (k === 'milis' || k === 'mizrakci'),
      );
      return var_ ? null : metin;
    }
    default:
      return null;
  }
}

/** Bütün taktiklerin bu ordu + dizilim için uygunluk durumu. */
export function taktikDurumlari(ordu: Army, dizilim: Dizilim): TaktikDurumu[] {
  return TAKTIKLER.map((t) => {
    const engel =
      kosulEngeli(t.kosul as never, ordu, dizilim) ??
      kosulEngeli(t.ek_kosul as never, ordu, dizilim);
    return {
      key: t.key,
      ad: t.ad,
      ozet: t.ozet,
      aciklama: t.aciklama,
      uygun: engel === null,
      engel,
    };
  });
}

export function taktikBul(key: string | null | undefined) {
  if (!key) return null;
  return TAKTIKLER.find((t) => t.key === key) ?? null;
}

/**
 * Taktiğin etkisi.
 *
 * `karsi_birim` düşman bileşimine göre ÖLÇEKLENİYOR: Mızrak Seti'nin
 * +%35'i düşmanın tamamı süvariyse tam, süvarisi yoksa sıfır yazar.
 * Sabit verilseydi taktik seçimi "en büyük sayıyı seç"e inerdi.
 */
export function taktikEtkisi(
  key: string | null | undefined,
  ordu: Army,
  dizilim: Dizilim,
  dusmanOrdu: Army,
): DuzenEtkisi {
  const bos: DuzenEtkisi = {
    saldiri: 0,
    savunma: 0,
    ilkTurSaldiri: 0,
    kaleDelme: 0,
    satirlar: [],
  };
  const t = taktikBul(key);
  if (!t) return bos;

  // Koşulu tutmayan taktik hiç işlemez. Sunucu otoritedir: istemci
  // uygun olmayan bir taktik gönderse bile burada sessizce düşer.
  const engel =
    kosulEngeli(t.kosul as never, ordu, dizilim) ?? kosulEngeli(t.ek_kosul as never, ordu, dizilim);
  if (engel) return bos;

  const e = t.etki as Record<string, number | Record<string, number>>;
  const tavan = B.taktik.azami_etki;
  const kis = (x: number) => Math.max(-tavan, Math.min(tavan, x));

  let saldiri = Number(e.saldiri ?? 0);
  const satirlar: string[] = [`${t.ad}: ${t.ozet}`];

  const karsi = (e.karsi_birim ?? {}) as Record<string, number>;
  const dusmanToplam = orduToplami(dusmanOrdu);
  for (const [birim, deger] of Object.entries(karsi)) {
    if (dusmanToplam <= 0) continue;
    const pay = (dusmanOrdu[birim as UnitType] ?? 0) / dusmanToplam;
    if (pay <= 0) {
      satirlar.push(`Düşmanda ${unitName(birim as UnitType).toLocaleLowerCase('tr')} yoktu; bu taktiğin asıl kozu boşa gitti.`);
      continue;
    }
    const ek = deger * pay;
    saldiri += ek;
    satirlar.push(
      `Düşmanın ${yuzde(pay)}'i ${unitName(birim as UnitType).toLocaleLowerCase('tr')}ydı: +${yuzde(ek)} saldırı.`,
    );
  }

  return {
    saldiri: kis(saldiri),
    savunma: kis(Number(e.savunma ?? 0)),
    ilkTurSaldiri: kis(Number(e.ilk_tur_saldiri ?? 0)),
    kaleDelme: Math.max(0, Math.min(tavan, Number(e.kale_delme ?? 0))),
    satirlar,
  };
}

/**
 * Dizilim + taktiğin birleşik etkisi. combat.ts bunu çağırıyor.
 *
 * İki katman AYRI hesaplanıp toplanıyor, çarpılmıyor: oyuncuya raporda
 * "dizilimden şu kadar, taktikten şu kadar" diye ayrı ayrı gösterilecek.
 */
export function duzenEtkisi(
  duzen: SavasDuzeni | null | undefined,
  ordu: Army,
  dusmanOrdu: Army,
): DuzenEtkisi {
  if (!duzen) return { saldiri: 0, savunma: 0, ilkTurSaldiri: 0, kaleDelme: 0, satirlar: [] };
  const d = dizilimEtkisi(duzen.dizilim, ordu);
  const t = taktikEtkisi(duzen.taktik, ordu, duzen.dizilim, dusmanOrdu);
  return {
    saldiri: d.saldiri + t.saldiri,
    savunma: d.savunma + t.savunma,
    ilkTurSaldiri: t.ilkTurSaldiri,
    kaleDelme: t.kaleDelme,
    satirlar: [...d.satirlar, ...t.satirlar],
  };
}
