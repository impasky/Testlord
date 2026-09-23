#!/usr/bin/env python3
"""
Oyun görsellerini KENDİ BİLGİSAYARINDA, ComfyUI ile üretir. Ücretsiz.

Neden: Gemini'nin görsel modellerinde ücretsiz katman yok (ölçüm
gorsel-uret.py'nin başında). Yerel ComfyUI ise yalnız elektrik yakıyor.

Bu script yeni bir üslup ya da yeni bir işleme GETİRMİYOR:
  - istemler   gorsel-uret.py'den (TABAN_USLUP, KATEGORI, SAYFALAR...)
  - işleme     gorsel-koy.py ve gorsel-uret.sayfayi_ayikla'dan
               (zemin ayıklama, magenta anahtarı, tabana hizalama, kırpma)
ComfyUI'ye yalnız "bu istemden bir resim çiz" dedirtiyor. Yani üslup tarifi
hâlâ tek yerde ve yerelde üretilen görsel, Gemini'nin ürettiğiyle aynı
kalıptan geçiyor.

NEREDE ÇALIŞIR: senin bilgisayarında, ComfyUI açıkken. Claude'un ortamından
senin bilgisayarına erişim yok; orada bu script ComfyUI'yi bulamaz.

KURULUM (tek seferlik) — ayrıntı docs/GORSEL-REHBERI.md, Yol 3:
  1. ComfyUI'yi kur ve aç
  2. Bir model indir, ComfyUI/models/checkpoints/ klasörüne koy
     (hangisi: `--durum` ekran kartına bakıp söyler)
  3. pip install pillow numpy scipy

KULLANIM:
  python tools/comfy-uret.py --durum                 # ComfyUI, ekran kartı, modeller, öneri
  python tools/comfy-uret.py --liste                 # üretilebilecek her şey
  python tools/comfy-uret.py zeminler/pazar          # 4 aday üret
  python tools/comfy-uret.py ekipman/silah_t3 --aday 8
  python tools/comfy-uret.py ekipman-silah           # SAYFA: beş kılıç tek karede
  python tools/comfy-uret.py birimler/okcu --rotus   # oyundakini rötuşla (img2img)
  python tools/comfy-uret.py --koy tools/comfy-aday/zeminler__pazar__3.png

  Seçenekler:
    --aday N        kaç aday (varsayılan 4)
    --tohum N       ilk adayın tohumu; sonrakiler +1 (aynı tohum = aynı resim)
    --model AD      hangi checkpoint (varsayılan: kurulu olanların en iyisi)
    --adim N        örnekleme adımı (varsayılan: model ailesine göre)
    --cfg X         istem bağlılığı (varsayılan: model ailesine göre)
    --rotus         oyundaki mevcut görseli girdi al, üstünden yeniden boya
    --kaynak YOL    başka bir görseli girdi al (eskiz, referans)
    --guc X         girdiden ne kadar uzaklaşsın, 0-1 (varsayılan 0.45)
    --akis          üretmeden, ComfyUI'ye sürüklenecek akışı (JSON) yaz
    COMFY_URL       ortam değişkeni; yoksa 127.0.0.1:8188 ve :8000 denenir

NEDEN ADAY: yerel modelin isabeti Gemini'ninkinden düşük ve üretmek bedava.
Doğru iş akışı "bir kere üret, ne çıkarsa koy" değil, "dört üret, en iyisini
seç". Adaylar tools/comfy-aday/ altına yazılır (depoya girmez), yanlarına
numaralı bir kontak sayfası (_<ad>.jpg) konur. Beğendiğini --koy ile oyuna
alırsın; oyundaki dosyaya o ana kadar DOKUNULMAZ.

--koy'u Claude da çalıştırabilir: adayı `gorsel-gelen` dalına yükle
(docs/GORSEL-TESLIM.md), dosya adı neyin ne olduğunu zaten söylüyor.

ÜÇ İŞLEME YOLU — hedefin nerede durduğuna göre, ad verildiğinde kendiliğinden:
  sayfa  SAYFALAR'daki bir anahtar (ekipman-silah, kent-3...) ya da tek
         sahnelik bölge afişi. gorsel-uret'in sayfa akışıyla aynı: istem
         sayfa_istemi(), bölme sayfayi_ayikla().
  tek    Sayfası olan bir sprite'ın (bina, birim, ekipman...) TEK başına
         üretimi. Magenta zeminde tek figür istenir, aynı ayıklayıcıyla
         saydam 512x512'ye kesilip tabana ya da ortaya hizalanır.
  koy    Sayfası olmayan sahneler (zeminler, yerlesim, akin, harita):
         tam_istem() ile üretilir, gorsel-koy.py'den geçer.

TEK Mİ SAYFA MI: sayfa, aileyi AYNI KAREDE çizdirdiği için tutarlı (beş
kılıç birbirinin gelişmiş hâli gibi durur). Ama yerel modeller "tam beş ayrı
nesne, tek sırada" talimatını Gemini kadar iyi tutmuyor; bölücü figür
sayısını tutturamazsa hiçbir şey yazmaz. Tek başına üretim her zaman
bölünür ama ailenin geri kalanıyla akraba olmayabilir. Bir kılıcı
yeniliyorsan tek, beşini birden yeniliyorsan sayfa.
"""
from __future__ import annotations

import importlib.util
import json
import math
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
ADAY = KOK / "tools" / "comfy-aday"

# Dosya adındaki alan ayracı. Görsel ve sayfa adlarında tek alt çizgi ve
# tire var (silah_t1, kent-orta-1), çift alt çizgi yok; `_tanimli_mi`
# bunu her çalışmada doğruluyor.
AYRAC = "__"

# Sprite zemininin rengi. gorsel-uret'in sayfa kompozisyonu da magenta
# istiyor; rötuşta saydam sprite bu renge oturtulup modele öyle veriliyor ki
# model saydam alanı "boş zemin" olarak görsün, siyah bir dikdörtgen değil.
MAGENTA = (255, 0, 255)

# Tek figürlük sprite'ın kompozisyonu. sayfa_kompozisyonu(1, ...) "exactly 1
# separate subjects arranged in a single horizontal row" diyor — beş figür
# için yazılmış bir cümlenin tekili, model için anlamsız. Zemin kuralları
# (düz magenta, gölge yok, taban plakası yok) aynen korunuyor çünkü
# ayıklayıcı tam olarak onlara göre yazıldı.
TEK_KOMPOZISYON = (
    "one single subject alone in the middle of the frame on a flat solid "
    "magenta background, generous empty magenta margin on every side, the "
    "subject is complete and never cut off by the frame edge, it touches "
    "nothing else, no ground plane, no baseplate, no cast shadow on the "
    "background, square 1:1 composition"
)

# Negatif istem. Gemini'de karşılığı yok; oradaki "no text, no watermark"
# olumlu istemin içinde duruyor. CLIP tabanlı modeller (SDXL, SD1.5) ise
# olumsuzlamayı iyi okumuyor, "no text" çoğu zaman yazı ÇAĞIRIYOR. Aynı
# yasaklar burada ayrıca veriliyor. FLUX negatif kullanmıyor (cfg 1).
NEGATIF = (
    "text, letters, words, watermark, signature, logo, border, frame, "
    "user interface, photo, photograph, photorealistic, 3d render, plastic, "
    "glossy, cartoon, anime, chibi, blurry, lowres, jpeg artifacts, "
    "deformed, disfigured, extra limbs, extra fingers, cropped"
)
NEGATIF_SPRITE = NEGATIF + (
    ", gradient background, vignette, textured background, cast shadow, "
    "ground, floor, pedestal, multiple objects"
)


# --- Model aileleri ---
#
# Her ailenin kendi doğru ayarı var ve yanlışı kötü değil ÇÖP üretiyor:
# FLUX schnell 30 adımda yanar, SDXL 4 adımda bulanık kalır. Aile dosya
# adından tahmin ediliyor; tutmazsa --adim/--cfg ile ezilir.
#
# `lisans` süs değil: bu ticari bir oyun. Model lisansı ticari kullanımı
# yasaklıyorsa üretilen görselin oyunda durması risk.
@dataclass(frozen=True)
class Aile:
    ad: str
    adim: int
    cfg: float
    ornekleyici: str
    zamanlayici: str
    alan: int  # üretim çözünürlüğünün piksel alanı (modelin doğal boyu)
    negatif: bool
    lisans: str
    oncelik: int  # kendiliğinden seçimde sıra: küçük olan önce


AILELER = {
    "flux-schnell": Aile(
        "FLUX.1 schnell", 4, 1.0, "euler", "simple", 1024 * 1024, False,
        "Apache-2.0 — ticari kullanım serbest", 0,
    ),
    "sdxl": Aile(
        "SDXL", 30, 6.0, "dpmpp_2m", "karras", 1024 * 1024, True,
        "SDXL 1.0 tabanı CreativeML Open RAIL++-M (ticari serbest); ince "
        "ayarlı bir modelse lisansı AYRI, indirdiğin sayfadan doğrula", 1,
    ),
    "sd3": Aile(
        "SD 3.x", 28, 4.5, "euler", "sgm_uniform", 1024 * 1024, True,
        "Stability AI Community License — yıllık geliri 1 milyon doları "
        "aşmayan için ücretsiz; şartları sayfasından doğrula", 2,
    ),
    "sd15": Aile(
        "SD 1.5", 30, 7.0, "dpmpp_2m", "karras", 512 * 512, True,
        "CreativeML Open RAIL-M; ince ayarlı bir modelse lisansı AYRI", 3,
    ),
    "flux-dev": Aile(
        "FLUX.1 dev", 20, 1.0, "euler", "simple", 1024 * 1024, False,
        "FLUX.1 [dev] Non-Commercial License — ticari bir oyunda KULLANMA, "
        "yerine schnell", 9,
    ),
}


def aile_bul(ckpt: str) -> str:
    k = ckpt.lower()
    if "flux" in k:
        return "flux-schnell" if "schnell" in k else "flux-dev"
    if "sd3" in k or "sd_3" in k or "stable-diffusion-3" in k:
        return "sd3"
    if "xl" in k or "pony" in k or "illustrious" in k:
        return "sdxl"
    return "sd15"


# --- Yardımcı modüller ---


def _modul(ad: str):
    """tools/<ad>.py'yi modül olarak yükler (tire içeren adlar import edilemiyor)."""
    yol = KOK / "tools" / f"{ad}.py"
    spec = importlib.util.spec_from_file_location(ad.replace("-", "_"), yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


_uretici = None


def uretici():
    """gorsel-uret.py — istemlerin ve işlemenin tek kaynağı. Ağa çıkmaz."""
    global _uretici
    if _uretici is None:
        _uretici = _modul("gorsel-uret")
    return _uretici


# --- Hedef: ne üretilecek, hangi istemle, nasıl işlenecek ---


@dataclass
class Hedef:
    anahtar: str  # aday dosyasının adındaki kimlik: "zeminler__pazar", "sayfa__kent-3"
    kip: str  # 'sayfa' | 'tek' | 'koy'
    klasor: str
    adlar: list[str]
    istem: str
    negatif: str
    oran: float  # genişlik / yükseklik
    sayfa: str | None = None
    duzen: str | None = None

    @property
    def oyundaki(self) -> Path | None:
        """Rötuş girdisi: oyunda şu an duran görsel (tek hedefte)."""
        if len(self.adlar) != 1:
            return None
        yol = uretici().CIKTI / self.klasor / f"{self.adlar[0]}.webp"
        return yol if yol.exists() else None


def _sayfasi(klasor: str, ad: str) -> tuple[str, str] | None:
    """Görselin üretildiği sayfa ve düzeni. Tek sahnelik (tam) sayfa önce."""
    u = uretici()
    bulunan = [
        (s, d) for s, (k, adlar, d) in u.SAYFALAR.items() if k == klasor and ad in adlar
    ]
    bulunan.sort(key=lambda sd: sd[1] != "tam")
    return bulunan[0] if bulunan else None


def _sayfa_hedefi(sayfa: str, anahtar: str | None = None) -> Hedef:
    u = uretici()
    klasor, adlar, duzen = u.SAYFALAR[sayfa]
    # Oran sayfa kompozisyonunun söylediği: tek sahne 3:2 (afiş), pano
    # şeridi 16:9, sprite sayfası kare.
    oran = {"tam": 3 / 2, "pano": 16 / 9}.get(duzen, 1.0)
    return Hedef(
        anahtar=anahtar or f"sayfa{AYRAC}{sayfa}",
        kip="sayfa",
        klasor=klasor,
        adlar=list(adlar),
        istem=u.sayfa_istemi(sayfa),
        negatif=NEGATIF if duzen in ("tam", "pano") else NEGATIF_SPRITE,
        oran=oran,
        sayfa=sayfa,
        duzen=duzen,
    )


def _gorsel_hedefi(klasor: str, ad: str) -> Hedef:
    u = uretici()
    konu = u.ISTEKLER[klasor][ad]
    anahtar = f"{klasor}{AYRAC}{ad}"
    sd = _sayfasi(klasor, ad)
    if sd:
        sayfa, duzen = sd
        if duzen == "tam":
            # Bölge afişi: tek sahnelik sayfanın kendisi. Aynı yoldan
            # geçmezse 1152x768 yerine 512x512 yazılır (KATEGORI boyutu
            # eski pano döneminden kalma).
            return _sayfa_hedefi(sayfa, anahtar)
        if duzen in ("zemin", "ikon"):
            return Hedef(
                anahtar=anahtar,
                kip="tek",
                klasor=klasor,
                adlar=[ad],
                istem=f"{u.SAYFA_KONUSU[klasor]}. {konu}. {TEK_KOMPOZISYON}, "
                f"{u.STIL_SOZLESMESI}",
                negatif=NEGATIF_SPRITE,
                oran=1.0,
                duzen=duzen,
            )
    g, y = u.KATEGORI[klasor]["boyut"]
    return Hedef(
        anahtar=anahtar,
        kip="koy",
        klasor=klasor,
        adlar=[ad],
        istem=u.tam_istem(klasor, konu),
        negatif=NEGATIF,
        oran=g / y,
    )


def hedefleri_coz(adlar: list[str]) -> list[Hedef]:
    """
    Komut satırındaki adlar -> hedefler. Kabul edilenler:
      sayfa anahtarı (kent-3), küme (ekipman), kume/ad (zeminler/pazar), düz ad (okcu)
    Düz ad iki kümede birden varsa (sehir: bölge VE yerleşim) belirsizdir
    ve kume/ad istenir — sessizce ikisini birden üretmek yanlış olurdu.
    """
    u = uretici()
    hedefler: list[Hedef] = []
    for ad in adlar:
        if ad in u.SAYFALAR:
            hedefler.append(_sayfa_hedefi(ad))
        elif ad in u.ISTEKLER:
            hedefler += [_gorsel_hedefi(ad, a) for a in u.ISTEKLER[ad]]
        elif "/" in ad:
            k, a = ad.split("/", 1)
            if k not in u.ISTEKLER or a not in u.ISTEKLER[k]:
                raise SystemExit(f"Bilinmeyen görsel: {ad}  (liste: --liste)")
            hedefler.append(_gorsel_hedefi(k, a))
        else:
            eslesen = [k for k, v in u.ISTEKLER.items() if ad in v]
            if not eslesen:
                raise SystemExit(f"Bilinmeyen görsel, küme ya da sayfa: {ad}  (liste: --liste)")
            if len(eslesen) > 1:
                secenek = ", ".join(f"{k}/{ad}" for k in eslesen)
                raise SystemExit(f"'{ad}' birden fazla kümede var. Hangisi: {secenek}")
            hedefler.append(_gorsel_hedefi(eslesen[0], ad))
    return hedefler


def _tanimli_mi() -> None:
    u = uretici()
    adlar = [a for v in u.ISTEKLER.values() for a in v] + list(u.ISTEKLER) + list(u.SAYFALAR)
    kotu = [a for a in adlar if AYRAC in a]
    if kotu:
        raise SystemExit(f"Ad içinde '{AYRAC}' var, aday dosya adı çözülemez: {kotu}")


def cozunurluk(oran: float, alan: int) -> tuple[int, int]:
    """Modelin doğal alanında, istenen oranda, 64'ün katı bir boyut."""
    g = math.sqrt(alan * oran)
    y = g / oran
    return max(64, round(g / 64) * 64), max(64, round(y / 64) * 64)


# --- ComfyUI istemcisi ---
#
# Yalnız standart kütüphane: kullanıcının makinesine requests/websocket
# kurdurmamak için. Sonuç /history'den yoklanıyor; saniyede bir istek
# yerel bir sunucu için hiçbir şey.


class ComfyHatasi(Exception):
    def __init__(self, ileti: str, bellek: bool = False):
        super().__init__(ileti)
        # Ekran kartı belleği yetmedi: kuyruktaki öbür adaylar da aynı
        # modelle aynı boyda, onlar da yetmeyecek. Ayrı tutuluyor ki çağıran
        # hepsini tek tek bekleyip aynı hatayı dört kez basmasın.
        self.bellek = bellek


BELLEK_IPUCU = (
    "Ekran kartının belleği yetmedi. Daha küçük bir model dene (--durum "
    "öneriyor) ya da ComfyUI'yi --lowvram ile başlat."
)


class Comfy:
    def __init__(self, url: str):
        self.url = url.rstrip("/")
        # Vekil sunucuyu BİLEREK atla: kullanıcının ortamında HTTP(S)_PROXY
        # tanımlıysa urllib yerel adrese de onun üstünden gitmeye çalışıyor.
        self.acici = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self.istemci = uuid.uuid4().hex

    def _istek(self, yol: str, veri: bytes | None = None, baslik: dict | None = None, sure=30):
        istek = urllib.request.Request(self.url + yol, data=veri, headers=baslik or {})
        try:
            with self.acici.open(istek, timeout=sure) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            govde = e.read().decode("utf-8", "replace")
            raise ComfyHatasi(f"HTTP {e.code} {yol}: {govde[:800]}") from None

    def json(self, yol: str, veri: dict | None = None):
        if veri is None:
            return json.loads(self._istek(yol))
        govde = json.dumps(veri).encode()
        return json.loads(self._istek(yol, govde, {"Content-Type": "application/json"}))

    def modeller(self) -> list[str]:
        return self.json("/models/checkpoints")

    def yukle(self, png: bytes, ad: str) -> str:
        """Girdi görselini ComfyUI'nin input/ klasörüne yükler; LoadImage adı döner."""
        sinir = uuid.uuid4().hex
        parcalar = [
            f"--{sinir}\r\nContent-Disposition: form-data; name=\"image\"; "
            f"filename=\"{ad}\"\r\nContent-Type: image/png\r\n\r\n".encode(),
            png,
            f"\r\n--{sinir}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\n"
            f"true\r\n--{sinir}\r\nContent-Disposition: form-data; name=\"type\"\r\n\r\n"
            f"input\r\n--{sinir}--\r\n".encode(),
        ]
        yanit = json.loads(
            self._istek(
                "/upload/image",
                b"".join(parcalar),
                {"Content-Type": f"multipart/form-data; boundary={sinir}"},
            )
        )
        alt = yanit.get("subfolder") or ""
        return f"{alt}/{yanit['name']}" if alt else yanit["name"]

    def kuyruga(self, akis: dict) -> str:
        try:
            yanit = self.json("/prompt", {"prompt": akis, "client_id": self.istemci})
        except ComfyHatasi as e:
            raise ComfyHatasi(_dogrulama_hatasi(str(e))) from None
        return yanit["prompt_id"]

    def bekle(self, kimlik: str, sure: int) -> list[dict]:
        """İş bitene kadar yoklar; kaydedilen görsellerin künyelerini döner."""
        bas = time.time()
        while time.time() - bas < sure:
            kayit = self.json(f"/history/{kimlik}").get(kimlik)
            if kayit:
                durum = kayit.get("status") or {}
                if durum.get("status_str") == "error":
                    raise _calisma_hatasi(durum)
                gorseller = [
                    g for cikti in kayit.get("outputs", {}).values() for g in cikti.get("images", [])
                ]
                if durum.get("completed") or gorseller:
                    return gorseller
            time.sleep(1)
        raise ComfyHatasi(f"{sure} saniyede bitmedi. ComfyUI penceresine bak.")

    def indir(self, kunye: dict) -> bytes:
        sorgu = urllib.parse.urlencode(
            {"filename": kunye["filename"], "subfolder": kunye.get("subfolder", ""),
             "type": kunye.get("type", "output")}
        )
        return self._istek(f"/view?{sorgu}", sure=120)

    def kuyruktan_cikar(self, kimlikler: list[str]) -> None:
        """Henüz başlamamış işleri kuyruktan siler (çalışanı durdurmaz)."""
        # Gövdesiz 200 dönüyor (server.py post_queue), o yüzden json() değil.
        # Temizlik en iyi çaba: olmazsa asıl hata mesajı gölgelenmesin,
        # kalan işler ComfyUI'de kendi hatasıyla biter.
        if not kimlikler:
            return
        govde = json.dumps({"delete": kimlikler}).encode()
        try:
            self._istek("/queue", govde, {"Content-Type": "application/json"})
        except (ComfyHatasi, OSError):
            pass


def _dogrulama_hatasi(ham: str) -> str:
    """ComfyUI'nin 400 gövdesini okunur bir cümleye çevirir."""
    try:
        govde = json.loads(ham.split(": ", 1)[1])
    except Exception:  # noqa: BLE001
        return ham
    satirlar = [govde.get("error", {}).get("message", "istek reddedildi")]
    for dugum, hata in (govde.get("node_errors") or {}).items():
        for h in hata.get("errors", []):
            satirlar.append(f"  {hata.get('class_type', dugum)}: {h.get('message')} — {h.get('details', '')}")
    metin = "\n".join(satirlar)
    if "ckpt_name" in metin:
        metin += "\n  Model dosyası bulunamadı. Kurulu olanlar: --durum"
    return metin


def _calisma_hatasi(durum: dict) -> ComfyHatasi:
    for olay, veri in durum.get("messages", []):
        if olay == "execution_error":
            ileti = str(veri.get("exception_message", "")).strip()
            bellek = "out of memory" in ileti.lower() or "OutOfMemory" in str(
                veri.get("exception_type")
            )
            return ComfyHatasi(f"{veri.get('node_type', '?')}: {ileti}", bellek)
    return ComfyHatasi("ComfyUI işi hata ile bitirdi (ayrıntı ComfyUI penceresinde).")


def comfy_bul() -> Comfy:
    adaylar = [os.environ["COMFY_URL"]] if os.environ.get("COMFY_URL") else [
        # 8188 elle/taşınabilir kurulumun, 8000 masaüstü uygulamasının varsayılanı.
        "http://127.0.0.1:8188",
        "http://127.0.0.1:8000",
    ]
    for url in adaylar:
        c = Comfy(url)
        try:
            c._istek("/system_stats", sure=3)
            return c
        except (OSError, ComfyHatasi):
            continue
    raise SystemExit(
        "ComfyUI bulunamadı (" + ", ".join(adaylar) + ").\n"
        "  - ComfyUI açık mı? Tarayıcıda arayüzü görebiliyor olmalısın.\n"
        "  - Başka bir adreste çalışıyorsa: COMFY_URL=http://127.0.0.1:PORT"
    )


# --- Akış ---
#
# Yalnız ÇEKİRDEK düğümler: özel düğüm kurdurmak, kurulumu kırılgan yapar.
# Düğüm ve girdi adları ComfyUI kaynağından (nodes.py) doğrulandı.
#
# EmptyLatentImage her aile için: FLUX 16 kanallı gizli uzay bekliyor ama
# ComfyUI boş gizli görüntünün kanal sayısını modele göre kendisi
# düzeltiyor (comfy/sample.py, fix_empty_latent_channels).


def akis_kur(
    ckpt: str, aile: Aile, hedef: Hedef, gen: int, yuk: int, tohum: int,
    adim: int, cfg: float, girdi_adi: str | None, guc: float,
) -> dict:
    a: dict = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": hedef.istem, "clip": ["1", 1]}},
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": hedef.negatif if aile.negatif else "", "clip": ["1", 1]},
        },
    }
    if girdi_adi:
        a["4"] = {"class_type": "LoadImage", "inputs": {"image": girdi_adi}}
        a["5"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}}
        gizli = ["5", 0]
    else:
        a["4"] = {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": gen, "height": yuk, "batch_size": 1},
        }
        gizli = ["4", 0]
    a["6"] = {
        "class_type": "KSampler",
        "inputs": {
            "seed": tohum,
            "steps": adim,
            "cfg": cfg,
            "sampler_name": aile.ornekleyici,
            "scheduler": aile.zamanlayici,
            "denoise": guc if girdi_adi else 1.0,
            "model": ["1", 0],
            "positive": ["2", 0],
            "negative": ["3", 0],
            "latent_image": gizli,
        },
    }
    a["7"] = {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}}
    a["8"] = {
        "class_type": "SaveImage",
        "inputs": {"filename_prefix": f"lordlar-cagi/{hedef.anahtar}", "images": ["7", 0]},
    }
    return a


def girdi_hazirla(yol: Path, gen: int, yuk: int) -> bytes:
    """
    img2img girdisi: üretim boyutuna ORTADAN kırpılıp ölçeklenmiş PNG.

    Saydam sprite magenta zemine oturtuluyor. Saydam pikselin RGB'si
    çoğunlukla siyah; olduğu gibi verilse model siyah bir kutunun içine
    boyardı ve ayıklayıcı o kutuyu figür sanardı.
    """
    from PIL import Image

    im = Image.open(yol)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        zemin = Image.new("RGBA", im.size, MAGENTA + (255,))
        zemin.alpha_composite(im)
        im = zemin
    im = im.convert("RGB")
    g, y = im.size
    hedef = gen / yuk
    if g / y > hedef:
        yeni = round(y * hedef)
        im = im.crop(((g - yeni) // 2, 0, (g - yeni) // 2 + yeni, y))
    else:
        yeni = round(g / hedef)
        im = im.crop((0, (y - yeni) // 2, g, (y - yeni) // 2 + yeni))
    tampon = BytesIO()
    im.resize((gen, yuk), Image.LANCZOS).save(tampon, "PNG")
    return tampon.getvalue()


# --- Adaylar ---


def _sonraki_numara(anahtar: str) -> int:
    """Eski adayların üstüne yazmamak için numara kaldığı yerden sürer."""
    nolar = []
    for f in ADAY.glob(f"{anahtar}{AYRAC}*.png"):
        son = f.stem.rsplit(AYRAC, 1)[-1]
        if son.isdigit():
            nolar.append(int(son))
    return max(nolar, default=0) + 1


def kontak_sayfasi(anahtar: str) -> Path | None:
    """Hedefin TÜM adaylarını numaralı tek bir JPEG'de yan yana dizer."""
    from PIL import Image, ImageDraw, ImageFont

    dosyalar = sorted(
        ADAY.glob(f"{anahtar}{AYRAC}*.png"),
        key=lambda f: int(f.stem.rsplit(AYRAC, 1)[-1]) if f.stem.rsplit(AYRAC, 1)[-1].isdigit() else 0,
    )
    if not dosyalar:
        return None
    kare = 384
    sutun = min(4, len(dosyalar))
    satir = math.ceil(len(dosyalar) / sutun)
    ilk = Image.open(dosyalar[0])
    yuk = round(kare * ilk.size[1] / ilk.size[0])
    tuval = Image.new("RGB", (sutun * kare, satir * yuk), (24, 20, 16))
    try:
        yazi = ImageFont.load_default(size=36)
    except TypeError:  # Pillow < 10.1: boyutsuz varsayılan yazı tipi
        yazi = ImageFont.load_default()
    ciz = ImageDraw.Draw(tuval)
    for i, f in enumerate(dosyalar):
        x, y = (i % sutun) * kare, (i // sutun) * yuk
        tuval.paste(Image.open(f).convert("RGB").resize((kare, yuk), Image.LANCZOS), (x, y))
        no = f.stem.rsplit(AYRAC, 1)[-1]
        ciz.rectangle((x, y, x + 64, y + 48), fill=(0, 0, 0))
        ciz.text((x + 12, y + 4), no, fill=(255, 220, 120), font=yazi)
    yol = ADAY / f"_{anahtar}.jpg"
    tuval.save(yol, "JPEG", quality=85)
    return yol


# --- Oyuna koyma ---


def aday_coz(yol: Path) -> Hedef:
    """tools/comfy-aday/zeminler__pazar__3.png -> zeminler/pazar hedefi."""
    parca = yol.stem.split(AYRAC)
    if len(parca) == 3 and parca[0] == "sayfa":
        return _sayfa_hedefi(parca[1])
    if len(parca) == 3:
        return hedefleri_coz([f"{parca[0]}/{parca[1]}"])[0]
    raise SystemExit(
        f"Dosya adından hedef çıkmıyor: {yol.name}\n"
        f"  Beklenen: <küme>{AYRAC}<ad>{AYRAC}<no>.png ya da sayfa{AYRAC}<sayfa>{AYRAC}<no>.png"
    )


def oyuna_koy(yol: Path) -> bool:
    """Seçilen adayı hedefin işleme yolundan geçirip oyunun klasörüne yazar."""
    hedef = aday_coz(yol)
    u = uretici()
    print(f"\n{yol.name} -> {hedef.klasor}/{', '.join(hedef.adlar)}  [{hedef.kip}]")

    if hedef.kip == "koy":
        # gorsel-koy.py'nin kendisi: filigran, zemin ayıklama (ekipman/lord),
        # kategori boyutuna kırpma, WebP. Varsayılanları orada.
        r = subprocess.run(
            [sys.executable, str(KOK / "tools" / "gorsel-koy.py"), hedef.klasor,
             f"{hedef.adlar[0]}={yol}"],
        )
        return r.returncode == 0

    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except ImportError:
        raise SystemExit("Sprite ayıklamak için numpy ve scipy gerekli: pip install numpy scipy")

    if hedef.kip == "sayfa":
        # Ham sayfa gorsel-uret'in koyduğu yere: yeniden bölmek gerekirse
        # (ör. --onizleme ile) orada. tools/stil/.gitignore depoya sokmuyor.
        from PIL import Image

        ham = u.STIL_PLAKASI.parent / f"{hedef.sayfa}.webp"
        ham.parent.mkdir(parents=True, exist_ok=True)
        Image.open(yol).convert("RGB").save(ham, "WEBP", quality=90, method=6)
        return u.sayfayi_ayikla(ham, hedef.sayfa) > 0

    # TEK: tek figürlük geçici bir sayfa tanımıyla aynı bölücü. Magenta
    # anahtarı, kopuk parça temizliği ve tabana/ortaya hizalama bedavaya
    # geliyor; ikinci bir kopya yazmak iki aracın "zemin nedir" tanımını
    # zamanla ayırırdı.
    gecici = "_comfy_tek"
    u.SAYFALAR[gecici] = (hedef.klasor, hedef.adlar, hedef.duzen)
    try:
        yazilan = u.sayfayi_ayikla(yol, gecici)
    finally:
        del u.SAYFALAR[gecici]
    if not yazilan:
        print(
            "  Bu adayda tek figür ayrılamadı (kenara değiyor ya da kopuk büyük "
            "parçası var). Başka bir aday seç."
        )
    return yazilan > 0


# --- Komutlar ---


def _zemin_listede(ad: str) -> bool:
    yol = KOK / "apps" / "web" / "src" / "components" / "Zemin.tsx"
    if not yol.exists():
        return True  # kaynak yoksa (yalnız araçlar kopyalanmış) uyarmanın anlamı yok
    metin = yol.read_text(encoding="utf-8")
    bas = metin.find("const ZEMINI_OLAN")
    return f"'{ad}'" in metin[bas : metin.find("]", bas)]


def durum() -> int:
    c = comfy_bul()
    s = c.json("/system_stats")
    sis = s.get("system", {})
    print(f"ComfyUI {sis.get('comfyui_version', '?')}  {c.url}")
    ram = sis.get("ram_total", 0) / 2**30
    vram = 0.0
    for d in s.get("devices", []):
        gb = d.get("vram_total", 0) / 2**30
        vram = max(vram, gb if d.get("type") != "cpu" else 0)
        print(f"  Aygıt: {d.get('name')}  ({gb:.1f} GB)")
    print(f"  Bellek (RAM): {ram:.0f} GB")

    modeller = c.modeller()
    print(f"\nKurulu modeller ({len(modeller)}):")
    for m in modeller:
        a = AILELER[aile_bul(m)]
        print(f"  {m}\n      {a.ad} · {a.lisans}")
    if not modeller:
        print("  (yok — models/checkpoints/ boş)")

    print("\nÖneri:")
    aileler = {aile_bul(m) for m in modeller}
    if "flux-schnell" in aileler or (vram < 12 and "sdxl" in aileler):
        secilen = min(modeller, key=lambda m: AILELER[aile_bul(m)].oncelik)
        print(
            f"  Hazırsın: {secilen} kendiliğinden kullanılacak.\n"
            "  İlk deneme: python tools/comfy-uret.py zeminler/pazar"
        )
        return 0
    if vram >= 12:
        print(
            "  FLUX.1 schnell — bu ekran kartı taşır, en iyi sonuç ve Apache-2.0.\n"
            "  Hugging Face: Comfy-Org/flux1-schnell -> flux1-schnell-fp8.safetensors (~17 GB)"
        )
    elif vram >= 6:
        print(
            "  SDXL 1.0 — bu ekran kartında rahat çalışır.\n"
            "  Hugging Face: stabilityai/stable-diffusion-xl-base-1.0 -> "
            "sd_xl_base_1.0.safetensors (~7 GB)"
        )
        if ram >= 32:
            print(
                "  FLUX.1 schnell de denenebilir: RAM yeterli, ComfyUI modelin bir\n"
                "  kısmını belleğe taşır. Daha yavaş ama genelde daha iyi sonuç."
            )
    elif vram > 0:
        print(
            "  Ekran kartı belleği düşük. SDXL'i ComfyUI --lowvram ile deneyebilirsin\n"
            "  (yavaş). Olmazsa önemli görseller için Gemini uygulaması daha iyi."
        )
    else:
        print("  Ekran kartı görünmüyor (CPU). Yerel üretim pratikte çok yavaş olur.")
    print("\nİndirdiğin dosyayı ComfyUI/models/checkpoints/ içine koy, ComfyUI'yi yenile.")
    return 0


def liste() -> int:
    u = uretici()
    for klasor, kayitlar in u.ISTEKLER.items():
        print(f"\n{klasor}  ({u.KATEGORI[klasor]['ad']})")
        for ad in kayitlar:
            h = _gorsel_hedefi(klasor, ad)
            var = "  " if (u.CIKTI / klasor / f"{ad}.webp").exists() else "YOK"
            print(f"  {var} {klasor}/{ad}  [{h.kip}]")
    print("\nSayfalar (bir ailenin hepsi tek karede):")
    for sayfa, (klasor, adlar, _) in u.SAYFALAR.items():
        print(f"  {sayfa}: {klasor} / {' '.join(adlar)}")
    return 0


def uret(hedefler: list[Hedef], secenek: dict) -> int:
    akis_modu = secenek["akis"]
    c = None if akis_modu else comfy_bul()

    if secenek["model"]:
        ckpt = secenek["model"]
        if c and ckpt not in c.modeller():
            raise SystemExit(f"'{ckpt}' kurulu değil. Kurulu olanlar: --durum")
    elif c:
        kurulu = c.modeller()
        if not kurulu:
            raise SystemExit("Kurulu model yok. Hangisini indireceğini --durum söyler.")
        ckpt = min(kurulu, key=lambda m: AILELER[aile_bul(m)].oncelik)
    else:
        ckpt = "flux1-schnell-fp8.safetensors"

    aile = AILELER[aile_bul(ckpt)]
    adim = secenek["adim"] or aile.adim
    cfg = secenek["cfg"] if secenek["cfg"] is not None else aile.cfg
    if not akis_modu:
        print(f"Model: {ckpt}  ({aile.ad}, {adim} adım, cfg {cfg})")
        print(f"Lisans: {aile.lisans}")
        if aile_bul(ckpt) == "flux-dev":
            print("  !! Bu modelin lisansı ticari kullanımı yasaklıyor. Oyunda kullanma.")

    ADAY.mkdir(parents=True, exist_ok=True)
    kok_tohum = secenek["tohum"] if secenek["tohum"] is not None else random.randrange(2**32)
    basarisiz: list[str] = []
    for hedef in hedefler:
        gen, yuk = cozunurluk(hedef.oran, aile.alan)

        girdi_yolu = secenek["kaynak"] or (hedef.oyundaki if secenek["rotus"] else None)
        if secenek["rotus"] and girdi_yolu is None:
            print(f"\n{hedef.anahtar}: oyunda bu görsel yok, rötuşlanacak bir şey yok. Atlandı.")
            continue

        if akis_modu:
            ad = girdi_yolu.name if girdi_yolu else None
            if ad:
                print(
                    f"Not: '{ad}' ComfyUI'nin input/ klasöründe yok. Akışı açınca "
                    "Load Image düğümünden görseli kendin seç.",
                    file=sys.stderr,
                )
            akis = akis_kur(ckpt, aile, hedef, gen, yuk, kok_tohum, adim, cfg, ad, secenek["guc"])
            # ensure_ascii: Windows konsolunda yönlendirme cp1254/cp1252 ile
            # yazıyor; Türkçe karakter olmadığından emin olmak dosyayı her
            # yerde açılır tutuyor.
            print(json.dumps(akis, indent=2, ensure_ascii=True))
            return 0

        girdi_adi = None
        if girdi_yolu:
            girdi_adi = c.yukle(girdi_hazirla(girdi_yolu, gen, yuk), f"lordlar-{hedef.anahtar}.png")

        ilk = _sonraki_numara(hedef.anahtar)
        kip = f"rötuş %{round(secenek['guc'] * 100)}" if girdi_adi else "sıfırdan"
        print(f"\n{hedef.anahtar}  {gen}x{yuk}  {kip}  [{hedef.kip}]")
        # Hepsi önce kuyruğa: ComfyUI modeli bir kere yükleyip ardı ardına
        # çiziyor. Sırayla gönder-bekle yapsak aralarda boşta dururdu.
        isler = []
        for i in range(secenek["aday"]):
            tohum = (kok_tohum + i) % 2**32
            akis = akis_kur(ckpt, aile, hedef, gen, yuk, tohum, adim, cfg, girdi_adi, secenek["guc"])
            try:
                isler.append((ilk + i, tohum, c.kuyruga(akis)))
            except ComfyHatasi as e:
                print(f"  ComfyUI isteği reddetti:\n  {e}")
                return 2

        for sira, (no, tohum, kimlik) in enumerate(isler):
            bas = time.time()
            try:
                kunyeler = c.bekle(kimlik, secenek["sure"])
                if not kunyeler:
                    raise ComfyHatasi("iş bitti ama görsel dönmedi")
                ham = c.indir(kunyeler[0])
            except ComfyHatasi as e:
                print(f"  aday {no}: HATA {e}")
                basarisiz.append(f"{hedef.anahtar}#{no}")
                if e.bellek:
                    # Aynı model, aynı boy: kalanlar da sığmayacak. Kuyrukta
                    # beklemesinler; ComfyUI boşuna dört kez aynı hatayı vermesin.
                    kalan = [k for _, _, k in isler[sira + 1 :]]
                    c.kuyruktan_cikar(kalan)
                    print(f"  {BELLEK_IPUCU}")
                    if kalan:
                        print(f"  Kalan {len(kalan)} aday kuyruktan çıkarıldı.")
                    print("\nBaşarısız:", ", ".join(basarisiz))
                    return 1
                continue
            yol = ADAY / f"{hedef.anahtar}{AYRAC}{no}.png"
            yol.write_bytes(ham)
            print(f"  aday {no}  tohum {tohum}  {time.time() - bas:.0f} sn  -> {yol.relative_to(KOK)}")

        sayfa = kontak_sayfasi(hedef.anahtar)
        if sayfa:
            print(f"  Hepsi yan yana: {sayfa.relative_to(KOK)}")
            print(
                f"  Beğendiğini koy: python tools/comfy-uret.py --koy "
                f"tools/comfy-aday/{hedef.anahtar}{AYRAC}<no>.png"
            )

    if basarisiz:
        print("\nBaşarısız:", ", ".join(basarisiz))
    return 1 if basarisiz else 0


def main() -> int:
    argv = sys.argv[1:]
    if not argv or "-h" in argv or "--help" in argv:
        print(__doc__)
        return 0 if argv else 2

    _tanimli_mi()

    def al(bayrak: str, donustur=str, varsayilan=None):
        if bayrak not in argv:
            return varsayilan
        i = argv.index(bayrak)
        if i + 1 >= len(argv):
            raise SystemExit(f"{bayrak} bir değer bekliyor")
        deger = argv[i + 1]
        del argv[i : i + 2]
        try:
            return donustur(deger)
        except ValueError:
            raise SystemExit(f"{bayrak} için geçersiz değer: {deger}") from None

    def var(bayrak: str) -> bool:
        if bayrak in argv:
            argv.remove(bayrak)
            return True
        return False

    koyulacaklar = []
    while "--koy" in argv:
        koyulacaklar.append(Path(al("--koy")))

    secenek = {
        "aday": al("--aday", int, 4),
        "tohum": al("--tohum", int),
        "model": al("--model"),
        "adim": al("--adim", int),
        "cfg": al("--cfg", float),
        "guc": al("--guc", float, 0.45),
        "sure": al("--sure", int, 900),
        "kaynak": al("--kaynak", Path),
        "rotus": var("--rotus"),
        "akis": var("--akis"),
    }
    durum_mu, liste_mi = var("--durum"), var("--liste")
    bilinmeyen = [a for a in argv if a.startswith("--")]
    if bilinmeyen:
        raise SystemExit(f"Bilinmeyen seçenek: {' '.join(bilinmeyen)}  (yardım: --help)")
    if not 0 < secenek["guc"] <= 1:
        raise SystemExit("--guc 0 ile 1 arasında olmalı")
    if secenek["aday"] < 1:
        raise SystemExit("--aday en az 1")
    if secenek["kaynak"] and not secenek["kaynak"].exists():
        raise SystemExit(f"--kaynak bulunamadı: {secenek['kaynak']}")

    if durum_mu:
        return durum()
    if liste_mi:
        return liste()

    if koyulacaklar:
        eksik = [str(y) for y in koyulacaklar if not y.exists()]
        if eksik:
            raise SystemExit(f"Dosya bulunamadı: {', '.join(eksik)}")
        sonuc = [(y, oyuna_koy(y)) for y in koyulacaklar]
        tamam = [y for y, ok in sonuc if ok]
        print(f"\n{len(tamam)}/{len(sonuc)} aday oyuna kondu.")
        if tamam:
            print("Oyunda nasıl durduğuna bak. Hangi modelle üretildiğini docs/LISANSLAR.md'ye yaz.")
        # Ekran zemini dosyası tek başına görünmüyor: Zemin.tsx hangi
        # ekranın zemini OLDUĞUNU elle tutulan bir listeden okuyor (sayfa
        # zıplamasın diye). Yeni bir zemin o listeye girmeden oyunda yok.
        konan = [aday_coz(y) for y in tamam]
        yeni_zemin = [
            h.adlar[0] for h in konan if h.klasor == "zeminler" and not _zemin_listede(h.adlar[0])
        ]
        if yeni_zemin:
            print(
                f"Yeni ekran zemini: {', '.join(yeni_zemin)}. Görünmesi için "
                "apps/web/src/components/Zemin.tsx içindeki ZEMINI_OLAN listesine\n"
                "girmesi ve ekranın <Zemin ad=...> kullanması gerekir (gorsel-denetim "
                "listeyle klasörün ayrıştığını yakalar)."
            )
        return 0 if len(tamam) == len(sonuc) else 1

    if not argv:
        raise SystemExit("Ne üretileceği verilmedi. Örnek: zeminler/pazar  (liste: --liste)")
    hedefler = hedefleri_coz(argv)
    if secenek["kaynak"] and len(hedefler) > 1:
        raise SystemExit("--kaynak tek bir hedefle kullanılır.")
    if secenek["akis"] and len(hedefler) > 1:
        raise SystemExit("--akis tek bir hedefle kullanılır (tek bir JSON yazar).")
    if len(hedefler) * secenek["aday"] > 40 and not secenek["akis"]:
        print(f"{len(hedefler)} hedef x {secenek['aday']} aday = {len(hedefler) * secenek['aday']} görsel.")
    return uret(hedefler, secenek)


if __name__ == "__main__":
    sys.exit(main())
