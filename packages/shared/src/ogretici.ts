/**
 * Öğretici içeriği — oyunu ilk girişte KABACA anlatan sayfalar.
 *
 * Neden burada, arayüzde değil: öğreticide geçen her sayı (kaç saat koruma,
 * kaç bölge, hangi birim hangisini kırıyor, günlük ticaret tavanı) motorda
 * zaten var. Metni arayüze yazsaydık aynı sayılar ikinci kez yazılmış
 * olurdu ve denge bir gün değiştiğinde öğretici SESSİZCE yalan söylemeye
 * başlardı. Yeni oyuncuya yalan söyleyen bir öğretici, öğreticisizlikten
 * kötüdür: oyuncu yanlış bir plan kurar ve oyunun kendisini suçlar.
 *
 * Bu yüzden sayfalar `balance.json`'dan TÜRETİLİYOR. Bir testte (ogretici
 * kontrolü, packages/shared/src/balance.test.ts) sayfaların motorla aynı
 * şeyi söylediği kilitli.
 *
 * Kapsam: oyunun BÜTÜN ana mekanikleri bir kez geçiliyor — ama her biri
 * bir iki maddeyle. Amaç ustalaştırmak değil, "burada böyle bir şey var"
 * dedirtmek; ayrıntıyı zaten her ekran kendi içinde anlatıyor (karşı
 * ipuçları kışlada, sapma cezası savaş raporunda, düğüm etkileri araştırma
 * ekranında).
 *
 * Kapsam bir kez daraldı ve pahalıya patladı: dizilim, taktik, araştırma,
 * hastane, pazar ve depo tavanı oyunda vardı ama öğreticide yoktu. Oyuncu
 * onları ancak kaza eseri buluyordu — depo tavanını ise hiç bulmuyor,
 * saatlerce boşa üretiyordu. Bir mekanik oyunda varsa öğreticide de
 * olmalı; yoksa oyuncu için o mekanik yok demektir.
 */
import {
  ARASTIRMA_CAGLARI,
  ARASTIRMA_DALLARI,
  ARASTIRMA_GRUPLARI,
  B,
  TAKTIKLER,
  WORLD_MAP,
  counterMultiplier,
  siegeVsFortress,
  siegeVsUnit,
  unitName,
} from './balance.js';
import {
  CEKIRDEK_AZAMI_SEVIYE,
  CEKIRDEK_BONUSU,
  FAYDA_FETIH,
  FAYDA_SAVUNMA,
  MEDENIYETLER,
  garnizonFaydaPuani,
  medeniyetBonusu,
} from './medeniyet.js';
import { veListesi } from './liste.js';
import { UNIT_TYPES, type UnitType } from './types.js';

/** Sayfadaki tek bir madde. Cümleyi arayüz değil, burası kuruyor. */
export interface OgreticiMadde {
  /** Kalın okunan kısım — göz taradığında bu takılıyor. */
  vurgu: string;
  /** Vurgunun açıklaması. */
  metin: string;
}

export interface OgreticiSayfa {
  anahtar: string;
  baslik: string;
  /** Tek cümlelik özet: sayfanın neyi anlattığı. */
  ozet: string;
  maddeler: OgreticiMadde[];
  /**
   * Sayfanın anlattığı ekran. Arayüz bunu "oraya git" düğmesine çeviriyor;
   * öğreticiyi okuyup nereye basacağını bilmemek en sık şikâyet.
   */
}

/** "mızrakçı süvariyi kırar" gibi bir eşleşme — motordan okunuyor. */
export interface KarsiSatiri {
  saldiran: UnitType;
  hedef: UnitType;
  carpan: number;
}

/**
 * Taş-kağıt-makas halkası, `birim_kars_carpanlari`'ndan türetiliyor.
 *
 * Elle yazsaydık üç satır olurdu ve dengede bir çarpan değiştiğinde
 * öğretici eski halkayı anlatmaya devam ederdi.
 */
export function karsiHalkasi(): KarsiSatiri[] {
  const satirlar: KarsiSatiri[] = [];
  for (const saldiran of UNIT_TYPES) {
    // Kusatma halkanin disinda: o bir birimi degil DUVARI kiriyor, ayri
    // bir maddede anlatiliyor.
    if (saldiran === 'kusatma') continue;
    for (const hedef of UNIT_TYPES) {
      if (hedef === saldiran) continue;
      const carpan = counterMultiplier(saldiran, hedef);
      if (carpan > 1) satirlar.push({ saldiran, hedef, carpan });
    }
  }
  return satirlar;
}

/**
 * Öğretici sayfaları.
 *
 * Sıra rastgele değil: oyuncunun kafasındaki soruların doğal sırası.
 * Neredeyim → ne kazanıyorum → nasıl savaşıyorum → nasıl büyüyorum →
 * kim beni koruyor → yalnız mıyım → ne zaman geri geleyim.
 */
export function ogreticiSayfalari(): OgreticiSayfa[] {
  const bolge = B.bolgeler as { max_seviye_bolen: number };
  const koruma = B.korumalar as {
    yeni_oyuncu_saat: number;
    yagma_sonrasi_saat: number;
    bolge_ele_gecirme_sonrasi_saat: number;
  };
  const ittifak = B.ittifak as { azami_uye: number };
  const bagis = (B.ittifak as unknown as { bagis: { gunluk_hak: number } }).bagis;
  const basvuru = (B.ittifak as unknown as { basvuru: { azami_bekleyen: number } }).basvuru;
  const pakt = (
    B.ittifak as unknown as {
      pakt: { azami: number; fesih_ihbar_saat: number };
    }
  ).pakt;
  const ticaret = B.ticaret as { gunluk_gonderim_tavani: number };
  const kaynak = B.kaynaklar as { malikane_saatlik: Record<string, number> };
  const vilayet = (
    B.bolgeler as unknown as {
      vilayet_birligi: { bolge_basina: number; azami: number };
    }
  ).vilayet_birligi;
  const komuta = B.komuta as { taban: number; liderlik_carpani: number };
  const savas = B.savas as { tur_sayisi: number };
  const diz = B.dizilim;
  const kusatmaYer = diz.birim_yerlesimi.kusatma;
  const suvariYer = diz.birim_yerlesimi.suvari;
  const taktikTavan = B.taktik as { azami_etki: number };
  const arastirma = B.arastirma as {
    iptal_iadesi: number;
    erken_pencere_seviye: number;
    yol_degisim_iadesi: number;
    yol_degisim_bekleme_saat: number;
  };
  const pazar = B.pazar as { komisyon: number; gunluk_tavan_altin_karsiligi: number };
  const esyaPazari = B.esya_pazari as { vergi: number };
  const hastane = B.hastane as { azami_saniye: number; bakim_alir: boolean };
  const casus = B.casusluk as { maliyet_altin: number; gecerlilik_saat: number };
  const depo = B.kaynaklar.depo_kapasitesi as {
    taban: number;
    lord_seviye_basina: number;
  };
  const kuyruk = B.kuyruklar.es_zamanli as Record<string, number>;
  // Dal başına kademe sayısı: en uzun daldan okunuyor. Dallar veri
  // dosyasında eşit uzunlukta ve bir test bunu kilitliyor.

  // İdeal satırlar veriden okunuyor: "mızrakçı önde, mancınık arkada"
  // cümlesi denge dosyası değişince kendiliğinden değişsin.
  const idealSatirlar = UNIT_TYPES.map(
    (t) => `${unitName(t)} ${diz.birim_yerlesimi[t].ideal_satir}. satır`,
  ).join(', ');

  const halka = karsiHalkasi()
    .map((k) => `${unitName(k.saldiran)} → ${unitName(k.hedef)} ×${k.carpan}`)
    .join(', ');

  /*
   * Medeniyet sayfasının sayıları da motordan (docs/16 §12.6).
   *
   * Çekirdek sayısı `balance.json`daki listelerin kendisinden SAYILIYOR,
   * elle yazılmış bir toplamdan değil. Bu dosyada tam olarak o hata bir
   * kez yapıldı: bölge sayısı elle yazılmıştı, harita 121'e çıkınca kopya
   * 61'de kaldı ve öğreticinin ilk sayfası diyarı yarısı kadar tanıttı.
   *
   * Bonus oranı da öyle: `medeniyetBonusu` motorun kendi işlevi, öğretici
   * onu bir kez çağırıp cümleye koyuyor. Denge dosyasındaki `seviye_basina`
   * değişirse cümle kendiliğinden değişir.
   */
  const cekirdekBasina = MEDENIYETLER[0]!.cekirdekBolgeler.length;
  const cekirdekSayisi = MEDENIYETLER.reduce((t, m) => t + m.cekirdekBolgeler.length, 0);
  const cekirdekSeviyeleri = (n: number): Record<number, number> =>
    Object.fromEntries(MEDENIYETLER[0]!.cekirdekBolgeler.map((id) => [id, n]));
  const cekirdekBirSeviye = Math.round(medeniyetBonusu(cekirdekSeviyeleri(1)).ambar * 100);
  const cekirdekTam = Math.round(
    medeniyetBonusu(cekirdekSeviyeleri(CEKIRDEK_AZAMI_SEVIYE)).ambar * 100,
  );
  const medeniyetTanitimi = MEDENIYETLER.map(
    (m) => `${m.ad}: ${m.ozet.toLocaleLowerCase('tr').replace(/\.$/, '')}`,
  ).join(' · ');
  const cekirdekBonuslari = Object.values(CEKIRDEK_BONUSU).join(', ');
  // Rütbe merdiveni de dengeden: bir kademe eklenirse cümle kendiliğinden
  // büyür.
  const faydaRutbeleri = (
    B.medeniyetler as unknown as { fayda_puani: { rutbeler: { ad: string }[] } }
  ).fayda_puani.rutbeler
    .map((r) => r.ad)
    .join(' → ');
  // Fayda puanı örneği de motordan: on yerlik bir garnizonun bir saatte
  // kazandığı puan. "Saatte yarım puan" demek yerine oyuncunun ekranda
  // göreceği sayıyı yazıyoruz.
  const ornekGarnizonYeri = 10;
  const ornekFaydaPuani = garnizonFaydaPuani(ornekGarnizonYeri, 1);
  // Taht iki ayrı şöhret çarpanı veriyor: tutana ve tutanın medeniyetine
  // (docs/16 §13 soru 5). İkisi de dengeden.
  const taht = B.taht_kalesi as { unvan_sohret_bonusu: number; medeniyet_sohret_bonusu: number };
  const degisimBekleme = (B.medeniyetler as unknown as { degisim: { bekleme_gun: number } }).degisim
    .bekleme_gun;
  const tahtUnvanBonusu = Math.round(taht.unvan_sohret_bonusu * 100);
  const tahtMedeniyetBonusu = Math.round(taht.medeniyet_sohret_bonusu * 100);

  return [
    {
      anahtar: 'diyar',
      baslik: 'Burası bir diyar, sen bir lordsun',
      ozet: 'Tek bir harita, üzerinde herkes. Sen de onlardan birisin.',
      maddeler: [
        {
          // Sayı HARİTADAN. `balance.json` içinde elle yazılmış bir kopya
          // vardı ve 61'de kalmıştı: harita 121 bölgeye çıkınca kopya
          // büyümedi ve öğreticinin İLK sayfası her yeni oyuncuya diyarı
          // yarısı kadar tanıtıyordu. Kopya silindi.
          vurgu: `${WORLD_MAP.region_count} bölge`,
          metin:
            'Haritadaki her işaret bir bölge. Bir bölgeyi tutan medeniyet varsa çerçevesi onun rengini taşır; ortadaki çekişmeli topraklar henüz kimsenin değil. Bölgeler bitmez ama çoğalmaz da — biri alırsa, bir başkası kaybeder.',
        },
        {
          vurgu: 'Taht Kalesi',
          metin: `Haritanın ortasındaki altın çerçeveli bölge. Onu tutan Diyarın Lordu olur ve şöhreti %${tahtUnvanBonusu} büyür; tahtı tutan MEDENİYETİN her üyesi de %${tahtMedeniyetBonusu} alır. Oyunun ucu burası — ve tek başına değil, tarafınla kazanılıyor.`,
        },
        {
          vurgu: 'Toprak haritayı açar',
          metin:
            'Yürüyüş süresi en yakın toprağından ölçülür, malikânenden değil. Bir bölge aldığın anda onun çevresindeki her yer sana yaklaşır — yayıldıkça daha uzağa uzanabilirsin.',
        },
        {
          vurgu: 'Dibe vurursun, silinmezsin',
          metin: `Bütün bölgelerini kaybetsen bile taban gelirin akmaya devam eder: saatte ${kaynak.malikane_saatlik.altin} altın. Bir kampa çekilirsin, binaların durur ve yeni bir yerleşim alınca kaldığın yerden devam edersin.`,
        },
        {
          vurgu: 'Kamptan başlarsın',
          metin:
            'Kampın kendi medeniyetinin yurdunda kurulur; toprağın yok, ordun yok. İlk köyünü fethettiğinde orası başkentin olur ve şehir sayfan bir kamptan bir köye döner. Sana hiçbir şey verilmiyor — ordu da toprak da bina da kazanılıyor.',
        },
      ],
    },
    /*
     * MEDENİYET — oyunun türünü söyleyen sayfa (docs/16 §12.6).
     *
     * İkinci sırada ve bilerek: oyuncu "neredeyim"i okudu, şimdi "kimim"
     * sorusunun sırası. Bu sayfa olmadan yeni oyuncu haritada renkleri
     * görüyor, bir bölgeye saldıramadığını fark ediyor, aldığı toprağın
     * gelirini alamadığını anlamıyor — üçünün de tek bir açıklaması var
     * ve o açıklama burada.
     */
    {
      anahtar: 'medeniyet',
      baslik: 'Dört medeniyet, sen birinin lordusun',
      ozet: 'Haritadaki dört renk dört taraf. Tek başına değil, bir tarafla oynuyorsun.',
      maddeler: [
        {
          vurgu: `${MEDENIYETLER.length} medeniyet`,
          metin: `${medeniyetTanitimi}. Her birinin kendi yurdu ve kendi rengi var; haritada bir bölgenin çerçevesi onu tutan medeniyetin rengini taşır.`,
        },
        {
          vurgu: 'Seçmiyorsun, yazılıyorsun',
          metin:
            'Kayıt olurken en az kalabalık medeniyete yazılırsın ve kampın onun yurdunda kurulur. Seçim serbest olsaydı herkes kazanan tarafa geçerdi ve fark kendi kendini büyütürdü — tarafları kura değil sayım dengeliyor.',
        },
        {
          // Kural ÖNCE sessizdi: mekanizma yoktu ve oyuncuya da
          // söylenmiyordu. Söylenmeyen kural, oyuncunun kafasında
          // "belki vardır"ı sonsuza kadar yaşatıyor (docs/16 §13 s.3).
          vurgu: 'Taraf değiştirebilirsin — ama bedeli var',
          metin: `Yalnız nüfusu ortalamanın ALTINDA olan bir medeniyete geçebilirsin; kazanan tarafa geçiş yok. Geçersen fayda puanın sıfırlanır ve ${degisimBekleme} gün yeniden değiştiremezsin. Toprağın ve kampın seninle gelir.`,
        },
        {
          vurgu: 'Toprak medeniyetin, pay senin',
          metin:
            'Bir bölgenin geliri kâğıt üstündeki sahibine değil, ORADA DURAN garnizonlara gider — bıraktıkları komuta yeri oranında. Askerini çekersen bölge medeniyetinden gitmez ama senin gelirin durur. Bölge bölünemez; bölgedeki pay bölünür.',
        },
        {
          vurgu: `${cekirdekSayisi} çekirdek ele geçirilemez`,
          metin: `Her yurdun ${cekirdekBasina} çekirdek bölgesi var ve hiçbirine saldırılamaz. Bir medeniyet yenilebilir ama silinemez: evine çekilir, toparlanır ve geri döner. Beşincisi medeniyetin başkenti — bonus değil kimlik taşır.`,
        },
        {
          vurgu: 'Çekirdek bonusu HERKESE işler',
          metin: `Dört çekirdeğe bağış yaparak medeniyetinin ${cekirdekBonuslari} oranlarını büyütürsün: her seviye +%${cekirdekBirSeviye}, en çok ${CEKIRDEK_AZAMI_SEVIYE} seviye, yani tam geliştirilmiş bir çekirdek +%${cekirdekTam}. Bonus o medeniyetteki herkese işler — bir kuruş vermeyene de.`,
        },
        {
          vurgu: 'Fayda puanı güç satın almaz',
          metin: `Garnizon tutmak (${ornekGarnizonYeri} yerlik garnizon saatte ${ornekFaydaPuani} puan), fetihe katılmak (${FAYDA_FETIH}), savunmaya katılmak (${FAYDA_SAVUNMA}) ve bağış yapmak fayda puanı kazandırır. Puan HARCANMIYOR: birikiyor ve medeniyetindeki rütbene dönüşüyor (${faydaRutbeleri}). Güç yalnız çekirdekten gelir ve o da herkese eşit işler.`,
        },
      ],
    },
    {
      anahtar: 'kaynak',
      baslik: 'Üç kaynak, bir puan',
      ozet: 'Altın, demir, erzak biriktirirsin; şöhret sıralamandır.',
      maddeler: [
        {
          vurgu: 'Altın ve demir',
          metin: 'Asker eğitmek, ekipman dövmek ve bölge geliştirmek bunlarla olur.',
        },
        {
          vurgu: 'Erzak',
          metin:
            'Ordun her saat erzak yer. Erzak biterse askerlerin açlıktan erimeye başlar — büyük ordu kurmak yetmiyor, besleyebilmek gerekiyor.',
        },
        {
          // Gelirin kaynağı değişti (docs/16 §6) ve bu sayfa onu
          // söylemeseydi oyuncu ilk bölgesini alıp gelirinin neden
          // artmadığını anlamazdı: ordusunu eve çağırmış olurdu.
          vurgu: 'Gelir garnizondan gelir',
          metin:
            'Kaynak iki yerden akar: malikânenin taban geliri ve bölgelerdeki garnizonların payı. Bir bölge, üstünde askeri olanlara öder. Aldığın toprağa asker bırakmazsan oradan tek altın almazsın.',
        },
        {
          vurgu: 'Şöhret',
          metin:
            'Harcanmaz, biriktirilir. Sıralamadaki yerin ve unvanın buradan gelir. Bölge tutmak, savaş kazanmak ve tahtı elinde tutmak şöhret kazandırır.',
        },
        {
          // Oyuncu testinde bu tavana çarpıldı ve fark edilmedi: altın
          // taşarken demir bitiyordu. Hiçbir ekranda yazmıyordu.
          vurgu: 'Deponun bir tavanı var',
          metin: `Her kaynağı en çok ${depo.taban.toLocaleString('tr-TR')} kadar biriktirebilirsin; lord seviyen her arttığında tavan ${depo.lord_seviye_basina.toLocaleString('tr-TR')} büyür. Tavana dayanan kaynak artık birikmez — üretilen boşa gider. Araştırmadaki Ambarlar bu tavanı büyütür.`,
        },
        {
          vurgu: 'Pazarda takas',
          metin: `Bölgeler tek kaynak üretir: şehir altın, maden demir, tarla erzak. Malikâne pazarında birini diğerine çevirebilirsin — komisyon %${Math.round(pazar.komisyon * 100)}, günlük hacim ${pazar.gunluk_tavan_altin_karsiligi.toLocaleString('tr-TR')} altın karşılığıyla sınırlı. Takas boşluğu kapatır, üretimin yerini tutmaz.`,
        },
        {
          // Eşya pazarı (docs/19): dövme zarının attığı fazla eşya
          // demirhanede birkaç altına gidiyordu; artık başka bir lordun işine
          // yarayabiliyor.
          vurgu: 'Eşya pazarı',
          metin: `İşine yaramayan eşyayı diyarındaki öteki lordlara satabilir, aradığını onlardan alabilirsin. Kimin sattığı görünmez; fiyat dar bir bantta oynar, satıştan %${Math.round(esyaPazari.vergi * 100)} vergi kesilir. Pazar binasından ya da Malikâne'den girilir.`,
        },
      ],
    },
    {
      anahtar: 'ordu',
      baslik: 'Ordu: kalabalık değil, doğru kalabalık',
      ozet: 'Birimler birbirini kırar. Kimi göndereceğin, kaç kişi olduğundan önemli.',
      maddeler: [
        {
          vurgu: 'Taş-kağıt-makas',
          metin: `${halka}. Karşındakinin garnizonunu görüp ona göre seçersen az askerle çok iş yaparsın.`,
        },
        {
          vurgu: 'Kuşatma silahı',
          metin: `Kaleye karşı ×${siegeVsFortress()}, canlı birime karşı ×${siegeVsUnit()}. Duvara karşı harika, insana karşı berbat — yanına muhafız al.`,
        },
        {
          vurgu: 'Komuta sınırı',
          metin: `Aynı anda ${komuta.taban} birim komuta edebilirsin; Liderlik her puanda ${komuta.liderlik_carpani} birim daha ekler. Ordu istediğin kadar büyümez.`,
        },
      ],
    },
    {
      anahtar: 'duzen',
      baslik: 'Savaştan önce: dizilimin ve taktiğin',
      ozet: `${diz.satir}x${diz.sutun} bir düzlükte orduyu sen yerleştirirsin, sonra bir taktik seçersin.`,
      maddeler: [
        {
          vurgu: `${diz.satir * diz.sutun} kare`,
          metin: `Saldırıya çıkmadan önce ordunu ${diz.satir}x${diz.sutun} bir alana dizersin. 1. satır en ön (düşmanın ilk çarptığı yer), ${diz.satir}. satır en arka. Kimin nerede durduğu savaşın gücünü değiştirir.`,
        },
        {
          vurgu: 'Her birimin bir yeri var',
          metin: `İdeal satırlar: ${idealSatirlar}. İdealinden her satır sapma güç kaybettirir; en ağır ceza mancınığındır (satır başına %${Math.round(kusatmaYer.satir_sapma_cezasi * 100)}) — ön hatta duran mancınık ilk çarpışmada dağılır.`,
        },
        {
          vurgu: 'Kanatlar ve açık cephe',
          metin: `Kenar sütunlar (${veListesi(diz.kanat_sutunlari)}) süvariye yarar (%${Math.round(suvariYer.kanat_carpani * 100)}), okçuyla mancınığa zarar verir. Ön satırda hiç yakın dövüş birimi bırakmazsan savunmandan %${Math.round(diz.acik_cephe_cezasi * 100)} gider: okçuyu öne koyup mızrakçıyı arkaya saklamak bedava değil.`,
        },
        {
          vurgu: `${TAKTIKLER.length} taktik`,
          metin:
            'Dizilimi yaptıktan sonra bir taktik seçersin — Hilal Düzeni süvarini kanattan dolandırır, Kalkan Duvarı ön hattı kilitler. Her taktiğin bir koşulu var ve koşulu tutmayan taktik seçilemez: yarım tutan bir taktiğe yarım bonus vermek, sana neden az aldığını anlatmayı imkânsız kılardı.',
        },
        {
          vurgu: 'Tavanı var, savaşı belirlemez',
          metin: `Dizilimden gelen etki en çok +%${Math.round(diz.azami_bonus * 100)} / -%${Math.round(diz.azami_ceza * 100)}, taktikten gelen en çok %${Math.round(taktikTavan.azami_etki * 100)}. İyi dizilim kötü orduyu kurtarmaz, ama iki denk ordudan hangisinin kazanacağını söyler. Yaptığın hatalar savaş raporunda tek tek yazar.`,
        },
      ],
    },
    {
      anahtar: 'savas',
      baslik: 'Savaş kendiliğinden çözülür',
      ozet: 'Orduyu yollarsın, yol alır, çarpışır; sen izlersin.',
      maddeler: [
        {
          vurgu: 'Önce önizleme',
          metin:
            'Saldırmadan önce kazanma ihtimalini, tahmini kaybını ve ganimetini gösteriyoruz. Kör atış yok.',
        },
        {
          vurgu: `${savas.tur_sayisi} tur`,
          metin:
            'Savaş tur tur hesaplanır ve raporu okunabilir: neyi neden kazandığın ya da kaybettiğin yazar. Rapordan doğrudan karşı saldırı açabilirsin.',
        },
        {
          vurgu: 'Önce casus yolla',
          metin: `${casus.maliyet_altin.toLocaleString('tr-TR')} altına bir bölgeye casus gönderip garnizonunu öğrenebilirsin. Rapor bir fotoğraftır: ${casus.gecerlilik_saat} saat sonra "eski" diye işaretlenir. Kurnazlık statın hem başarı şansını artırır hem yakalanma riskini düşürür.`,
        },
        {
          vurgu: 'Kaybetmek ölüm değil',
          metin:
            'Yenilirsen ordunun bir kısmını kaybedersin, hesabını değil. Ölü sayılanların bir bölümü yaralı olarak geri döner — hem savunmada hem saldırıda.',
        },
        {
          vurgu: 'Hastane',
          metin: `Yaralılar eve değil hastaneye girer ve tedavi bitene kadar savaşa katılamaz. Tedavi en çok ${Math.round(hastane.azami_saniye / 3600)} saat sürer; o sürede erzak yemez ve komuta yerini işgal etmezler. Yenilgi bir gecikmedir, silinme değil.`,
        },
        {
          vurgu: 'Ganimet ve fetih',
          metin:
            'Bir bölgeyi ezici bir üstünlükle alırsan bölge medeniyetine yazılır ve sağ kalan askerlerin orada garnizon olarak kalır — payını o andan itibaren almaya başlarsın. Yaralılar ve ganimet eve döner. Dar kazanırsan yalnız yağmalarsın: kaynağı alır, bölgeyi bırakırsın.',
        },
        {
          vurgu: 'Yoldaşına kılıç çekilmez',
          metin:
            'Kendi medeniyetinden bir lordun tuttuğu bölgeye saldıramazsın, çekirdeklere ise kimse saldıramaz. Yurdunda henüz hiçbir lordun almadığı bölgeler serbest: oradaki garnizon bir yoldaşın değil, bölgenin kendi muhafızlarıdır — ilk fethin büyük ihtimalle orada olacak.',
        },
      ],
    },
    /*
     * ŞEHİR ve AKIN — Y3'ten Y6'ya kadar gelen iki yeni sistem.
     *
     * Öğreticinin en sinsi eskimesi bu: oyuncu sekiz sayfa okuyup oyuna
     * giriyor ve ekranın yarısını tanımıyor. Sayfa eklendi çünkü iki
     * mekanik de oyuncunun HER GÜN dokunacağı yerler.
     */
    {
      anahtar: 'sehir',
      baslik: 'Şehrin: her binanın bir işi var',
      ozet: 'Ana sayfan bir yerleşim haritası. Binalar kapasite verir.',
      maddeler: [
        {
          vurgu: 'Yerleşim bir TAVAN',
          metin:
            'Kampta binalar 1. seviyeyi geçemez, köyde 2, kasabada 3, şehirde 4. Fethin karşılığı bu: T5 ekipman dövmek için gerçek bir şehir gerekiyor.',
        },
        {
          vurgu: 'Araştırma oran, bina kapasite',
          metin:
            'Araştırma "%15 daha hızlı" der, bina "aynı anda 2 eğitim" der. İkisi hiçbir zaman aynı sayıya dokunmaz — hangisini yükselteceğin ayrı bir karar.',
        },
        {
          vurgu: 'Binalar seninle taşınır',
          metin:
            'Daha büyük bir yerleşim fethedip başkentini oraya taşırsan binaların seviyeleriyle birlikte gelir. Taşınmak hiçbir şey kaybettirmez.',
        },
      ],
    },
    {
      anahtar: 'akin',
      baslik: 'Akın: toprak almadan savaşmak',
      ozet: 'Beş düşman diyarı, her birinde on kamp. Kaynak ve ekipman.',
      maddeler: [
        {
          vurgu: 'Toprak riski yok',
          metin:
            'Akın toprak vermez, toprak da almaz. Kaybetsen bile bölgen elinde kalır — ordunu denemenin en ucuz yeri burası.',
        },
        {
          vurgu: 'Savaş gerçek',
          metin:
            'Aynı savaş motoru, aynı dizilim, aynı taktik, aynı kayıp. Yaralıların hastaneye girer. Burada öğrendiğin her şey karşındaki lorda karşı da geçerli.',
        },
        {
          vurgu: 'Kaynak kesin, ekipman şans',
          metin:
            'Kazanınca kaynağı mutlaka alırsın; ekipman ihtimale bağlı ve grup zorlaştıkça hem ihtimal hem kademe büyür. Şefler en iyisini düşürür.',
        },
        {
          vurgu: 'Vurulan kamp toparlanır',
          metin:
            'Düşürdüğün grup birkaç saat sonra geri döner. O sürede gri durur ama kaybolmaz — ne zaman döneceği ekranda yazılı.',
        },
      ],
    },
    {
      anahtar: 'buyume',
      baslik: 'Büyümenin üç yolu',
      ozet: 'Bölge, ekipman ve general. Üçü de aynı anda ilerler.',
      maddeler: [
        {
          vurgu: 'Bölge geliştir',
          metin:
            'Bir bölgeyi yükseltmek onun gelirini ve savunmasını artırır; oradaki garnizonunun payı da aynı oranda büyür. Yeni bölge almaktan çoğu zaman daha kârlıdır.',
        },
        {
          vurgu: 'Ekipman döv',
          metin:
            'Demirhanede kuşandığın eşyalar ordunun saldırı ve savunmasına doğrudan eklenir. Aynı orduyla daha güçlü savaşırsın.',
        },
        {
          vurgu: 'General topla',
          metin:
            'Generaller savaşa katıldıkça seviye atlar ve ordunun bonuslarını büyütür. Yaralanırlarsa bir süre dinlenmeleri gerekir.',
        },
        {
          vurgu: 'Bölge sınırı',
          metin: `Her ${bolge.max_seviye_bolen} lord seviyesinde bir bölge daha tutabilirsin. Erken oyunda az bölgeyi iyi tutmak, çok bölgeyi kötü tutmaktan iyidir.`,
        },
        {
          vurgu: 'Aynı vilayette topla',
          metin: `Aynı vilayette tuttuğun her fazladan bölge, oradaki bütün bölgelerinin gelirini %${Math.round(vilayet.bolge_basina * 100)} artırır (en çok %${Math.round(vilayet.azami * 100)}). Dağınık üç bölge ile bitişik üç bölge aynı şey değil.`,
        },
      ],
    },
    {
      anahtar: 'arastirma',
      baslik: 'Araştırma: diyarını sen şekillendirirsin',
      ozet: 'Seçimlerin seni öbür lordlardan ayırır. İki lord aynı seviyede olsa bile aynı olmaz.',
      maddeler: [
        {
          vurgu: `${ARASTIRMA_DALLARI.length} sekme, ${ARASTIRMA_CAGLARI.length} çağ`,
          metin:
            // Dal özetleri veri dosyasında noktayla bitiyor; parantez
            // içine alırken kırpılıyor, yoksa "divan, casuslar.)" oluyor.
            ARASTIRMA_DALLARI.map(
              (d) => `${d.ad} (${d.ozet.toLocaleLowerCase('tr').replace(/\.$/, '')})`,
            ).join(' · ') +
            `. Bir araştırma, okla bağlı olduklarının hepsi bitince açılır. Çağından ${arastirma.erken_pencere_seviye} seviye önce de başlatabilirsin; daha uzun sürer.`,
        },
        {
          vurgu: `${ARASTIRMA_GRUPLARI.length} büyük seçim`,
          metin:
            ARASTIRMA_GRUPLARI.map((g) => g.ad).join(', ') +
            `: her birinden yalnız bir yol seçebilirsin. Sonradan değiştirebilirsin ama o yolun araştırmaları silinir, bedellerinin %${Math.round(arastirma.yol_degisim_iadesi * 100)}'i geri gelir ve aynı seçimi ${Math.round(arastirma.yol_degisim_bekleme_saat / 24)} gün değiştiremezsin.`,
        },
        {
          vurgu:
            kuyruk.research === 1
              ? 'Aynı anda tek araştırma'
              : `Aynı anda ${kuyruk.research} araştırma`,
          metin: `Başta aynı anda ${kuyruk.research} araştırma yürütebilirsin; Kütüphane ve bazı araştırmalar yuva ekler. Sıra senin kararın: önce ekonomiyi mi büyütürsün, orduyu mu? Vazgeçersen harcadığının %${Math.round(arastirma.iptal_iadesi * 100)}'i geri gelir.`,
        },
      ],
    },
    {
      anahtar: 'koruma',
      baslik: 'Seni koruyan kurallar',
      ozet: 'Uykudayken silinmezsin. Bu oyunda kalkanlar gerçekten var.',
      maddeler: [
        {
          vurgu: `${koruma.yeni_oyuncu_saat} saat yeni lord kalkanı`,
          metin:
            'Başlarken kimse sana saldıramaz. Kalkan, sen ilk saldırını yaptığında düşer — hazır olduğuna kendin karar veriyorsun.',
        },
        {
          vurgu: `Yağma sonrası ${koruma.yagma_sonrasi_saat} saat`,
          metin:
            'Bölgen yağmalandıysa kısa bir süre dokunulmaz olur. Farklı saldırganların sırayla gelip seni bir gecede silmesi böyle engelleniyor.',
        },
        {
          vurgu: `Fetih sonrası ${koruma.bolge_ele_gecirme_sonrasi_saat} saat`,
          metin:
            'Yeni aldığın bölge bir süre korunur. Aldığın anda elinden alınmaz, garnizonunu toplamaya vaktin olur.',
        },
      ],
    },
    {
      anahtar: 'ittifak',
      baslik: 'Yalnız oynamak zorunda değilsin',
      ozet: 'İttifak; birbirine saldıramayan, birbirini besleyen bir grup.',
      maddeler: [
        {
          vurgu: `En fazla ${ittifak.azami_uye} üye`,
          metin:
            'Üyeler birbirine saldıramaz. Küçük tutuldu: bir kaleyi birlikte kuşatmaya yeter, haritayı tek başına yutmaya yetmez.',
        },
        {
          // "Nasıl girerim" sorusu, "içeride ne yaparım"dan önce geliyor:
          // oyuncunun çarptığı ilk kapı bu.
          vurgu: 'Katılmak',
          metin: `Kimi ittifaklara doğrudan girersin, çoğu başvuruyla üye alır — o zaman liderin onayını beklersin. Aynı anda ${basvuru.azami_bekleyen} başvurun açık olabilir; kabul edilen biri gelince diğerleri kendiliğinden düşer.`,
        },
        {
          vurgu: 'Takviye ve ortak hedef',
          metin:
            'Bir üyenin bölgesine asker yollayıp savunmasını güçlendirebilir, lider olarak haritada ortak bir hedef işaretleyebilirsin.',
        },
        {
          vurgu: 'İttifak seviyesi',
          metin: `Üyeler bağış yaptıkça ittifak seviye atlar ve HERKES kazanır: daha çok kaynak gönderme hakkı, daha hızlı takviye, daha ucuz keşif. Günde ${bagis.gunluk_hak} bağış hakkın var.`,
        },
        {
          vurgu: 'Saldırmazlık paktı',
          metin: `İki ittifak birbirine saldırmamaya söz verebilir. En fazla ${pakt.azami} pakt, ve fesih anında geçmiyor: ${pakt.fesih_ihbar_saat} saat ihbar süresi boyunca pakt hâlâ koruyor. Verdiğin söz o yüzden bir şey ifade ediyor.`,
        },
        {
          vurgu: 'Kaynak gönder',
          metin: `Zorda kalan üyeye kaynak yollayabilirsin. Günde ${ticaret.gunluk_gonderim_tavani.toLocaleString('tr-TR')} altın karşılığına kadar, ve kaynak da yol alır — anında gitmez.`,
        },
      ],
    },
    {
      anahtar: 'ritim',
      baslik: 'Oyunun ritmi',
      ozet: 'Bu oyun beklemeli. Günde birkaç dakika yeter.',
      maddeler: [
        {
          vurgu: 'Bir şey başlat, kapat',
          metin:
            'Eğitim, yürüyüş ve imar zamanla biter. Uygulamayı açık tutman gerekmez; kapalıyken de işler.',
        },
        {
          vurgu: '"Şimdi ne yapmalısın"',
          metin:
            'Malikânede tek bir kart her zaman sıradaki adımı söyler. Ne yapacağını bilemezsen oraya bak, gerisini düşünme.',
        },
        {
          vurgu: 'Günlük görevler ve haftalık sefer',
          metin:
            'Her gün üç küçük görev, her hafta bir sefer. Kısa bir girişte bile elinde bir şeyle çıkarsın.',
        },
        {
          vurgu: 'Başarımlar',
          metin:
            'Lord ekranında bir başarım listesi var: bölge, savaş, ekipman, general. Hiçbiri zorunlu değil — oyunu hiç görmediğin yerlerinden denemen için birer bahane.',
        },
        {
          vurgu: 'Dünya kalıcı',
          metin:
            'Sezon yok, sıfırlama yok. Bugün kurduğun şey yarın da, seneye de duruyor. Acele etmene gerek yok.',
        },
      ],
    },
  ];
}
