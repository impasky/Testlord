/**
 * Akın motoru: beş harita, on grup, türetilen yenilenme.
 *
 * Buradaki testlerin çoğu bir DENGE sözü tutuyor: zorluk artmalı, ödül
 * onunla birlikte artmalı, ilk harita son haritayı gereksiz kılmamalı.
 * Bunlar bir gün "denge" diye tek bir sayı oynatıldığında sessizce
 * bozulabilecek şeyler; testler o gün patlasın diye burada.
 */
import { describe, expect, it } from 'vitest';
import { AKIN_HARITALARI, B, regionBaseIncome, unit } from './balance.js';
import { altinKarsiligi } from './odul.js';
import {
  AKINLAR,
  AKIN_ANAHTARLARI,
  akinDurumlari,
  akinEkipmanSansi,
  akinGarnizonSayisi,
  akinGarnizonu,
  akinGrubuGecerliMi,
  akinHaritasi,
  akinOdulu,
  akinOrdusuEngeli,
  akinSuresiSn,
  akinXp,
  akinYenilenmeSn,
  sefMi,
} from './akin.js';
import { UNIT_TYPES } from './types.js';

const ILK = AKIN_ANAHTARLARI[0]!;
const SON = AKIN_ANAHTARLARI[AKIN_ANAHTARLARI.length - 1]!;

describe('haritalar', () => {
  it('beş harita, her birinde on grup', () => {
    expect(AKINLAR).toHaveLength(5);
    for (const h of AKIN_HARITALARI) {
      expect(h.gruplar, h.key).toHaveLength(B.akin.grup_sayisi);
    }
  });

  it('grup adları benzersiz — iki kamp aynı adı taşımıyor', () => {
    for (const h of AKIN_HARITALARI) {
      expect(new Set(h.gruplar).size, h.key).toBe(h.gruplar.length);
    }
  });

  it('haritalar seviye sırasıyla açılıyor', () => {
    const seviyeler = AKINLAR.map((h) => h.acilisSeviyesi);
    for (let i = 1; i < seviyeler.length; i++) {
      expect(seviyeler[i]!).toBeGreaterThan(seviyeler[i - 1]!);
    }
  });

  it('zorlaştıkça daha iyi ekipman düşüyor — son harita ilkini gereksiz kılıyor', () => {
    const tierler = AKINLAR.map((h) => h.azamiTier);
    expect(tierler[tierler.length - 1]!).toBeGreaterThan(tierler[0]!);
  });

  it('bilinmeyen harita null döner, patlamaz', () => {
    expect(akinHaritasi('yok_boyle_bir_yer')).toBeNull();
    expect(akinGarnizonu('yok_boyle_bir_yer', 1)).toEqual({});
  });
});

describe('grup numarası', () => {
  it('1..10 geçerli, dışı değil', () => {
    expect(akinGrubuGecerliMi(1)).toBe(true);
    expect(akinGrubuGecerliMi(10)).toBe(true);
    expect(akinGrubuGecerliMi(0)).toBe(false);
    expect(akinGrubuGecerliMi(11)).toBe(false);
    expect(akinGrubuGecerliMi(1.5)).toBe(false);
  });

  it('yalnız onuncu grup şef', () => {
    expect(sefMi(10)).toBe(true);
    expect(sefMi(9)).toBe(false);
  });
});

describe('garnizon', () => {
  it('gruptan gruba büyüyor', () => {
    for (let g = 2; g <= 10; g++) {
      expect(akinGarnizonSayisi(ILK, g)).toBeGreaterThan(akinGarnizonSayisi(ILK, g - 1));
    }
  });

  it('haritadan haritaya büyüyor', () => {
    const ilkinSefi = akinGarnizonSayisi(ILK, 10);
    const sonunSefi = akinGarnizonSayisi(SON, 10);
    expect(sonunSefi).toBeGreaterThan(ilkinSefi * 2);
  });

  it('karışımda payı olan her birimden en az 1 çıkıyor', () => {
    // İlk grupta bile: yoksa taş-kağıt-makas erken oyunda görünmezdi.
    for (const h of AKIN_HARITALARI) {
      const ordu = akinGarnizonu(h.key, 1);
      for (const t of UNIT_TYPES) {
        if ((h.karisim[t] ?? 0) > 0) expect(ordu[t], `${h.key}/${t}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('haritaların karışımı farklı — tek bir "en iyi ordu" yok', () => {
    const imzalar = AKIN_HARITALARI.map((h) =>
      UNIT_TYPES.map((t) => (h.karisim[t] ?? 0).toFixed(2)).join('|'),
    );
    expect(new Set(imzalar).size).toBe(AKIN_HARITALARI.length);
  });
});

describe('süre', () => {
  it('grupla ve haritayla uzuyor', () => {
    expect(akinSuresiSn(ILK, 10)).toBeGreaterThan(akinSuresiSn(ILK, 1));
    expect(akinSuresiSn(SON, 1)).toBeGreaterThan(akinSuresiSn(ILK, 1));
  });

  it('ilk grup KISA — akın PvP yürüyüşünden hızlı olmalı', () => {
    expect(akinSuresiSn(ILK, 1)).toBeLessThanOrEqual(10 * 60);
  });
});

describe('ödül', () => {
  it('grupla büyüyor', () => {
    for (let g = 2; g <= 10; g++) {
      expect(akinOdulu(ILK, g).altin).toBeGreaterThan(akinOdulu(ILK, g - 1).altin);
    }
  });

  it('haritanın ağırlığı ödülü şekillendiriyor', () => {
    // Kırık Sahil altın, Solgun Bataklık demir ağırlıklı: ikisi de aynı
    // paketi verseydi harita seçmek bir karar olmazdı.
    const a = akinOdulu(ILK, 5);
    const b = akinOdulu(AKIN_ANAHTARLARI[1]!, 5);
    expect(a.altin / a.demir).not.toBeCloseTo(b.altin / b.demir, 1);
  });

  it('şef ayrıca çarpan alıyor', () => {
    const dokuz = akinOdulu(ILK, 9).altin;
    const on = akinOdulu(ILK, 10).altin;
    expect(on).toBeGreaterThan(dokuz * B.akin.odul_us);
  });

  it('xp de grupla büyüyor', () => {
    expect(akinXp(10)).toBeGreaterThan(akinXp(1));
    expect(akinXp(0)).toBe(0);
  });
});

/**
 * DENGE SÖZLERİ.
 *
 * Bu üçü bir gün "denge" diye tek bir sayı oynatıldığında sessizce
 * bozulabilir; testler o gün patlasın diye burada. Sayıları yeniden
 * çözmek için `pnpm denge:akin`.
 */
describe('denge', () => {
  const deger = (o: { altin: number; demir: number; erzak: number }) => altinKarsiligi(o);
  const saatlik = (h: string, g: number) => (deger(akinOdulu(h, g)) / akinSuresiSn(h, g)) * 3600;

  it('sonraki harita saatlik DAHA ÇOK veriyor', () => {
    // İlk yazışta bozuktu: süre `guc_carpani` ile uzarken ödül uzamıyordu,
    // en kolay harita saatlik en çok altını veriyordu.
    for (let i = 1; i < AKIN_ANAHTARLARI.length; i++) {
      const onceki = AKIN_ANAHTARLARI[i - 1]!;
      const simdi = AKIN_ANAHTARLARI[i]!;
      expect(saatlik(simdi, 1), `${onceki} → ${simdi}`).toBeGreaterThan(saatlik(onceki, 1));
    }
  });

  it('sonraki harita daha AĞIR garnizon tutuyor', () => {
    for (let i = 1; i < AKIN_ANAHTARLARI.length; i++) {
      expect(akinGarnizonSayisi(AKIN_ANAHTARLARI[i]!, 1)).toBeGreaterThan(
        akinGarnizonSayisi(AKIN_ANAHTARLARI[i - 1]!, 1),
      );
    }
  });

  it('akın bir GELİR KAYNAĞI değil: günlük tavan toprak gelirini yüzlerce kat aşmıyor', () => {
    /*
     * Akından toprak çıkması PvP'nin sebebini nasıl yok ederse, akından
     * sınırsız kaynak çıkması da toprak tutmanın sebebini yok eder.
     * İlk sayılarla bu oran 158 katı geçiyordu.
     */
    let tavan = 0;
    for (const h of AKIN_ANAHTARLARI) {
      for (let g = 1; g <= B.akin.grup_sayisi; g++) {
        const kez = sefMi(g) ? 24 / B.akin.sef_yenilenme_saat : 24 / B.akin.yenilenme_saat;
        tavan += deger(akinOdulu(h, g)) * kez;
      }
    }
    const besKoy = 5 * (regionBaseIncome('koy').altin ?? 0) * 24;
    expect(tavan / besKoy).toBeLessThan(80);
  });

  it('bir akın gönderdiği ordunun kaybını ÖDÜYOR ama zengin etmiyor', () => {
    // İlk haritanın orta grubu: oraya gidecek ordu kabaca garnizon
    // kadar; kaybı %5 varsayarsak ödül o kaybın 1-5 katı olmalı.
    const g = 3;
    const garnizon = akinGarnizonu(AKIN_ANAHTARLARI[0]!, g);
    const ordununBedeli = UNIT_TYPES.reduce(
      (t, u) => t + (garnizon[u] ?? 0) * altinKarsiligi(unit(u).maliyet),
      0,
    );
    const kayip = ordununBedeli * 0.05;
    const odul = deger(akinOdulu(AKIN_ANAHTARLARI[0]!, g));
    expect(odul).toBeGreaterThan(kayip);
    expect(odul).toBeLessThan(kayip * 8);
  });
});

describe('ekipman şansı', () => {
  it('ihtimal grupla artıyor ve 1i geçmiyor', () => {
    let once = 0;
    for (let g = 1; g <= 10; g++) {
      const s = akinEkipmanSansi(ILK, g);
      expect(s.ihtimal).toBeGreaterThanOrEqual(once);
      expect(s.ihtimal).toBeLessThanOrEqual(1);
      once = s.ihtimal;
    }
  });

  it('haritanın tavanı ekipman kademesini kesiyor', () => {
    // Kırık Sahil'in ŞEFİ bile son haritanın kademesini düşüremiyor:
    // düşürebilseydi ilk harita son haritayı gereksiz kılardı.
    const ilkinSefi = akinEkipmanSansi(ILK, 10);
    const sonunSefi = akinEkipmanSansi(SON, 10);
    expect(ilkinSefi.tier).toBeLessThanOrEqual(akinHaritasi(ILK)!.azami_tier);
    expect(sonunSefi.tier).toBeGreaterThan(ilkinSefi.tier);
  });
});

describe('yenilenme', () => {
  it('şefin yenilenmesi normalden uzun', () => {
    expect(akinYenilenmeSn(10)).toBeGreaterThan(akinYenilenmeSn(1));
  });

  it('vurulan grup kapalı, süre dolunca açılıyor', () => {
    const simdi = new Date('2026-01-01T12:00:00Z');
    const azOnce = new Date(simdi.getTime() - 60_000);
    const cokOnce = new Date(simdi.getTime() - (akinYenilenmeSn(1) + 60) * 1000);

    const taze = akinDurumlari(99, { [`${ILK}:1`]: azOnce }, simdi)[0]!;
    expect(taze.gruplar[0]!.acik).toBe(false);
    expect(taze.gruplar[0]!.yenilenirAt).not.toBeNull();

    const eski = akinDurumlari(99, { [`${ILK}:1`]: cokOnce }, simdi)[0]!;
    expect(eski.gruplar[0]!.acik).toBe(true);
    expect(eski.gruplar[0]!.yenilenirAt).toBeNull();
  });

  it('bir grubun vurulması ötekini etkilemiyor', () => {
    const simdi = new Date('2026-01-01T12:00:00Z');
    const h = akinDurumlari(99, { [`${ILK}:1`]: new Date(simdi.getTime() - 60_000) }, simdi)[0]!;
    expect(h.gruplar[0]!.acik).toBe(false);
    expect(h.gruplar[1]!.acik).toBe(true);
    expect(h.acikGrup).toBe(9);
  });

  it('bozuk zaman damgası grubu kilitlemiyor', () => {
    // Json'dan gelen değer bozuk olabilir; grup açık kalmalı, patlamamalı.
    const h = akinDurumlari(99, { [`${ILK}:1`]: 'olmayan-bir-tarih' })[0]!;
    expect(h.gruplar[0]!.acik).toBe(true);
  });
});

describe('seviye kapısı', () => {
  it('düşük seviyede yalnız ilk harita açık', () => {
    const durum = akinDurumlari(1, {});
    expect(durum[0]!.acik).toBe(true);
    expect(durum[durum.length - 1]!.acik).toBe(false);
  });

  it('kapalı haritanın grupları da kapalı', () => {
    const kapali = akinDurumlari(1, {})[4]!;
    expect(kapali.gruplar.every((g) => !g.acik)).toBe(true);
    expect(kapali.acikGrup).toBe(0);
  });

  it('yeterli seviyede hepsi açılıyor', () => {
    const durum = akinDurumlari(99, {});
    expect(durum.every((h) => h.acik)).toBe(true);
  });
});

describe('ordu doğrulaması', () => {
  it('boş ordu reddediliyor', () => {
    expect(akinOrdusuEngeli({})).not.toBeNull();
    expect(akinOrdusuEngeli({ milis: 0 })).not.toBeNull();
  });

  it('dolu ordu geçiyor', () => {
    expect(akinOrdusuEngeli({ milis: 3 })).toBeNull();
  });
});
