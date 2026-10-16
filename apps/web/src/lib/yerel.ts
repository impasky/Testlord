/**
 * Android uygulamasının yerel yetenekleri (docs/25): Google Play
 * Faturalandırma ve AdMob ödüllü reklam.
 *
 * Web'de (PWA) hiçbiri yok: `uygulamadaMi()` false, mağaza bilgi kipinde
 * ("elmas Android uygulamasından alınır"). Eklentiler yalnız uygulamada
 * ve ilk kullanımda yükleniyor; web paketine girmiyorlar.
 *
 * GÜVEN SINIRI: buradaki hiçbir sonuç elmas ya da süre VERMİYOR. Satın
 * almanın jetonu sunucuya gidiyor, sunucu Play'e soruyor; reklamın ödülü
 * Google'ın imzalı sunucu çağrısıyla geliyor. İstemci yalnız aracı.
 */
import { Capacitor } from '@capacitor/core';

export function uygulamadaMi(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/* ------------------------------------------------------------------ */
/* Google Play                                                         */
/* ------------------------------------------------------------------ */

const play = () => import('@capgo/native-purchases');

/** Play'deki yerel fiyatlar (vergi dahil, oyuncunun para biriminde). */
export async function playFiyatlari(urunler: string[]): Promise<Record<string, string>> {
  if (!uygulamadaMi() || urunler.length === 0) return {};
  const { NativePurchases, PURCHASE_TYPE } = await play();
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: urunler,
    productType: PURCHASE_TYPE.INAPP,
  });
  return Object.fromEntries(products.map((p) => [p.identifier, p.priceString]));
}

export type SatinAlmaSonucu = { jeton: string } | { iptal: true };

/**
 * Play'in satın alma penceresini açar. Tüketme ve onay KAPALI: ikisini de
 * sunucu, elması yazdıktan sonra yapıyor (services/satinAlma.ts).
 * `hesapEtiketi` satın almayı lorda bağlıyor (Play'in obfuscatedAccountId).
 */
export async function playSatinAl(urun: string, hesapEtiketi: string): Promise<SatinAlmaSonucu> {
  const { NativePurchases, PURCHASE_TYPE } = await play();
  try {
    const t = await NativePurchases.purchaseProduct({
      productIdentifier: urun,
      productType: PURCHASE_TYPE.INAPP,
      appAccountToken: hesapEtiketi,
      isConsumable: false,
      autoAcknowledgePurchases: false,
    });
    if (!t.purchaseToken) throw new Error('Play satın alma jetonu vermedi.');
    return { jeton: t.purchaseToken };
  } catch (e) {
    if (/cancel|iptal|USER_CANCELED/i.test(String((e as Error)?.message ?? e)))
      return { iptal: true };
    throw e;
  }
}

/**
 * Cihazda kalmış, sunucuya ulaşmamış satın almalar: uygulama satın alma
 * sırasında kapandıysa ya da ağ koptuysa. Sunucu aynı jetonu bir kez
 * işliyor; hepsini yeniden göndermek güvenli.
 */
export async function bekleyenPlaySatinAlmalari(
  hesapEtiketi: string,
): Promise<{ urun: string; jeton: string }[]> {
  if (!uygulamadaMi()) return [];
  const { NativePurchases, PURCHASE_TYPE } = await play();
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.INAPP,
    appAccountToken: hesapEtiketi,
  });
  return purchases
    .filter((p) => p.purchaseToken)
    .map((p) => ({ urun: p.productIdentifier, jeton: p.purchaseToken! }));
}

/* ------------------------------------------------------------------ */
/* AdMob                                                               */
/* ------------------------------------------------------------------ */

const admob = () => import('@capacitor-community/admob');
let baslangic: Promise<void> | null = null;

/**
 * AdMob'u başlatır ve gerekiyorsa (AB/Birleşik Krallık) Google'ın onay
 * penceresini (UMP) gösterir. Onay reklam istenmeden önce soruluyor,
 * uygulama açılışında değil: reklam izlemeyen oyuncu hiç sorulmuyor.
 */
async function reklamBaslat(): Promise<void> {
  baslangic ??= (async () => {
    const { AdMob, AdmobConsentStatus } = await admob();
    await AdMob.initialize({ initializeForTesting: import.meta.env.DEV });
    const onay = await AdMob.requestConsentInfo();
    if (onay.isConsentFormAvailable && onay.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }
  })().catch((e) => {
    baslangic = null; // bir sonraki denemede yeniden
    throw e;
  });
  return baslangic;
}

export type ReklamSonucu = 'izlendi' | 'kapatildi';

/**
 * Ödüllü reklamı gösterir. Ödülü bu dönüş değeri DEĞİL, Google'ın
 * sunucumuza imzalı çağrısı veriyor; `oturumId` o çağrıya `custom_data`
 * olarak gidiyor, `kullanici` lordun etiketi olarak.
 */
export async function reklamIzle(o: {
  birim: string;
  oturumId: string;
  kullanici: string;
  kisisellestirilmis: boolean;
}): Promise<ReklamSonucu> {
  await reklamBaslat();
  const { AdMob, RewardAdPluginEvents } = await admob();
  let odul = false;
  const dinleyici = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    odul = true;
  });
  try {
    await AdMob.prepareRewardVideoAd({
      adId: o.birim,
      npa: !o.kisisellestirilmis,
      ssv: { userId: o.kullanici, customData: o.oturumId },
    });
    await AdMob.showRewardVideoAd();
  } finally {
    await dinleyici.remove();
  }
  return odul ? 'izlendi' : 'kapatildi';
}

/** Hesap ekranından: reklam onayını yeniden düzenle (gerekliyse). */
export async function reklamGizlilikSecenekleri(): Promise<boolean> {
  if (!uygulamadaMi()) return false;
  await reklamBaslat();
  const { AdMob } = await admob();
  const bilgi = await AdMob.requestConsentInfo();
  // Sıralama paketin ana girişinden dışa aktarılmıyor; değeri sabit dizge.
  if (String(bilgi.privacyOptionsRequirementStatus) !== 'REQUIRED') return false;
  await AdMob.showPrivacyOptionsForm();
  return true;
}
