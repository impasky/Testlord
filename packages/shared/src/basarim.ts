/**
 * Başarımlar — kilometre taşlarını hissedilir kılar.
 *
 * TAMAMEN TÜRETİLMİŞ: yeni tablo, yeni yazma, göç yok. Sayılan şeylerin
 * hepsi (bölge sayısı, PvP galibiyeti, kuşanık parça, ELO, seviye) zaten
 * Lord kaydında duruyor. İkinci bir yerde tutmak, er ya da geç ikisinin
 * birbirinden sapması demek — deponun `balance.json` kuralının aynısı,
 * bu kez duruma uygulanmış hâli.
 *
 * Karşılığında bir şey kaybediyoruz: "şu an kilidi açıldı" anını sunucu
 * bilmiyor. Onu arayüz kendi tarafında (localStorage) takip ediyor;
 * cihaz başına bir "yeni" noktası için bu yeterli ve hiçbir oyun
 * durumunu kirletmiyor.
 */
import { BASARIM_KUMELERI } from './balance.js';

export interface BasarimDurumu {
  key: string;
  ad: string;
  aciklama: string;
  hedef: number;
  /** Şu anki değer. Hedefi aşabilir; arayüz kırpıyor. */
  simdi: number;
  tamam: boolean;
}

export interface BasarimKumesi {
  ad: string;
  basarimlar: BasarimDurumu[];
}

/**
 * Ölçüt değerleri.
 *
 * Anahtarlar `data/basarimlar.json` içindeki `olcut` alanlarıyla birebir.
 * Bir ölçüt eksikse o başarım 0 ilerlemeyle görünür — sessizce kaybolmaz,
 * çünkü kaybolan bir başarımın eksik olduğu anlaşılmaz.
 */
export interface BasarimOlcutleri {
  bolge: number;
  taht: number;
  pvp_galibiyet: number;
  elo: number;
  /** Kullanılan komuta yerinin yüzdesi (0–100). */
  komuta_orani: number;
  /** Kaç farklı birim tipinden asker var. */
  birim_cesidi: number;
  /** Dolu general slotunun yüzdesi (0–100). */
  general_slot_orani: number;
  kusanik: number;
  en_yuksek_tier: number;
  seviye: number;
  en_yuksek_bolge_seviyesi: number;
}

export function basarimlar(olcut: BasarimOlcutleri): BasarimKumesi[] {
  return BASARIM_KUMELERI.map((kume) => ({
    ad: kume.ad,
    basarimlar: kume.basarimlar.map((b) => {
      const simdi = olcut[b.olcut as keyof BasarimOlcutleri] ?? 0;
      return {
        key: b.key,
        ad: b.ad,
        aciklama: b.aciklama,
        hedef: b.hedef,
        simdi,
        tamam: simdi >= b.hedef,
      };
    }),
  }));
}

/** Kaç başarım tamamlandı / toplam kaç var. */
export function basarimSayaci(kumeler: BasarimKumesi[]): { tamam: number; toplam: number } {
  let tamam = 0;
  let toplam = 0;
  for (const k of kumeler) {
    for (const b of k.basarimlar) {
      toplam++;
      if (b.tamam) tamam++;
    }
  }
  return { tamam, toplam };
}
