/**
 * E-POSTA DOĞRULAMA — adresin gerçekten o kişiye ait olduğunu ölçmek.
 *
 * ── Neden gerekiyor ─────────────────────────────────────────────────
 *
 * Bugün kayıt sırasında adresini yanlış yazan oyuncu, parolasını
 * unuttuğunda hesabını KALICI olarak kaybediyor: sıfırlama postası var
 * olmayan bir kutuya gidiyor ve geri dönüşü yok. İkinci kazanç bot
 * hesabına ve yasak kaçağına sürtünme.
 *
 * ── Kapı KADEMELİ, ve bu bilinçli ───────────────────────────────────
 *
 * Kayıtta hiçbir şey sorulmuyor: "ilk saldırı dakikalarda bitsin"
 * (docs/08) kuralı, yeni oyuncuyu posta kutusuna göndermeyi yasaklıyor.
 * Doğrulamadan kapalı olan üç kapı var ve üçü de BAŞKA OYUNCUYA
 * dokunuyor — ittifak sohbeti, kaynak gönderme ve eşya pazarı. Oyunun kendisine
 * (fetih, inşa, araştırma) hiç dokunulmuyor; oynamayı engellemek
 * doğrulama değil, ceza olurdu.
 *
 * Serbest süre bitince giriş kapanıyor. Kapanmasaydı doğrulama bir
 * temenni olurdu: kimse doğrulamaz ve parola sıfırlama yine çalışmazdı.
 *
 * Bu dosya SAF: veritabanı yok, tarih dışarıdan geliyor.
 */
import { B } from './balance.js';

const E = B.eposta_dogrulama;

export const JETON_OMRU_SAAT = E.jeton_omru_saat;
export const YENIDEN_GONDER_BEKLEME_SN = E.yeniden_gonder_bekleme_sn;
export const GUNLUK_GONDERIM_TAVANI = E.gunluk_gonderim_tavani;
export const SERBEST_GUN = E.serbest_gun;

/** Doğrulanmadan yapılamayan eylemler. Anahtarlar kalıcı, metin değişebilir. */
export const KISITLI_EYLEM_ADI: Record<string, string> = {
  ittifak_sohbet: 'İttifak sohbetine yazmak',
  kaynak_gonder: 'Kaynak göndermek',
  esya_pazari: 'Eşya pazarında alım satım',
};

export function jetonBitisi(simdi: Date): Date {
  return new Date(simdi.getTime() + JETON_OMRU_SAAT * 3600_000);
}

export interface DogrulamaDurumu {
  dogrulandi: boolean;
  /** Serbest süre bitene kaç gün kaldı. Doğrulanmışsa null. */
  kalanGun: number | null;
  /** Serbest süre doldu: giriş artık doğrulama istiyor. */
  girisKapali: boolean;
  /** Oyuncuya gösterilecek tek satır. Doğrulanmışsa null. */
  metin: string | null;
}

/**
 * Hesabın doğrulama hâli.
 *
 * Ölçü hesabın AÇILDIĞI an, ilk postanın gönderildiği an değil: posta
 * kaybolabilir, yeniden gönderilebilir, hiç gitmemiş olabilir. Serbest
 * süreyi son gönderime bağlamak, yeniden gönder düğmesine basarak
 * süreyi sonsuza kadar uzatmayı mümkün kılardı.
 */
export function dogrulamaDurumu(
  dogrulandi: Date | null | undefined,
  hesapAcilis: Date,
  simdi: Date,
): DogrulamaDurumu {
  if (dogrulandi) return { dogrulandi: true, kalanGun: null, girisKapali: false, metin: null };

  const gecen = (simdi.getTime() - hesapAcilis.getTime()) / 86_400_000;
  const kalan = Math.max(0, Math.ceil(SERBEST_GUN - gecen));
  if (kalan === 0) {
    return {
      dogrulandi: false,
      kalanGun: 0,
      girisKapali: true,
      metin: 'E-postanı doğrulaman gerekiyor. Yeni bir bağlantı isteyebilirsin.',
    };
  }
  return {
    dogrulandi: false,
    kalanGun: kalan,
    girisKapali: false,
    metin: `E-postan doğrulanmadı — ${kalan} gün sonra giriş için gerekecek.`,
  };
}

/**
 * Yeniden gönderme frensiz bırakılabilir mi.
 *
 * Frensiz bir "yeniden gönder" düğmesi, başkasının adresini yazıp
 * basmaya devam eden biri için posta kutusu bombalama aracıdır. İki
 * fren birden: iki gönderim arası en az bir dakika, ve günde en fazla
 * beş. Birincisi tek kişiyi, ikincisi sabırlı olanı durduruyor.
 */
export function gonderilebilirMi(
  sonGonderim: Date | null | undefined,
  bugunkuSayi: number,
  simdi: Date,
): { uygun: boolean; sebep?: string } {
  if (bugunkuSayi >= GUNLUK_GONDERIM_TAVANI) {
    return { uygun: false, sebep: 'Bugünlük gönderim hakkın doldu. Yarın tekrar dene.' };
  }
  if (sonGonderim) {
    const gecen = (simdi.getTime() - sonGonderim.getTime()) / 1000;
    if (gecen < YENIDEN_GONDER_BEKLEME_SN) {
      const kalan = Math.ceil(YENIDEN_GONDER_BEKLEME_SN - gecen);
      return { uygun: false, sebep: `Çok hızlı. ${kalan} saniye bekle.` };
    }
  }
  return { uygun: true };
}

/** Jeton hâlâ geçerli mi: süresi dolmamış ve daha önce kullanılmamış. */
export function jetonGecerli(
  bitis: Date,
  kullanildi: Date | null | undefined,
  simdi: Date,
): boolean {
  if (kullanildi) return false;
  return bitis.getTime() > simdi.getTime();
}
