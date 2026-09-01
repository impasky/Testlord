/**
 * E-posta gönderimi.
 *
 * İki taşıyıcı var ve hangisinin kullanılacağı ortam değişkeniyle seçilir:
 *
 *   log     (varsayılan) — postayı sunucu log'una yazar, dışarıya bir şey
 *           göndermez. Geliştirmede ve testte doğru davranış budur:
 *           gerçek adreslere posta atmadan akışın tamamı denenebilir.
 *   resend  — api.resend.com'a POST atar. Ücretsiz katmanı var ve tek bir
 *           JSON gövdesi istiyor; başka sağlayıcı için buraya kardeş bir
 *           fonksiyon eklemek yeterli.
 *
 * Neden sağlayıcı kütüphanesi değil de düz fetch: tek bir POST için bir
 * bağımlılık, onun geçişli bağımlılıkları ve güncelleme yükü demek.
 */
import { env } from '../env.js';

export interface Posta {
  kime: string;
  konu: string;
  metin: string;
  html?: string;
}

async function resendIle(p: Posta): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EPOSTA_ANAHTAR}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EPOSTA_GONDEREN,
      to: [p.kime],
      subject: p.konu,
      text: p.metin,
      ...(p.html ? { html: p.html } : {}),
    }),
  });
  if (!r.ok) {
    throw new Error(`E-posta gönderilemedi (${r.status}): ${(await r.text()).slice(0, 200)}`);
  }
}

/**
 * Postayı gönderir. Gönderilemezse hata FIRLATMAZ — çağıran akış
 * (parola sıfırlama) bir e-posta yüzünden çökmemeli; sorun log'a yazılır.
 */
export async function postaGonder(
  p: Posta,
  log: { info: (o: object, m: string) => void; error: (o: object, m: string) => void },
): Promise<void> {
  try {
    if (env.EPOSTA_TASIYICI === 'resend') {
      await resendIle(p);
      log.info({ kime: p.kime, konu: p.konu }, 'E-posta gönderildi');
      return;
    }
    // log taşıyıcısı: adresi ve gövdeyi yaz. Geliştirmede bağlantıyı
    // buradan kopyalayıp akışı deneyebilirsin.
    log.info({ kime: p.kime, konu: p.konu, metin: p.metin }, 'E-posta (log taşıyıcısı)');
  } catch (e) {
    log.error({ err: e, kime: p.kime }, 'E-posta gönderilemedi');
  }
}
