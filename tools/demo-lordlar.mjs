/**
 * Test için canlı bir dünya kurar: birkaç rakip lord yaratır, onlara bölge,
 * ordu ve seviye verir, sonra tüm kalkanları kaldırır.
 *
 * Amaç: boş bir haritada sıralama, PvP ve düşman garnizonu denenemez. Bu araç
 * oyunu "ortasından" görmeni sağlar.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır, üretimde bunlar yüklenmez.
 *
 *   pnpm dev            (ayrı terminalde)
 *   pnpm demo
 *
 * Sonra kendi hesabınla kayıt ol; haritada bu lordların bölgelerini görürsün.
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const ADET = Number(process.env.DEMO_ADET ?? 6);

const LORDLAR = [
  { ad: 'Demirhan Bey', xp: 1500, ordu: { mizrakci: 40, okcu: 25 } },
  { ad: 'Yaman Alp', xp: 6000, ordu: { mizrakci: 60, okcu: 40, suvari: 8 } },
  { ad: 'Kılıçarslan', xp: 14000, ordu: { mizrakci: 80, okcu: 55, suvari: 15 } },
  { ad: 'Boran Tigin', xp: 3000, ordu: { mizrakci: 45, okcu: 30 } },
  { ad: 'Sungur Bey', xp: 9000, ordu: { mizrakci: 70, okcu: 45, suvari: 10 } },
  { ad: 'Aybüke Hatun', xp: 20000, ordu: { mizrakci: 90, okcu: 60, suvari: 20 } },
  { ad: 'Turgut Alp', xp: 4500, ordu: { mizrakci: 50, okcu: 35 } },
  { ad: 'Karaca Bey', xp: 11000, ordu: { mizrakci: 75, okcu: 50, suvari: 12 } },
];

const damga = Date.now().toString(36).slice(-4);
let sonToken = null;

async function cagir(yol, token, opts = {}) {
  const res = await fetch(`${API}/api${yol}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const metin = await res.text();
  const govde = metin ? JSON.parse(metin) : null;
  if (!res.ok) throw new Error(`${yol} -> ${res.status}: ${govde?.error ?? metin}`);
  return govde;
}
const post = (yol, token, govde) =>
  cagir(yol, token, { method: 'POST', body: JSON.stringify(govde ?? {}) });

async function lordKur(tanim, sira) {
  const ad = `${tanim.ad}`;
  const { token } = await post('/auth/register', null, {
    email: `demo-${damga}-${sira}@lordlar.dev`,
    password: 'parola1234',
    lordName: ad,
  });
  sonToken = token;

  await post('/test/kaynak-ver', token, { altin: 120000, demir: 60000, erzak: 80000 });
  await post('/test/xp-ver', token, { miktar: tanim.xp });

  // Liderlik'e yatırım yap ki ordu kapasitesi yetsin
  const { lord } = await cagir('/me', token);
  if (lord.statPoints > 0) {
    await post('/me/stats', token, {
      liderlik: Math.floor(lord.statPoints * 0.6),
      guc: Math.ceil(lord.statPoints * 0.4),
    });
  }

  for (const [tip, adet] of Object.entries(tanim.ordu)) {
    await post('/army/train', token, { unitType: tip, count: adet }).catch(() => {});
  }
  await post('/test/kuyruklari-bitir', token);

  // Boş bir bölge kap
  const harita = await cagir('/map', token);
  const hedef = harita.regions
    .filter((r) => !r.owner && r.ring >= 3 && r.type !== 'kale' && r.type !== 'taht')
    .sort((a, b) => a.distance - b.distance)[0];

  let bolge = null;
  if (hedef) {
    const ordu = (await cagir('/army', token)).home;
    // Ordunun yarısıyla saldır, yarısı evde kalsın
    const saldiri = Object.fromEntries(
      Object.entries(ordu).map(([t, n]) => [t, Math.max(1, Math.floor(n * 0.6))]),
    );
    await post('/march', token, { toRegionId: hedef.id, army: saldiri });
    await post('/test/yuruyusleri-bitir', token);
    await post('/test/yuruyusleri-bitir', token); // dönüş yürüyüşü

    const sonrasi = await cagir(`/map/${hedef.id}`, token);
    if (sonrasi.isMine) {
      bolge = sonrasi.name;
      // Sağ kalanların bir kısmını garnizona koy: saldırılınca gerçek savaş olsun
      const ev = (await cagir('/army', token)).home;
      const garnizon = Object.fromEntries(
        Object.entries(ev).map(([t, n]) => [t, Math.floor(n * 0.5)]).filter(([, n]) => n > 0),
      );
      if (Object.keys(garnizon).length) {
        await post(`/map/${hedef.id}/garrison`, token, { army: garnizon }).catch(() => {});
      }
    }
  }

  const son = await cagir('/me', token);
  return { ad, seviye: son.lord.level, sohret: son.lord.fame, bolge };
}

console.log(`Lordlar Çağı — demo dünyası kuruluyor (${ADET} rakip lord)\n`);

const kurulan = [];
for (let i = 0; i < Math.min(ADET, LORDLAR.length); i++) {
  try {
    const r = await lordKur(LORDLAR[i], i);
    kurulan.push(r);
    console.log(
      `  ${r.ad.padEnd(14)} Lv${String(r.seviye).padStart(2)} · şöhret ${String(r.sohret).padStart(6)}` +
        (r.bolge ? ` · ${r.bolge}` : ' · bölgesiz'),
    );
  } catch (e) {
    console.log(`  ${LORDLAR[i].ad}: kurulamadı — ${e.message}`);
  }
}

if (sonToken) {
  const k = await post('/test/kalkanlari-kaldir', sonToken);
  console.log(`\n  ${k.bolgeKalkani} bölge kalkanı ve ${k.lordKalkani} lord kalkanı kaldırıldı.`);
}

console.log(`\n${kurulan.length} rakip lord hazır. Şimdi kendi hesabınla kayıt ol:`);
console.log('  http://localhost:5173\n');
console.log('Denemeye değer: Sıralama sekmesinde rakiplerini gör, Harita\'da');
console.log('noktalı desenli (düşman) bölgelere saldır, Demirhane\'de ekipman üret.');
