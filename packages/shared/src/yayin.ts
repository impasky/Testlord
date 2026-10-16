/**
 * YAYIN KONTROLÜ — sunucu eksik ayarları kendisi söylüyor (docs/05 §6).
 *
 * Yayın öncesi kontrol listesi bir belgedeydi ve test KODUN doğru
 * davrandığını gösteriyordu; üretim ORTAMINDA değişkenin gerçekten öyle
 * ayarlandığını göstermiyordu. `NODE_ENV`i unutmak test uçlarını açık
 * bırakıyor, `EPOSTA_TASIYICI=log` parola sıfırlama postasını hiç
 * göndermiyor, yönetici atanmamışsa şikâyetler kimsesiz birikiyor — ve
 * hiçbiri bir hata vermiyor, oyun "çalışıyor" görünüyor.
 *
 * Denetim SAF: girdisi yalnız evet/hayır ve sayılar. Sunucu ayarların
 * DEĞERİNİ buraya hiç geçirmiyor (`JWT_SECRET`in kendisi değil "güçlü
 * mü"; adresin kendisi değil "yerel mi"), çıktısı da yalnız ad, durum
 * ve sebep kodu. Pano, açılış günlüğü ve `pnpm yayin-kontrolu` aynı
 * listeyi okuyor; metinler burada, arayüzde çevriliyor.
 */

export type YayinDurumu = 'tamam' | 'eksik' | 'uyari';

/** Sunucunun topladığı girdi — hiçbir ayarın değeri yok. */
export interface YayinGirdisi {
  uretim: boolean;
  /** `JWT_SECRET` rastgele görünüyor mu (bkz. `jwtGucluMu`). */
  jwtGuclu: boolean;
  demoLordlar: boolean;
  yoneticiSayisi: number;
  sentryDsn: boolean;
  izlemeAcik: boolean;
  epostaTasiyici: 'log' | 'resend';
  epostaAnahtar: boolean;
  /** Gönderen adresi varsayılan (`@localhost`) mı. */
  epostaGonderenYerel: boolean;
  vapidAcik: boolean;
  vapidGizli: boolean;
  /** Parola sıfırlama bağlantısının tabanı. */
  uygulamaUrl: 'yok' | 'yerel' | 'guvensiz' | 'tamam';
  /** Arayüz ayrı bir adresteyse (`SERVE_WEB` kapalı) izinli adreslerin hepsi yerel mi. */
  webOriginYerel: boolean;
  arayuzAyni: boolean;
  destekEposta: boolean;
  hizSiniriYuksek: boolean;
  logAyrintili: boolean;
  resimSiniflandirici: boolean;
  /** İstemcinin IP'si nereden okunuyor (apps/api istemciIp.ts). */
  ipKaynagi: 'baslik' | 'vekil' | 'baglanti';
  /** Render'da mı — orada istek her zaman bir vekilden geçiyor. */
  renderda: boolean;
  /**
   * Denetimi isteyen yöneticinin KENDİ isteğinde görülen: vekil izi var
   * mı, ayarlı başlık eksik mi. Açılışta ve komut satırında istek yok:
   * `null`. Değer değil, yalnız evet/hayır.
   */
  istek: { vekilIzi: boolean; baslikEksik: boolean } | null;
  /**
   * Google Play satın alma (docs/25): paket adı ve servis hesabının ikisi
   * de var mı, hesap okunabiliyor mu. Hesabın kendisi değil.
   */
  play: 'yok' | 'yarim' | 'bozuk' | 'tamam';
  /** AdMob: ödüllü birim, yayıncı kimliği ve ikisi aynı hesaptan mı. */
  reklam: { birim: boolean; yayinci: boolean; uyusuyor: boolean };
}

export type YayinNedeni =
  | 'uretim'
  | 'uretim-degil'
  | 'jwt'
  | 'jwt-zayif'
  | 'demo-kapali'
  | 'demo-acik'
  | 'yonetici'
  | 'yonetici-yok'
  | 'sentry'
  | 'sentry-yok'
  | 'sentry-hatali'
  | 'eposta'
  | 'eposta-log'
  | 'eposta-anahtar-yok'
  | 'eposta-gonderen-yerel'
  | 'push'
  | 'push-yok'
  | 'push-yarim'
  | 'adres'
  | 'adres-yok'
  | 'adres-yerel'
  | 'adres-guvensiz'
  | 'origin'
  | 'origin-yerel'
  | 'destek'
  | 'destek-yok'
  | 'hiz'
  | 'hiz-yuksek'
  | 'log'
  | 'log-ayrintili'
  | 'resim'
  | 'resim-kapali'
  | 'ip'
  | 'ip-vekil'
  | 'ip-dogrudan'
  | 'ip-baslik-yok'
  | 'ip-vekil-arkasi'
  | 'ip-bilinmiyor'
  | 'play'
  | 'play-kapali'
  | 'play-yarim'
  | 'play-bozuk'
  | 'reklam'
  | 'reklam-kapali'
  | 'reklam-app-ads-yok'
  | 'reklam-yayinci-uyusmuyor';

export interface YayinBulgusu {
  /** Ayarın adı (`NODE_ENV`) ya da ayar olmayan işin adı (`yönetici`). */
  ad: string;
  durum: YayinDurumu;
  neden: YayinNedeni;
}

/** Bulgunun açıklaması; durum `tamam` değilse ne yapılacağı da içinde. */
export const YAYIN_METNI: Record<YayinNedeni, string> = {
  uretim: 'Üretim kipinde; test uçları kapalı.',
  'uretim-degil':
    'NODE_ENV=production değil: /api/test/* uçları açık ve CORS gevşek. Sunucuda NODE_ENV=production yap.',
  jwt: 'Oturum imzası uzun ve rastgele görünüyor.',
  'jwt-zayif':
    'Oturum imzası tahmin edilebilir görünüyor (tekrarlı ya da örnek bir sözcük içeriyor). Rastgele üret; değişince herkes çıkış yapar.',
  'demo-kapali': 'Rakip demo lordlar eklenmiyor.',
  'demo-acik':
    'İlk açılışta 6 demo lord ekleniyor. Gerçek oyuncular gelecekse SEED_DEMO_LORDS=false yap.',
  yonetici: 'En az bir yönetici var.',
  'yonetici-yok':
    'Hiç yönetici yok: şikâyetler kuyrukta birikiyor ve kimse bakamıyor. pnpm yonetici ver <eposta>',
  sentry: 'Hata izleme açık.',
  'sentry-yok': 'Hata izleme kapalı: sunucu çökünce kimse haber almıyor. SENTRY_DSN gir.',
  'sentry-hatali':
    'SENTRY_DSN girilmiş ama izleme açılamadı; büyük olasılıkla yazım hatası. Sentry panelinden yeniden kopyala.',
  eposta: 'E-posta gerçekten gönderiliyor.',
  'eposta-log':
    'E-posta yalnız sunucu günlüğüne yazılıyor; parola sıfırlama ve doğrulama postası oyuncuya gitmiyor. EPOSTA_TASIYICI=resend yap.',
  'eposta-anahtar-yok': 'EPOSTA_TASIYICI=resend ama EPOSTA_ANAHTAR boş: posta gönderilemez.',
  'eposta-gonderen-yerel':
    'Gönderen adresi varsayılan (@localhost); posta reddedilir. EPOSTA_GONDEREN alan adın doğrulanmış bir adres olmalı.',
  push: 'Push bildirimi açık.',
  'push-yok':
    'Push bildirimi kapalı; arayüzde düğme hiç çıkmıyor. pnpm push-anahtari ile üretilen VAPID çiftini gir.',
  'push-yarim': 'VAPID çiftinin yalnız bir yarısı girilmiş; push kapalı. İkisini birlikte gir.',
  adres: 'Bağlantıların tabanı herkese açık bir https adresi.',
  'adres-yok':
    'Uygulamanın adresi bilinmiyor; parola sıfırlama bağlantısı localhost gösteriyor. UYGULAMA_URL gir.',
  'adres-yerel': 'UYGULAMA_URL yerel bir adres; e-postadaki bağlantılar oyuncuda açılmaz.',
  'adres-guvensiz': 'UYGULAMA_URL https değil; parola sıfırlama bağlantısı şifresiz gidiyor.',
  origin: 'Arayüzün adresi izinli.',
  'origin-yerel':
    "Arayüz ayrı bir adreste ama WEB_ORIGIN yalnız localhost: tarayıcı istekleri CORS'ta düşer. Arayüzün adresini WEB_ORIGIN'e yaz.",
  destek: 'Destek adresi yayında.',
  'destek-yok':
    "DESTEK_EPOSTA boş: Kullanım Koşulları ve Aydınlatma Metni'nde iletişim satırı yok. Oyuncunun yazabileceği bir adres gir.",
  hiz: 'İstek tavanları olağan.',
  'hiz-yuksek':
    "İstek tavanları çok yüksek; yük testi değeri kalmış olabilir. RATE_LIMIT_MAX ve AUTH_RATE_LIMIT_MAX'ı varsayılana döndür.",
  log: 'Günlük seviyesi olağan.',
  'log-ayrintili':
    'Günlük debug/trace seviyesinde; üretimde gereğinden çok yazıyor. LOG_LEVEL=info yap.',
  resim: 'Profil resmi sınıflandırıcısı açık.',
  'resim-kapali':
    'Profil resmi sınıflandırıcısı kapalı: yüklenen her resim yönetici onayını bekliyor.',
  ip: 'İstemcinin adresi vekilin yazdığı başlıktan okunuyor.',
  'ip-vekil': "İstemcinin adresi X-Forwarded-For'dan, güvenilen vekil sayısıyla okunuyor.",
  'ip-dogrudan': 'İstemcinin adresi doğrudan bağlantıdan okunuyor.',
  'ip-baslik-yok':
    'ISTEMCI_IP_BASLIGI girilmiş ama bu istekte o başlık yok: adres vekilinkine düşüyor. Başlığın adını denetle (Render: cf-connecting-ip).',
  'ip-vekil-arkasi':
    'Sunucu bir vekilin arkasında ama adres bağlantıdan okunuyor: kayıt ve giriş sınırı bütün oyunculara tek kova. Render’da ISTEMCI_IP_BASLIGI=cf-connecting-ip yap.',
  'ip-bilinmiyor':
    'Sunucu bir vekilin arkasındaysa ISTEMCI_IP_BASLIGI ya da VEKIL_SAYISI gir; yoksa giriş sınırı herkese tek kova olur. Yönetici panosu bunu senin isteğinle ölçer.',
  play: 'Google Play satın alma açık; her satın alma sunucuda Google’a doğrulatılıyor.',
  'play-kapali':
    'Google Play satın alma kapalı: Mağaza yalnız bilgi gösteriyor, elmas paketi satılmıyor. Açmak için PLAY_PAKET_ADI ve PLAY_SERVIS_HESABI gir (docs/25).',
  'play-yarim':
    'PLAY_PAKET_ADI ile PLAY_SERVIS_HESABI’ndan yalnız biri girilmiş; satın alma kapalı. İkisini birlikte gir.',
  'play-bozuk':
    'PLAY_SERVIS_HESABI okunamıyor (JSON ya da base64 JSON değil, ya da client_email/private_key eksik); satın alma kapalı. Anahtarı Google Cloud’dan yeniden indirip gir.',
  reklam: 'Ödüllü reklam açık; ödül yalnız Google’ın imzalı bildirimiyle veriliyor.',
  'reklam-kapali':
    'Ödüllü reklam kapalı: uygulamada "Reklam izle" çıkmıyor. Açmak için ADMOB_ODUL_BIRIMI gir (docs/25).',
  'reklam-app-ads-yok':
    'ADMOB_YAYINCI_KIMLIGI boş: /app-ads.txt yayımlanmıyor ve AdMob doğrulanmamış uygulamanın reklamını kısıyor. pub-… kimliğini gir.',
  'reklam-yayinci-uyusmuyor':
    'ADMOB_ODUL_BIRIMI ile ADMOB_YAYINCI_KIMLIGI farklı yayıncılara ait; app-ads.txt yanlış hesabı gösteriyor. İkisini aynı AdMob hesabından kopyala.',
};

/** Sunucunun bilemediği, elle denenecek işler (docs/05 §6). */
export const YAYIN_ELLE: readonly string[] = [
  'Yedek alınıyor ve canlı veritabanında bir kez "pnpm yedek-tatbikati" koştu (docs/05 §4).',
  'Parola sıfırlama e-postası gerçekten geliyor.',
  'Hesap ekranındaki "Deneme gönder" telefona düşüyor.',
  'AdMob’da ödüllü birimin sunucu doğrulama (SSV) adresi https://<alan adın>/api/reklam/ssv ve "Doğrula" geçiyor (docs/25).',
  'Android uygulamasında lisans test hesabıyla bir elmas paketi alındı ve elmas geldi; bir test reklamı izlendi ve süre düştü (docs/25).',
];

/** Bir tavanın üstü "yük testinden kalmış" sayılıyor. */
export const HIZ_SINIRI_TAVANI = { genel: 1000, giris: 300 } as const;

/**
 * İmza rastgele görünüyor mu. Kesin bir ölçü değil, yaygın hataları
 * yakalıyor: örnek dosyadan kopyalanmış bir cümle, tekrarlanan harfler.
 * Uzunluk zaten açılışta denetleniyor (en az 32).
 */
export function jwtGucluMu(imza: string): boolean {
  if (imza.length < 32) return false;
  if (new Set(imza).size < 12) return false;
  return !/degistir|değiştir|change|secret|gizli|ornek|örnek|example|password|parola|lordlar/i.test(
    imza,
  );
}

/** Adresi sınıflandırır; adresin kendisi dışarı çıkmıyor. */
export function adresSinifi(adres: string | null | undefined): YayinGirdisi['uygulamaUrl'] {
  if (!adres) return 'yok';
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(adres))
    return 'yerel';
  if (!/^https:\/\//i.test(adres)) return 'guvensiz';
  return 'tamam';
}

export function yayinDenetimi(g: YayinGirdisi): YayinBulgusu[] {
  const b: YayinBulgusu[] = [];
  const ekle = (ad: string, durum: YayinDurumu, neden: YayinNedeni) => b.push({ ad, durum, neden });

  ekle('NODE_ENV', g.uretim ? 'tamam' : 'eksik', g.uretim ? 'uretim' : 'uretim-degil');
  ekle('JWT_SECRET', g.jwtGuclu ? 'tamam' : 'eksik', g.jwtGuclu ? 'jwt' : 'jwt-zayif');
  ekle(
    'yönetici',
    g.yoneticiSayisi > 0 ? 'tamam' : 'eksik',
    g.yoneticiSayisi > 0 ? 'yonetici' : 'yonetici-yok',
  );
  ekle(
    'SENTRY_DSN',
    g.sentryDsn && g.izlemeAcik ? 'tamam' : 'eksik',
    !g.sentryDsn ? 'sentry-yok' : g.izlemeAcik ? 'sentry' : 'sentry-hatali',
  );
  if (g.epostaTasiyici === 'log') ekle('EPOSTA_TASIYICI', 'eksik', 'eposta-log');
  else if (!g.epostaAnahtar) ekle('EPOSTA_ANAHTAR', 'eksik', 'eposta-anahtar-yok');
  else if (g.epostaGonderenYerel) ekle('EPOSTA_GONDEREN', 'eksik', 'eposta-gonderen-yerel');
  else ekle('EPOSTA_TASIYICI', 'tamam', 'eposta');
  ekle(
    'VAPID',
    g.vapidAcik && g.vapidGizli ? 'tamam' : 'eksik',
    g.vapidAcik && g.vapidGizli ? 'push' : g.vapidAcik || g.vapidGizli ? 'push-yarim' : 'push-yok',
  );
  ekle(
    'UYGULAMA_URL',
    g.uygulamaUrl === 'tamam' ? 'tamam' : 'eksik',
    g.uygulamaUrl === 'tamam' ? 'adres' : (`adres-${g.uygulamaUrl}` as const),
  );
  if (!g.arayuzAyni) {
    ekle(
      'WEB_ORIGIN',
      g.webOriginYerel ? 'eksik' : 'tamam',
      g.webOriginYerel ? 'origin-yerel' : 'origin',
    );
  }
  ekle(
    'SEED_DEMO_LORDS',
    g.demoLordlar ? 'uyari' : 'tamam',
    g.demoLordlar ? 'demo-acik' : 'demo-kapali',
  );
  ekle(
    'DESTEK_EPOSTA',
    g.destekEposta ? 'tamam' : 'uyari',
    g.destekEposta ? 'destek' : 'destek-yok',
  );
  ekle(
    'RATE_LIMIT_MAX',
    g.hizSiniriYuksek ? 'uyari' : 'tamam',
    g.hizSiniriYuksek ? 'hiz-yuksek' : 'hiz',
  );
  ekle('LOG_LEVEL', g.logAyrintili ? 'uyari' : 'tamam', g.logAyrintili ? 'log-ayrintili' : 'log');
  ekle(
    'RESIM_SINIFLANDIRICI',
    g.resimSiniflandirici ? 'tamam' : 'uyari',
    g.resimSiniflandirici ? 'resim' : 'resim-kapali',
  );
  /*
   * İstemci adresi. Yanlışsa hiçbir şey hata vermiyor: oyun çalışıyor,
   * yalnız giriş sınırı bütün oyunculara tek kova ve çoklu hesap izi
   * herkesi aynı ağda gösteriyor. Kesin hüküm yöneticinin kendi isteğinden.
   */
  if (g.ipKaynagi === 'baslik') {
    ekle(
      'ISTEMCI_IP_BASLIGI',
      g.istek?.baslikEksik ? 'eksik' : 'tamam',
      g.istek?.baslikEksik ? 'ip-baslik-yok' : 'ip',
    );
  } else if (g.ipKaynagi === 'vekil') {
    ekle('VEKIL_SAYISI', 'tamam', 'ip-vekil');
  } else if (g.renderda || g.istek?.vekilIzi) {
    ekle('ISTEMCI_IP_BASLIGI', 'eksik', 'ip-vekil-arkasi');
  } else if (g.uretim && !g.istek) {
    ekle('ISTEMCI_IP_BASLIGI', 'uyari', 'ip-bilinmiyor');
  } else {
    ekle('ISTEMCI_IP_BASLIGI', 'tamam', 'ip-dogrudan');
  }
  /*
   * Mağaza isteğe bağlı: hiç girilmemişse oyun eksiksiz, yalnız satış
   * ve reklam yok (uyarı). Yarım ya da bozuk bir ayar ise birinin açmak
   * isteyip başaramadığı demek (eksik).
   */
  ekle(
    'PLAY_SERVIS_HESABI',
    g.play === 'tamam' ? 'tamam' : g.play === 'yok' ? 'uyari' : 'eksik',
    g.play === 'tamam' ? 'play' : g.play === 'yok' ? 'play-kapali' : (`play-${g.play}` as const),
  );
  if (!g.reklam.birim) ekle('ADMOB_ODUL_BIRIMI', 'uyari', 'reklam-kapali');
  else if (!g.reklam.yayinci) ekle('ADMOB_YAYINCI_KIMLIGI', 'uyari', 'reklam-app-ads-yok');
  else if (!g.reklam.uyusuyor) ekle('ADMOB_YAYINCI_KIMLIGI', 'eksik', 'reklam-yayinci-uyusmuyor');
  else ekle('ADMOB_ODUL_BIRIMI', 'tamam', 'reklam');
  return b;
}

/** Eksik ve uyarı sayısı. */
export function yayinOzeti(b: readonly YayinBulgusu[]): { eksik: number; uyari: number } {
  return {
    eksik: b.filter((x) => x.durum === 'eksik').length,
    uyari: b.filter((x) => x.durum === 'uyari').length,
  };
}
