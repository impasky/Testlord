/**
 * Araştırma ağacı.
 *
 * Neden var: aynı seviyedeki iki lord bugün birebir aynı. Ekonomi düz bir
 * çizgi — herkes aynı sırayla aynı şeye sahip oluyor ve "ben şöyle bir
 * diyar kurdum" diyebileceği hiçbir dallanma yok. Araştırma, oyuncunun
 * diyarını kendi seçimleriyle şekillendirdiği katman.
 *
 * Kalıcı dünyada uzun ufuk sorununa da cevap veriyor: on beş düğümün
 * tamamı yüzlerce bin kaynak ve doksan saatlik araştırma demek. Tavana
 * gelen lordun peşinden koşacağı bir şey kalıyor.
 *
 * TASARIM KARARI — yasak değil, sıra. Kademeler karşılıklı dışlayan
 * dallara ayrılmıyor; herkes uzun vadede hepsini alabiliyor. Seçim
 * "neyi asla alamayacağım" değil "neyi ÖNCE alacağım". Geri alınamayan
 * bir yanlış seçim, aylar süren bir dünyada oyuncuyu hesabını silmeye
 * iter; sıralama kararı ise her hafta işe yarar.
 *
 * Etkiler tek bir yerde toplanıp (arastirmaBonusu) motorun mevcut
 * bonus yollarına giriyor. Yeni bir düğüm eklemek çoğu zaman koda
 * dokunmadan data/arastirma.json'a bir kayıt.
 */
import { ARASTIRMA_DALLARI, B } from './balance.js';
import type { Resources } from './types.js';

export interface ArastirmaDugumu {
  key: string;
  ad: string;
  aciklama: string;
  kademe: number;
  lord_seviyesi: number;
  etki: Record<string, number>;
}

export interface ArastirmaDali {
  key: string;
  ad: string;
  ozet: string;
  dugumler: ArastirmaDugumu[];
}

/**
 * Bütün etkilerin toplandığı tek nesne.
 *
 * Alanlar açıkça yazılı (Record<string, number> değil): bir düğümün
 * etkisi motorda hiçbir yere bağlanmamışsa derleyici yakalasın. Sessizce
 * hiçbir şey yapmayan bir araştırma, oyuncudan alınmış kaynak demektir.
 */
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
  };
}

/** JSON'daki yılan_harfli etki adını bonus alanına eşler. */
const ETKI_ALANI: Record<string, keyof ArastirmaBonusu> = {
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
};

export const ARASTIRMALAR: ArastirmaDali[] = ARASTIRMA_DALLARI as ArastirmaDali[];

/** Bütün düğümler tek listede; sıra dal sırası, sonra kademe. */
export function arastirmaDugumleri(): ArastirmaDugumu[] {
  return ARASTIRMALAR.flatMap((d) => d.dugumler);
}

export function arastirmaDugumu(key: string): ArastirmaDugumu | null {
  return arastirmaDugumleri().find((d) => d.key === key) ?? null;
}

export function arastirmaDali(key: string): ArastirmaDali | null {
  return ARASTIRMALAR.find((d) => d.dugumler.some((x) => x.key === key)) ?? null;
}

/** Bir düğümün önkoşulu: aynı daldaki bir önceki kademe. */
export function arastirmaOnkosulu(key: string): ArastirmaDugumu | null {
  const dal = arastirmaDali(key);
  const dugum = arastirmaDugumu(key);
  if (!dal || !dugum || dugum.kademe <= 1) return null;
  return dal.dugumler.find((d) => d.kademe === dugum.kademe - 1) ?? null;
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

export function arastirmaSuresiSn(kademe: number): number {
  return Math.round(B.arastirma.sure_taban_dakika * Math.pow(kademe, B.arastirma.sure_us) * 60);
}

/**
 * Bir etkiyi oyuncunun okuyabileceği tek satıra çevirir.
 *
 * Oyuncunun şikâyeti: "araştırma kısmında oranlar ve sayısal değerler
 * yok, depo kapasitesi ne kadar artacak belli değil." Açıklama metni
 * ne yaptığını ANLATIYOR ama ne kadar yaptığını söylemiyordu; bedeli
 * yüz binlerce kaynak olan bir kararı böyle vermek mümkün değil.
 *
 * Cümle motorda üretiliyor, arayüzde değil: sayı `data/arastirma.json`
 * ile aynı yerden gelsin, ikisi ayrışmasın.
 */
export function etkiCumlesi(etki: string, deger: number): string {
  const yuzde = `%${Math.round(Math.abs(deger) * 100)}`;
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
    default:
      // Motorda karşılığı olmayan etki: veri dosyasına yeni bir anahtar
      // eklenip buraya satır yazılmamış demektir. Sessizce boş geçmek
      // yerine anahtarı gösteriyoruz ki gözden kaçmasın.
      return `${etki}: ${deger}`;
  }
}

export interface ArastirmaDurumu extends ArastirmaDugumu {
  dal: string;
  dalAdi: string;
  maliyet: Resources;
  sureSn: number;
  /** Etkinin okunur hâli: "Depo kapasitesi +%50". */
  etkiSatirlari: string[];
  tamamlandi: boolean;
  /** Başlatılabilir mi. Tamamlanmışsa false. */
  acik: boolean;
  /** Açık değilse sebebi; açıksa null. */
  engel: string | null;
}

/**
 * Bütün düğümlerin bu lord için durumu.
 *
 * Engel METNİ burada üretiliyor, arayüzde değil: "neden başlatamıyorum"
 * sorusunun cevabı motorun kendi kuralından çıkmalı. İki yerde yazılsa
 * kural değiştiğinde biri sessizce eskir.
 */
export function arastirmaDurumlari(
  tamamlanan: readonly string[],
  lordSeviyesi: number,
): ArastirmaDurumu[] {
  const bitmis = new Set(tamamlanan);
  const out: ArastirmaDurumu[] = [];
  for (const dal of ARASTIRMALAR) {
    for (const d of dal.dugumler) {
      const tamamlandi = bitmis.has(d.key);
      const onkosul = arastirmaOnkosulu(d.key);
      let engel: string | null = null;
      if (tamamlandi) engel = null;
      else if (onkosul && !bitmis.has(onkosul.key)) engel = `Önce ${onkosul.ad} gerekiyor.`;
      else if (lordSeviyesi < d.lord_seviyesi)
        engel = `Lord seviyesi ${d.lord_seviyesi} gerekiyor.`;
      out.push({
        ...d,
        dal: dal.key,
        dalAdi: dal.ad,
        maliyet: arastirmaMaliyeti(d.kademe),
        sureSn: arastirmaSuresiSn(d.kademe),
        etkiSatirlari: Object.entries(d.etki).map(([k, v]) => etkiCumlesi(k, v)),
        tamamlandi,
        acik: !tamamlandi && engel === null,
        engel,
      });
    }
  }
  return out;
}

/** Tamamlanan araştırmaların toplam etkisi. */
export function arastirmaBonusu(tamamlanan: readonly string[]): ArastirmaBonusu {
  const b = bosArastirmaBonusu();
  for (const key of tamamlanan) {
    const d = arastirmaDugumu(key);
    if (!d) continue; // veri dosyasından kaldırılmış düğüm: sessizce yok say
    for (const [etki, deger] of Object.entries(d.etki)) {
      const alan = ETKI_ALANI[etki];
      if (alan) b[alan] += deger;
    }
  }
  return b;
}

/** Kaç düğüm bitti / toplam kaç düğüm var. İlerleme çubuğu için. */
export function arastirmaIlerlemesi(tamamlanan: readonly string[]): {
  biten: number;
  toplam: number;
} {
  const hepsi = arastirmaDugumleri();
  const gecerli = new Set(hepsi.map((d) => d.key));
  return {
    biten: tamamlanan.filter((k) => gecerli.has(k)).length,
    toplam: hepsi.length,
  };
}
