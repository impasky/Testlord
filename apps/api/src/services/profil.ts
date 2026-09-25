/**
 * Profil: oyuncunun öteki oyunculara görünen yüzü.
 *
 * Üç iş:
 *   - sohbette bir mesajın YAZARI nasıl görünür (`yazarGorunumu`),
 *   - ada/resme dokununca açılan PROFİL KARTI (`profilKarti`),
 *   - yöneticinin profil resmi kararları (`resmiOnayla`, `resmiKaldir`).
 *
 * KARTTA NE VAR, NE YOK. Oyuncunun isteği: "profil ve bazı bilgiler
 * görünsün, kritik bilgiler görünmesin." Kartta yalnız oyunun zaten
 * herkese gösterdiği şeyler var — ad, arma, seviye, unvan, şöhret,
 * medeniyet, ittifak, bölge sayısı (haritada da sayılabiliyor), diyar ve
 * katıldığı ay. YOK: e-posta, kaynaklar, ordunun büyüklüğü ve yeri,
 * ekipman, son görülme, kampın yeri. Bunların her biri ya kişisel veri ya
 * da bir saldırgana hedef seçtiren istihbarat — casusluk oyunun içinde
 * bir bedelle alınıyor, profil kartı onu bedavaya vermemeli.
 */
import {
  MEDENIYETLER,
  faydaRutbesi,
  profilResmiCoz,
  unvan,
  type Arma,
  type ProfilResmi,
} from '@lordlar/shared';
import { prisma } from '../db.js';
import { hata } from '../errors.js';
import { lordArmasi, pushEvent } from './lord.js';

/** Bir yazarı çizmek için gereken sütunlar — sohbet sorgularına eklenir. */
export const YAZAR_SEC = {
  id: true,
  name: true,
  profilResmi: true,
  armaKalkan: true,
  armaDesen: true,
  armaRenk1: true,
  armaRenk2: true,
  armaSembol: true,
} as const;

export interface YazarGorunumu {
  lordId: string;
  ad: string;
  resim: ProfilResmi;
  arma: Arma;
}

export function yazarGorunumu(l: {
  id: string;
  name: string;
  profilResmi: string | null;
  armaKalkan: string | null;
  armaDesen: string | null;
  armaRenk1: string | null;
  armaRenk2: string | null;
  armaSembol: string | null;
}): YazarGorunumu {
  return { lordId: l.id, ad: l.name, resim: profilResmiCoz(l.profilResmi), arma: lordArmasi(l) };
}

/** Profil kartı — bakanın kendisi dahil herkese aynı alanlar. */
export async function profilKarti(hedefId: string, bakanId: string) {
  const l = await prisma.lord.findUnique({
    where: { id: hedefId },
    select: {
      ...YAZAR_SEC,
      level: true,
      fame: true,
      faydaPuani: true,
      isNpc: true,
      createdAt: true,
      ittifakRutbe: true,
      world: { select: { name: true } },
      medeniyet: { select: { key: true } },
      alliance: { select: { name: true, tag: true, leaderLordId: true } },
    },
  });
  if (!l) throw hata.bulunamadi('Lord');

  const [bolgeSayisi, tahtSayisi, engel] = await Promise.all([
    prisma.region.count({ where: { ownerLordId: hedefId } }),
    prisma.region.count({ where: { ownerLordId: hedefId, type: 'taht' } }),
    prisma.lordEngel.findUnique({
      where: { lordId_engellenenId: { lordId: bakanId, engellenenId: hedefId } },
      select: { id: true },
    }),
  ]);

  const m = l.medeniyet ? MEDENIYETLER.find((x) => x.id === l.medeniyet!.key) : undefined;
  const rutbe = l.alliance
    ? l.alliance.leaderLordId === l.id
      ? 'lider'
      : l.ittifakRutbe === 'yasli'
        ? 'yasli'
        : 'uye'
    : null;

  return {
    ...yazarGorunumu(l),
    seviye: l.level,
    sohret: l.fame,
    unvan: unvan(l.fame, tahtSayisi > 0).ad,
    medeniyet: m ? { ad: m.ad, renk: m.renk } : null,
    faydaRutbesi: l.medeniyet ? faydaRutbesi(l.faydaPuani).ad : null,
    ittifak: l.alliance ? { ad: l.alliance.name, etiket: l.alliance.tag, rutbe } : null,
    bolgeSayisi,
    diyar: l.world.name,
    // Gün değil AY: ne zaman katıldığı bir kimlik bilgisi, hangi gün
    // kaydolduğu değil.
    katildi: new Date(l.createdAt.getFullYear(), l.createdAt.getMonth(), 1).toISOString(),
    rakip: l.isNpc,
    benim: hedefId === bakanId,
    engelledin: engel !== null,
  };
}

/* ------------------------------------------------------------------ */
/* Yönetici kararları                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resmi onaylar ve lordun profiline koyar.
 *
 * Profile yalnız lordun EN SON yüklediği resim konuyor: incelemede
 * beklerken bir başkasını yükleyen ya da hazır portre seçen oyuncunun
 * tercihi, geç gelen bir onayla ezilmemeli.
 *
 * `sessiz`: şikâyet "yok sayıldı" diye resim geri geliyorsa oyuncuya
 * bildirim gitmiyor — resmi zaten onaylanmıştı, haberdar bile olmamıştı.
 */
export async function resmiOnayla(
  id: string,
  yoneticiId: string,
  o: { sessiz?: boolean } = {},
): Promise<void> {
  const r = await prisma.profilResmi.findUnique({
    where: { id },
    select: { lordId: true, veri: true },
  });
  if (!r || !r.veri) return;
  await prisma.profilResmi.update({
    where: { id },
    data: { durum: 'onayli', bakanId: yoneticiId, bakildiAn: new Date() },
  });
  const enSon = await prisma.profilResmi.findFirst({
    where: { lordId: r.lordId, veri: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (enSon?.id === id) {
    await prisma.lord.update({ where: { id: r.lordId }, data: { profilResmi: `yuklenen:${id}` } });
  }
  if (!o.sessiz) {
    await pushEvent(r.lordId, 'moderasyon', {
      mesaj: 'Profil resmin onaylandı; artık herkes görüyor.',
    });
  }
}

/**
 * Resmi kaldırır: baytları SİLİNİYOR (uygunsuz bir görüntüyü saklamak
 * onu dağıtmanın bir başka yolu olurdu), satır karar izi olarak kalıyor.
 * Lord o resmi kullanıyorsa armasına dönüyor.
 */
export async function resmiKaldir(id: string, yoneticiId: string): Promise<void> {
  const r = await prisma.profilResmi.findUnique({ where: { id }, select: { lordId: true } });
  if (!r) return;
  await prisma.$transaction([
    prisma.profilResmi.update({
      where: { id },
      data: { durum: 'kaldirildi', veri: null, bakanId: yoneticiId, bakildiAn: new Date() },
    }),
    prisma.lord.updateMany({
      where: { id: r.lordId, profilResmi: `yuklenen:${id}` },
      data: { profilResmi: null },
    }),
  ]);
  await pushEvent(r.lordId, 'moderasyon', {
    mesaj:
      'Profil resmin kurallara uymadığı için kaldırıldı. Uygunsuz içerik tekrarlanırsa hesabın kısıtlanabilir.',
  });
}
