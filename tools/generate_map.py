#!/usr/bin/env python3
"""
Lordlar Cagi - Dunya haritasi ureteci.

Yaricapi 4 olan bir altigen (hex) harita uretir: 1 merkez + 60 bolge = 61 bolge.
  - Merkez (ring 0)      -> TAHT KALESI (dunyada tek, en degerli hedef)
  - Ring 1..4            -> 60 bolge, 6 vilayete (sector) 10'ar bolge

Cikti: data/world-map.json  (SABIT ICERIK - elle degistirilmez, bu script ile uretilir)
Calistirma: python3 tools/generate_map.py
"""
import json, math, os

RADIUS = 4

# Vilayet isimleri (sector 0..5)
PROVINCES = [
    {"key": "kuzeymark", "name": "Kuzeymark"},
    {"key": "demirvadi", "name": "Demirvadi"},
    {"key": "gunbati",   "name": "Günbatı Kıyıları"},
    {"key": "aksu",      "name": "Aksu Ovası"},
    {"key": "karaorman", "name": "Karaorman"},
    {"key": "tasgecit",  "name": "Taşgeçit"},
]

# Her vilayette sabit dagilim: 3 Tarla + 3 Sehir + 2 Maden + 2 Kale = 10
PROVINCE_TYPE_PATTERN = ["tarla", "sehir", "maden", "kale", "tarla",
                         "sehir", "maden", "kale", "tarla", "sehir"]

# Merkeze yaklastikca deger ve NPC garnizonu artar
RING_INCOME_MULT = {0: 3.0, 1: 2.0, 2: 1.5, 3: 1.2, 4: 1.0}
RING_GARRISON = {
    4: {"milis": 25,  "mizrakci": 12,  "okcu": 0,   "suvari": 0,  "kusatma": 0},
    3: {"milis": 80,  "mizrakci": 50,  "okcu": 30,  "suvari": 0,  "kusatma": 0},
    2: {"milis": 0,   "mizrakci": 120, "okcu": 80,  "suvari": 30, "kusatma": 0},
    1: {"milis": 0,   "mizrakci": 200, "okcu": 150, "suvari": 80, "kusatma": 10},
    0: {"milis": 0,   "mizrakci": 400, "okcu": 300, "suvari": 150,"kusatma": 40},
}

# Bolge isim havuzlari (tip bazli, sabit)
NAME_POOL = {
    "tarla": ["Buğday Düzü","Yeşilçayır","Ekinlik","Bereket Ovası","Sapköy","Harmanyeri",
              "Altınbaşak","Çayırbaşı","Tohumluk","Otlakköy","Güneşli Tarla","Bolluk Ovası",
              "Yoncalı","Değirmenderesi","Ambarköy","Başaklı","Çimenyurt","Ekinova"],
    "sehir": ["Akkale Şehri","Tüccarlar Limanı","Gümüşçarşı","Yüksekkapı","Taş Meydan",
              "Kervanbaşı","Altınkapı","Loncalar Şehri","Dörtyol","Çamlıca Şehri",
              "Denizkapı","Büyükpazar","Sarraflar","Hanlar Şehri","Beyazsur","İpekyolu",
              "Tuzköy","Zanaatkârlar"],
    "maden": ["Demirocak","Karakuyu","Bakırdere","Kayaburun","Cürufköy","Derinkuyu",
              "Çakmaktaşı","Kırıkkaya","Kürskuyu","Maden Boğazı","Kızılcevher","Körükbaşı"],
    "kale":  ["Sarpkaya Kalesi","Yıldızburç","Kartalyuva","Sınırkule","Demirkapı Kalesi",
              "Gözcükule","Üçgen Burç","Karahisar","Yüceburç","Sarpsurlar",
              "Geçitbaşı Kalesi","Aslanpençe"],
}


def hex_ring_distance(q, r):
    """Aksiyel hex koordinatinin merkeze uzakligi."""
    return (abs(q) + abs(r) + abs(q + r)) // 2


def sector_of(q, r):
    """Hex'i 6 vilayetten birine atar (merkez etrafinda 60 derecelik dilimler)."""
    # aksiyel -> kartezyen (pointy-top)
    x = math.sqrt(3) * (q + r / 2.0)
    y = 1.5 * r
    ang = math.degrees(math.atan2(y, x)) % 360.0
    return int(ang // 60.0) % 6


def build():
    tiles = []
    for q in range(-RADIUS, RADIUS + 1):
        for r in range(-RADIUS, RADIUS + 1):
            if hex_ring_distance(q, r) <= RADIUS:
                tiles.append((q, r))

    center = [t for t in tiles if hex_ring_distance(*t) == 0]
    outer = [t for t in tiles if hex_ring_distance(*t) > 0]
    assert len(center) == 1 and len(outer) == 60, (len(center), len(outer))

    # Vilayetlere ayir, her vilayet tam 10 bolge olacak sekilde dengele
    buckets = {i: [] for i in range(6)}
    for (q, r) in outer:
        buckets[sector_of(q, r)].append((q, r))
    # Tasanlari eksik vilayetlere kaydir (deterministik: ring, sonra q, sonra r)
    for b in buckets.values():
        b.sort(key=lambda t: (hex_ring_distance(*t), t[0], t[1]))
    fulls = [i for i in range(6) if len(buckets[i]) > 10]
    lacks = [i for i in range(6) if len(buckets[i]) < 10]
    while fulls and lacks:
        f, l = fulls[0], lacks[0]
        buckets[l].append(buckets[f].pop())
        if len(buckets[f]) == 10: fulls.pop(0)
        if len(buckets[l]) == 10: lacks.pop(0)
    for i in range(6):
        assert len(buckets[i]) == 10, (i, len(buckets[i]))
        buckets[i].sort(key=lambda t: (hex_ring_distance(*t), t[0], t[1]))

    name_idx = {k: 0 for k in NAME_POOL}
    regions = []

    # Merkez: Taht Kalesi
    regions.append({
        "id": 1, "name": "Taht Kalesi", "type": "taht", "province": "taht",
        "q": 0, "r": 0, "ring": 0, "level": 1,
        "income_mult": RING_INCOME_MULT[0],
        "npc_garrison": RING_GARRISON[0],
        "unique": True,
    })

    rid = 2
    for s in range(6):
        prov = PROVINCES[s]
        for i, (q, r) in enumerate(buckets[s]):
            rtype = PROVINCE_TYPE_PATTERN[i]
            ring = hex_ring_distance(q, r)
            nm = NAME_POOL[rtype][name_idx[rtype] % len(NAME_POOL[rtype])]
            name_idx[rtype] += 1
            regions.append({
                "id": rid, "name": nm, "type": rtype, "province": prov["key"],
                "q": q, "r": r, "ring": ring, "level": 1,
                "income_mult": RING_INCOME_MULT[ring],
                "npc_garrison": RING_GARRISON[ring],
                "unique": False,
            })
            rid += 1

    out = {
        "schema": "lordlar-cagi/world-map@1",
        "radius": RADIUS,
        "region_count": len(regions),
        "provinces": PROVINCES + [{"key": "taht", "name": "Taht Vilayeti"}],
        "regions": regions,
    }
    return out


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data = build()
    path = os.path.join(root, "data", "world-map.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    from collections import Counter
    c = Counter(r["type"] for r in data["regions"])
    print(f"{data['region_count']} bolge uretildi -> {path}")
    print("Tip dagilimi:", dict(c))
    print("Ring dagilimi:", dict(Counter(r["ring"] for r in data["regions"])))
