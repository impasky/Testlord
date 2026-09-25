/**
 * Kullanım Koşulları — oyunun kuralları, oyunun dışındakiler.
 *
 * NEDEN VAR: oyuncular birbirine yazıyor (ittifak sohbeti) ve kendi
 * adlarını, ittifak adlarını seçiyor. Kullanıcı içeriği olan bir uygulamayı
 * mağazalar ancak şu dördüyle kabul ediyor (App Store 1.2, Google Play UGC
 * politikası): uygunsuz içeriğe SIFIR TOLERANS diyen koşullar, bir süzgeç,
 * şikâyet ve engelleme — ve herkese açık bir iletişim yolu. Süzgeç
 * (mesajDenetimi, adDenetimi), şikâyet (⚑) ve engel (⊘) oyunda; bu sayfa
 * koşulların kendisi. Kayıt ekranı oyuncuyu buraya yolluyor.
 *
 * Hash ile açılıyor (`#/kosullar`), Aydınlatma Metni ile aynı sebep: giriş
 * ekranından da açılabilmeli.
 *
 * BU BİR HUKUKİ GÖRÜŞ DEĞİL. Metin oyunun gerçekten uyguladığı kuralları
 * anlatıyor; yayına almadan önce bir hukukçuya okutulmalı.
 */
import { Buton, Kart } from '../components/ui';
import { TamZemin } from '../components/Zemin';
import { DestekSatiri } from '../components/DestekSatiri';

function Madde({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h2 className="baslik mb-1 text-[12px] text-altin">{baslik}</h2>
      <div className="space-y-1.5 text-[12.5px] leading-snug text-solgun">{children}</div>
    </div>
  );
}

export function Kosullar({ onKapat }: { onKapat: () => void }) {
  return (
    <div className="min-h-dvh px-4 py-8">
      <TamZemin ad="giris" />
      <div className="relative z-10 mx-auto w-full max-w-lg">
        <header className="mb-5 text-center">
          <h1 className="baslik text-2xl text-altin">Kullanım Koşulları</h1>
          <p className="mt-1 text-[12px] text-sonuk">
            Diyara girerek bu koşulları kabul etmiş olursun.
          </p>
        </header>

        <Kart className="p-4">
          <Madde baslik="Uygunsuz içeriğe sıfır tolerans">
            <p>
              Lord adında, ittifak adında, genel ve ittifak sohbetinde ve profil resminde küfür,
              hakaret, nefret söylemi, taciz, tehdit, cinsel içerik, başkasının kişisel bilgisini
              paylaşmak ve dolandırıcılık yasaktır.
            </p>
            <p>
              Uygunsuz adlar ve mesajlar otomatik bir süzgeçten geçer; süzgeçten kaçan içerik
              şikâyet edildiğinde bir yönetici tarafından incelenir.
            </p>
          </Madde>

          <Madde baslik="Profil resmi">
            <p>
              Yalnız hakkına sahip olduğun ve herkese göstermekte sakınca görmediğin bir resim
              yükle. Çıplaklık, cinsel içerik, şiddet, kan, nefret sembolleri, başkasının fotoğrafı
              ve kişisel bilgi (telefon, adres) içeren resimler yasaktır.
            </p>
            <p>
              Yüklenen her resim otomatik denetimden geçer; açık içerik anında reddedilir, emin
              olunamayan resim bir yöneticinin onayından sonra görünür. Oyuncular resmi şikâyet
              edebilir. Kuralı çiğneyen resim kaldırılır, tekrarında hesap kısıtlanır.
            </p>
          </Madde>

          <Madde baslik="Şikâyet ve engelleme">
            <p>
              Sohbette bir mesajın yanındaki ⚑ ile şikâyet edebilir, ⊘ ile o lordu
              engelleyebilirsin; aynısını lordun adına ya da resmine dokununca açılan profil
              kartından da yapabilirsin. Engellediğin lordun mesajlarını hiçbir sohbette bir daha
              görmezsin; engeli Hesap ekranından kaldırabilirsin.
            </p>
            <p>
              Şikâyetler en geç 24 saat içinde incelenir. Kuralı çiğneyen içerik kaldırılır; yazan
              susturulur, tekrarında hesabı kapatılır.
            </p>
          </Madde>

          <Madde baslik="Adil oyun">
            <p>
              Oyunu otomatikleştiren yazılımlar, birden çok hesapla kendine kaynak aktarmak ve bir
              hatayı bilerek istismar etmek yasaktır. Bulduğun hatayı bildirmen oyunu herkes için
              iyileştirir.
            </p>
          </Madde>

          <Madde baslik="Elmas ve oyun içi değerler">
            <p>
              Elmas, kaynaklar ve ekipman yalnız oyun içinde oynayarak kazanılır; gerçek parayla
              satılmaz, gerçek bir değeri yoktur, başka bir hesaba ya da kişiye devredilemez.
            </p>
          </Madde>

          <Madde baslik="Hesabın">
            <p>
              Hesap kişiseldir; parolanın güvenliği senin sorumluluğundadır. Hesabını dilediğin an
              Hesap ekranından silebilirsin — silme geri alınamaz.
            </p>
          </Madde>

          <Madde baslik="Oyunun değişmesi">
            <p>
              Oyun geliştirilmeye devam ediyor: sayılar, dengeler ve kurallar değişebilir; bakım
              için kısa kesintiler olabilir. Önemli değişiklikler oyun içinde duyurulur.
            </p>
          </Madde>

          <Madde baslik="İletişim">
            <DestekSatiri />
          </Madde>

          <Buton className="mt-5" tam boy="buyuk" onClick={onKapat}>
            Geri dön
          </Buton>
        </Kart>
      </div>
    </div>
  );
}
