#!/usr/bin/env python3
"""
Lordlar Cagi - Denge dogrulayici.

data/balance.json degistirildiginde bu script calistirilir. docs/02 bolum 7'deki
kontrollerden SAF ARITMETIK olanlari uygular.

SAVAS MOTORUNA BAGLI kontroller (ilk fetih, kayip bandi, guc dagilimi) burada
DEGIL, packages/shared/src/balance.test.ts icindedir - cunku sadece gercek motor
tahkimati, karsi carpanlarini ve kayip dagitimini dogru hesaplar. Buradaki bir
Python kopyasi kacinilmaz olarak motordan sapardi.

  python3 tools/check_balance.py     <- aritmetik kontroller (bu dosya)
  pnpm test                          <- motor bagimli kontroller

Cikis kodu: 0 = tum kontroller gecti, 1 = en az bir kontrol basarisiz.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'data', 'balance.json'), encoding='utf-8'))
M = json.load(open(os.path.join(ROOT, 'data', 'world-map.json'), encoding='utf-8'))
U = B['birimler']
K = B['kaynaklar']

sonuclar = []


def kontrol(no, ad, gecti, detay):
    sonuclar.append((no, ad, gecti, detay))


def malikane(lv):
    t, b = K['malikane_saatlik'], K['malikane_seviye_bonusu_saatlik']
    return {k: t[k] + b[k] * lv for k in t}


def bakim(ordu):
    return sum(U[t]['bakim_erzak_saat'] * c for t, c in ordu.items())


# --- 1) Lv60'a ulasma suresi: 100-130 gun -----------------------------------
k, us = B['lord']['xp_katsayi'], B['lord']['xp_us']
gun = 0
for n in range(1, B['lord']['max_seviye']):
    gerekli, birikmis = k * (n ** us), 0
    while birikmis < gerekli:
        birikmis += 80 * n * 6 + 2000      # gunde 6 savas + bolge islemleri
        gun += 1
kontrol(1, "Lv60'a ulasma suresi", 100 <= gun <= 130, f"{gun} gun (hedef 100-130)")

# --- 2) Lv1 ordusu aclik cekmemeli ------------------------------------------
baslangic = {"mizrakci": 20, "okcu": 15}
g1, b1 = malikane(1)['erzak'], bakim(baslangic)
kontrol(2, "Lv1 ordu bakimi karsilaniyor", g1 >= b1, f"gelir {g1} vs bakim {b1}")

# --- 3) Lv60 ordusu 3 tarla ile beslenebilmeli ------------------------------
endgame = {"mizrakci": 150, "okcu": 120, "suvari": 150, "kusatma": 20}
tarla = B['bolgeler']['taban_gelir_saatlik']['tarla']['erzak']
g60 = malikane(60)['erzak'] + 3 * tarla * 1.5 * 2.0   # 3 tarla, ring2, Lv5
b60 = bakim(endgame)
kontrol(3, "Lv60 ordu bakimi karsilaniyor", g60 >= b60, f"gelir {g60:.0f} vs bakim {b60}")

# --- 4) TASINDI: ilk fetih kontrolu balance.test.ts'te (tahkimat hesabi gerekiyor) --

# --- 5) Bolge Lv1->Lv5 geri odemesi: 7-12 gun -------------------------------
bt, bus = B['bolgeler']['yukseltme_taban']['altin'], B['bolgeler']['yukseltme_us']
top = sum(bt * (bus ** (n - 1)) for n in range(1, 5))
sehir = B['bolgeler']['taban_gelir_saatlik']['sehir']['altin']
ek = sehir * B['bolgeler']['seviye_basina_gelir'] * 4
odeme = top / ek / 24
kontrol(5, "Bolge yukseltme geri odemesi", 7 <= odeme <= 12,
        f"{odeme:.1f} gun (maliyet {top:,.0f} altin)")

# --- 6 ve 7) TASINDI --------------------------------------------------------
# Lord guc payi ve kayip bandi kontrolleri packages/shared/src/balance.test.ts'te.
# Gercek savas motorunu kullanirlar; buradaki Python kopyasi motordan sapardi.

# --- 8) Bolge kitligi korunmali: bolge/oyuncu < 0.75 ------------------------
elde = M['region_count'] - 1                      # Taht Kalesi haric
oran = elde / B['dunya']['oyuncu_kapasitesi']
kontrol(8, "Bolge kitligi korunuyor", oran < 0.75,
        f"{elde} bolge / {B['dunya']['oyuncu_kapasitesi']} oyuncu = {oran:.2f}")

# --- Rapor ------------------------------------------------------------------
print("=" * 70)
print("LORDLAR CAGI - DENGE DOGRULAMA (aritmetik kontroller)")
print("=" * 70)
basarisiz = 0
for no, ad, gecti, detay in sonuclar:
    isaret = "GECTI" if gecti else "KALDI"
    if not gecti:
        basarisiz += 1
    print(f"  [{isaret}] {no}. {ad}")
    print(f"          {detay}")
print("-" * 70)
if basarisiz:
    print(f"SONUC: {len(sonuclar)-basarisiz}/{len(sonuclar)} gecti, {basarisiz} KONTROL BASARISIZ")
    print("data/balance.json duzeltilmeden koda gecilmemeli.")
    sys.exit(1)
print(f"SONUC: {len(sonuclar)}/{len(sonuclar)} aritmetik kontrol gecti.")
print("Motor bagimli kontroller icin: pnpm test")
sys.exit(0)
