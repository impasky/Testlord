/**
 * Akın motoru: beş harita, on grup, türetilen yenilenme.
 *
 * Buradaki testlerin çoğu bir DENGE sözü tutuyor: zorluk artmalı, ödül
 * onunla birlikte artmalı, ilk harita son haritayı gereksiz kılmamalı.
 * Bunlar bir gün "denge" diye tek bir sayı oynatıldığında sessizce
 * bozulabilecek şeyler; testler o gün patlasın diye burada.
 */
import { describe, expect, it } from 'vitest';
import { AKIN_HARITALARI, B, unit } from './balance.js';
import { simulateBattle } from './combat.js';
import { varsayilanDizilim } from './duzen.js';
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
  type AkinVuruslari,
} from './akin.js';
import { UNIT_TYPES, bosGeneralBonus } from './types.js';

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
  it('her akın bir dakika — harita ve grup fark etmiyor', () => {
    // Oyuncu kararı: akın oturum içinde tekrar tekrar yapılan bir eylem.
    for (const h of AKIN_ANAHTARLARI) {
      for (let g = 1; g <= B.akin.grup_sayisi; g++) {
        expect(akinSuresiSn(h, g), `${h}/${g}`).toBe(60);
      }
    }
    expect(akinSuresiSn(SON, 10)).toBe(akinSuresiSn(ILK, 1));
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

  it('sınırsız normal grup SAĞMAL DEĞİL: ezici orduyla bile ölen asker ödülden pahalı', () => {
    /*
     * Akından sınırsız kaynak çıkması toprak tutmanın sebebini yok eder.
     * Eskiden bunu yenilenme süresi tutuyordu (8 saat: grup günde üç
     * kez). Oyuncunun kararıyla normal grup artık hiç beklemiyor; aynı
     * sözü tutan şey KAYIP. Garnizonun iki ve sekiz katı orduyla, beş
     * haritanın bütün normal gruplarında ölen askerin bedeli kaynak
     * ödülünü aşmalı — aşmazsa en kolay grup bir musluk olur.
     *
     * Eski ölçüt "akın kaybını ÖDESİN"di ve %5 kayıp varsayıyordu; motor
     * gerçekte %10-25 kaybettiriyor, yani söz hiç tutmamıştı. Oyuncunun
     * ödülü düşürme kararıyla (%20) açık açık bırakıldı: akının kaynağı
     * kaybın bir KISMINI karşılar, kazancı XP ve ekipman.
     */
    const taraf = (units: Record<string, number>, savunan: boolean) => ({
      units,
      duzen: { dizilim: varsayilanDizilim(units), taktik: null },
      gearBonus: { saldiri: 0, savunma: 0, can: 0 },
      generalBonus: bosGeneralBonus(),
      lordContribution: 0,
      leadership: 0,
      fortressBonus: 0,
      isDefender: savunan,
    });
    const orduDegeri = (a: Record<string, number | undefined>) =>
      UNIT_TYPES.reduce((t, u) => t + (a[u] ?? 0) * altinKarsiligi(unit(u).maliyet), 0);
    for (const kat of [2, 8]) {
      for (const h of AKIN_ANAHTARLARI) {
        for (let g = 1; g < B.akin.grup_sayisi; g++) {
          const garnizon = akinGarnizonu(h, g);
          const ordu: Record<string, number> = {};
          for (const u of UNIT_TYPES) if (garnizon[u]) ordu[u] = garnizon[u]! * kat;
          const r = simulateBattle(taraf(ordu, false), taraf(garnizon, true), `sagmal-${h}-${g}`, {
            defenderStore: { altin: 0, demir: 0, erzak: 0 },
            attackerCunning: 0,
            canCapture: false,
          });
          const olu = orduDegeri(r.attackerLosses);
          const odul = deger(akinOdulu(h, g));
          expect(r.winner, `${h} ${g}. grup, ${kat} kat`).toBe('attacker');
          expect(olu, `${h} ${g}. grup, ${kat} kat`).toBeGreaterThan(odul);
          // Ama ödül bir SÜS de değil: kaybın anlamlı bir kısmını karşılıyor.
          expect(odul, `${h} ${g}. grup, ${kat} kat`).toBeGreaterThan(olu * 0.05);
        }
      }
    }
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

  it('NORMAL GRUP vurulunca kapanmıyor (oyuncu kararı: "limiti kaldıralım")', () => {
    const simdi = new Date('2026-01-01T12:00:00Z');
    const h = akinDurumlari(99, { [`${ILK}:1`]: simdi }, simdi)[0]!;
    for (let g = 1; g < B.akin.grup_sayisi; g++) expect(akinYenilenmeSn(g)).toBe(0);
    expect(h.gruplar[0]!.acik).toBe(true);
    expect(h.gruplar[0]!.yenilenirAt).toBeNull();
  });

  it('vurulan ŞEF kapalı, süre dolunca açılıyor', () => {
    const simdi = new Date('2026-01-01T12:00:00Z');
    const sef = B.akin.grup_sayisi;
    const azOnce = new Date(simdi.getTime() - 60_000);
    const cokOnce = new Date(simdi.getTime() - (akinYenilenmeSn(sef) + 60) * 1000);

    const taze = akinDurumlari(99, { [`${ILK}:${sef}`]: azOnce }, simdi)[0]!;
    expect(taze.gruplar[sef - 1]!.acik).toBe(false);
    expect(taze.gruplar[sef - 1]!.yenilenirAt).not.toBeNull();

    const eski = akinDurumlari(99, { [`${ILK}:${sef}`]: cokOnce }, simdi)[0]!;
    expect(eski.gruplar[sef - 1]!.acik).toBe(true);
    expect(eski.gruplar[sef - 1]!.yenilenirAt).toBeNull();
  });

  it('şefin vurulması ötekileri etkilemiyor', () => {
    const simdi = new Date('2026-01-01T12:00:00Z');
    const sef = B.akin.grup_sayisi;
    const h = akinDurumlari(
      99,
      { [`${ILK}:${sef}`]: new Date(simdi.getTime() - 60_000) },
      simdi,
    )[0]!;
    expect(h.gruplar[sef - 1]!.acik).toBe(false);
    expect(h.gruplar[0]!.acik).toBe(true);
    expect(h.acikGrup).toBe(sef - 1);
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

  it('yeterli seviye TEK BAŞINA yetmiyor — harita zinciri de var', () => {
    // Bu sınama eskiden "yeterli seviyede hepsi açılıyor" diyordu ve
    // doğruydu: tek kapı seviyeydi. Artık ikinci bir kapı var (önceki
    // haritayı bitirmek), o yüzden 99. seviyede bile yalnız ilki açık.
    // Kural değişti, sınama de onunla değişti — silinmedi.
    const durum = akinDurumlari(99, {});
    expect(durum[0]!.acik).toBe(true);
    expect(durum.slice(1).every((h) => !h.acik)).toBe(true);
  });

  it('seviye yetmezse zincir tamamlansa bile açılmıyor', () => {
    // İki kapı BİRLİKTE çalışıyor: biri diğerini geçersiz kılmıyor.
    const hepsiTemiz: AkinVuruslari = {};
    for (const h of AKIN_HARITALARI) {
      for (let i = 1; i <= 10; i++) hepsiTemiz[`${h.key}:${i}`] = new Date('2020-01-01');
    }
    const durum = akinDurumlari(1, hepsiTemiz);
    const seviyeliler = durum.filter((h) => h.gerekenSeviye > 1);
    expect(seviyeliler.length).toBeGreaterThan(0);
    expect(seviyeliler.every((h) => !h.acik)).toBe(true);
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

describe('harita kapısı — önceki bitmeden sonraki açılmaz', () => {
  const yuksekSeviye = 99;
  const hepsiVurulmus = (key: string): AkinVuruslari =>
    Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`${key}:${i + 1}`, new Date('2020-01-01')]),
    );

  it('ilk harita hiçbir şey gerektirmiyor — öncesi yok', () => {
    const d = akinDurumlari(yuksekSeviye, {});
    expect(d[0]!.acik).toBe(true);
    expect(d[0]!.engel).toBeNull();
  });

  it('seviye yetse bile ikinci harita kapalı: önceki bitmemiş', () => {
    const d = akinDurumlari(yuksekSeviye, {});
    expect(d[1]!.acik).toBe(false);
    expect(d[1]!.engel).toContain(d[0]!.ad);
  });

  it('ilk harita bitince ikincisi açılıyor', () => {
    const d = akinDurumlari(yuksekSeviye, hepsiVurulmus(AKIN_HARITALARI[0]!.key));
    expect(d[0]!.temiz).toBe(true);
    expect(d[1]!.acik).toBe(true);
    // ama ÜÇÜNCÜSÜ hâlâ kapalı: zincir atlanmıyor.
    expect(d[2]!.acik).toBe(false);
  });

  it('dokuz grup yetmiyor, onu da gerekiyor', () => {
    const eksik = hepsiVurulmus(AKIN_HARITALARI[0]!.key);
    delete eksik[`${AKIN_HARITALARI[0]!.key}:10`];
    const d = akinDurumlari(yuksekSeviye, eksik);
    expect(d[0]!.temiz).toBe(false);
    expect(d[1]!.acik).toBe(false);
  });

  it('temizlik KALICI: gruplar yenilense de harita bitmiş sayılıyor', () => {
    // Vuruş zamanları çok eski, yani gruplar çoktan yenilendi. Yine de
    // sonraki harita açık kalmalı — yoksa bitirilen harita birkaç saat
    // sonra "bitmemiş" olur ve sonraki kapanırdı.
    const d = akinDurumlari(yuksekSeviye, hepsiVurulmus(AKIN_HARITALARI[0]!.key));
    expect(d[0]!.gruplar.every((g) => g.acik)).toBe(true);
    expect(d[1]!.acik).toBe(true);
  });

  it('seviye yetmiyorsa engel seviyeyi söylüyor, haritayı değil', () => {
    const d = akinDurumlari(1, hepsiVurulmus(AKIN_HARITALARI[0]!.key));
    expect(d[1]!.engel).toMatch(/seviye/i);
  });
});
