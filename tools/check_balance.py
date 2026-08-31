#!/usr/bin/env python3
"""
Lordlar Cagi - Denge dogrulayici.

data/balance.json degistirildiginde bu script calistirilir. docs/02 bolum 7'deki
8 kontrolu uygular ve tasarim hedeflerinden sapma varsa hata verir.

Kullanim: python3 tools/check_balance.py
Cikis kodu: 0 = tum kontroller gecti, 1 = en az bir kontrol basarisiz.

M8'de bu kontroller apps/api icinde bir test dosyasina cevrilecek ve CI'da kosacak.
"""
import json, os, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'data', 'balance.json'), encoding='utf-8'))
M = json.load(open(os.path.join(ROOT, 'data', 'world-map.json'), encoding='utf-8'))
U = B['birimler']
K = B['kaynaklar']
E = B['ekipman']

sonuclar = []


def kontrol(no, ad, gecti, detay):
    sonuclar.append((no, ad, gecti, detay))


def malikane(lv):
    t, b = K['malikane_saatlik'], K['malikane_seviye_bonusu_saatlik']
    return {k: t[k] + b[k] * lv for k in t}


def bakim(ordu):
    return sum(U[t]['bakim_erzak_saat'] * c for t, c in ordu.items())


def yer(ordu):
    return sum(U[t]['yer'] * c for t, c in ordu.items())


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

# --- 4) Ilk NPC bolgesi 1. gunde alinabilmeli -------------------------------
ring4 = [r for r in M['regions'] if r['ring'] == 4][0]['npc_garrison']
npc_sav = sum(U[t]['savunma'] * c for t, c in ring4.items() if c)
sal = (baslangic['mizrakci'] * U['mizrakci']['saldiri']
       + baslangic['okcu'] * U['okcu']['saldiri'] * 1.5)     # okcu -> mizrakci
R4 = sal / (sal + npc_sav)
maliyet = sum(U[t]['maliyet']['altin'] * c for t, c in baslangic.items())
butce = B['lord']['baslangic_kaynaklari']['altin'] + malikane(1)['altin'] * 24
kontrol(4, "1. gun ilk fetih mumkun", R4 >= 0.60 and maliyet <= butce,
        f"R={R4:.2f} (>=0.60), maliyet {maliyet} <= 1 gunluk butce {butce:.0f}")

# --- 5) Bolge Lv1->Lv5 geri odemesi: 7-12 gun -------------------------------
bt, bus = B['bolgeler']['yukseltme_taban']['altin'], B['bolgeler']['yukseltme_us']
top = sum(bt * (bus ** (n - 1)) for n in range(1, 5))
sehir = B['bolgeler']['taban_gelir_saatlik']['sehir']['altin']
ek = sehir * B['bolgeler']['seviye_basina_gelir'] * 4
odeme = top / ek / 24
kontrol(5, "Bolge yukseltme geri odemesi", 7 <= odeme <= 12,
        f"{odeme:.1f} gun (maliyet {top:,.0f} altin)")

# --- 6) Lordun toplam savas gucundeki payi: %15-25 --------------------------
esya = E['tier_taban_guc']['5'] * E['nadirlik_carpani']['kadim'] * (1 + E['yukseltme_basina_bonus'] * E['max_yukseltme'])
gear = esya * len(E['slotlar'])
lord = 100 * 3 + gear * E['ekipman_katsayi']
ordu_sal = 280 * U['suvari']['saldiri'] * 1.30 * 1.15    # silahlik +%30, general +%15
pay = 100 * lord / (lord + ordu_sal)
kontrol(6, "Lordun savas gucundeki payi", 15 <= pay <= 25,
        f"%{pay:.1f} (hedef %15-25)")

# --- 7) Kazanan her zaman kayip vermeli, kaybeden hep daha cok kaybetmeli ---
def kayiplar(R):
    Rw = max(R, 1 - R)
    return (min((1 - Rw) * 0.70, B['savas']['kayip']['kazanan_max']),
            min(0.60 + (Rw - 0.5) * 0.6, B['savas']['kayip']['kaybeden_max']))

tutarli = True
detaylar = []
for R in (0.75, 0.60, 0.51, 0.38, 0.25):
    kz, kb = kayiplar(R)
    if not (kz > 0 and kb > kz):
        tutarli = False
    detaylar.append(f"R={R}: kazanan %{kz*100:.1f} / kaybeden %{kb*100:.1f}")
kontrol(7, "Kayip bandi tutarli (kazanan>0, kaybeden>kazanan)", tutarli, "; ".join(detaylar))

# --- 8) Bolge kitligi korunmali: bolge/oyuncu < 0.75 ------------------------
elde = M['region_count'] - 1                      # Taht Kalesi haric
oran = elde / B['dunya']['oyuncu_kapasitesi']
kontrol(8, "Bolge kitligi korunuyor", oran < 0.75,
        f"{elde} bolge / {B['dunya']['oyuncu_kapasitesi']} oyuncu = {oran:.2f}")

# --- Rapor ------------------------------------------------------------------
print("=" * 70)
print("LORDLAR CAGI - DENGE DOGRULAMA")
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
print(f"SONUC: {len(sonuclar)}/{len(sonuclar)} kontrol gecti. Denge tutarli.")
sys.exit(0)
