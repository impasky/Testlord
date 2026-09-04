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
 * Kapsam kasten "kabaca": oyuncuya oyunun TAMAMINI öğretmiyoruz, haritasını
 * veriyoruz. Ayrıntıyı zaten her ekran kendi içinde anlatıyor (karşı
 * ipuçları kışlada, savaş sebebi raporda, omurga malikânede). Öğreticinin
 * tek işi "burada neler var, ben ne yapıyorum" sorusunu cevaplamak.
 */
import { B, counterMultiplier, siegeVsFortress, siegeVsUnit, unitName } from './balance.js';
import { UNIT_TYPES, type Ekran, type UnitType } from './types.js';

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
  sekme?: Ekran;
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
  const ticaret = B.ticaret as { gunluk_gonderim_tavani: number };
  const kaynak = B.kaynaklar as { malikane_saatlik: Record<string, number> };
  const vilayet = (
    B.bolgeler as unknown as {
      vilayet_birligi: { bolge_basina: number; azami: number };
    }
  ).vilayet_birligi;
  const komuta = B.komuta as { taban: number; liderlik_carpani: number };
  const savas = B.savas as { tur_sayisi: number };

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
      sekme: 'harita',
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
      ],
      sekme: 'malikane',
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
      sekme: 'kisla',
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
          vurgu: 'Kaybetmek ölüm değil',
          metin:
            'Yenilirsen ordunun bir kısmını kaybedersin, hesabını değil. ' +
            'Savunmada kaybedenlerin bir bölümü yaralı olarak evine döner.',
        },
        {
          vurgu: 'Ganimet ve fetih',
          metin:
            'Bir bölgeyi ezici bir üstünlükle alırsan bölge senin olur. Dar kazanırsan ' +
            'yalnız yağmalarsın: kaynağı alır, bölgeyi bırakırsın.',
        },
      ],
      sekme: 'harita',
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
      sekme: 'demirhane',
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
      sekme: 'harita',
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
          vurgu: 'Takviye ve ortak hedef',
          metin:
            'Bir üyenin bölgesine asker yollayıp savunmasını güçlendirebilir, lider ' +
            'olarak haritada ortak bir hedef işaretleyebilirsin.',
        },
        {
          vurgu: 'Kaynak gönder',
          metin:
            `Zorda kalan üyeye kaynak yollayabilirsin. Günde ${ticaret.gunluk_gonderim_tavani.toLocaleString('tr-TR')} ` +
            'altın karşılığına kadar, ve kaynak da yol alır — anında gitmez.',
        },
      ],
      sekme: 'ittifak',
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
          vurgu: 'Dünya kalıcı',
          metin:
            'Sezon yok, sıfırlama yok. Bugün kurduğun şey yarın da, seneye de duruyor. ' +
            'Acele etmene gerek yok.',
        },
      ],
      sekme: 'malikane',
    },
  ];
}
