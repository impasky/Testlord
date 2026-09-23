import { describe, expect, it } from 'vitest';
import {
  ARASTIRMALAR,
  CAGLAR,
  GRUPLAR,
  agacHatalari,
  arastirmaBonusu,
  arastirmaDugumleri,
  arastirmaDugumu,
  arastirmaDurumlari,
  arastirmaIlerlemesi,
  arastirmaMaliyeti,
  arastirmaSureCarpani,
  arastirmaSuresiSn,
  bosArastirmaBonusu,
  etkiCumlesi,
  grupSecenekleri,
  grupSecimi,
  yolBirakmaPlani,
  yolDugumleri,
} from './arastirma.js';
import {
  binaSuresiSn,
  commandCapacity,
  esZamanliLimit,
  malikaneIncome,
  regionIncome,
  storageCapacity,
  taktikEtkisi,
  upkeepPerHour,
  varsayilanDizilim,
} from './index.js';
import { egitimSuresiSn, marchDurationSec } from './march.js';
import { simulateBattle } from './combat.js';
import { B } from './balance.js';
import type { Army, Side } from './types.js';
import { bosGeneralBonus } from './types.js';

describe('ağaç verisi tutarlı (docs/20)', () => {
  it('veri kurallarının hiçbiri bozulmuyor', () => {
    // Önkoşul var mı, çağı ve kapısı tutarlı mı, yol dışına bağlanıyor mu,
    // hücre çakışıyor mu, döngü var mı, etki motora bağlı mı — hepsi tek
    // listede; hata mesajı hangi düğümün neyi bozduğunu söylüyor.
    expect(agacHatalari()).toEqual([]);
  });

  it('dört sekme, altı çağ, üç grup', () => {
    expect(ARASTIRMALAR.map((d) => d.key)).toEqual(['imar', 'ordu', 'doktrin', 'diyar']);
    expect(CAGLAR.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(GRUPLAR.map((g) => g.key).sort()).toEqual(['doktrin', 'ekonomi', 'yonetim']);
  });

  it('eski on beş düğüm anahtarıyla, etkisiyle ve kapısıyla duruyor (göç)', () => {
    // Tamamlanmış araştırmalar olduğu gibi geçerli kalmalı: anahtar ya da
    // etki değişirse oyuncu hiçbir şey yapmadan güç kaybeder.
    const eski: [string, number, Record<string, number>][] = [
      ['ambarlar', 3, { depo_carpani: 0.5 }],
      ['degirmenler', 8, { malikane_geliri: 0.15 }],
      ['lonca_duzeni', 15, { egitim_maliyeti: -0.12 }],
      ['tahil_ambarlari', 24, { depo_carpani: 0.5, bakim_indirimi: 0.15 }],
      ['vergi_defteri', 34, { bolge_geliri: 0.2 }],
      ['talim_meydani', 3, { egitim_hizi: 0.2 }],
      ['zirh_atolyesi', 10, { ordu_savunma: 0.08 }],
      ['ok_atolyesi', 18, { ordu_saldiri: 0.08 }],
      ['sancak_beyligi', 27, { komuta_kapasitesi: 40 }],
      ['seferi_ordu', 38, { yuruyus_hizi: 0.2 }],
      ['sur_ustaligi', 5, { kale_savunmasi: 0.15 }],
      ['yagma_yollari', 12, { yagma: 0.2 }],
      ['casus_agi', 20, { casus_maliyeti: -0.3 }],
      ['imar_ustalari', 29, { bolge_yukseltme_hizi: 0.25 }],
      ['divan', 40, { gunluk_saldiri: 1 }],
    ];
    for (const [key, sv, etki] of eski) {
      const d = arastirmaDugumu(key);
      expect(d, key).not.toBeNull();
      expect(d!.lord_seviyesi, key).toBe(sv);
      expect(d!.etki, key).toEqual(etki);
      // Göçte kimse seçmediği bir yolu seçmiş olamaz.
      expect(d!.yol, key).toBeUndefined();
    }
  });

  it('her düğümün en az bir etkisi var ve etkisi motora bağlı', () => {
    // Motorda karşılığı olmayan bir etki, oyuncudan alınmış kaynak
    // demek: araştırma biter, hiçbir şey değişmez.
    const bos = JSON.stringify(bosArastirmaBonusu());
    for (const d of arastirmaDugumleri()) {
      expect(Object.keys(d.etki).length, d.key).toBeGreaterThan(0);
      expect(JSON.stringify(arastirmaBonusu([d.key])), d.key).not.toBe(bos);
    }
  });

  it('her düğümün okunur bir açıklaması var', () => {
    for (const d of arastirmaDugumleri()) {
      expect(d.aciklama.length, d.key).toBeGreaterThan(40);
      expect(d.ad.length, d.key).toBeGreaterThan(3);
    }
  });

  it('her grubun en az iki seçeneği var ve bir grubun yolları aynı uzunlukta', () => {
    // Yol uzunlukları farklı olsaydı ilerleme çubuğunun sonu seçime göre
    // oynardı ve kısa yol "daha çabuk biten" diye seçilirdi.
    for (const g of GRUPLAR) {
      const secenekler = grupSecenekleri(g.key);
      expect(secenekler.length, g.key).toBeGreaterThanOrEqual(2);
      const boylar = new Set(secenekler.map((s) => yolDugumleri(s.yol!).length));
      expect(boylar.size, g.key).toBe(1);
    }
  });

  it('en dolu lordun toplamı balance.json’daki tavanı aşmıyor', () => {
    // Her gruptan en güçlü yol + bütün ortak düğümler. Yeni bir düğüm
    // eklenip denge sessizce kaymasın.
    const tavan = B.arastirma.etki_tavani as unknown as Record<string, number>;
    const ortak = arastirmaDugumleri().filter((d) => !d.yol);
    for (const etki of Object.keys(tavan).filter((k) => !k.startsWith('_'))) {
      let toplam = ortak.reduce((s, d) => s + (d.etki[etki] ?? 0), 0);
      for (const g of GRUPLAR) {
        const yollar = grupSecenekleri(g.key).map((s) =>
          yolDugumleri(s.yol!).reduce((x, d) => x + (d.etki[etki] ?? 0), 0),
        );
        toplam += yollar.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
      }
      expect(Math.abs(toplam), etki).toBeLessThanOrEqual(Math.abs(tavan[etki]!) + 1e-9);
    }
    // Ve veri dosyasındaki her etkinin bir tavanı var.
    for (const d of arastirmaDugumleri())
      for (const etki of Object.keys(d.etki)) expect(tavan[etki], `${d.key}/${etki}`).toBeDefined();
  });

  it('üst çağ daha pahalı ve daha uzun', () => {
    for (let k = 2; k <= 6; k++) {
      expect(arastirmaMaliyeti(k).altin).toBeGreaterThan(arastirmaMaliyeti(k - 1).altin);
      expect(arastirmaSuresiSn({ kademe: k, lord_seviyesi: 1 })).toBeGreaterThan(
        arastirmaSuresiSn({ kademe: k - 1, lord_seviyesi: 1 }),
      );
    }
  });

  it('son çağ Sv 45 sonrasına içerik getiriyor', () => {
    // İlk ağaç Sv 40'ta bitiyordu; lord 60'a gidiyor (docs/20).
    const cihan = arastirmaDugumleri().filter((d) => d.kademe === 6);
    expect(cihan.length).toBeGreaterThanOrEqual(8);
    for (const d of cihan) expect(d.lord_seviyesi).toBeGreaterThanOrEqual(45);
  });
});

describe('etkiler okunur cümleye çevriliyor', () => {
  // Oyuncunun şikâyeti: "araştırma kısmında oranlar ve sayısal değerler
  // yok, depo kapasitesi ne kadar artacak belli değil." Yüz binlerce
  // kaynak bedeli olan bir karar, ne kazandıracağını söylemeden verilemez.
  it('her düğümün her etkisi bir cümleye dönüyor', () => {
    for (const d of arastirmaDurumlari([], 99)) {
      expect(d.etkiSatirlari.length).toBe(Object.keys(d.etki).length);
      for (const satir of d.etkiSatirlari) expect(satir.length).toBeGreaterThan(5);
    }
  });

  it('hiçbir etki "anahtar: sayı" ham hâline düşmüyor', () => {
    // Veri dosyasına yeni bir etki eklenip etkiCumlesi'ne satır
    // yazılmazsa cümle ham anahtarı basıyor. Bu test onu yakalar.
    for (const d of arastirmaDurumlari([], 99)) {
      for (const satir of d.etkiSatirlari) {
        expect(satir).not.toMatch(/^[a-z_]+: /);
      }
    }
  });

  it('cümleler sayıyı ve adı içeriyor', () => {
    expect(etkiCumlesi('depo_carpani', 0.5)).toContain('%50');
    expect(etkiCumlesi('komuta_kapasitesi', 40)).toContain('40');
    expect(etkiCumlesi('gunluk_saldiri', 1)).toContain('1');
    expect(etkiCumlesi('okcu_saldiri', 0.12)).toBe('Okçu saldırısı +%12');
    expect(etkiCumlesi('taktik_hilal', 0.3)).toBe('Hilal Düzeni ustalığı +%30');
    expect(etkiCumlesi('arastirma_yuvasi', 1)).toBe('+1 araştırma yuvası');
  });

  it('indirimler eksi işaretiyle değil "azalıyor" diliyle yazılıyor', () => {
    // egitim_maliyeti veri dosyasında NEGATİF; oyuncuya "−%12" diye
    // gösterilmeli, "+%-12" diye değil.
    const c = etkiCumlesi('egitim_maliyeti', -0.12);
    expect(c).toContain('%12');
    expect(c).not.toContain('-12');
    expect(c).not.toContain('+%');
  });
});

describe('önkoşullar', () => {
  it('önkoşulu olmayan düğüm yalnız ilk çağda', () => {
    for (const d of arastirmaDugumleri())
      if (d.onkosul.length === 0) expect(d.kademe, d.key).toBe(1);
  });

  it('birden fazla önkoşulun HEPSİ gerekiyor ve eksikler adıyla yazılıyor', () => {
    // Lonca Düzeni hem Değirmenler'i hem Taş Ocakları'nı istiyor.
    const yalnizBiri = arastirmaDurumlari(['ambarlar', 'degirmenler'], 99).find(
      (d) => d.key === 'lonca_duzeni',
    )!;
    expect(yalnizBiri.acik).toBe(false);
    expect(yalnizBiri.engel).toContain('Taş Ocakları');
    expect(yalnizBiri.onkosulDurumu.map((o) => o.tamam)).toEqual([true, false]);
    const ikisi = arastirmaDurumlari(['ambarlar', 'degirmenler', 'tas_ocaklari'], 99).find(
      (d) => d.key === 'lonca_duzeni',
    )!;
    expect(ikisi.acik).toBe(true);
  });

  it('kilitli düğüm sebebini yazıyor', () => {
    const durumlar = arastirmaDurumlari([], 1);
    const kilitli = durumlar.filter((d) => !d.acik && !d.tamamlandi);
    expect(kilitli.length).toBeGreaterThan(0);
    for (const d of kilitli) expect((d.engel ?? '').length).toBeGreaterThan(10);
  });

  it('tamamlanan düğüm tekrar açılmıyor, süren düğüm de', () => {
    const d = arastirmaDurumlari(['ambarlar'], 99).find((x) => x.key === 'ambarlar');
    expect(d?.tamamlandi).toBe(true);
    expect(d?.acik).toBe(false);
    const s = arastirmaDurumlari([], 99, { suren: ['ambarlar'] }).find((x) => x.key === 'ambarlar');
    expect(s?.suruyor).toBe(true);
    expect(s?.acik).toBe(false);
  });

  it('bilinmeyen anahtar ilerlemeyi şişirmiyor; toplam araştırılabilir olan', () => {
    const i = arastirmaIlerlemesi(['ejderha_terbiyesi', 'ambarlar']);
    expect(i.biten).toBe(1);
    // 60 düğüm − seçilmeyecek yollar (öğreti 2×5, ekonomi 2, yönetim 1).
    expect(i.toplam).toBe(47);
    expect(arastirmaIlerlemesi(['savas_sanati', 'kale_ogretisi']).toplam).toBe(47);
  });
});

describe('erken araştırma ve geride kalma (HOI4 çağ cezası)', () => {
  const cihan = { kademe: 6, lord_seviyesi: 45 };

  it('kapıda süre çağın süresi', () => {
    expect(arastirmaSuresiSn(cihan, 45)).toBe(arastirmaSuresiSn(cihan));
  });

  it('kapıdan önce her seviye süreyi uzatıyor', () => {
    const c = arastirmaSureCarpani(cihan, 42);
    expect(c.erkenSeviye).toBe(3);
    expect(c.carpan).toBeCloseTo(1 + 3 * B.arastirma.erken_ceza_seviye_basina);
    expect(arastirmaSuresiSn(cihan, 42)).toBeGreaterThan(arastirmaSuresiSn(cihan, 45));
  });

  it('pencere dışında başlatılamıyor, pencere içinde erken işaretli', () => {
    const d = arastirmaDugumu('divan')!; // Sv 40
    const hepsi = ['sur_ustaligi', 'yagma_yollari', 'imar_ustalari'];
    const icinde = arastirmaDurumlari(hepsi, 35).find((x) => x.key === 'divan')!;
    expect(icinde.acik).toBe(true);
    expect(icinde.erken).toBe(true);
    expect(icinde.sureNotu).toContain('5 seviye erken');
    const disinda = arastirmaDurumlari(hepsi, 34).find((x) => x.key === 'divan')!;
    expect(disinda.acik).toBe(false);
    expect(disinda.engel).toContain(String(d.lord_seviyesi));
  });

  it('kapıyı çok geçen lord eski çağı hızlı kapatıyor, indirimin tavanı var', () => {
    const ilk = { kademe: 1, lord_seviyesi: 3 };
    expect(arastirmaSureCarpani(ilk, 8).carpan).toBe(1); // eşik: 5 seviye
    expect(arastirmaSureCarpani(ilk, 10).carpan).toBeCloseTo(
      1 - 2 * B.arastirma.geride_indirim_seviye_basina,
    );
    expect(arastirmaSureCarpani(ilk, 60).carpan).toBeCloseTo(1 - B.arastirma.geride_azami_indirim);
  });

  it('araştırma hızı süreyi BÖLÜYOR, sıfırlamıyor', () => {
    const b = arastirmaBonusu(['katipler', 'rasathane']);
    expect(b.arastirmaHizi).toBeCloseTo(0.25);
    const once = arastirmaSuresiSn(cihan, 45);
    const sonra = arastirmaSuresiSn(cihan, 45, b);
    expect(sonra).toBe(Math.round(once / 1.25));
  });
});

describe('dışlayan gruplar ve yol bırakma', () => {
  const kok = ['savas_sanati'];

  it('grup seçilmemişken üç öğretinin üçü de açık', () => {
    const d = arastirmaDurumlari(kok, 99);
    for (const k of ['akinci_ogretisi', 'menzil_ogretisi', 'kale_ogretisi'])
      expect(d.find((x) => x.key === k)!.acik, k).toBe(true);
  });

  it('bir öğreti seçilince öbürleri ve bütün yolları kapanıyor', () => {
    const d = arastirmaDurumlari([...kok, 'kale_ogretisi'], 99);
    const kapali = d.filter((x) => x.kapali).map((x) => x.key);
    expect(kapali).toEqual(
      expect.arrayContaining([
        'akinci_ogretisi',
        'hilal_ustaligi',
        'menzil_ogretisi',
        'toplu_atis',
      ]),
    );
    expect(kapali).not.toContain('kalkan_duvari_ustaligi');
    const akinci = d.find((x) => x.key === 'akinci_ogretisi')!;
    expect(akinci.acik).toBe(false);
    expect(akinci.engel).toContain('Kale Öğretisi');
    expect(grupSecimi([...kok, 'kale_ogretisi'], 'doktrin')).toBe('kale');
  });

  it('süren bir seçenek de öbürlerini kapatıyor (iki öğreti aynı anda başlamasın)', () => {
    const d = arastirmaDurumlari(kok, 99, { suren: ['menzil_ogretisi'] });
    expect(d.find((x) => x.key === 'akinci_ogretisi')!.kapali).toBe(true);
    expect(d.find((x) => x.key === 'menzil_ogretisi')!.suruyor).toBe(true);
  });

  it('yol bırakma planı: o yolun tamamlanmışları silinir, bedelin yarısı döner', () => {
    const tamam = [...kok, 'akinci_ogretisi', 'hilal_ustaligi', 'ambarlar'];
    const p = yolBirakmaPlani(tamam, 'doktrin')!;
    expect(p.yol).toBe('akinci');
    expect(p.silinecek.sort()).toEqual(['akinci_ogretisi', 'hilal_ustaligi']);
    const beklenen =
      Math.floor(arastirmaMaliyeti(2).altin * B.arastirma.yol_degisim_iadesi) +
      Math.floor(arastirmaMaliyeti(3).altin * B.arastirma.yol_degisim_iadesi);
    expect(p.iade.altin).toBe(beklenen);
    // Ortak düğümlere dokunulmuyor.
    expect(p.silinecek).not.toContain('savas_sanati');
    expect(yolBirakmaPlani(kok, 'doktrin')).toBeNull();
  });

  it('bırakılan yolun etkileri gidiyor', () => {
    const once = arastirmaBonusu([...kok, 'akinci_ogretisi']);
    const plan = yolBirakmaPlani([...kok, 'akinci_ogretisi'], 'doktrin')!;
    const kalan = [...kok, 'akinci_ogretisi'].filter((k) => !plan.silinecek.includes(k));
    const sonra = arastirmaBonusu(kalan);
    expect(once.birimSaldiri.suvari).toBeGreaterThan(0);
    expect(sonra.birimSaldiri.suvari ?? 0).toBe(0);
    expect(sonra.orduSaldiri).toBe(once.orduSaldiri - 0); // savaş sanatı duruyor
  });
});

describe('etkiler motorda gerçekten işliyor', () => {
  it('Ambarlar depoyu büyütüyor', () => {
    const once = storageCapacity(10);
    const sonra = storageCapacity(10, arastirmaBonusu(['ambarlar']));
    expect(sonra).toBeGreaterThan(once);
  });

  it('Değirmenler malikâne gelirini artırıyor', () => {
    const once = malikaneIncome(10);
    const sonra = malikaneIncome(10, arastirmaBonusu(['degirmenler']));
    expect(sonra.altin).toBeGreaterThan(once.altin);
  });

  it('Tahıl Ambarları bakımı ucuzlatıyor', () => {
    const ordu: Army = { mizrakci: 100 };
    const once = upkeepPerHour(ordu);
    const sonra = upkeepPerHour(ordu, undefined, arastirmaBonusu(['tahil_ambarlari']));
    expect(sonra).toBeLessThan(once);
  });

  it('Sancak Beyliği komuta kapasitesini büyütüyor', () => {
    const once = commandCapacity(10);
    const sonra = commandCapacity(10, undefined, arastirmaBonusu(['sancak_beyligi']));
    expect(sonra).toBeGreaterThan(once);
  });

  it('Talim Meydanı eğitimi kısaltıyor ama sıfırlamıyor', () => {
    const once = egitimSuresiSn(100, 10);
    const sonra = egitimSuresiSn(100, 10, false, arastirmaBonusu(['talim_meydani']));
    expect(sonra).toBeLessThan(once);
    expect(sonra).toBeGreaterThan(0);
  });

  it('Seferî Ordu yürüyüşü kısaltıyor', () => {
    const ordu: Army = { mizrakci: 10 };
    const once = marchDurationSec(5, ordu);
    const sonra = marchDurationSec(5, ordu, undefined, undefined, arastirmaBonusu(['seferi_ordu']));
    expect(sonra).toBeLessThanOrEqual(once);
  });

  it('Zırh Atölyesi ve Ok Atölyesi savaşta güç değiştiriyor', () => {
    const taraf = (arastirma: Side['arastirma']): Side => ({
      units: { mizrakci: 100 },
      gearBonus: { saldiri: 0, savunma: 0, can: 0 },
      generalBonus: bosGeneralBonus(),
      lordContribution: 0,
      leadership: 0,
      fortressBonus: 0,
      isDefender: false,
      arastirma,
    });
    const dusman: Side = { ...taraf(null), isDefender: true };
    const ctx = {
      defenderStore: { altin: 0, demir: 0, erzak: 0 },
      attackerCunning: 0,
      canCapture: true,
    };
    const b = arastirmaBonusu(['zirh_atolyesi', 'ok_atolyesi']);
    const dus = simulateBattle(taraf(null), dusman, 'tohum', ctx);
    const guclu = simulateBattle(
      taraf({ orduSaldiri: b.orduSaldiri, orduSavunma: b.orduSavunma, kaleSavunmasi: 0, yagma: 0 }),
      dusman,
      'tohum',
      ctx,
    );
    expect(guclu.rounds[0]!.saldiranGuc).toBeGreaterThan(dus.rounds[0]!.saldiranGuc);
  });

  it('Sur Ustalığı yalnız SAVUNANIN tahkimatını büyütüyor', () => {
    const yap = (isDefender: boolean, arastirma: Side['arastirma']): Side => ({
      units: { mizrakci: 100 },
      gearBonus: { saldiri: 0, savunma: 0, can: 0 },
      generalBonus: bosGeneralBonus(),
      lordContribution: 0,
      leadership: 0,
      fortressBonus: isDefender ? 0.3 : 0,
      isDefender,
      arastirma,
    });
    const b = arastirmaBonusu(['sur_ustaligi']);
    const etki = { orduSaldiri: 0, orduSavunma: 0, kaleSavunmasi: b.kaleSavunmasi, yagma: 0 };
    const ctx = {
      defenderStore: { altin: 0, demir: 0, erzak: 0 },
      attackerCunning: 0,
      canCapture: true,
    };
    const dus = simulateBattle(yap(false, null), yap(true, null), 'tohum', ctx);
    const surlu = simulateBattle(yap(false, null), yap(true, etki), 'tohum', ctx);
    expect(surlu.rounds[0]!.savunanGuc).toBeGreaterThan(dus.rounds[0]!.savunanGuc);
  });

  it('araştırmasız oyuncu hiçbir yerde ceza almıyor', () => {
    const bos = arastirmaBonusu([]);
    expect(storageCapacity(10, bos)).toBe(storageCapacity(10));
    expect(malikaneIncome(10, bos)).toEqual(malikaneIncome(10));
    expect(commandCapacity(10, undefined, bos)).toBe(commandCapacity(10));
    expect(upkeepPerHour({ mizrakci: 10 }, undefined, bos)).toBe(upkeepPerHour({ mizrakci: 10 }));
  });
});

describe('yeni etkiler motorda işliyor (docs/20 §4)', () => {
  const ctx = {
    defenderStore: { altin: 0, demir: 0, erzak: 0 },
    attackerCunning: 0,
    canCapture: true,
  };
  const taraf = (units: Army, arastirma: Side['arastirma'], duzen?: Side['duzen']): Side => ({
    units,
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: 0,
    isDefender: false,
    arastirma,
    duzen,
  });
  const etki = (b: ReturnType<typeof arastirmaBonusu>): Side['arastirma'] => ({
    orduSaldiri: b.orduSaldiri,
    orduSavunma: b.orduSavunma,
    kaleSavunmasi: b.kaleSavunmasi,
    yagma: b.yagma,
    birimSaldiri: b.birimSaldiri,
    birimSavunma: b.birimSavunma,
    taktikUstaligi: b.taktikUstaligi,
  });

  it('Bileşik Yay yalnız OKÇUYU güçlendiriyor', () => {
    const dusman = { ...taraf({ mizrakci: 100 }, null), isDefender: true };
    const b = etki(arastirmaBonusu(['bilesik_yay']));
    const okcu = (a: Side['arastirma']) =>
      simulateBattle(taraf({ okcu: 100 }, a), dusman, 'tohum', ctx).rounds[0]!.saldiranGuc;
    const mizrak = (a: Side['arastirma']) =>
      simulateBattle(taraf({ mizrakci: 100 }, a), dusman, 'tohum', ctx).rounds[0]!.saldiranGuc;
    expect(okcu(b)).toBeGreaterThan(okcu(null));
    expect(mizrak(b)).toBe(mizrak(null));
  });

  it('taktik ustalığı taktiğin kozunu büyütüyor, tavanı delmiyor', () => {
    const ordu: Army = { suvari: 40, mizrakci: 60 };
    const dizilim = varsayilanDizilim(ordu);
    // Düşmanın çeyreği okçu: koz tavanın altında, ustalık onu büyütebilir.
    const dusmanOrdu: Army = { okcu: 25, mizrakci: 75 };
    const duz = taktikEtkisi('hilal', ordu, dizilim, dusmanOrdu);
    const usta = taktikEtkisi('hilal', ordu, dizilim, dusmanOrdu, { hilal: 0.3 });
    expect(usta.saldiri).toBeGreaterThan(duz.saldiri);
    expect(usta.saldiri).toBeLessThanOrEqual(B.taktik.azami_etki);
    // Bedel (hilalin savunma eksisi) hafifliyor.
    expect(usta.savunma).toBeGreaterThan(duz.savunma);
    expect(usta.satirlar.some((x) => x.includes('ustalığı'))).toBe(true);
  });

  it('tavandaki koz büyümüyor ama bedeli yine hafifliyor (docs/20 §4)', () => {
    // Bütün düşman okçu: Hilal %15 + karşı birim %20 = %35, tavan %30.
    // Ustalığın tavanı delmesi yasak; boşa da gitmesin diye eksi küçülüyor.
    const ordu: Army = { suvari: 40, mizrakci: 60 };
    const dizilim = varsayilanDizilim(ordu);
    const duz = taktikEtkisi('hilal', ordu, dizilim, { okcu: 100 });
    const usta = taktikEtkisi('hilal', ordu, dizilim, { okcu: 100 }, { hilal: 0.3 });
    expect(duz.saldiri).toBe(B.taktik.azami_etki);
    expect(usta.saldiri).toBe(B.taktik.azami_etki);
    expect(usta.savunma).toBeGreaterThan(duz.savunma);
  });

  it('başka taktiğin ustalığı bu taktiğe dokunmuyor', () => {
    const ordu: Army = { suvari: 40, mizrakci: 60 };
    const dizilim = varsayilanDizilim(ordu);
    const a = taktikEtkisi('hilal', ordu, dizilim, { okcu: 100 });
    const b = taktikEtkisi('hilal', ordu, dizilim, { okcu: 100 }, { kalkan_duvari: 0.3 });
    expect(b).toEqual(a);
  });

  it('kaynağa özel gelir yalnız o kaynağı artırıyor', () => {
    const once = malikaneIncome(20);
    const sonra = malikaneIncome(20, arastirmaBonusu(['derin_madenler']));
    expect(sonra.demir).toBeGreaterThan(once.demir);
    expect(sonra.altin).toBe(once.altin);
    expect(sonra.erzak).toBe(once.erzak);
    const bolge = regionIncome('maden', 1, 1, undefined, arastirmaBonusu(['derin_madenler']));
    expect(bolge.demir).toBeGreaterThan(regionIncome('maden', 1, 1).demir);
  });

  it('bina hızı süreyi bölüyor', () => {
    const b = arastirmaBonusu(['tas_ocaklari']);
    expect(binaSuresiSn(3, b)).toBe(Math.round(binaSuresiSn(3) / 1.15));
  });

  it('Medrese ve Beytülhikme araştırma yuvası veriyor', () => {
    const bos = esZamanliLimit('research', { kutuphane: 2 });
    expect(esZamanliLimit('research', { kutuphane: 2 }, arastirmaBonusu(['medrese']))).toBe(
      bos + 1,
    );
    expect(
      esZamanliLimit('research', { kutuphane: 2 }, arastirmaBonusu(['medrese', 'beytulhikme'])),
    ).toBe(bos + 2);
  });
});

describe('maliyet eğrisi anlamlı', () => {
  it('ilk çağ erken erişilebilir, bütün ağaç uzun soluklu', () => {
    // Kalıcı dünyada araştırma "tavana gelen ne yapacak" sorusunun
    // cevabı: ağacın tamamı günlerce süren bir iş olmalı.
    const toplamSaat = arastirmaDugumleri().reduce((x, d) => x + arastirmaSuresiSn(d), 0) / 3600;
    expect(arastirmaSuresiSn({ kademe: 1, lord_seviyesi: 1 })).toBeLessThanOrEqual(3600);
    expect(toplamSaat).toBeGreaterThan(200);
  });

  it('maliyet formülü balance.json’dan geliyor', () => {
    const beklenen = Math.round(
      B.arastirma.maliyet_taban.altin * Math.pow(3, B.arastirma.maliyet_us),
    );
    expect(arastirmaMaliyeti(3).altin).toBe(beklenen);
  });
});

describe('düğüm arama', () => {
  it('var olmayan anahtar null dönüyor, çökmüyor', () => {
    expect(arastirmaDugumu('yok_boyle_bir_sey')).toBeNull();
    expect(arastirmaBonusu(['yok_boyle_bir_sey'])).toEqual(bosArastirmaBonusu());
  });
});
