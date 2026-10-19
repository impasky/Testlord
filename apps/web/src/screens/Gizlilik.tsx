/**
 * Aydınlatma metni — hangi veriyi neden tutuyoruz.
 *
 * NEDEN VAR: oyun e-posta ve parola topluyor. Türkiye'de kişisel veri
 * işleyen bir hizmeti yayına almak için aydınlatma metni zorunlu (KVKK
 * md. 10) ve yoktu. Oyuncu olmadan ölçüm olmuyor, ölçüm olmadan da
 * `docs/16`daki hiçbir sayı sınanamıyor — yani bu sayfa, oyunun bir
 * sonraki adımının önündeki tek yasal engeldi.
 *
 * Metin TAHMİNLE değil şemayla yazıldı: her madde `schema.prisma`daki
 * bir alana ya da koddaki bir çağrıya karşılık geliyor. Bir alan
 * eklenirse burası da güncellenmeli — söylemediğimiz bir şeyi toplamak,
 * hiç metin koymamaktan kötü.
 *
 * Hash ile açılıyor (`#/gizlilik`), kapı değil: giriş ekranından da
 * açılabilmeli ve giriş ekranında henüz kapı yok. `ParolaSifirla` ile
 * aynı desen.
 *
 * BU BİR HUKUKİ GÖRÜŞ DEĞİL. Metin toplanan veriyi dürüstçe anlatıyor;
 * yayına almadan önce bir hukukçuya okutulmalı.
 */
import { COKLU_HESAP, REKLAM } from '@lordlar/shared';
import { Buton, Kart, sablonlu } from '../components/ui';
import { DestekSatiri } from '../components/DestekSatiri';
import { TamZemin } from '../components/Zemin';

function Madde({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h2 className="baslik mb-1 text-[12px] text-altin">{baslik}</h2>
      <div className="space-y-1.5 text-[12.5px] leading-snug text-solgun">{children}</div>
    </div>
  );
}

export function Gizlilik({ onKapat }: { onKapat: () => void }) {
  return (
    <div className="min-h-dvh px-4 py-8">
      <TamZemin ad="giris" />
      <div className="relative z-10 mx-auto w-full max-w-lg">
        <header className="mb-5 text-center">
          <h1 className="baslik text-2xl text-altin">Aydınlatma Metni</h1>
          <p className="mt-1 text-[12px] text-sonuk">
            Lordlar Çağı hangi veriyi neden tutuyor — ve neyi tutmuyor.
          </p>
        </header>

        <Kart className="p-4">
          <Madde baslik="Ne topluyoruz">
            <p>
              <strong className="text-parsomen">E-posta adresin.</strong> Hesabını tanımak ve
              parolanı sıfırlaman için. Başka hiçbir amaçla kullanılmıyor.
            </p>
            <p>
              <strong className="text-parsomen">Parolan — şifrelenmiş hâliyle.</strong> Parolanın
              kendisi hiçbir yerde saklanmıyor; yalnızca geri çevrilemez bir özeti (argon2id)
              tutuluyor. Parolanı unutursan biz de bilemeyiz, sıfırlaman gerekir.
            </p>
            <p>
              <strong className="text-parsomen">Oyun durumun.</strong> Lordun, ordun, bölgelerin,
              savaş raporların, ittifakın, sohbet mesajların ve engellediğin lordlar. Oyunun kendisi
              bu.
            </p>
            <p>
              <strong className="text-parsomen">Profil resmin — yüklersen.</strong> Resim
              sunucumuzda küçültülüp yeniden kaydediliyor; bu sırada konum, cihaz ve tarih gibi
              gizli bilgileri (EXIF) siliniyor. Uygunsuz içeriğe karşı bir görüntü
              sınıflandırıcısından geçiyor — sınıflandırıcı kendi sunucumuzda çalışıyor, resim
              hiçbir dış hizmete gönderilmiyor. Sınıflandırıcının emin olamadığı resme bir yönetici
              bakıyor. Reddedilen resim saklanmıyor.
            </p>
            <p>
              <strong className="text-parsomen">
                Son giriş anın, son gördüğün ekran ve oyunu açtığın günler.
              </strong>{' '}
              Sen yokken ne olduğunu özetlemek ve oyuncuların oyunu nerede bıraktığını, kaç kişinin
              ertesi gün döndüğünü toplam olarak görmek için. Kimin hangi ekranda olduğu değil,
              yalnızca sayılar okunuyor.
            </p>
            <p>
              <strong className="text-parsomen">Ağının anahtarlı özeti — kısa süreliğine.</strong>{' '}
              {`Bir oyuncunun ikinci hesap açıp kendini beslemesini görebilmek için oyuna girdiğin ağın geri çevrilemez bir özeti (gizli anahtarlı HMAC) ${COKLU_HESAP.agIziSaklamaGun} gün tutuluyor, sonra kendiliğinden siliniyor. Adresin kendisi değil: özetten adres geri çıkarılamıyor. Özeti yalnız yöneticinin çoklu hesap listesi okuyor ve tek başına hiçbir yaptırıma yol açmıyor — aynı evden oynamak serbest.`}
            </p>
            <p>
              <strong className="text-parsomen">
                Satın almaların — Android uygulamasında alırsan.
              </strong>{' '}
              Google Play'in verdiği sipariş numarası ve satın alma jetonu, ürün, elmas miktarı,
              tarih ve iade durumu. Elmasın bir kez verilmesi, iadenin düşülmesi ve bir sorunu
              birlikte çözebilmemiz için. Kart ve ödeme bilgin bize hiç gelmiyor; ödemeyi Google
              alıyor.
            </p>
            <p>
              <strong className="text-parsomen">
                İzlediğin ödüllü reklamlar — Android uygulamasında izlersen.
              </strong>{' '}
              {`Reklamın hangi işe gittiği, ne zaman izlendiği, kazandırdığı süre ve reklam ağının işlem numarası. Günlük hakkı saymak ve ödülü bir kez vermek için; ${REKLAM.saklamaGun} gün sonra siliniyor.`}
            </p>
          </Madde>

          <Madde baslik="Android uygulamasında reklam ve ödeme">
            <p>
              Ödüllü reklamları Google AdMob gösteriyor ve reklam yalnız sen istediğinde açılıyor.
              Reklamı gösterebilmek, sahtekârlığı önlemek ve ölçmek için AdMob cihazından reklam
              kimliği, IP adresi, cihaz ve uygulama bilgisi gibi verileri Google'ın kendi gizlilik
              politikasına göre topluyor; bu veri bize gelmiyor.
            </p>
            <p>
              Reklamlar kişiselleştirilmemiş isteniyor: Google ilgi alanlarına göre reklam seçmiyor,
              ama sıklık sınırı, sahtekârlık önleme ve ölçüm için veri işlemeye devam ediyor.
              Bölgende gerekiyorsa uygulama ilk reklamdan önce onayını soruyor; kararını Hesap
              ekranındaki “Reklam gizlilik seçenekleri”nden değiştirebilirsin.
            </p>
            <p>
              Satın almanın ve reklam ödülünün senin hesabına ait olduğunu doğrulamak için Google'a
              hesabının geri çevrilemez bir etiketi gidiyor — e-postan ya da lord adın değil. Satın
              almayı Google Play'den, reklam ödülünü de Google'ın sunucumuza gönderdiği imzalı
              bildirimden doğruluyoruz.
            </p>
            <p>Web sürümünde bunların hiçbiri yok: ne reklam var ne satın alma.</p>
          </Madde>

          <Madde baslik="Ne toplamıyoruz">
            {/* Tek şablon: `<strong>` etrafında bölünen cümle çeviri
                listesine "cümle ortası" diye düşüp hiç çevrilmiyordu. */}
            <p>
              {sablonlu(
                'İzleme çerezi ve analitik kütüphanesi {0}. Web sürümünde hiçbir üçüncü taraf betiği çalışmıyor; Android uygulamasındaki tek üçüncü taraf, yukarıda anlatılan Google reklam ve ödeme hizmetleri.',
                [<strong key="y">yok</strong>],
              )}
            </p>
            <p>
              Adın, yaşın, konumun, telefonun ve cihaz kimliğin bizim tarafımızdan sorulmuyor ve
              tutulmuyor. Lord adını sen seçiyorsun ve gerçek adın olmak zorunda değil.
            </p>
            <p>
              IP adresinin kendisi hiçbir yere yazılmıyor — ne veritabanına ne sunucu günlüğüne.
              Kayıt ve giriş denemelerini sınırlamak için yalnızca istek anında kullanılıyor.
              Yukarıdaki özet adres değil, ondan geri dönülemeyen bir iz.
            </p>
          </Madde>

          <Madde baslik="Bildirimler">
            <p>
              {sablonlu(
                'Bildirimleri {0} tarayıcının ürettiği abonelik bilgisi (adres ve şifreleme anahtarları) ile cihazını ayırt etmeye yarayan kısa bir etiket saklanıyor. Kapattığında silinir.',
                [<strong key="s">sen açarsan</strong>],
              )}
            </p>
            <p>
              Bildirim, tarayıcının kendi bildirim servisi üzerinden gidiyor — bu, cihazının
              üreticisine ait bir hizmet.
            </p>
          </Madde>

          <Madde baslik="Kimlerle paylaşılıyor">
            <p>Oyun verisi kimseyle paylaşılmıyor, satılmıyor.</p>
            <p>
              E-posta göndermek için (parola sıfırlama, savaş bildirimi) bir e-posta sağlayıcısı
              kullanılıyor; o sağlayıcı yalnızca adresini ve gönderilen iletinin metnini görüyor.
            </p>
            <p>
              Android uygulamasında reklam ve ödeme için Google (AdMob ve Google Play) — yukarıdaki
              bölümde anlatıldığı kadarıyla.
            </p>
            <p>
              İttifak sohbetinde yazdıkların ittifakındaki diğer oyunculara, genel sohbette
              yazdıkların bütün oyunculara açık. Şikâyet edilen bir mesaj ya da resim, kararı
              verecek yöneticiye görünür.
            </p>
            <p>
              Profil kartında başkaları yalnızca lord adını, profil resmini, armanı, seviyeni,
              unvanını, şöhretini, ülkeni, ittifakını, bölge sayını, diyarını ve katıldığın ayı
              görür. Kaynakların, ordun, e-postan ve son giriş anın kimseye gösterilmez.
            </p>
            <p>
              Sunucuda bir hata olursa teknik ayrıntısı bir hata izleme hizmetine gidebilir; oraya
              e-posta adresin ve parolan gönderilmez, yalnız hatanın kendisi ve lordunun kimlik
              numarası.
            </p>
          </Madde>

          <Madde baslik="Ne kadar süre">
            <p>
              {`Hesabın açık kaldığı sürece; ağ özeti en fazla ${COKLU_HESAP.agIziSaklamaGun} gün, reklam kayıtları ${REKLAM.saklamaGun} gün. Hesabını silersen lordun, ordun, ekipmanın, sohbet mesajların, yüklediğin resimler, ağ özetlerin, satın alma ve reklam kayıtların ve bildirim aboneliğin birlikte silinir. Google'ın kendi tuttuğu ödeme kayıtları Google Play'in koşullarına tabidir.`}
            </p>
          </Madde>

          <Madde baslik="Haklarını nasıl kullanırsın">
            <p>
              <strong className="text-parsomen">Silme:</strong> Hesap ekranındaki “Hesabı Sil”
              bölümünden, parolanı girerek. İşlem geri alınamaz ve aracı gerektirmez.
            </p>
            <p>
              <strong className="text-parsomen">Düzeltme:</strong> Parolanı Hesap ekranından
              değiştirebilirsin.
            </p>
            <p>
              Verilerine erişmek ya da başka bir talepte bulunmak istersen kayıt olduğun e-posta
              adresinden bize yazman yeterli.
            </p>
            <DestekSatiri />
          </Madde>

          <p className="mt-5 border-t border-kenar pt-3 text-[11px] text-sonuk">
            Bu metin oyunun gerçekten tuttuğu veriyi anlatır. Yeni bir alan eklendiğinde metin de
            güncellenir.
          </p>

          <Buton className="mt-4" tam boy="buyuk" onClick={onKapat}>
            Geri dön
          </Buton>
        </Kart>
      </div>
    </div>
  );
}
