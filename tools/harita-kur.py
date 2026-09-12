#!/usr/bin/env python3
"""
Lordlar Cagi - Dunya haritasini SIFIRDAN kurar.

════════════════════════════════════════════════════════════════════════
NEDEN YENIDEN
════════════════════════════════════════════════════════════════════════

Altigen izgara docs/12 §1'de kaldirilmisti ama izi kalmisti: komsuluklar
eski altigen komsuluklarindan TURETILMISTI, yani grafik hala bir kafesti.
Olculdu -- 61 bolgenin 37'sinin tam 6 komsusu, 18'inin tam 4, 6'sinin tam 3
komsusu vardi ve yalniz 24 farkli y degeri vardi. Isaretciler satir satir
diziliydi. Resmedilmis bir diyarin ustunde askeri bir sablon duruyordu.

Mekanik sonucu daha agirdi: HER YER BIRBIRINE BENZIYORDU. Bir gecidi
tutmakla ovanin ortasinda oturmak arasinda fark yoktu, cunku herkesin alti
komsusu vardi. Harita bir karar alani degil, bir listeydi.

════════════════════════════════════════════════════════════════════════
YENI SIRA: once cografya, sonra siyaset, en son koordinat
════════════════════════════════════════════════════════════════════════

1. ARAZI resimden okunur (`harita-arazi.py`). Dag, orman, ova, deniz.

2. BOLGELER araziye serpilir -- izgaraya degil. Mavi-gurultu ornekleme
   (Mitchell'in "en iyi aday" yontemi): her yeni nokta icin bir avuc aday
   atilir ve mevcutlara EN UZAK olan secilir. Sonuc duzensiz ama dengeli
   dagilmis bir serpinti; ne kafes gibi dizili ne de kumelenmis.

   En kucuk aralik ARAZIYE gore degisiyor ve bu bir suslemenin degil
   oynanisin karari: ovada yerlesim sik, dagda seyrek. Dagin az bolgesi
   olmasi, dagi gecmenin az yolu olmasi demek.

3. KOMSULUK Delaunay ucgenlemesinden cikar, sonra BUDANIR:
     - deniz gecen kenar atilir (kara yolu yok),
     - cok uzun kenar atilir (komsu degil, uzaktan bakisan iki yer),
     - DAG gecen kenar atilir -- sonra geri eklenir, ama yalniz EN KISASI.
   Son madde haritanin butun meselesi: dagin arkasi ancak GECITTEN
   gecilerek aliniyor. Gecit sayisi azaldikca o gecidi tutan bolge
   degerleniyor. Kale'ler oraya konuyor.

4. VILAYETLER grafikte buyur, haritada degil: alti tohumdan dengeli
   genisleme. Boylece her vilayet BITISIK bir siyasi blok -- "kuzeyin
   ucte biri" gibi cetvelle cizilmis bir dilim degil.

5. TUR arazi + STRATEJIK ROL ile belirleniyor. Dagda maden, ovada tarla,
   ormanda koy, kiyida ve kavsakta sehir; gecidin agzinda KALE.

6. DENGE mesafeden geliyor ve ESKISININ AYNISI: gelir carpani ve NPC
   garnizonu Taht Kalesi'ne kac adim uzakta oldugunla belirleniyor. Bu
   bilincli -- harita degisti, dengenin omurgasi degismedi. Testler
   (balance.test.ts) tam bunu olcuyor.

TEKRARLANABILIR: tohum sabit (TOHUM), yani ayni girdi ayni haritayi verir.
Zemin resmi degisirse harita da degisir ve degismesi gerekir.

KULLANIM:
  python3 tools/harita-kur.py                 # kur, dogrula, YAZMA
  python3 tools/harita-kur.py --yaz           # data/world-map.json'a yaz
  python3 tools/harita-kur.py --onizleme x.png
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict, deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

_arazi_mod = import_module("harita-arazi")
arazi_oku = _arazi_mod.arazi_oku
DENIZ, OVA, ORMAN, DAG = _arazi_mod.DENIZ, _arazi_mod.OVA, _arazi_mod.ORMAN, _arazi_mod.DAG
ARAZI_ADI = _arazi_mod.ARAZI_ADI

KOK = Path(__file__).resolve().parent.parent
HEDEF = KOK / "data" / "world-map.json"

TOHUM = 20260911
BOLGE_SAYISI = 121

# --- Serpinti ---------------------------------------------------------
# Arazi basina EN KUCUK ARALIK (yuzde). Ovada sik, dagda seyrek.
ARALIK = {OVA: 6.1, ORMAN: 6.8, DAG: 7.9}
ADAY = 60          # her nokta icin atilan aday sayisi (Mitchell)
KENAR_PAY = 6.5    # haritanin kenarina bu kadar yaklasilmaz (yuzde)
KARA_ORANI = 0.72  # isaretcinin altindaki alanin bu kadari kara olmali
ISARET_YARICAP = 6 # isaretcinin zeminde kapladigi yaricap (piksel)

# --- Komsuluk ---------------------------------------------------------
EN_UZUN_KENAR = 12.0   # bundan uzunu komsuluk degil
DENIZ_PAYI = 0.22      # kenarin bu kadari denizse kara yolu yok
DAG_PAYI = 0.34        # kenarin bu kadari dagsa bu bir GECIT
ORNEK = 24             # kenar uzerinde kac nokta orneklenir
UZUN_KENAR_KATI = 1.6  # yerel ortancanin bu katindan uzun kenar budanir
EN_AZ_KOMSU = 2        # cikmaz sokak olmasin: tek komsulu bolge birakilmiyor
# Onarim turlarinin geri alabilecegi EN UZUN kenar. Sinirsiz birakildiginda
# haritanin bir ucundan obur ucuna 58 birimlik bir cizgi cekildi: iki bolge
# "komsu" oluyor ama aralarinda dort bolge duruyor. Komsuluk bitisiklik
# demek; uzaktan bakisan iki yer komsu degildir.
EN_UZUN_ONARIM = 15.5
EN_COK_CAP = 15        # haritanin capi; buyudukce yuruyus sureleri gerilir
# Cap 15 bir hesaptan cikiyor: yuruyus suresi adim basina 12 dakika
# (`balance.json` yuruyus.dakika_adim_basina) ve tavan 360 dakika. 15 adim
# = 180 dakika, yani en uzak kose uc saat. Tavanin yarisi; buyuk dunya
# uzak demek ama ulasilmaz demek degil.

# --- Vilayetler -------------------------------------------------------
VILAYETLER = ["kuzeymark", "demirvadi", "gunbati", "aksu", "karaorman", "tasgecit"]
VILAYET_ADI = {
    "kuzeymark": "Kuzeymark",
    "demirvadi": "Demirvadi",
    "gunbati": "Günbatı Kıyıları",
    "aksu": "Aksu Ovası",
    "karaorman": "Karaorman",
    "tasgecit": "Taşgeçit",
    "taht": "Taht Vilayeti",
}

# --- Tur dagilimi -----------------------------------------------------
# Sayilar ESKI HARITANIN AYNISI. Tur dagilimi dengeye giriyor (gelir,
# tahkimat, ilk fetih zorlugu); haritanin sekli degisirken ekonominin
# agirligi degismemeli.
TUR_HEDEFI = {"tarla": 32, "sehir": 28, "koy": 24, "maden": 22, "kale": 14}

# --- Denge: her sey TAHT'A UZAKLIKTAN ---------------------------------
GELIR_CARPANI = {0: 3.0, 1: 2.0, 2: 1.5, 3: 1.2}
GELIR_TABAN = 1.0
# Merkeze yakin halkalarin garnizonu (tur fark etmez: oralari zaten geç
# oyunun hedefi). Eski haritadan birebir alindi.
HALKA_GARNIZONU = {
    0: {"milis": 0, "mizrakci": 400, "okcu": 300, "suvari": 150, "kusatma": 40},
    1: {"milis": 0, "mizrakci": 200, "okcu": 150, "suvari": 70, "kusatma": 20},
    2: {"milis": 0, "mizrakci": 105, "okcu": 80, "suvari": 35, "kusatma": 10},
    3: {"milis": 0, "mizrakci": 75, "okcu": 55, "suvari": 25, "kusatma": 5},
}
# Dis halka TURE gore, cunku orasi ilk fethin yeri ve zorluk farki orada
# okunmali. Eski haritadan birebir.
DIS_GARNIZON = {
    "koy": {"milis": 12, "mizrakci": 4, "okcu": 0, "suvari": 0, "kusatma": 0},
    "tarla": {"milis": 14, "mizrakci": 8, "okcu": 6, "suvari": 0, "kusatma": 0},
    "maden": {"milis": 12, "mizrakci": 10, "okcu": 8, "suvari": 0, "kusatma": 0},
    "sehir": {"milis": 10, "mizrakci": 12, "okcu": 10, "suvari": 2, "kusatma": 0},
    "kale": {"milis": 8, "mizrakci": 14, "okcu": 12, "suvari": 3, "kusatma": 0},
}

# --- Adlar ------------------------------------------------------------
# Ad ARAZIYE ve TURE uyuyor: dagdaki bolge "Gölcük Koyu" olmamali. Havuzlar
# gerekenden genis; secim tohumlu, yani her calistirmada ayni.
ADLAR = {
    "maden": [
        "Demirtaş", "Karakaya", "Gümüşoluk", "Bakırtepe", "Çeliktaş", "Kurşunlu",
        "Taşocağı", "Demirocak", "Çakmaktaş", "Madenkuyu", "Kırıkkaya", "Közlüce",
        "Sarpkaya", "Karataş", "Tuncbeli", "Gümüşdere", "Bakırdağ", "Kömürlük",
        "Yalçınkaya", "Cevherli", "Demirbel", "Kayaardı", "Örensivri", "Taşbaşı",
        "Ocaklı", "Çakılkaya", "Mermerli", "Kavlaktaş",
    ],
    "koy": [
        "Çamlıbel", "Meşelik", "Kızılçam", "Ardıçlı", "Gürgenli", "Kavaklı",
        "Söğütlü", "Fındıklı", "Palamutlu", "Karaağaç", "Çınaraltı", "Kestanelik",
        "Yabanardıç", "Dutluca", "Pelitli", "Kayınlık", "Ihlamurlu", "Alıçlı",
        "Böğürtlen", "Kuşburnu", "Sarıçam", "Akçakavak", "Eğrigürgen", "Yaşlımeşe",
        "Çakmaklı", "Tozlukoru", "Kurtboğan", "Gökçepelit", "Yaylakonak", "Sazlıdere",
    ],
    "tarla": [
        "Buğdayova", "Yoncalı", "Altınbaşak", "Ekinlik", "Harmanlı", "Başakçayır",
        "Arpalık", "Sarıova", "Bereketli", "Çayırbaşı", "Darıova", "Tarlabaşı",
        "Gökçeova", "Ballıova", "Akçaova", "Üzümlü", "Susamlık", "Otluca",
        "Bostanlı", "Nadaslı", "Sapçayır", "Buğdaylı", "Çeltikli", "Mercimekli",
        "Nohutlu", "Pancarlı", "Ekinbaşı", "Samanlık", "Taneli", "Kekikova",
        "Sütlüce", "Yemlik", "Kuyulukır", "Beyazbaşak", "Bolluova", "Verimli",
    ],
    "sehir": [
        "Akpazar", "Kervanbaşı", "Çarşıkent", "Handibi", "Bezirgan", "Altınçarşı",
        "Gümüşliman", "Tuzlaburnu", "Denizkapı", "Mercanlı", "Yelkenli", "Körfezkent",
        "Fenerbaşı", "Balıkçıburnu", "Tuzpazarı", "Gemlik", "Kalafatlı", "Demirliman",
        "Sarıkervan", "Dörtyol", "Köprübaşı", "Kantarcı", "Tezgâhlı", "Boyacılar",
        "Urganlı", "Halıcılar", "Bakırcılar", "Tellallar", "Konaklı", "Menzilhan",
        "İskelebaşı", "Sarraflar", "Camlıçarşı", "Kösedağıtı",
    ],
    "kale": [
        "Demirkapı", "Sarpgeçit", "Kartalyuva", "Boğazkale", "Gedikkale",
        "Zindankapı", "Şahinkaya", "Dikmen Kalesi", "Sıradağ Kalesi", "Yalçınkapı",
        "Kuzgunkaya", "Bekçitepe", "Gözcükule", "Sarphisar", "Dörtburç",
        "Çelikkapı", "Aslanyatağı", "Karakule",
    ],
}


# ══════════════════════════════════════════════════════════════════════
# 1. SERPINTI
# ══════════════════════════════════════════════════════════════════════
def uygun_mu(x, y, arazi, kara):
    """Isaretci buraya oturur mu: karada, kenardan uzakta, cevresi de kara."""
    import numpy as np

    if not (KENAR_PAY <= x <= 100 - KENAR_PAY and KENAR_PAY <= y <= 100 - KENAR_PAY):
        return None
    boy = kara.shape[0]
    px, py = int(x / 100 * boy), int(y / 100 * boy)
    r = ISARET_YARICAP
    pencere = kara[max(0, py - r) : py + r + 1, max(0, px - r) : px + r + 1]
    if pencere.size == 0 or pencere.mean() < KARA_ORANI:
        return None
    # Arazi turu tek pikselden degil kucuk bir pencereden: tek bir firca
    # darbesi bolgenin karakterini belirlememeli.
    ap = arazi[max(0, py - 8) : py + 9, max(0, px - 8) : px + 9]
    sayim = Counter(ap[ap > 0].ravel().tolist())
    if not sayim:
        return None
    return int(sayim.most_common(1)[0][0])


def serpinti(arazi, kara, rastgele):
    """
    Mavi gurultu: her nokta icin ADAY kadar aday at, mevcutlara en uzak
    olani sec. Izgaranin duzenliligi de kumelenmenin cirkinligi de yok.

    Taht ONCE konuyor ve merkeze en yakin uygun ovaya: oyunun ucu
    haritanin ortasinda durmali, rastgele bir yerde degil.
    """
    noktalar = []
    en_iyi, en_iyi_d = None, 1e9
    for adim in range(0, 2000):
        # Merkezden disariya spiral tarama: ilk bulunan zaten en yakini.
        ac = adim * 0.618 * 2 * math.pi
        yc = math.sqrt(adim) * 1.1
        x, y = 50 + yc * math.cos(ac), 50 + yc * math.sin(ac)
        t = uygun_mu(x, y, arazi, kara)
        if t is None or t == DAG:
            continue
        d = (x - 50) ** 2 + (y - 50) ** 2
        if d < en_iyi_d:
            en_iyi, en_iyi_d = (x, y, t), d
        if d < 4:
            break
    noktalar.append(en_iyi)

    while len(noktalar) < BOLGE_SAYISI:
        secilen, secilen_puan = None, -1.0
        for _ in range(ADAY):
            x = rastgele.uniform(KENAR_PAY, 100 - KENAR_PAY)
            y = rastgele.uniform(KENAR_PAY, 100 - KENAR_PAY)
            t = uygun_mu(x, y, arazi, kara)
            if t is None:
                continue
            en_yakin = min(math.dist((x, y), (p[0], p[1])) for p in noktalar)
            if en_yakin < ARALIK[t]:
                continue
            if en_yakin > secilen_puan:
                secilen, secilen_puan = (x, y, t), en_yakin
        if secilen is None:
            # Aralik biraz genis kalmis: hepsini kis ve devam et. Sabit bir
            # sayi (61) hedefliyoruz, gevsemeden duramayiz.
            for k in ARALIK:
                ARALIK[k] *= 0.94
            continue
        noktalar.append(secilen)
    return noktalar


# ══════════════════════════════════════════════════════════════════════
# 2. KOMSULUK
# ══════════════════════════════════════════════════════════════════════
def kenar_profili(a, b, arazi, kara):
    """Kenarin uzerinde deniz ve dag oranlari."""
    boy = kara.shape[0]
    deniz = dag = 0
    for i in range(1, ORNEK):
        t = i / ORNEK
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t
        px, py = int(x / 100 * boy), int(y / 100 * boy)
        px = min(max(px, 0), boy - 1)
        py = min(max(py, 0), boy - 1)
        if not kara[py, px]:
            deniz += 1
        elif arazi[py, px] == DAG:
            dag += 1
    return deniz / (ORNEK - 1), dag / (ORNEK - 1)


def komsuluk_kur(noktalar, arazi, kara):
    """
    Delaunay -> budama -> gecitleri geri ekleme.

    Dondurur: (kenarlar, gecitler). Ikisi de (i, j) ciftleri kumesi;
    gecitler kenarlarin alt kumesi.
    """
    import numpy as np
    from scipy.spatial import Delaunay

    P = np.array([[p[0], p[1]] for p in noktalar])
    ucgen = Delaunay(P)
    ham = set()
    for s in ucgen.simplices:
        for i in range(3):
            a, b = int(s[i]), int(s[(i + 1) % 3])
            ham.add((min(a, b), max(a, b)))

    uzunluk = {e: float(np.linalg.norm(P[e[0]] - P[e[1]])) for e in ham}
    # Yerel olcut: her dugumun kendi kenarlarinin ortancasi. Sabit bir esik
    # kullanmak dagin seyrek bolgesindeki dogru komsuluklari da keserdi.
    yerel = defaultdict(list)
    for (a, b), u in uzunluk.items():
        yerel[a].append(u)
        yerel[b].append(u)
    ortanca = {d: float(np.median(v)) for d, v in yerel.items()}

    kolay, gecit_adayi, atilan, deniz_adayi = set(), {}, {}, {}
    for e, u in uzunluk.items():
        a, b = e
        d_oran, dag_oran = kenar_profili(noktalar[a], noktalar[b], arazi, kara)
        if d_oran > DENIZ_PAYI:
            # Kara yolu yok. Yine de saklaniyor: cikmaz sokagi onarmanin
            # son caresi bir BOGAZ GECISI olabiliyor -- kiyi seridinde
            # dagin da denizin de kapattigi noktalar var ve oralarda
            # sandal, hicbir yolu olmayan bir bolgeden iyidir.
            if u <= EN_UZUN_ONARIM:
                deniz_adayi[e] = u
            continue
        if u > EN_UZUN_KENAR or u > UZUN_KENAR_KATI * (ortanca[a] + ortanca[b]) / 2:
            # Budandi ama SILINMEDI: asagidaki onarim turlari buradan geri
            # alabiliyor. Silseydik cikmaz sokagi ve uzayan capi duzeltmenin
            # tek yolu esikleri gevsetmek olurdu ve o da butun haritayi
            # yeniden kafese cevirirdi.
            atilan[e] = (u, dag_oran > DAG_PAYI)
            continue
        if dag_oran > DAG_PAYI:
            gecit_adayi[e] = u  # dag asiyor: ancak gecitse gecilir
            continue
        kolay.add(e)

    # Dagin arkasi ancak GECITTEN aliniyor: kopuk bilesenler arasina yalniz
    # EN KISA gecitler ekleniyor. Cok eklemek dagi yok sayardi, hic eklememek
    # haritayi ikiye bolerdi.
    kenarlar = set(kolay)
    gecitler = set()
    for e in sorted(gecit_adayi, key=gecit_adayi.get):
        a, b = e
        if _ayni_kumede(kenarlar, len(noktalar), a, b):
            continue
        kenarlar.add(e)
        gecitler.add(e)

    # Hala kopuksa (deniz ayirmis): en kisa deniz yolunu ac.
    while True:
        kumeler = _kumeler(kenarlar, len(noktalar))
        if len(kumeler) == 1:
            break
        kumeler.sort(key=len)
        kucuk = kumeler[0]
        obur = {d for k in kumeler[1:] for d in k}
        en_iyi = min(
            ((a, b) for a in kucuk for b in obur),
            key=lambda ab: float(np.linalg.norm(P[ab[0]] - P[ab[1]])),
        )
        e = (min(en_iyi), max(en_iyi))
        kenarlar.add(e)
        gecitler.add(e)

    _cikmazi_onar(kenarlar, gecitler, atilan, gecit_adayi, deniz_adayi, len(noktalar))
    _capi_kis(kenarlar, gecitler, atilan, gecit_adayi, len(noktalar))
    return kenarlar, gecitler


def _derece(kenarlar, n):
    d = {i: 0 for i in range(n)}
    for a, b in kenarlar:
        d[a] += 1
        d[b] += 1
    return d


def _cikmazi_onar(kenarlar, gecitler, atilan, gecit_adayi, deniz_adayi, n):
    """
    Tek komsulu bolge birakma.

    Cikmaz sokak nadiren iyi bir seydir -- oraya giden tek yol varsa o
    bolge ne savunulur ne de saldirilir, sadece unutulur. Budanmis
    kenarlardan EN KISASI geri aliniyor; dag asiyorsa gecit sayiliyor.
    """
    # Sira ONEMLI: once kara yolu, sonra gecit, en son bogaz gecisi. Sozluk
    # birlesimi sagdan solu eziyor, o yuzden ters sirada yaziliyor.
    havuz = {**{e: (u, True) for e, u in deniz_adayi.items()},
             **{e: (u, True) for e, u in gecit_adayi.items() if e not in kenarlar},
             **{e: (u, dag) for e, (u, dag) in atilan.items() if u <= EN_UZUN_ONARIM}}
    for _ in range(n * 2):
        derece = _derece(kenarlar, n)
        eksik = [i for i, d in derece.items() if d < EN_AZ_KOMSU]
        if not eksik:
            return
        i = eksik[0]
        adaylar = [(u, e, dag) for e, (u, dag) in havuz.items()
                   if (i in e) and e not in kenarlar]
        if not adaylar:
            return
        _u, e, dag = min(adaylar)
        kenarlar.add(e)
        if dag:
            gecitler.add(e)


def _capi_kis(kenarlar, gecitler, atilan, gecit_adayi, n):
    """
    Haritanin capini EN_COK_CAP'in altina indirir.

    Cap yalniz bir estetik olcu degil: `EN_UZAK_MESAFE` yuruyus surelerini
    olcekliyor (harita.ts). Cap 15'e ciktiginda haritanin bir ucundan
    obur ucuna gitmek eski haritanin iki katini aliyordu. Kisaltma
    KISAYOL ekleyerek yapiliyor: budanmis kenarlardan, iki ucu birbirinden
    en uzak olani. Boylece kafes geri gelmiyor, yalniz diyar dolasilabilir
    kaliyor.
    """
    havuz = {**{e: (u, dag) for e, (u, dag) in atilan.items() if u <= EN_UZUN_ONARIM},
             **{e: (u, True) for e, u in gecit_adayi.items()}}
    for _ in range(60):
        mesafe = _mesafeler(kenarlar, n)
        cap = max(max(s.values()) for s in mesafe.values())
        if cap <= EN_COK_CAP:
            return
        adaylar = [
            (-mesafe[e[0]].get(e[1], 99), u, e, dag)
            for e, (u, dag) in havuz.items()
            if e not in kenarlar and mesafe[e[0]].get(e[1], 99) >= 3
        ]
        if not adaylar:
            return
        _k, _u, e, dag = min(adaylar)
        kenarlar.add(e)
        if dag:
            gecitler.add(e)


def _mesafeler(kenarlar, n):
    komsu = defaultdict(set)
    for a, b in kenarlar:
        komsu[a].add(b)
        komsu[b].add(a)
    tablo = {}
    for s in range(n):
        d = {s: 0}
        q = deque([s])
        while q:
            u = q.popleft()
            for v in komsu[u]:
                if v not in d:
                    d[v] = d[u] + 1
                    q.append(v)
        tablo[s] = d
    return tablo


def _kumeler(kenarlar, n):
    komsu = defaultdict(set)
    for a, b in kenarlar:
        komsu[a].add(b)
        komsu[b].add(a)
    gorulen, sonuc = set(), []
    for s in range(n):
        if s in gorulen:
            continue
        k, q = {s}, deque([s])
        gorulen.add(s)
        while q:
            u = q.popleft()
            for v in komsu[u]:
                if v not in gorulen:
                    gorulen.add(v)
                    k.add(v)
                    q.append(v)
        sonuc.append(k)
    return sonuc


def _ayni_kumede(kenarlar, n, a, b):
    for k in _kumeler(kenarlar, n):
        if a in k:
            return b in k
    return False


# ══════════════════════════════════════════════════════════════════════
# 3. VILAYETLER
# ══════════════════════════════════════════════════════════════════════
def vilayetleri_boya(noktalar, komsu, taht):
    """
    Alti tohumdan DENGELI genisleme. Vilayet grafikte buyuyor, haritada
    degil: sonuc bitisik bir siyasi blok, cetvelle cizilmis bir dilim degil.

    Tohumlar birbirine en uzak alti bolge (uzak-nokta ornekleme): boylece
    hicbir vilayet bir digerinin icinden dogmuyor.
    """
    n = len(noktalar)
    aday = [i for i in range(n) if i != taht]
    tohumlar = [max(aday, key=lambda i: math.dist(noktalar[i][:2], noktalar[taht][:2]))]
    while len(tohumlar) < len(VILAYETLER):
        tohumlar.append(
            max(
                (i for i in aday if i not in tohumlar),
                key=lambda i: min(math.dist(noktalar[i][:2], noktalar[t][:2]) for t in tohumlar),
            )
        )

    sahip = {taht: "taht"}
    cepheler = {v: deque([t]) for v, t in zip(VILAYETLER, tohumlar)}
    for v, t in zip(VILAYETLER, tohumlar):
        sahip[t] = v
    # Sirayla bir adim: buyuk vilayet kucugu yutmuyor.
    ilerledi = True
    while ilerledi:
        ilerledi = False
        for v in VILAYETLER:
            c = cepheler[v]
            while c:
                u = c.popleft()
                yeni = [k for k in komsu[u] if k not in sahip]
                if not yeni:
                    continue
                for k in yeni:
                    sahip[k] = v
                    c.append(k)
                ilerledi = True
                break
    # Taht komsularina komsuluk yoluyla ulasilamayan kaldiysa (olmamali)
    for i in range(n):
        sahip.setdefault(i, VILAYETLER[0])
    return sahip


def vilayet_adlari(sahip, noktalar, gecit_sayaci):
    """
    Vilayet ANAHTARLARINI karakterlerine gore dagitir.

    Adlar zaten arayuzde (`DunyaHaritasi.tsx` VILAYET_ADI) ve anlamlilar:
    Demirvadi maden, Karaorman orman, Aksu ovasi demek. Eskiden bu adlar
    rastgele dilimlere yapistirilmisti; simdi bolgenin gercekten oyle olani
    o adi aliyor.
    """
    ozellik = {}
    for v in VILAYETLER:
        uyeler = [i for i, s in sahip.items() if s == v]
        if not uyeler:
            ozellik[v] = (0, 0, 0, 0, 0)
            continue
        arz = Counter(noktalar[i][2] for i in uyeler)
        ozellik[v] = (
            arz[DAG] / len(uyeler),
            arz[ORMAN] / len(uyeler),
            arz[OVA] / len(uyeler),
            sum(noktalar[i][1] for i in uyeler) / len(uyeler),  # ortalama y (kuzey = kucuk)
            sum(noktalar[i][0] for i in uyeler) / len(uyeler),  # ortalama x (bati = kucuk)
        )
    # Her ada bir puan islevi; en yuksek puanli vilayet o adi alir.
    puan = {
        "demirvadi": lambda o: o[0] * 3,                 # en dagli
        "karaorman": lambda o: o[1] * 3,                 # en ormanli
        "aksu": lambda o: o[2] * 3,                      # en ovali
        "kuzeymark": lambda o: (100 - o[3]) / 100 * 2,   # en kuzey
        "gunbati": lambda o: (100 - o[4]) / 100 * 2,     # en bati
        "tasgecit": lambda o: o[0] * 2 + o[1],           # dagli-ormanli, gecit yurdu
    }
    atanan, kalan = {}, set(VILAYETLER)
    for ad in ["demirvadi", "karaorman", "aksu", "gunbati", "kuzeymark", "tasgecit"]:
        v = max(kalan, key=lambda k: puan[ad](ozellik[k]))
        atanan[v] = ad
        kalan.discard(v)
    return atanan


# ══════════════════════════════════════════════════════════════════════
# 4. TURLER
# ══════════════════════════════════════════════════════════════════════
def turleri_ata(noktalar, komsu, gecit_dugumleri, kiyi, taht, uzaklik, rastgele):
    """
    Tur = arazi + STRATEJIK ROL. Sayilar TUR_HEDEFI'ne birebir oturuyor.

    Yontem acgozlu ama sirasi onemli: once KALE'ler (gecit agzi az ve
    yerleri belli), sonra MADEN (dag), sonra SEHIR (kiyi ve kavsak), sonra
    TARLA (ova), kalan KOY.

    KOY yalniz SINIR BANDINDA (taht'a 4+ adim). Bu bir tasarim kurali, suslu
    bir tercih degil: koy ilk fethin yeri ve garnizonu buna gore zayif. Ilk
    surumde tur ataması mesafeyi hic bilmiyordu, bir koy 3. halkaya dustu ve
    o halkanin 160 kisilik garnizonunu aldi -- yani "en zayif bolge" oyunun
    en sert kapilarindan biri oldu. Denge testi bunu ayni gun yakaladi.
    """
    n = len(noktalar)
    kalan = [i for i in range(n) if i != taht]
    tur = {taht: "taht"}
    kalanlar = set(kalan)

    def al(ad, sayi, anahtar):
        secilen = sorted(kalanlar, key=anahtar, reverse=True)[:sayi]
        for i in secilen:
            tur[i] = ad
            kalanlar.discard(i)

    # KALE: gecidi tutan. Gecit dugumu olmak bas sart; esitlik bozulurken
    # az komsulu olan kazaniyor (dar bogaz daha degerli).
    al(
        "kale",
        TUR_HEDEFI["kale"],
        lambda i: (gecit_dugumleri.get(i, 0) * 10 - len(komsu[i]) + rastgele.random()),
    )
    # KOY once ve YALNIZ SINIR BANDINDAN. Sirayi bu belirliyor: koy "artan"
    # olsaydi ic halkaya dusebilirdi ve orada 160 kisilik halka garnizonunu
    # alirdi -- oyunun en zayif bolgesi en sert kapilarindan biri olurdu.
    # Ilk surumde tam bu oldu ve denge testi ayni gun yakaladi.
    #
    # Koyun yeri de bos degil: ormanda, kiyidan uzakta, az komsulu. Yani
    # ovanin verimli ortasi degil, diyarin sapa kosesi.
    al(
        "koy",
        TUR_HEDEFI["koy"],
        lambda i: (
            -99 if uzaklik.get(i, 9) < 4 else
            (1.5 if noktalar[i][2] == ORMAN else 0)
            + (0.8 if not kiyi[i] else 0)
            + max(0, 4 - len(komsu[i])) * 0.4
            + uzaklik.get(i, 9) * 0.35
            + rastgele.random() * 0.5
        ),
    )
    # MADEN: dagda. Dag bolgesi yetmezse ormanin tasliklarina tasar.
    al(
        "maden",
        TUR_HEDEFI["maden"],
        lambda i: ((2 if noktalar[i][2] == DAG else 0) + (1 if noktalar[i][2] == ORMAN else 0)
                   + rastgele.random()),
    )
    # SEHIR: kiyida (liman) ya da kavsakta (cok komsulu).
    al(
        "sehir",
        TUR_HEDEFI["sehir"],
        lambda i: ((1.6 if kiyi[i] else 0) + len(komsu[i]) * 0.25 + rastgele.random() * 0.6),
    )
    # TARLA: kalan her yer. Ova zaten en genis arazi, dolayisiyla artan da
    # buraya dusuyor -- ve tarla oyunun ilk hedefi oldugu icin sinir bandinda
    # da bulunmasi gerekiyor.
    for i in sorted(kalanlar):
        tur[i] = "tarla"
    return tur


# ══════════════════════════════════════════════════════════════════════
# 5. KURULUM
# ══════════════════════════════════════════════════════════════════════
def kur():
    import random

    import numpy as np

    rastgele = random.Random(TOHUM)
    arazi, kara = arazi_oku()
    noktalar = serpinti(arazi, kara, rastgele)
    kenarlar, gecitler = komsuluk_kur(noktalar, arazi, kara)

    komsu = defaultdict(set)
    for a, b in kenarlar:
        komsu[a].add(b)
        komsu[b].add(a)

    taht = 0  # serpinti tahti ilk koyuyor
    # Kiyi: isaretcinin yakininda deniz var mi.
    from scipy import ndimage

    kiyi_uzak = ndimage.distance_transform_edt(kara)
    boy = kara.shape[0]
    kiyi = {}
    for i, (x, y, _t) in enumerate(noktalar):
        px, py = int(x / 100 * boy), int(y / 100 * boy)
        kiyi[i] = bool(kiyi_uzak[py, px] < 55)

    gecit_dugumleri = Counter()
    for a, b in gecitler:
        gecit_dugumleri[a] += 1
        gecit_dugumleri[b] += 1

    # Taht'a uzaklik: dengenin omurgasi. Tur atamasi da bunu okuyor, o yuzden
    # ONCE hesaplaniyor.
    uzaklik = {taht: 0}
    q = deque([taht])
    while q:
        u = q.popleft()
        for v in komsu[u]:
            if v not in uzaklik:
                uzaklik[v] = uzaklik[u] + 1
                q.append(v)

    tur = turleri_ata(noktalar, komsu, gecit_dugumleri, kiyi, taht, uzaklik, rastgele)
    sahip = vilayetleri_boya(noktalar, komsu, taht)
    vilayet_anahtari = vilayet_adlari(sahip, noktalar, gecit_dugumleri)

    # Adlar: turden havuz, tohumlu secim, tekrar yok.
    havuz = {k: list(v) for k, v in ADLAR.items()}
    for v in havuz.values():
        rastgele.shuffle(v)
    adlar = {taht: "Taht Kalesi"}
    for i in sorted(range(len(noktalar))):
        if i == taht:
            continue
        h = havuz[tur[i]]
        ad = h.pop()
        # "Koy" turu adin kendisinde de duyulsun: oyuncu listede turu
        # okumadan da anlasin.
        adlar[i] = f"{ad} Köyü" if tur[i] == "koy" and not ad.endswith("Köyü") else ad

    bolgeler = []
    for i, (x, y, a) in enumerate(noktalar):
        d = uzaklik[i]
        bolgeler.append(
            {
                "id": i + 1,
                "name": adlar[i],
                "type": tur[i],
                "arazi": ARAZI_ADI[a],
                "kiyi": kiyi[i],
                "province": "taht" if i == taht else vilayet_anahtari[sahip[i]],
                "x": round(x, 2),
                "y": round(y, 2),
                "komsular": sorted(k + 1 for k in komsu[i]),
                "level": 1,
                "income_mult": GELIR_CARPANI.get(d, GELIR_TABAN),
                "npc_garrison": dict(HALKA_GARNIZONU[d] if d in HALKA_GARNIZONU else DIS_GARNIZON[tur[i]]),
                "unique": i == taht,
            }
        )
    gecit_listesi = sorted((min(a, b) + 1, max(a, b) + 1) for a, b in gecitler)
    # Uzaklik disariya KIMLIKLE veriliyor: iceride dizin, disarida id.
    return bolgeler, gecit_listesi, {i + 1: d for i, d in uzaklik.items()}, noktalar


# ══════════════════════════════════════════════════════════════════════
# 6. DOGRULAMA
# ══════════════════════════════════════════════════════════════════════
def dogrula(bolgeler, gecitler, uzaklik):
    hata = []
    R = {b["id"]: b for b in bolgeler}
    if len(bolgeler) != BOLGE_SAYISI:
        hata.append(f"bolge sayisi {len(bolgeler)}, {BOLGE_SAYISI} olmali")
    if sum(1 for b in bolgeler if b["type"] == "taht") != 1:
        hata.append("Taht Kalesi tam 1 olmali")
    if len({b["name"] for b in bolgeler}) != len(bolgeler):
        hata.append("tekrar eden bolge adi var")
    for b in bolgeler:
        for k in b["komsular"]:
            if k not in R:
                hata.append(f"{b['name']}: olmayan komsu {k}")
            elif b["id"] not in R[k]["komsular"]:
                hata.append(f"{b['name']} -> {R[k]['name']} tek yonlu")
        if not b["komsular"]:
            hata.append(f"{b['name']}: komsusuz")
    if len(uzaklik) != len(bolgeler):
        hata.append(f"harita kopuk: {len(uzaklik)}/{len(bolgeler)} bolgeye ulasiliyor")
    # Denge testlerinin bagli oldugu halkalar
    halkalar = Counter(uzaklik.values())
    for h in (1, 2, 3, 4):
        if halkalar.get(h, 0) == 0:
            hata.append(f"taht'a {h} adim uzakta bolge yok (balance.test.ts bunu ariyor)")
    dis = [b for b in bolgeler if uzaklik[b["id"]] == 4 and b["type"] != "koy"]
    if not dis:
        hata.append("4 adim uzakta koy olmayan bolge yok (KENAR_NPC)")
    ickoy = [b["name"] for b in bolgeler if b["type"] == "koy" and uzaklik[b["id"]] < 4]
    if ickoy:
        hata.append(f"koy ic halkada: {', '.join(ickoy)} (koy sinir bandinda olmali)")
    # Tur dagilimi
    sayim = Counter(b["type"] for b in bolgeler)
    for t, n in TUR_HEDEFI.items():
        if sayim[t] != n:
            hata.append(f"{t}: {sayim[t]} adet, {n} olmali")
    for g in gecitler:
        if g[1] not in R[g[0]]["komsular"]:
            hata.append(f"gecit {g} komsuluk listesinde yok")
    return hata


def rapor(bolgeler, gecitler, uzaklik, noktalar):
    derece = Counter(len(b["komsular"]) for b in bolgeler)
    print(f"bolge: {len(bolgeler)}   gecit: {len(gecitler)}")
    print("derece dagilimi:", dict(sorted(derece.items())))
    print("halkalar:", dict(sorted(Counter(uzaklik.values()).items())))
    print("cap:", max(_cap(bolgeler)))
    print("turler:", dict(Counter(b["type"] for b in bolgeler)))
    print("arazi:", dict(Counter(b["arazi"] for b in bolgeler)))
    print("vilayet:", dict(Counter(b["province"] for b in bolgeler)))
    print("farkli x:", len({b["x"] for b in bolgeler}), " farkli y:", len({b["y"] for b in bolgeler}))
    kale = [b["name"] for b in bolgeler if b["type"] == "kale"]
    print("kaleler:", ", ".join(kale))


def _cap(bolgeler):
    R = {b["id"]: b["komsular"] for b in bolgeler}
    en = []
    for s in R:
        d = {s: 0}
        q = deque([s])
        while q:
            u = q.popleft()
            for v in R[u]:
                if v not in d:
                    d[v] = d[u] + 1
                    q.append(v)
        en.append(max(d.values()))
    return en


def onizleme(bolgeler, gecitler, hedef: Path):
    from PIL import Image, ImageDraw

    im = Image.open(KOK / "apps/web/public/gorseller/harita/dunya.webp").convert("RGB")
    ç = ImageDraw.Draw(im)
    boy = im.size[0]
    P = {b["id"]: (b["x"] / 100 * boy, b["y"] / 100 * boy) for b in bolgeler}
    gset = {tuple(g) for g in gecitler}
    for b in bolgeler:
        for k in b["komsular"]:
            if k < b["id"]:
                continue
            renk = (255, 90, 60) if (b["id"], k) in gset else (240, 220, 180)
            ç.line([P[b["id"]], P[k]], fill=renk, width=4 if (b["id"], k) in gset else 2)
    renkler = {"taht": (255, 200, 60), "kale": (220, 90, 70), "sehir": (110, 170, 230),
               "maden": (170, 170, 180), "tarla": (150, 200, 110), "koy": (200, 170, 130)}
    for b in bolgeler:
        x, y = P[b["id"]]
        r = 13 if b["type"] == "taht" else 9
        ç.ellipse([x - r, y - r, x + r, y + r], fill=renkler[b["type"]], outline=(20, 14, 10), width=2)
    im.save(hedef)
    print(f"onizleme: {hedef}")


if __name__ == "__main__":
    bolgeler, gecitler, uzaklik, noktalar = kur()
    hatalar = dogrula(bolgeler, gecitler, uzaklik)
    rapor(bolgeler, gecitler, uzaklik, noktalar)
    if hatalar:
        print("\nHATA:")
        for h in hatalar:
            print("  -", h)
    if "--onizleme" in sys.argv:
        i = sys.argv.index("--onizleme")
        onizleme(bolgeler, gecitler, Path(sys.argv[i + 1]))
    if "--yaz" in sys.argv:
        if hatalar:
            print("\nHatali harita yazilmaz.")
            sys.exit(1)
        mevcut = json.loads(HEDEF.read_text(encoding="utf-8"))
        yeni = {
            "schema": mevcut["schema"],
            "_not": (
                "Harita CIZILMIS ZEMINDEN turetiliyor: `tools/harita-kur.py`. "
                "Elle duzenlenmez -- araci calistir. Konum x/y (yuzdelik, YALNIZ "
                "cizim icin); motor x/y okumaz, mesafe komsuluk grafiginde en kisa "
                "yoldur. Komsuluk Delaunay'dan cikip budaniyor: deniz gecen ve dag "
                "asan kenar atiliyor, dagin arkasina yalniz GECITLERDEN "
                "gecilebiliyor (bkz. gecitler). Denge mesafeden geliyor ve eski "
                "haritayla ayni: gelir carpani ve NPC garnizonu Taht Kalesi'ne "
                "uzakliga bagli."
            ),
            "region_count": len(bolgeler),
            "gecitler": [list(g) for g in gecitler],
            "_gecit_notu": (
                "Dag asan komsuluklar. Haritada ayri cizilirler ve iki yani da "
                "cogu zaman KALE'dir: gecidi tutan bolge, dagin arkasini tutar."
            ),
            "provinces": [{"key": k, "name": VILAYET_ADI[k]} for k in VILAYETLER + ["taht"]],
            "regions": bolgeler,
        }
        HEDEF.write_text(json.dumps(yeni, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nyazildi: {HEDEF.relative_to(KOK)}")
