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
  ARASTIRMA_DALLARI,
  B,
  TAKTIKLER,
  counterMultiplier,
  siegeVsFortress,
  siegeVsUnit,
  unitName,
} from './balance.js';
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
  const bolge = B.bolgeler as { toplam: number; max_seviye_bolen: number };
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
  const arastirma = B.arastirma as { iptal_iadesi: number };
  const pazar = B.pazar as { komisyon: number; gunluk_tavan_altin_karsiligi: number };
  const hastane = B.hastane as { azami_saniye: number; bakim_alir: boolean };
  const casus = B.casusluk as { maliyet_altin: number; gecerlilik_saat: number };
  const depo = B.kaynaklar.depo_kapasitesi as {
    taban: number;
    lord_seviye_basina: number;
  };
  const kuyruk = B.kuyruklar.es_zamanli as Record<string, number>;
  // Dal başına kademe sayısı: en uzun daldan okunuyor. Dallar veri
  // dosyasında eşit uzunlukta ve bir test bunu kilitliyor.
  const kademeSayisi = Math.max(...ARASTIRMA_DALLARI.map((d) => d.dugumler.length));

  // İdeal satırlar veriden okunuyor: "mızrakçı önde, mancınık arkada"
  // cümlesi denge dosyası değişince kendiliğinden değişsin.
  const idealSatirlar = UNIT_TYPES.map(
    (t) => `${unitName(t)} ${diz.birim_yerlesimi[t].ideal_satir}. satır`,
  ).join(', ');

  const halka = karsiHalkasi()
    .map((k) => `${unitName(k.saldiran)} → ${unitName(k.hedef)} ×${k.carpan}`)
    .join(', ');

  return [
    {
      anahtar: 'diyar',
      baslik: 'Burası bir diyar, sen bir lordsun',
      ozet: 'Tek bir harita, üzerinde herkes. Sen de onlardan birisin.',
      maddeler: [
        {
          vurgu: `${bolge.toplam} bölge`,
          metin:
            'Haritadaki her altıgen bir bölge. Kimi boş durur, kimini bir lord tutar. ' +
            'Bölgeler bitmez ama çoğalmaz da — biri alırsa, bir başkası kaybeder.',
        },
        {
          vurgu: 'Taht Kalesi',
          metin:
            'Haritanın ortasındaki altın çerçeveli bölge. Onu tutan Diyarın Lordu olur ' +
            've şöhretini daha hızlı büyütür. Oyunun ucu burası.',
        },
        {
          vurgu: 'Toprak haritayı açar',
          metin:
            'Yürüyüş süresi en yakın toprağından ölçülür, malikânenden değil. ' +
            'Bir bölge aldığın anda onun çevresindeki her yer sana yaklaşır — ' +
            'yayıldıkça daha uzağa uzanabilirsin.',
        },
        {
          vurgu: 'Malikânen güvende',
          metin:
            'Kimse malikânene saldıramaz. Her şeyini kaybetsen bile saatte ' +
            `${kaynak.malikane_saatlik.altin} altın akmaya devam eder. Oyundan atılmazsın.`,
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
            'Ordun her saat erzak yer. Erzak biterse askerlerin açlıktan erimeye ' +
            'başlar — büyük ordu kurmak yetmiyor, besleyebilmek gerekiyor.',
        },
        {
          vurgu: 'Şöhret',
          metin:
            'Harcanmaz, biriktirilir. Sıralamadaki yerin ve unvanın buradan gelir. ' +
            'Bölge tutmak, savaş kazanmak ve tahtı elinde tutmak şöhret kazandırır.',
        },
        {
          // Oyuncu testinde bu tavana çarpıldı ve fark edilmedi: altın
          // taşarken demir bitiyordu. Hiçbir ekranda yazmıyordu.
          vurgu: 'Deponun bir tavanı var',
          metin:
            `Her kaynağı en çok ${depo.taban.toLocaleString('tr-TR')} kadar biriktirebilirsin; ` +
            `lord seviyen her arttığında tavan ${depo.lord_seviye_basina.toLocaleString('tr-TR')} büyür. ` +
            'Tavana dayanan kaynak artık birikmez — üretilen boşa gider. Araştırmadaki ' +
            'Ambarlar bu tavanı büyütür.',
        },
        {
          vurgu: 'Pazarda takas',
          metin:
            'Bölgeler tek kaynak üretir: şehir altın, maden demir, tarla erzak. Malikâne ' +
            `pazarında birini diğerine çevirebilirsin — komisyon %${Math.round(pazar.komisyon * 100)}, ` +
            `günlük hacim ${pazar.gunluk_tavan_altin_karsiligi.toLocaleString('tr-TR')} altın karşılığıyla sınırlı. ` +
            'Takas boşluğu kapatır, üretimin yerini tutmaz.',
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
          metin:
            `Kaleye karşı ×${siegeVsFortress()}, canlı birime karşı ×${siegeVsUnit()}. ` +
            'Duvara karşı harika, insana karşı berbat — yanına muhafız al.',
        },
        {
          vurgu: 'Komuta sınırı',
          metin:
            `Aynı anda ${komuta.taban} birim komuta edebilirsin; Liderlik her puanda ` +
            `${komuta.liderlik_carpani} birim daha ekler. Ordu istediğin kadar büyümez.`,
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
          metin:
            `Saldırıya çıkmadan önce ordunu ${diz.satir}x${diz.sutun} bir alana dizersin. ` +
            `1. satır en ön (düşmanın ilk çarptığı yer), ${diz.satir}. satır en arka. ` +
            'Kimin nerede durduğu savaşın gücünü değiştirir.',
        },
        {
          vurgu: 'Her birimin bir yeri var',
          metin:
            `İdeal satırlar: ${idealSatirlar}. İdealinden her satır sapma güç kaybettirir; ` +
            `en ağır ceza mancınığındır (satır başına %${Math.round(kusatmaYer.satir_sapma_cezasi * 100)}) — ` +
            'ön hatta duran mancınık ilk çarpışmada dağılır.',
        },
        {
          vurgu: 'Kanatlar ve açık cephe',
          metin:
            `Kenar sütunlar (${diz.kanat_sutunlari.join(' ve ')}) süvariye yarar ` +
            `(%${Math.round(suvariYer.kanat_carpani * 100)}), okçuyla mancınığa zarar verir. ` +
            `Ön satırda hiç yakın dövüş birimi bırakmazsan savunmandan %${Math.round(diz.acik_cephe_cezasi * 100)} ` +
            'gider: okçuyu öne koyup mızrakçıyı arkaya saklamak bedava değil.',
        },
        {
          vurgu: `${TAKTIKLER.length} taktik`,
          metin:
            'Dizilimi yaptıktan sonra bir taktik seçersin — Hilal Düzeni süvarini kanattan ' +
            'dolandırır, Kalkan Duvarı ön hattı kilitler. Her taktiğin bir koşulu var ve ' +
            'koşulu tutmayan taktik seçilemez: yarım tutan bir taktiğe yarım bonus vermek, ' +
            'sana neden az aldığını anlatmayı imkânsız kılardı.',
        },
        {
          vurgu: 'Tavanı var, savaşı belirlemez',
          metin:
            `Dizilimden gelen etki en çok +%${Math.round(diz.azami_bonus * 100)} / ` +
            `-%${Math.round(diz.azami_ceza * 100)}, taktikten gelen en çok ` +
            `%${Math.round(taktikTavan.azami_etki * 100)}. İyi dizilim kötü orduyu kurtarmaz, ` +
            'ama iki denk ordudan hangisinin kazanacağını söyler. Yaptığın hatalar savaş ' +
            'raporunda tek tek yazar.',
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
            'Saldırmadan önce kazanma ihtimalini, tahmini kaybını ve ganimetini ' +
            'gösteriyoruz. Kör atış yok.',
        },
        {
          vurgu: `${savas.tur_sayisi} tur`,
          metin:
            'Savaş tur tur hesaplanır ve raporu okunabilir: neyi neden kazandığın ' +
            'ya da kaybettiğin yazar. Rapordan doğrudan karşı saldırı açabilirsin.',
        },
        {
          vurgu: 'Önce casus yolla',
          metin:
            `${casus.maliyet_altin.toLocaleString('tr-TR')} altına bir bölgeye casus gönderip garnizonunu ` +
            `öğrenebilirsin. Rapor bir fotoğraftır: ${casus.gecerlilik_saat} saat sonra "eski" diye ` +
            'işaretlenir. Kurnazlık statın hem başarı şansını artırır hem yakalanma riskini düşürür.',
        },
        {
          vurgu: 'Kaybetmek ölüm değil',
          metin:
            'Yenilirsen ordunun bir kısmını kaybedersin, hesabını değil. ' +
            'Ölü sayılanların bir bölümü yaralı olarak geri döner — hem savunmada hem saldırıda.',
        },
        {
          vurgu: 'Hastane',
          metin:
            'Yaralılar eve değil hastaneye girer ve tedavi bitene kadar savaşa katılamaz. ' +
            `Tedavi en çok ${Math.round(hastane.azami_saniye / 3600)} saat sürer; o sürede ` +
            'erzak yemez ve komuta yerini işgal etmezler. Yenilgi bir gecikmedir, silinme değil.',
        },
        {
          vurgu: 'Ganimet ve fetih',
          metin:
            'Bir bölgeyi ezici bir üstünlükle alırsan bölge senin olur. Dar kazanırsan ' +
            'yalnız yağmalarsın: kaynağı alır, bölgeyi bırakırsın.',
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
            'Aldığın bölgeyi yükseltmek geliri ve savunmayı artırır. Yeni bölge almaktan ' +
            'çoğu zaman daha kârlıdır — ve kimse elinden almaya kalkışmaz.',
        },
        {
          vurgu: 'Ekipman döv',
          metin:
            'Demirhanede kuşandığın eşyalar ordunun saldırı ve savunmasına doğrudan ' +
            'eklenir. Aynı orduyla daha güçlü savaşırsın.',
        },
        {
          vurgu: 'General topla',
          metin:
            'Generaller savaşa katıldıkça seviye atlar ve ordunun bonuslarını büyütür. ' +
            'Yaralanırlarsa bir süre dinlenmeleri gerekir.',
        },
        {
          vurgu: 'Bölge sınırı',
          metin:
            `Her ${bolge.max_seviye_bolen} lord seviyesinde bir bölge daha tutabilirsin. ` +
            'Erken oyunda az bölgeyi iyi tutmak, çok bölgeyi kötü tutmaktan iyidir.',
        },
        {
          vurgu: 'Aynı vilayette topla',
          metin:
            `Aynı vilayette tuttuğun her fazladan bölge, oradaki bütün bölgelerinin gelirini ` +
            `%${Math.round(vilayet.bolge_basina * 100)} artırır (en çok %${Math.round(vilayet.azami * 100)}). ` +
            'Dağınık üç bölge ile bitişik üç bölge aynı şey değil.',
        },
      ],
    },
    {
      anahtar: 'arastirma',
      baslik: 'Araştırma: diyarını sen şekillendirirsin',
      ozet: 'Kalıcı seçimler. İki lord aynı seviyede olsa bile aynı olmaz.',
      maddeler: [
        {
          vurgu: `${ARASTIRMA_DALLARI.length} dal, her dalda ${kademeSayisi} kademe`,
          metin:
            // Dal özetleri veri dosyasında noktayla bitiyor; parantez
            // içine alırken kırpılıyor, yoksa "vergi defteri.)" oluyor.
            ARASTIRMA_DALLARI.map(
              (d) => `${d.ad} (${d.ozet.toLocaleLowerCase('tr').replace(/\.$/, '')})`,
            ).join(' · ') + '. Bir dalda ilerlemek için önce alt kademesini bitirmen gerekir.',
        },
        {
          vurgu: 'Kalıcı ve geri alınmaz',
          metin:
            'Araştırma bittiğinde etkisi sonsuza kadar durur — ekipman gibi eskimez, ordu ' +
            'gibi ölmez. Depo tavanı, eğitim hızı, ordu saldırısı, yürüyüş hızı: hepsi ' +
            'buradan büyür.',
        },
        {
          vurgu:
            kuyruk.research === 1
              ? 'Aynı anda tek araştırma'
              : `Aynı anda ${kuyruk.research} araştırma`,
          metin:
            `Aynı anda ${kuyruk.research} araştırma yürütebilirsin, yani sıra senin kararın: ` +
            'önce ekonomiyi mi büyütürsün, orduyu mu? Vazgeçersen harcadığının ' +
            `%${Math.round(arastirma.iptal_iadesi * 100)}'i geri gelir.`,
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
            'Başlarken kimse sana saldıramaz. Kalkan, sen ilk saldırını yaptığında ' +
            'düşer — hazır olduğuna kendin karar veriyorsun.',
        },
        {
          vurgu: `Yağma sonrası ${koruma.yagma_sonrasi_saat} saat`,
          metin:
            'Bölgen yağmalandıysa kısa bir süre dokunulmaz olur. Farklı saldırganların ' +
            'sırayla gelip seni bir gecede silmesi böyle engelleniyor.',
        },
        {
          vurgu: `Fetih sonrası ${koruma.bolge_ele_gecirme_sonrasi_saat} saat`,
          metin:
            'Yeni aldığın bölge bir süre korunur. Aldığın anda elinden alınmaz, ' +
            'garnizonunu toplamaya vaktin olur.',
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
            'Üyeler birbirine saldıramaz. Küçük tutuldu: bir kaleyi birlikte kuşatmaya ' +
            'yeter, haritayı tek başına yutmaya yetmez.',
        },
        {
          // "Nasıl girerim" sorusu, "içeride ne yaparım"dan önce geliyor:
          // oyuncunun çarptığı ilk kapı bu.
          vurgu: 'Katılmak',
          metin:
            'Kimi ittifaklara doğrudan girersin, çoğu başvuruyla üye alır — o zaman ' +
            `liderin onayını beklersin. Aynı anda ${basvuru.azami_bekleyen} başvurun ` +
            'açık olabilir; kabul edilen biri gelince diğerleri kendiliğinden düşer.',
        },
        {
          vurgu: 'Takviye ve ortak hedef',
          metin:
            'Bir üyenin bölgesine asker yollayıp savunmasını güçlendirebilir, lider ' +
            'olarak haritada ortak bir hedef işaretleyebilirsin.',
        },
        {
          vurgu: 'İttifak seviyesi',
          metin:
            'Üyeler bağış yaptıkça ittifak seviye atlar ve HERKES kazanır: daha çok ' +
            'kaynak gönderme hakkı, daha hızlı takviye, daha ucuz keşif. Günde ' +
            `${bagis.gunluk_hak} bağış hakkın var.`,
        },
        {
          vurgu: 'Saldırmazlık paktı',
          metin:
            `İki ittifak birbirine saldırmamaya söz verebilir. En fazla ${pakt.azami} pakt, ` +
            `ve fesih anında geçmiyor: ${pakt.fesih_ihbar_saat} saat ihbar süresi boyunca pakt ` +
            'hâlâ koruyor. Verdiğin söz o yüzden bir şey ifade ediyor.',
        },
        {
          vurgu: 'Kaynak gönder',
          metin:
            `Zorda kalan üyeye kaynak yollayabilirsin. Günde ${ticaret.gunluk_gonderim_tavani.toLocaleString('tr-TR')} ` +
            'altın karşılığına kadar, ve kaynak da yol alır — anında gitmez.',
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
            'Eğitim, yürüyüş ve imar zamanla biter. Uygulamayı açık tutman gerekmez; ' +
            'kapalıyken de işler.',
        },
        {
          vurgu: '"Şimdi ne yapmalısın"',
          metin:
            'Malikânede tek bir kart her zaman sıradaki adımı söyler. Ne yapacağını ' +
            'bilemezsen oraya bak, gerisini düşünme.',
        },
        {
          vurgu: 'Günlük görevler ve haftalık sefer',
          metin:
            'Her gün üç küçük görev, her hafta bir sefer. Kısa bir girişte bile ' +
            'elinde bir şeyle çıkarsın.',
        },
        {
          vurgu: 'Başarımlar',
          metin:
            'Lord ekranında bir başarım listesi var: bölge, savaş, ekipman, general. ' +
            'Hiçbiri zorunlu değil — oyunu hiç görmediğin yerlerinden denemen için ' +
            'birer bahane.',
        },
        {
          vurgu: 'Dünya kalıcı',
          metin:
            'Sezon yok, sıfırlama yok. Bugün kurduğun şey yarın da, seneye de duruyor. ' +
            'Acele etmene gerek yok.',
        },
      ],
    },
  ];
}
