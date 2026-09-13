/**
 * BİLDİRİM KARTI — Hesap ekranındaki izin anahtarı.
 *
 * Lordlar Çağı bekleme üzerine kurulu: ordu yürür, kuyruk dolar, saldırı
 * gelir. Oyuncu bunların hiçbirini uygulama kapalıyken göremiyordu —
 * "ordum ne zaman döner" sorusunun tek cevabı tahminen dönüp bakmaktı.
 *
 * Kartın tek kuralı var: HER HÂL AÇIKÇA SÖYLENİYOR. "Düğmeye bastım,
 * hiçbir şey olmadı" en kötü sonuç; oyuncu bildirimlerin açık olduğunu
 * sanıp beklerse, hiç açmamış olmasından kötü durumdadır. Bu yüzden
 * sunucuda anahtar yoksa düğme hiç çıkmıyor, iOS'ta ana ekran gerekiyorsa
 * bunu söylüyor, tarayıcı reddettiyse nereden açılacağını tarif ediyor.
 */
import { useEffect, useState } from 'react';
import { Buton, Kart } from './ui';
import { api } from '../api/client';
import { bildirimAc, bildirimHali, bildirimKapat, type BildirimHali } from '../lib/bildirim';

export function BildirimKarti() {
  const [hal, setHal] = useState<BildirimHali | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    void bildirimHali().then((h) => {
      if (!iptal) setHal(h);
    });
    return () => {
      iptal = true;
    };
  }, []);

  // Hâl okunana kadar hiçbir şey çizilmiyor: bir an "kapalı" gösterip
  // sonra "açık"a dönmek, oyuncuya yanlış bilgi vermenin en hızlı yolu.
  if (!hal) return null;

  // Sunucuda anahtar yok ya da tarayıcı desteklemiyor: kart hiç yok.
  // Yapılamayacak bir şeyi anlatmak, ekranı kalabalıklaştırmaktan başka
  // işe yaramaz.
  if (hal.durum === 'sunucu-kapali' || hal.durum === 'desteklenmiyor') return null;

  const calistir = async (is: () => Promise<BildirimHali>, basarili: string) => {
    setMesgul(true);
    setHata(null);
    setBilgi(null);
    try {
      const yeni = await is();
      setHal(yeni);
      if (yeni.durum === 'acik') setBilgi(basarili);
      else if (yeni.durum === 'reddedildi') {
        setHata(
          'Tarayıcı bildirimleri engelliyor. Adres çubuğundaki kilit simgesinden ' +
            'bu siteye bildirim izni vermen gerekiyor.',
        );
      }
    } catch {
      setHata('Bildirimler açılamadı. Birazdan tekrar dene.');
    } finally {
      setMesgul(false);
    }
  };

  return (
    <Kart className="p-3">
      <p className="mb-2.5 text-[12px] leading-snug text-solgun">
        Ordun döndüğünde, kuyruğun bittiğinde ve toprağına saldırıldığında haberin olsun. Bildirim
        yalnız bu cihaza gelir; istediğin zaman kapatabilirsin.
      </p>

      {hal.durum === 'ios-ana-ekran' && (
        <p className="text-[12px] leading-snug text-altin">
          iPhone ve iPad&apos;de bildirimler yalnızca ana ekrana eklenmiş uygulamada çalışır. Paylaş
          menüsünden <span className="font-bold">Ana Ekrana Ekle</span> deyip oyunu oradan aç, sonra
          buraya dön.
        </p>
      )}

      {hal.durum === 'reddedildi' && (
        <p className="text-[12px] leading-snug text-kirmizi">
          Bu tarayıcıda bildirimlere izin verilmemiş. Adres çubuğundaki kilit simgesinden izni
          açtıktan sonra tekrar dene.
        </p>
      )}

      {(hal.durum === 'kapali' || hal.durum === 'reddedildi') && (
        <Buton
          tur="anahat"
          className="w-full"
          disabled={mesgul || hal.durum === 'reddedildi'}
          onClick={() => void calistir(bildirimAc, 'Bildirimler açıldı.')}
        >
          {mesgul ? 'Açılıyor…' : 'Bildirimleri aç'}
        </Buton>
      )}

      {hal.durum === 'acik' && (
        <div className="space-y-2">
          <p className="text-[12px] text-yesil">
            Bildirimler açık
            {hal.cihazSayisi > 1 ? ` · ${hal.cihazSayisi} cihaz` : ''}
          </p>
          <div className="flex gap-2">
            <Buton
              tur="anahat"
              className="flex-1"
              disabled={mesgul}
              onClick={() => {
                setMesgul(true);
                setHata(null);
                api
                  .pushDeneme()
                  .then((r) =>
                    setBilgi(
                      r.gonderildi > 0
                        ? 'Deneme bildirimi gönderildi.'
                        : 'Gönderilecek cihaz bulunamadı.',
                    ),
                  )
                  .catch(() => setHata('Deneme bildirimi gönderilemedi.'))
                  .finally(() => setMesgul(false));
              }}
            >
              Deneme gönder
            </Buton>
            <Buton
              tur="anahat"
              className="flex-1"
              disabled={mesgul}
              onClick={() => void calistir(bildirimKapat, '')}
            >
              Kapat
            </Buton>
          </div>
        </div>
      )}

      {bilgi && <p className="mt-2 text-[12px] text-yesil">{bilgi}</p>}
      {hata && <p className="mt-2 text-[12px] text-kirmizi">{hata}</p>}
    </Kart>
  );
}
