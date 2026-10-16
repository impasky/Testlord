/**
 * Google Play Developer API — yalnız üç çağrı, SDK'sız (docs/25).
 *
 *   satinAlmaGetir  purchases.products.get     satın alma gerçekten var mı
 *   tuket           purchases.products.consume tüketilebilir ürünü kapat
 *                                              (aynı zamanda onaylıyor)
 *   iadeler         purchases.voidedpurchases  iade/iptal edilenler
 *
 * Kimlik: servis hesabının özel anahtarıyla imzalı JWT → OAuth erişim
 * jetonu (RS256, "JWT bearer" akışı). Jeton bir saat geçerli; 5 dakika
 * kala yenileniyor. Bir Google kütüphanesi bunu yapardı ama 60 MB'lık bir
 * bağımlılık üç HTTP çağrısı için fazla.
 *
 * `purchases.products` (v1) seçildi, `productsv2` değil: alanları
 * (purchaseState, consumptionState, obfuscatedExternalAccountId,
 * purchaseType) belgede tam ve kararlı. v2'ye geçmek yalnız bu dosyayı
 * değiştirir.
 *
 * Geliştirmede (NODE_ENV ≠ production) ayar yoksa yerel taklide
 * bağlanıyor (routes/devMagaza.ts): uçtan uca test gerçek kod yolunu —
 * JWT imzası, jeton alma, HTTP çağrıları — koşuyor. Üretimde adresler
 * sabit Google adresleri; ortam değişkeniyle değiştirilemiyor.
 */
import {
  createHash,
  createHmac,
  createPrivateKey,
  createSign,
  generateKeyPairSync,
} from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env } from '../env.js';

const GOOGLE_API = 'https://androidpublisher.googleapis.com';
const GOOGLE_JETON = 'https://oauth2.googleapis.com/token';
const KAPSAM = 'https://www.googleapis.com/auth/androidpublisher';
const URETIM = env.NODE_ENV === 'production';

interface ServisHesabi {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface PlayAyari {
  paket: string;
  apiAdresi: string;
  jetonAdresi: string;
  hesap: ServisHesabi;
  taklit: boolean;
}

/**
 * Geliştirme taklidinin servis hesabı. Anahtar geçici dizinde, veritabanı
 * adresine bağlı bir dosyada: API ve worker AYRI süreçler ve taklidin
 * jeton ucu (API'de) worker'ın imzasını da tanımalı. Depoya hiçbir anahtar
 * yazılmıyor; dosya ilk kullanımda üretiliyor.
 */
function taklitHesap(): ServisHesabi {
  const iz = createHash('sha256').update(env.DATABASE_URL).digest('hex').slice(0, 12);
  const dosya = join(tmpdir(), `lordlar-play-taklit-${iz}.pem`);
  let pem: string;
  try {
    pem = readFileSync(dosya, 'utf8');
  } catch {
    pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString();
    writeFileSync(dosya, pem, { mode: 0o600 });
  }
  return { client_email: 'taklit@lordlar.test', private_key: pem };
}

/**
 * Düz JSON ya da base64 JSON; okunamazsa `null`. Hatanın METNİ bilerek
 * atılıyor: `JSON.parse`ın iletisi girdiden bir parça alıntılıyor ve o
 * parça özel anahtarın kendisi olabilir.
 */
function servisHesabiOku(ham: string): ServisHesabi | null {
  try {
    const metin = ham.trim().startsWith('{') ? ham : Buffer.from(ham, 'base64').toString('utf8');
    const h = JSON.parse(metin) as Partial<ServisHesabi>;
    if (typeof h.client_email !== 'string' || typeof h.private_key !== 'string') return null;
    createPrivateKey(h.private_key); // bozuk PEM şimdi düşsün, ilk satın almada değil
    return h as ServisHesabi;
  } catch {
    return null;
  }
}

let ayarOnbellegi: PlayAyari | null | undefined;
let hesapBozuk = false;

/**
 * Play ayarı; yapılandırılmamışsa ya da servis hesabı okunamıyorsa
 * `null` (mağaza bilgi kipinde, satın alma kapalı). Bozuk hesap oyunu
 * düşürmüyor; yayın kontrolü onu `playHesabiBozukMu` ile söylüyor.
 */
export function playAyari(): PlayAyari | null {
  if (ayarOnbellegi !== undefined) return ayarOnbellegi;
  hesapBozuk = false;
  if (env.PLAY_PAKET_ADI && env.PLAY_SERVIS_HESABI) {
    const hesap = servisHesabiOku(env.PLAY_SERVIS_HESABI);
    if (!hesap) {
      hesapBozuk = true;
      ayarOnbellegi = null;
      return null;
    }
    ayarOnbellegi = {
      paket: env.PLAY_PAKET_ADI,
      apiAdresi: !URETIM && env.PLAY_API_ADRESI ? env.PLAY_API_ADRESI : GOOGLE_API,
      jetonAdresi: !URETIM && hesap.token_uri ? hesap.token_uri : GOOGLE_JETON,
      hesap,
      taklit: false,
    };
  } else if (!URETIM) {
    // Yerel taklit: API'nin geliştirme uçlarında (devMagaza.ts).
    const kok = `http://127.0.0.1:${env.PORT}/api/test/play`;
    ayarOnbellegi = {
      paket: env.PLAY_PAKET_ADI ?? 'com.lordlarcagi.oyun',
      apiAdresi: env.PLAY_API_ADRESI ?? kok,
      jetonAdresi: `${kok}/token`,
      hesap: taklitHesap(),
      taklit: true,
    };
  } else {
    ayarOnbellegi = null;
  }
  return ayarOnbellegi;
}

/** `PLAY_SERVIS_HESABI` girilmiş ama okunamıyor mu (yayın kontrolü). */
export function playHesabiBozukMu(): boolean {
  playAyari();
  return hesapBozuk;
}

/** Testler ayarı değiştirdikten sonra (yalnız geliştirme). */
export function playAyariniUnut(): void {
  ayarOnbellegi = undefined;
  erisim = null;
}

/* ------------------------------------------------------------------ */
/* Erişim jetonu                                                       */
/* ------------------------------------------------------------------ */

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** RS256 imzalı JWT (servis hesabı → OAuth). Saf; test edilebilir. */
export function jwtImzala(hesap: ServisHesabi, aud: string, simdiSn: number): string {
  const baslik = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const govde = b64url(
    JSON.stringify({
      iss: hesap.client_email,
      scope: KAPSAM,
      aud,
      iat: simdiSn,
      exp: simdiSn + 3600,
    }),
  );
  const imza = createSign('RSA-SHA256').update(`${baslik}.${govde}`).sign(hesap.private_key);
  return `${baslik}.${govde}.${b64url(imza)}`;
}

let erisim: { jeton: string; bitis: number } | null = null;

async function erisimJetonu(a: PlayAyari): Promise<string> {
  const simdi = Date.now();
  if (erisim && erisim.bitis - simdi > 5 * 60_000) return erisim.jeton;
  const r = await fetch(a.jetonAdresi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtImzala(a.hesap, a.jetonAdresi, Math.floor(simdi / 1000)),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new PlayHatasi(`erişim jetonu alınamadı (${r.status})`, r.status);
  const j = (await r.json()) as { access_token: string; expires_in?: number };
  erisim = { jeton: j.access_token, bitis: simdi + (j.expires_in ?? 3600) * 1000 };
  return erisim.jeton;
}

/* ------------------------------------------------------------------ */
/* Çağrılar                                                            */
/* ------------------------------------------------------------------ */

export class PlayHatasi extends Error {
  constructor(
    message: string,
    readonly durum: number,
    readonly sebep?: string,
  ) {
    super(message);
  }
}

async function cagir(a: PlayAyari, yontem: 'GET' | 'POST', yol: string): Promise<unknown> {
  const r = await fetch(
    `${a.apiAdresi}/androidpublisher/v3/applications/${encodeURIComponent(a.paket)}${yol}`,
    {
      method: yontem,
      headers: { Authorization: `Bearer ${await erisimJetonu(a)}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const metin = await r.text();
  if (!r.ok) {
    // Google hata gövdesi: { error: { code, message, errors: [{ reason }] } }
    let sebep: string | undefined;
    try {
      sebep = (JSON.parse(metin) as { error?: { errors?: { reason?: string }[] } }).error
        ?.errors?.[0]?.reason;
    } catch {
      /* gövde JSON değil */
    }
    throw new PlayHatasi(
      `Play ${yontem} ${yol.split('/tokens/')[0]} → ${r.status}`,
      r.status,
      sebep,
    );
  }
  return metin ? JSON.parse(metin) : {};
}

/** purchases.products.get yanıtının kullandığımız alanları. */
export interface PlaySatinAlma {
  /** 0 satın alındı, 1 iptal, 2 bekliyor */
  purchaseState?: number;
  /** 0 tüketilmedi, 1 tüketildi */
  consumptionState?: number;
  /** 0 onaylanmadı, 1 onaylandı */
  acknowledgementState?: number;
  orderId?: string;
  /** 0 test (lisans test hesabı), 1 promosyon, 2 ödüllü; yoksa normal */
  purchaseType?: number;
  obfuscatedExternalAccountId?: string;
  productId?: string;
  quantity?: number;
}

const jetonYolu = (urun: string, jeton: string) =>
  `/purchases/products/${encodeURIComponent(urun)}/tokens/${encodeURIComponent(jeton)}`;

export async function satinAlmaGetir(urun: string, jeton: string): Promise<PlaySatinAlma> {
  const a = playAyari();
  if (!a) throw new PlayHatasi('Play yapılandırılmamış', 503);
  return (await cagir(a, 'GET', jetonYolu(urun, jeton))) as PlaySatinAlma;
}

export async function tuket(urun: string, jeton: string): Promise<void> {
  const a = playAyari();
  if (!a) throw new PlayHatasi('Play yapılandırılmamış', 503);
  await cagir(a, 'POST', `${jetonYolu(urun, jeton)}:consume`);
}

export interface PlayIade {
  purchaseToken: string;
  orderId?: string;
  voidedTimeMillis?: string;
  voidedReason?: number;
  voidedSource?: number;
}

/** `baslangic`tan bu yana iade/iptal edilen tek seferlik satın almalar (sayfalı). */
export async function iadeler(baslangic: Date): Promise<PlayIade[]> {
  const a = playAyari();
  if (!a) return [];
  const sonuc: PlayIade[] = [];
  let sayfa: string | undefined;
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ startTime: String(baslangic.getTime()), maxResults: '1000' });
    if (sayfa) q.set('token', sayfa);
    const j = (await cagir(a, 'GET', `/purchases/voidedpurchases?${q}`)) as {
      voidedPurchases?: PlayIade[];
      tokenPagination?: { nextPageToken?: string };
    };
    sonuc.push(...(j.voidedPurchases ?? []));
    sayfa = j.tokenPagination?.nextPageToken;
    if (!sayfa) break;
  }
  return sonuc;
}

/* ------------------------------------------------------------------ */
/* Hesap etiketi                                                       */
/* ------------------------------------------------------------------ */

const ETIKET_ANAHTARI = createHmac('sha256', env.JWT_SECRET)
  .update('lordlar/play-hesap/v1')
  .digest();

/**
 * Satın almayı lorda bağlayan opak etiket (Play'in obfuscatedAccountId'si,
 * en çok 64 karakter). Lord kimliğinin kendisi değil: Play'e kişisel
 * tanımlayıcı vermemek Google'ın isteği. Sunucu, Play'in döndürdüğü
 * etiketin isteği yapan lordunkiyle aynı olduğunu denetliyor — başkasının
 * satın alma jetonunu kendi hesabına yazdırmak böyle engelleniyor.
 */
export function hesapEtiketi(lordId: string): string {
  return createHmac('sha256', ETIKET_ANAHTARI).update(lordId).digest('hex').slice(0, 40);
}

/** Jetonun kısa, geri çevrilemez izi — günlükte jetonun kendisi durmasın. */
export function jetonIzi(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex').slice(0, 12);
}
