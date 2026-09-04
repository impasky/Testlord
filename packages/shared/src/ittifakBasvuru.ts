/**
 * İttifağa başvuru: katılımın liderin kararı olması.
 *
 * Bu dosya var olan bir deliği kapatıyor. `/ittifak/:id/katil` ucu herkese
 * açıktı: istediğin ittifağa yürüyüp giriyordun, lider yalnızca "katıldı"
 * bildirimi alıyordu, söz hakkı yoktu. İttifak seviyesi ve ayrıcalıkları
 * (B1e) gelince delik büyüdü — aylarca bağış toplayıp Sv6'ya çıkmış bir
 * ittifağın ticaret tavanı ve takviye hızı, kapıdan giren herkese bedava
 * oluyordu. Birlikte büyütülen bir şeyin kapısı olmalı.
 *
 * Kapı iki katmanlı, çünkü liderin yükü de bir maliyet:
 * - **Seviye eşiği** başvuruyu lider bakmadan süzüyor ("Lv10 altı almıyoruz").
 * - **Başvuru** kalanı insana taşıyor.
 *
 * Buradaki her şey saf: karar ve gerekçe. Veritabanı api tarafında.
 */
import { B } from './balance.js';

/** Katılım türü. Lider seçiyor, ittifak ekranında görünüyor. */
export type KatilimTuru = 'acik' | 'basvuru';

export const KATILIM_ADI: Record<KatilimTuru, string> = {
  acik: 'Herkes katılabilir',
  basvuru: 'Başvuru ile',
};

/** Başvurunun durumu. */
export type BasvuruDurumu = 'bekliyor' | 'kabul' | 'ret' | 'geri_cekildi';

export function azamiBekleyenBasvuru(): number {
  return B.ittifak.basvuru.azami_bekleyen;
}

export function retBeklemeSn(): number {
  return B.ittifak.basvuru.ret_bekleme_saat * 3600;
}

export function basvuruMesajiEnFazla(): number {
  return B.ittifak.basvuru.mesaj_en_fazla_harf;
}

export function azamiAsgariSeviye(): number {
  return B.ittifak.basvuru.azami_asgari_seviye;
}

export interface BasvuruDurum {
  olur: boolean;
  sebep?: string;
  /** Ret beklemesi işliyorsa kalan saniye — arayüz geri sayım gösteriyor. */
  kalanSn?: number;
}

export interface BasvuruKosullari {
  /** Başvuran lordun seviyesi. */
  lordSeviye: number;
  /** Başvuran hâlâ bir ittifakta mı? */
  ittifaktaMi: boolean;
  /** Hedef ittifağın katılım türü. */
  katilim: KatilimTuru;
  /** Hedef ittifağın istediği en düşük seviye. */
  asgariSeviye: number;
  uyeSayisi: number;
  /** Bu lordun bekleyen başvuru sayısı (bu ittifak hariç). */
  bekleyenSayisi: number;
  /** Bu ittifağa daha önce yapılmış başvurunun durumu ve karar anı. */
  oncekiDurum?: BasvuruDurumu;
  oncekiKararAt?: Date | null;
  simdi: Date;
}

/**
 * Bu lord bu ittifağa başvurabilir mi?
 *
 * Sıra rastgele değil, en kesin engelden en geçiciye: "zaten ittifaktasın"
 * hiç değişmeyecek bir durum, ret beklemesi bir saat sonra kalkıyor.
 * Oyuncuya önce değiştiremeyeceği şeyi söylemek, sonra düzeltilebilir
 * olanı söylemekten iyidir.
 */
export function basvurabilirMi(k: BasvuruKosullari): BasvuruDurum {
  if (k.ittifaktaMi) {
    return { olur: false, sebep: 'Zaten bir ittifaktasın. Önce ayrılman gerekir.' };
  }
  if (k.katilim !== 'basvuru') {
    return { olur: false, sebep: 'Bu ittifak başvuru almıyor, doğrudan katılabilirsin.' };
  }
  if (k.uyeSayisi >= B.ittifak.azami_uye) {
    return { olur: false, sebep: `İttifak dolu (${B.ittifak.azami_uye} üye).` };
  }
  if (k.lordSeviye < k.asgariSeviye) {
    return {
      olur: false,
      sebep: `Bu ittifak en az Sv${k.asgariSeviye} istiyor. Sen Sv${k.lordSeviye}'sin.`,
    };
  }
  if (k.oncekiDurum === 'bekliyor') {
    return { olur: false, sebep: 'Bu ittifağa zaten başvurdun, cevap bekleniyor.' };
  }
  if (k.oncekiDurum === 'ret' && k.oncekiKararAt) {
    const gecen = (k.simdi.getTime() - k.oncekiKararAt.getTime()) / 1000;
    const kalan = Math.ceil(retBeklemeSn() - gecen);
    if (kalan > 0) {
      return {
        olur: false,
        sebep: `Bu ittifak başvurunu reddetti. ${Math.ceil(kalan / 3600)} saat sonra yeniden başvurabilirsin.`,
        kalanSn: kalan,
      };
    }
  }
  // Bekleyen sayısı EN SONDA: bu engel oyuncunun kendi elinde (bir
  // başvurusunu geri çekip yerine bunu yapabilir), o yüzden ancak
  // diğer her şey uygunken söylemek anlamlı.
  if (k.bekleyenSayisi >= azamiBekleyenBasvuru()) {
    return {
      olur: false,
      sebep: `Aynı anda en fazla ${azamiBekleyenBasvuru()} başvurun olabilir. Birini geri çek.`,
    };
  }
  return { olur: true };
}

/**
 * Liderin belirlediği asgari seviye geçerli mi?
 *
 * Tavan var çünkü tavansız bir eşik ittifağı yeni oyuncuya tamamen
 * kapatırdı ve oyunun en çok ihtiyacı olan şey yeni oyuncunun bir gruba
 * girmesi.
 */
export function asgariSeviyeDenetle(seviye: number): BasvuruDurum {
  if (!Number.isInteger(seviye) || seviye < 1) {
    return { olur: false, sebep: 'Seviye eşiği en az 1 olmalı.' };
  }
  if (seviye > azamiAsgariSeviye()) {
    return { olur: false, sebep: `Seviye eşiği en fazla ${azamiAsgariSeviye()} olabilir.` };
  }
  return { olur: true };
}

export function basvuruMesajiDenetle(mesaj: string): BasvuruDurum {
  if (mesaj.length > basvuruMesajiEnFazla()) {
    return { olur: false, sebep: `Not en fazla ${basvuruMesajiEnFazla()} harf olabilir.` };
  }
  return { olur: true };
}
