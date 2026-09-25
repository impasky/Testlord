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
              <strong className="text-parsomen">Son giriş anın ve son gördüğün ekran.</strong> İki
              iş için: sen yokken ne olduğunu özetlemek, ve oyuncuların oyunu nerede bıraktığını
              toplam olarak görmek. İkincisinde kimin hangi ekranda olduğu değil, yalnızca sayılar
              okunuyor.
            </p>
          </Madde>

          <Madde baslik="Ne toplamıyoruz">
            {/* Tek şablon: `<strong>` etrafında bölünen cümle çeviri
                listesine "cümle ortası" diye düşüp hiç çevrilmiyordu. */}
            <p>
              {sablonlu(
                'Reklam ağı, izleme çerezi, analitik kütüphanesi {0}. Sayfada hiçbir üçüncü taraf betiği çalışmıyor.',
                [<strong key="y">yok</strong>],
              )}
            </p>
            <p>
              Adın, yaşın, konumun, telefonun, cihaz kimliğin sorulmuyor ve tutulmuyor. Lord adını
              sen seçiyorsun ve gerçek adın olmak zorunda değil.
            </p>
            <p>
              IP adresin veritabanına yazılmıyor. Yalnızca kayıt ve giriş denemelerini sınırlamak
              için, istek anında ve geçici olarak kullanılıyor.
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
              İttifak sohbetinde yazdıkların ittifakındaki diğer oyunculara, genel sohbette
              yazdıkların bütün oyunculara açık. Şikâyet edilen bir mesaj ya da resim, kararı
              verecek yöneticiye görünür.
            </p>
            <p>
              Profil kartında başkaları yalnızca lord adını, profil resmini, armanı, seviyeni,
              unvanını, şöhretini, medeniyetini, ittifakını, bölge sayını, diyarını ve katıldığın
              ayı görür. Kaynakların, ordun, e-postan ve son giriş anın kimseye gösterilmez.
            </p>
            <p>
              Sunucuda bir hata olursa teknik ayrıntısı bir hata izleme hizmetine gidebilir; oraya
              e-posta adresin ve parolan gönderilmez, yalnız hatanın kendisi ve lordunun kimlik
              numarası.
            </p>
          </Madde>

          <Madde baslik="Ne kadar süre">
            <p>
              Hesabın açık kaldığı sürece. Hesabını silersen lordun, ordun, ekipmanın, sohbet
              mesajların, yüklediğin resimler ve bildirim aboneliğin birlikte silinir.
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
