import { describe, expect, it } from 'vitest';
import {
  YAYIN_METNI,
  adresSinifi,
  jwtGucluMu,
  yayinDenetimi,
  yayinOzeti,
  type YayinGirdisi,
} from './yayin';

const HAZIR: YayinGirdisi = {
  uretim: true,
  jwtGuclu: true,
  demoLordlar: false,
  yoneticiSayisi: 1,
  sentryDsn: true,
  izlemeAcik: true,
  epostaTasiyici: 'resend',
  epostaAnahtar: true,
  epostaGonderenYerel: false,
  vapidAcik: true,
  vapidGizli: true,
  uygulamaUrl: 'tamam',
  webOriginYerel: true,
  arayuzAyni: true,
  destekEposta: true,
  hizSiniriYuksek: false,
  logAyrintili: false,
  resimSiniflandirici: true,
};

const neden = (g: Partial<YayinGirdisi>) =>
  Object.fromEntries(yayinDenetimi({ ...HAZIR, ...g }).map((b) => [b.ad, b.neden]));

describe('yayın kontrolü', () => {
  it('her şey ayarlıysa eksik ve uyarı yok', () => {
    expect(yayinOzeti(yayinDenetimi(HAZIR))).toEqual({ eksik: 0, uyari: 0 });
  });

  it('boş bir geliştirme ortamı: zorunlular eksik', () => {
    const b = yayinDenetimi({
      ...HAZIR,
      uretim: false,
      yoneticiSayisi: 0,
      sentryDsn: false,
      izlemeAcik: false,
      epostaTasiyici: 'log',
      epostaAnahtar: false,
      vapidAcik: false,
      vapidGizli: false,
      uygulamaUrl: 'yok',
      arayuzAyni: false,
    });
    const eksik = b.filter((x) => x.durum === 'eksik').map((x) => x.ad);
    expect(eksik).toEqual([
      'NODE_ENV',
      'yönetici',
      'SENTRY_DSN',
      'EPOSTA_TASIYICI',
      'VAPID',
      'UYGULAMA_URL',
      'WEB_ORIGIN',
    ]);
  });

  it('sebepler ayrışıyor', () => {
    expect(neden({ sentryDsn: true, izlemeAcik: false }).SENTRY_DSN).toBe('sentry-hatali');
    expect(neden({ epostaAnahtar: false }).EPOSTA_ANAHTAR).toBe('eposta-anahtar-yok');
    expect(neden({ epostaGonderenYerel: true }).EPOSTA_GONDEREN).toBe('eposta-gonderen-yerel');
    expect(neden({ vapidGizli: false }).VAPID).toBe('push-yarim');
    expect(neden({ uygulamaUrl: 'guvensiz' }).UYGULAMA_URL).toBe('adres-guvensiz');
    expect(neden({ uygulamaUrl: 'yerel' }).UYGULAMA_URL).toBe('adres-yerel');
    expect(neden({ demoLordlar: true }).SEED_DEMO_LORDS).toBe('demo-acik');
  });

  it('WEB_ORIGIN yalnız arayüz ayrı adresteyse denetleniyor', () => {
    expect(neden({}).WEB_ORIGIN).toBeUndefined();
    expect(neden({ arayuzAyni: false }).WEB_ORIGIN).toBe('origin-yerel');
    expect(neden({ arayuzAyni: false, webOriginYerel: false }).WEB_ORIGIN).toBe('origin');
  });

  it('uyarılar yayını durdurmuyor, eksik sayısına girmiyor', () => {
    const o = yayinOzeti(
      yayinDenetimi({
        ...HAZIR,
        demoLordlar: true,
        destekEposta: false,
        hizSiniriYuksek: true,
        logAyrintili: true,
        resimSiniflandirici: false,
      }),
    );
    expect(o).toEqual({ eksik: 0, uyari: 5 });
  });

  it('her sebebin metni var', () => {
    for (const b of yayinDenetimi(HAZIR)) expect(YAYIN_METNI[b.neden]).toBeTruthy();
    for (const m of Object.values(YAYIN_METNI)) expect(m.length).toBeGreaterThan(10);
  });

  it('imza: örnek cümle ve tekrar zayıf, rastgele güçlü', () => {
    expect(jwtGucluMu('a'.repeat(40))).toBe(false);
    expect(jwtGucluMu('bunu-mutlaka-degistir-uretimde-32-karakter')).toBe(false);
    expect(jwtGucluMu('dev-secret-change-me-please-0123456789')).toBe(false);
    expect(jwtGucluMu('kısa')).toBe(false);
    expect(jwtGucluMu('Qm9v1x7ZtP2kLw4sHc8RyB3nJd6fVg0aEu5i')).toBe(true);
  });

  it('adres sınıfı: değer dışarı çıkmıyor, yalnız sınıfı', () => {
    expect(adresSinifi(undefined)).toBe('yok');
    expect(adresSinifi('')).toBe('yok');
    expect(adresSinifi('http://localhost:5173')).toBe('yerel');
    expect(adresSinifi('http://127.0.0.1')).toBe('yerel');
    expect(adresSinifi('http://oyun.example.com')).toBe('guvensiz');
    expect(adresSinifi('https://lordlar.onrender.com')).toBe('tamam');
    expect(adresSinifi('https://localhost.example.com')).toBe('tamam');
  });
});
