/**
 * Dokunsal ve işitsel geri bildirim.
 *
 * Mobil bir oyunda saldırı düğmesinin tokluğu hissin yarısıdır. Şu ana
 * kadar her şey sessizdi.
 *
 * Neden ses DOSYASI yok: birkaç yüz kilobaytlık varlık eklemek, tek bir
 * onay sesi için ağır. Sesler Web Audio ile anlık üretiliyor — dosya yok,
 * indirme yok, gecikme yok.
 *
 * Neden hepsi sessizce başarısız olabiliyor: titreşim iOS Safari'de yok,
 * ses bağlamı kullanıcı etkileşimi olmadan açılmıyor, kimi tarayıcı
 * ikisini de engelliyor. Hiçbiri oyunu bozmamalı — geri bildirim
 * süstür, mekanik değil.
 */

let baglam: AudioContext | null = null;

function sesBaglami(): AudioContext | null {
  try {
    // Tarayıcılar ses bağlamını yalnızca kullanıcı etkileşimi içinde
    // açtırıyor; bu fonksiyon zaten hep bir tıklamadan çağrılıyor.
    baglam ??= new AudioContext();
    if (baglam.state === 'suspended') void baglam.resume();
    return baglam;
  } catch {
    return null;
  }
}

/** Kısa bir ton. Süre ve frekans dışında hiçbir şey ayarlanmıyor: sadelik kasıtlı. */
function ton(frekans: number, sureMs: number, ses = 0.05): void {
  const ctx = sesBaglami();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const kazanc = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frekans;
    // Sonu yumuşat: ani kesilen ton "tık" diye çatlıyor.
    kazanc.gain.setValueAtTime(ses, ctx.currentTime);
    kazanc.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + sureMs / 1000);
    osc.connect(kazanc).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + sureMs / 1000);
  } catch {
    /* ses yoksa oyun yine çalışır */
  }
}

function titret(desen: number | number[]): void {
  try {
    navigator.vibrate?.(desen);
  } catch {
    /* titreşim yoksa oyun yine çalışır */
  }
}

/** Sıradan bir onay: eğitim başladı, ekipman üretildi. */
export function hisOnay(): void {
  titret(12);
  ton(660, 70);
}

/** Ağır eylem: saldırı emri, bölge bırakma. */
export function hisAgir(): void {
  titret([18, 40, 24]);
  ton(320, 110);
  setTimeout(() => ton(240, 140), 90);
}

/** Kazanç: bölge alındı, seviye atlandı. */
export function hisZafer(): void {
  titret([15, 45, 15, 45, 30]);
  ton(523, 90);
  setTimeout(() => ton(659, 90), 90);
  setTimeout(() => ton(784, 160), 180);
}

/** Reddedilen işlem. Kısa ve alçak: cezalandırıcı değil, uyarıcı. */
export function hisRet(): void {
  titret(30);
  ton(180, 120, 0.04);
}
