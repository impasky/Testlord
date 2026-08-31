/**
 * Test dağıtımı için dünyaya rakip lordlar ekler.
 *
 * tools/demo-lordlar.mjs ile aynı işi yapar ama HTTP ve /api/test/* uçları
 * olmadan, doğrudan veritabanı üzerinden. Bu yüzden ÜRETİMDE de güvenle
 * çalışabilir: dışarıya hiçbir uç açmaz.
 *
 * Amaç: yeni açılan bir dünyada oyuncu tek başınadır — sıralamada tek satır,
 * saldıracak kimse yok, düşman garnizonu denenemez. Bu fonksiyon oyunu
 * "ortasından" görülebilir hale getirir.
 */
import {
  GEAR_LINES,
  UNIT_TYPES,
  WORLD_MAP,
  armySlots,
  calculateFame,
  commandCapacity,
  statPointsForLevelUp,
  xpForLevel,
  type Army,
  type UnitType,
} from '@lordlar/shared';
import { hashPassword } from '../auth.js';
import { prisma } from '../db.js';

interface DemoTanim {
  ad: string;
  seviye: number;
  ordu: Army;
  liderlik: number;
  guc: number;
}

const DEMO: DemoTanim[] = [
  { ad: 'Demirhan Bey', seviye: 5, ordu: { mizrakci: 40, okcu: 25 }, liderlik: 12, guc: 8 },
  { ad: 'Yaman Alp', seviye: 8, ordu: { mizrakci: 60, okcu: 40, suvari: 8 }, liderlik: 20, guc: 12 },
  { ad: 'Kılıçarslan', seviye: 12, ordu: { mizrakci: 80, okcu: 55, suvari: 15 }, liderlik: 30, guc: 18 },
  { ad: 'Boran Tigin', seviye: 6, ordu: { mizrakci: 45, okcu: 30 }, liderlik: 15, guc: 9 },
  { ad: 'Sungur Bey', seviye: 10, ordu: { mizrakci: 70, okcu: 45, suvari: 10 }, liderlik: 25, guc: 15 },
  { ad: 'Aybüke Hatun', seviye: 14, ordu: { mizrakci: 90, okcu: 60, suvari: 20 }, liderlik: 36, guc: 22 },
];

/** Seviyeye kadar biriken toplam XP (kayıtta seviye + kalan tutulur, bu sadece kontrol içindir). */
function toplamXp(seviye: number): number {
  let t = 0;
  for (let n = 1; n < seviye; n++) t += xpForLevel(n);
  return t;
}

/**
 * Dünyada demo lord yoksa ekler. Tekrar çalıştırılabilir: mevcutsa hiçbir şey yapmaz.
 * Dönüş: eklenen lord sayısı.
 */
export async function seedDemoLords(worldId: string): Promise<number> {
  const zaten = await prisma.lord.count({ where: { worldId, name: { in: DEMO.map((d) => d.ad) } } });
  if (zaten > 0) return 0;

  const kenar = WORLD_MAP.regions.filter((r) => r.ring === 4);
  const parola = await hashPassword(`demo-${Math.random().toString(36).slice(2)}`);
  let eklenen = 0;

  for (let i = 0; i < DEMO.length; i++) {
    const d = DEMO[i]!;
    const ev = kenar[(i * 4) % kenar.length]!;

    // Sahipsiz bir bölge bul: eve yakın, kale ve taht dışında
    const bolge = await prisma.region.findFirst({
      where: { worldId, ownerLordId: null, type: { notIn: ['kale', 'taht'] }, ring: { gte: 3 } },
      orderBy: { id: 'asc' },
    });

    const dagitilan = statPointsForLevelUp(1, d.seviye);
    const kalanPuan = Math.max(0, dagitilan - d.liderlik - d.guc);

    const lord = await prisma.lord.create({
      data: {
        user: {
          create: {
            email: `demo-${i}-${Date.now().toString(36)}@lordlar.local`,
            passwordHash: parola,
          },
        },
        world: { connect: { id: worldId } },
        name: d.ad,
        level: d.seviye,
        xp: 0,
        liderlik: 5 + d.liderlik,
        guc: 5 + d.guc,
        dayaniklilik: 5 + Math.floor(kalanPuan / 2),
        kurnazlik: 5 + Math.ceil(kalanPuan / 2),
        statPoints: 0,
        altin: 20000,
        demir: 8000,
        erzak: 15000,
        homeQ: ev.q,
        homeR: ev.r,
        // Demo lordlar saldırılabilir olmalı: yeni oyuncu kalkanı yok
        protectionUntil: null,
        gearLines: { create: GEAR_LINES.map((line) => ({ line, level: 1 })) },
      },
    });

    // Ordunun yarısı evde, yarısı garnizonda
    const kapasite = commandCapacity(5 + d.liderlik);
    const ordu: Army = armySlots(d.ordu) <= kapasite ? d.ordu : { mizrakci: 20, okcu: 10 };

    for (const t of UNIT_TYPES as readonly UnitType[]) {
      const toplam = ordu[t] ?? 0;
      if (toplam <= 0) continue;
      const garnizon = bolge ? Math.floor(toplam * 0.5) : 0;
      const evde = toplam - garnizon;
      if (evde > 0) {
        await prisma.armyUnit.create({
          data: { lordId: lord.id, unitType: t, count: evde, locationType: 'home', locationId: null },
        });
      }
      if (garnizon > 0 && bolge) {
        await prisma.armyUnit.create({
          data: {
            lordId: lord.id,
            unitType: t,
            count: garnizon,
            locationType: 'region',
            locationId: String(bolge.id),
          },
        });
      }
    }

    if (bolge) {
      await prisma.region.update({
        where: { id: bolge.id },
        data: { ownerLordId: lord.id, npcGarrison: {}, shieldUntil: null },
      });
    }

    // Şöhreti gerçek formülle hesapla ki sıralama tutarlı olsun
    const bolgeler = bolge ? [{ type: bolge.type, level: bolge.level }] : [];
    await prisma.lord.update({
      where: { id: lord.id },
      data: {
        fame: calculateFame({
          lordLevel: d.seviye,
          regions: bolgeler,
          totalEquipmentPower: 0,
          army: ordu,
          pvpWins: 0,
          fortressFameAccrued: 0,
          ownsThrone: false,
        }),
      },
    });

    eklenen++;
  }

  console.log(`${eklenen} rakip lord dünyaya eklendi (test dağıtımı).`);
  return eklenen;
}

export { toplamXp };
