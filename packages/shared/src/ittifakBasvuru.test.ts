import { describe, expect, it } from 'vitest';
import {
  asgariSeviyeDenetle,
  azamiAsgariSeviye,
  azamiBekleyenBasvuru,
  basvurabilirMi,
  basvuruMesajiDenetle,
  basvuruMesajiEnFazla,
  retBeklemeSn,
  type BasvuruKosullari,
} from './ittifakBasvuru.js';
import { B } from './balance.js';

const SIMDI = new Date('2026-01-01T12:00:00Z');

/** Her şeyi uygun bir başvuru; testler tek tek bozuyor. */
function kosul(ek: Partial<BasvuruKosullari> = {}): BasvuruKosullari {
  return {
    lordSeviye: 12,
    ittifaktaMi: false,
    katilim: 'basvuru',
    asgariSeviye: 1,
    uyeSayisi: 3,
    bekleyenSayisi: 0,
    simdi: SIMDI,
    ...ek,
  };
}

describe('başvuru koşulları', () => {
  it('uygun bir lord başvurabilir', () => {
    expect(basvurabilirMi(kosul()).olur).toBe(true);
  });

  it('ittifakta olan başvuramaz', () => {
    const s = basvurabilirMi(kosul({ ittifaktaMi: true }));
    expect(s.olur).toBe(false);
    expect(s.sebep).toContain('Zaten bir ittifaktasın');
  });

  it('açık ittifağa başvurulmaz, doğrudan katılınır', () => {
    const s = basvurabilirMi(kosul({ katilim: 'acik' }));
    expect(s.olur).toBe(false);
    expect(s.sebep).toContain('doğrudan katılabilirsin');
  });

  it('dolu ittifağa başvurulmaz', () => {
    const s = basvurabilirMi(kosul({ uyeSayisi: B.ittifak.azami_uye }));
    expect(s.olur).toBe(false);
    expect(s.sebep).toContain('dolu');
  });

  it('seviye eşiğinin altındaki lord elenir ve kaç eksiği olduğunu görür', () => {
    const s = basvurabilirMi(kosul({ lordSeviye: 5, asgariSeviye: 10 }));
    expect(s.olur).toBe(false);
    expect(s.sebep).toContain('Sv10');
    expect(s.sebep).toContain('Sv5');
  });

  it('eşiğe tam oturan lord geçer', () => {
    expect(basvurabilirMi(kosul({ lordSeviye: 10, asgariSeviye: 10 })).olur).toBe(true);
  });

  it('bekleyen başvurusu olan aynı ittifağa ikinci kez başvuramaz', () => {
    const s = basvurabilirMi(kosul({ oncekiDurum: 'bekliyor' }));
    expect(s.olur).toBe(false);
    expect(s.sebep).toContain('cevap bekleniyor');
  });
});

describe('ret beklemesi', () => {
  it('reddedilen lord bekleme dolmadan yeniden başvuramaz', () => {
    const s = basvurabilirMi(
      kosul({
        oncekiDurum: 'ret',
        oncekiKararAt: new Date(SIMDI.getTime() - 3600 * 1000),
      }),
    );
    expect(s.olur).toBe(false);
    expect(s.kalanSn).toBeGreaterThan(0);
  });

  it('bekleme dolunca yeniden başvurabilir — ret kalıcı yasak değil', () => {
    const s = basvurabilirMi(
      kosul({
        oncekiDurum: 'ret',
        oncekiKararAt: new Date(SIMDI.getTime() - (retBeklemeSn() + 1) * 1000),
      }),
    );
    expect(s.olur).toBe(true);
  });

  it('geri çekilen başvuru bekleme getirmez — kendi kararı, ceza değil', () => {
    const s = basvurabilirMi(
      kosul({ oncekiDurum: 'geri_cekildi', oncekiKararAt: SIMDI }),
    );
    expect(s.olur).toBe(true);
  });
});

describe('aynı anda açık başvuru sayısı', () => {
  it('tavana kadar başvurulabilir', () => {
    expect(basvurabilirMi(kosul({ bekleyenSayisi: azamiBekleyenBasvuru() - 1 })).olur).toBe(true);
  });

  it('tavanda yeni başvuru alınmaz', () => {
    const s = basvurabilirMi(kosul({ bekleyenSayisi: azamiBekleyenBasvuru() }));
    expect(s.olur).toBe(false);
    expect(s.sebep).toContain('geri çek');
  });

  /**
   * Sıra önemli: oyuncuya önce değiştiremeyeceği engeli söylemeli.
   * "Üç başvurundan birini geri çek" diyip sonra "zaten seviyen yetmiyor"
   * demek, oyuncuya boşuna iş yaptırmak olurdu.
   */
  it('seviye engeli, başvuru tavanından ÖNCE söylenir', () => {
    const s = basvurabilirMi(
      kosul({ lordSeviye: 2, asgariSeviye: 10, bekleyenSayisi: azamiBekleyenBasvuru() }),
    );
    expect(s.sebep).toContain('Sv10');
  });
});

describe('lider ayarları', () => {
  it('makul bir seviye eşiği kabul edilir', () => {
    expect(asgariSeviyeDenetle(10).olur).toBe(true);
    expect(asgariSeviyeDenetle(1).olur).toBe(true);
  });

  it('tavanın üstü reddedilir — ittifak yeni oyuncuya tamamen kapanmasın', () => {
    expect(asgariSeviyeDenetle(azamiAsgariSeviye() + 1).olur).toBe(false);
  });

  it('sıfır ve ondalık reddedilir', () => {
    expect(asgariSeviyeDenetle(0).olur).toBe(false);
    expect(asgariSeviyeDenetle(4.5).olur).toBe(false);
  });

  it('eşik tavanı azami lord seviyesinin yarısını geçmiyor', () => {
    expect(azamiAsgariSeviye()).toBeLessThanOrEqual(B.lord.max_seviye / 2);
  });
});

describe('başvuru notu', () => {
  it('kısa not geçer', () => {
    expect(basvuruMesajiDenetle('Lv12, aktifim, gece oynuyorum').olur).toBe(true);
  });

  it('uzun not reddedilir', () => {
    expect(basvuruMesajiDenetle('a'.repeat(basvuruMesajiEnFazla() + 1)).olur).toBe(false);
  });

  it('boş not geçer — not zorunlu değil', () => {
    expect(basvuruMesajiDenetle('').olur).toBe(true);
  });
});
