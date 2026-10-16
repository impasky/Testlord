/**
 * AdMob ödüllü reklam — sunucu tarafı doğrulama (SSV, docs/25).
 *
 * Ödülü İSTEMCİ VERMİYOR. Reklam bitince Google sunucumuzu imzalı bir
 * GET ile çağırıyor; ödül yalnız imza doğrulanınca veriliyor. "İzledim"
 * diyen bir istemci hiçbir şey kazanmıyor.
 *
 * İmza (Google'ın SSV belgesi ve Tink örneği):
 *   - Sorgu dizgisinin sonunda `signature` ve `key_id` var, bu sırayla.
 *   - İmzalanan içerik: `&signature=`dan ÖNCEKİ kısım, yüzde
 *     kodlaması çözülmüş hâliyle (Java'da `URI.getQuery()`).
 *   - İmza base64url, DER biçiminde ECDSA (P-256) / SHA-256.
 *   - Açık anahtarlar Google'ın anahtar sunucusunda (keyId → pem);
 *     24 saatten uzun önbelleğe alınmamalı, anahtarlar dönüyor.
 *
 * Geliştirmede Google'ın anahtarlarına ek olarak süreç içinde üretilen
 * bir anahtar da tanınıyor (`key_id=gelistirme`): uçtan uca test imzalı
 * bir çağrıyı gerçek doğrulama yolundan geçiriyor. Üretimde o anahtar yok.
 */
import { createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { env } from '../env.js';

const GOOGLE_ANAHTARLAR = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const URETIM = env.NODE_ENV === 'production';
const ONBELLEK_MS = 12 * 3_600_000;
/** Bilinmeyen key_id gelince anahtarlar en sık bu kadar arayla yeniden çekilir. */
const YENIDEN_CEKME_MS = 60_000;

let anahtarlar: { harita: Map<string, KeyObject>; an: number } | null = null;
let sonCekme = 0;

async function anahtarlariCek(): Promise<Map<string, KeyObject>> {
  const adres = !URETIM && env.ADMOB_ANAHTAR_ADRESI ? env.ADMOB_ANAHTAR_ADRESI : GOOGLE_ANAHTARLAR;
  sonCekme = Date.now();
  const r = await fetch(adres, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`AdMob anahtarları alınamadı (${r.status})`);
  const j = (await r.json()) as { keys?: { keyId: number | string; pem: string }[] };
  const harita = new Map<string, KeyObject>();
  for (const k of j.keys ?? []) harita.set(String(k.keyId), createPublicKey(k.pem));
  anahtarlar = { harita, an: Date.now() };
  return harita;
}

async function anahtar(keyId: string): Promise<KeyObject | null> {
  if (!URETIM && keyId === GELISTIRME_KEY_ID) return gelistirmeAnahtari().acik;
  const taze = anahtarlar && Date.now() - anahtarlar.an < ONBELLEK_MS;
  let harita = taze ? anahtarlar!.harita : await anahtarlariCek();
  if (!harita.has(keyId) && Date.now() - sonCekme > YENIDEN_CEKME_MS) {
    harita = await anahtarlariCek(); // anahtar yeni dönmüş olabilir
  }
  return harita.get(keyId) ?? null;
}

export interface SsvAlanlari {
  adUnit: string;
  customData: string;
  userId: string;
  rewardAmount: number;
  rewardItem: string;
  transactionId: string;
  timestamp: number;
}

/** İmzalanan içerik ve imza — saf, sorgu dizgisinin ham hâlinden. */
export function ssvParcala(
  hamSorgu: string,
): { icerik: string; imza: string; keyId: string } | null {
  const i = hamSorgu.indexOf('&signature=');
  if (i <= 0) return null;
  const p = new URLSearchParams(hamSorgu);
  const imza = p.get('signature');
  const keyId = p.get('key_id');
  if (!imza || !keyId) return null;
  let icerik: string;
  try {
    icerik = decodeURIComponent(hamSorgu.slice(0, i));
  } catch {
    return null;
  }
  return { icerik, imza, keyId };
}

/** Doğrularsa alanları, doğrulamazsa `null` döndürür. */
export async function ssvDogrula(hamSorgu: string): Promise<SsvAlanlari | null> {
  const parca = ssvParcala(hamSorgu);
  if (!parca) return null;
  const k = await anahtar(parca.keyId);
  if (!k) return null;
  let gecerli: boolean;
  try {
    gecerli = verify(
      'sha256',
      Buffer.from(parca.icerik, 'utf8'),
      { key: k, dsaEncoding: 'der' },
      Buffer.from(parca.imza, 'base64url'),
    );
  } catch {
    gecerli = false; // bozuk DER ya da yanlış biçimli imza
  }
  if (!gecerli) return null;
  const p = new URLSearchParams(hamSorgu);
  return {
    adUnit: p.get('ad_unit') ?? '',
    customData: p.get('custom_data') ?? '',
    userId: p.get('user_id') ?? '',
    rewardAmount: Number(p.get('reward_amount') ?? 0),
    rewardItem: p.get('reward_item') ?? '',
    transactionId: p.get('transaction_id') ?? '',
    timestamp: Number(p.get('timestamp') ?? 0),
  };
}

/** Çağrı bizim ödüllü reklam birimimizden mi (yapılandırılmışsa). */
export function birimBizimMi(adUnit: string): boolean {
  const birim = odulBirimi();
  if (!birim) return !URETIM;
  return birim.split('/')[1] === adUnit;
}

/** Google'ın herkese açık Android ödüllü TEST birimi. */
const TEST_BIRIMI = 'ca-app-pub-3940256099942544/5224354917';

/** Uygulamanın kullanacağı ödüllü birim; üretimde ayar yoksa `null` (reklam kapalı). */
export function odulBirimi(): string | null {
  return env.ADMOB_ODUL_BIRIMI ?? (URETIM ? null : TEST_BIRIMI);
}

/* ------------------------------------------------------------------ */
/* Geliştirme imzacısı                                                 */
/* ------------------------------------------------------------------ */

export const GELISTIRME_KEY_ID = 'gelistirme';
let gelistirme: { acik: KeyObject; gizli: KeyObject } | null = null;

function gelistirmeAnahtari() {
  if (URETIM) throw new Error('geliştirme imzacısı üretimde yok');
  if (!gelistirme) {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    gelistirme = { acik: publicKey, gizli: privateKey };
  }
  return gelistirme;
}

/**
 * Google'ın göndereceği gibi imzalı bir SSV sorgusu üretir (yalnız
 * geliştirme): parametreler alfabetik, sonda signature ve key_id.
 */
export function gelistirmeSsvSorgusu(alanlar: Record<string, string>): string {
  const g = gelistirmeAnahtari();
  const govde = Object.keys(alanlar)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(alanlar[k]!)}`)
    .join('&');
  const imza = sign('sha256', Buffer.from(decodeURIComponent(govde), 'utf8'), {
    key: g.gizli,
    dsaEncoding: 'der',
  }).toString('base64url');
  return `${govde}&signature=${imza}&key_id=${GELISTIRME_KEY_ID}`;
}
