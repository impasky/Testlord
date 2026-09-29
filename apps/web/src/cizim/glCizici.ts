/**
 * GPU ÇİZİMİ (WebGL2) — aynı 3B model, tarayıcının izin verdiği en temiz
 * hâliyle (docs/24).
 *
 * SVG her yüzü tek düz renkle boyuyor; ne kadar dilim eklense yüzler
 * seçiliyor. Burada aynı model GPU'da çiziliyor:
 *
 * - Işık piksel başına: köşe normalleri (`Yuz.vn`) yüzün içinde ara
 *   değerleniyor, kule, kafa ve yamaç dilimsiz.
 * - 2×2 süper örnekleme: kenarlar tırtıksız.
 * - Yumuşak gölge: nesneler (bina, ağaç, figür) araziye ve birbirine gölge
 *   düşürüyor (gölge haritası + yüzde süzgeçli örnekleme).
 * - Akıllı kenar: çizgi yalnız siluette, keskin kırılımda ve renk
 *   değişiminde; yuvarlak yüzeyin içinde çizgi yok.
 *
 * Işık, palet ve kamera SVG çizimiyle aynı (`uc.ts`): iki yol yan yana
 * durduğunda aynı dünyanın parçası. Sonuç bir PNG; `Sahne` onu aynı SVG'nin
 * içine resim olarak koyuyor. WebGL2 yoksa ya da bağlam kaybolursa her şey
 * SVG çokgenleriyle çizilmeye devam ediyor.
 *
 * Bu dosya yalnız çizici: DOM'a dokunmuyor, işçide de (Web Worker +
 * OffscreenCanvas) ana iş parçacığında da aynı koşuyor. Sıra, önbellek ve
 * işçi `gl.ts`'de.
 */
import type { DumanKaynagi } from './duman';
import { KOSE, type Ag } from './glAg';
import { ISIK, ORTAM, YAYGIN, kameraTabani, type Kamera, type V3 } from './uc';

/** Süper örnekleme: her çıktı pikseli 2×2 örnek. */
const SS = 2;
/** Gölge haritası kenarı. */
const GOLGE_BOYU = 2048;
/**
 * 2×2 örneklenen çıktının en uzun kenarı: bellek sınırı. `Sahne` bunu
 * aşmıyor; daha büyük bir istek (dünya zemini) tek örnekle çiziliyor.
 */
export const EN_BUYUK = 1400;
/** Örnek hedeflerinin kenar sınırı; bundan büyük çıktı tek örnekle çiziliyor. */
const ORNEK_SINIRI = EN_BUYUK * SS;
/** Gölgedeki yüzün yaygın ışığından kalan pay. */
const GOLGE_GUC = 0.62;
/** Ortam gölgesinin gücü (yarıçap içinde yükselen komşuların ortalamasına çarpan). */
const AO_GUC = 2.2;
/**
 * Ortam gölgesine sayılan en düşük yükselti (komşunun yüzey düzlemiyle
 * yaptığı açının sinüsü, ~17°). Arazi düz yüzlü; köşe normali yumuşak
 * olduğu için komşu üçgenlerin sığ kıvrımı düzlemin biraz üstünde kalıyor
 * ve eşik düşükken çimde üçgenler tek tek kararıyordu. Duvar dibi (90°)
 * eşiğin çok üstünde.
 */
const AO_ESIK = 0.3;
/**
 * Dik metalin parıltı bandı: normalin göğe bükülmesi ve bandın gücü (bkz.
 * ana gölgelendiricide "parıltı bandı").
 */
const ZIRH_BUKUM = 0.8;
const ZIRH_PARILTI = 0.9;
/**
 * Tilt-shift: odak bandının dışında bulanıklık yarıçapı (çıktı enine oran)
 * ve bandın merkezi (0 alt, 1 üst). Maket etkisi: izometrik sahne yakından
 * çekilmiş bir minyatür gibi okunuyor.
 */
const TILT_YARICAP = 0.0065;
const TILT_ODAK = 0.56;
/** Işıyan yüzlerin haresi. */
const HARE_GUC = 0.55;
/**
 * Hareketli sahnenin ışık katmanı: hare ana resimdekinin kaç katı geniş ve
 * ne kadar güçlü. Sayfada titreyen bu katman ateşin çevresini soluk alıp
 * veriyormuş gibi açıp kısıyor.
 */
const KATMAN_HARE_YARICAP = 2;
const KATMAN_HARE_GUC = 1.1;

const ANA_KOSE = `#version 300 es
layout(location=0) in vec3 a_konum;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec3 a_renk;
layout(location=3) in vec4 a_ek;
layout(location=4) in vec4 a_su;
layout(location=5) in vec3 a_kum;
layout(location=6) in vec3 a_doku;
uniform mat4 u_goruntu;
// Salınan parçanın karesi: parça sayfadaki hücresine kaydırılıyor (kırpma uzayı).
uniform vec2 u_kaydir;
out vec3 v_konum;
out vec3 v_normal;
out vec3 v_renk;
out vec4 v_ek;
out vec4 v_su;
out vec3 v_kum;
out vec3 v_doku;
void main() {
  v_konum = a_konum;
  v_normal = a_normal;
  v_renk = a_renk;
  v_ek = a_ek;
  v_su = a_su;
  v_kum = a_kum;
  v_doku = a_doku;
  gl_Position = u_goruntu * vec4(a_konum, 1.0);
  gl_Position.xy += u_kaydir;
}`;

/*
 * Işık: gökyüzü/zemin ortam ışığı (üste bakan yüz göğün serinliğini, alta
 * bakan yerden yansıyan sıcaklığı alıyor; gölgeler hafif mavi) + hafif
 * sıcak güneş + parlak yüzlerde (metal, su) güneşin yansıması. Ortalama
 * parlaklık SVG çizimiyle aynı kalıyor, yalnız renk sıcaklığı ayrışıyor.
 */
const GOK = '0.93, 0.99, 1.10';
const YER = '1.09, 1.00, 0.88';
const GUNES = '1.05, 1.00, 0.92';

const ANA_PARCA = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_konum;
in vec3 v_normal;
in vec3 v_renk;
in vec4 v_ek;
in vec4 v_su;
in vec3 v_kum;
in vec3 v_doku;
uniform sampler2DShadow u_golge;
uniform mat4 u_isikMat;
uniform vec3 u_isik;
uniform vec3 u_goz;
uniform float u_golgeVar;
uniform float u_texel;
uniform float u_normalKay;
uniform float u_dalga;
uniform float u_yer;
// Salınan parçanın karesi: sahne (ana geçişin ek dokusu, kopya) önündeyse at.
uniform int u_sahneVar;
uniform sampler2D u_sahne;
uniform ivec2 u_sahneKay;
layout(location=0) out vec4 o_renk;
layout(location=1) out vec4 o_normal;
layout(location=2) out vec4 o_taban;
layout(location=3) out vec4 o_ek;
float golge(vec3 n) {
  if (u_golgeVar < 0.5) return 1.0;
  vec4 lp = u_isikMat * vec4(v_konum + n * u_normalKay, 1.0);
  vec3 s = lp.xyz * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 1.0;
  float t = 0.0;
  for (int i = -2; i <= 2; i++)
    for (int j = -2; j <= 2; j++)
      t += texture(u_golge, vec3(s.xy + vec2(float(i), float(j)) * u_texel, s.z - 0.0008));
  return t / 25.0;
}
float karma(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float gurultu(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(karma(i), karma(i + vec2(1.0, 0.0)), u.x),
             mix(karma(i + vec2(0.0, 1.0)), karma(i + vec2(1.0, 1.0)), u.x), u.y);
}
float dalga(vec2 p) {
  return gurultu(p) * 0.7 + gurultu(p * 2.1 + 7.1) * 0.3;
}
/*
 * Malzeme desenleri. Girdi: yüzey koordinatı (dünya birimi, v eğim boyunca
 * yukarı) ve piksel başına değişimi (kenar yumuşatma). Çıktı: (renk
 * çarpanı, kabartma: normalin yüzey boyunca u ve v yönüne eğimi).
 */
// Taş örgü / döşeme: sıralar kaydırmalı, taş başına ton; derz koyu ve
// gömük, taşın kenarı derze doğru pahlı.
vec3 orgu(vec2 uv, vec2 boy, float derz, float pah, vec2 aa) {
  float sira = floor(uv.y / boy.y);
  float x = uv.x + karma(vec2(sira, 7.31)) * boy.x;
  float blok = floor(x / boy.x);
  float fx = x - blok * boy.x;
  float fy = uv.y - sira * boy.y;
  float dx = min(fx, boy.x - fx);
  float dy = min(fy, boy.y - fy);
  float a = 0.7 * max(aa.x, aa.y) + 1e-4;
  float dm = min(dx, dy);
  float harc = 1.0 - smoothstep(derz - a, derz + a, dm);
  float ton = 0.93 + 0.2 * karma(vec2(blok, sira) + 0.37);
  vec2 e = dx < dy ? vec2(fx < 0.5 * boy.x ? -1.0 : 1.0, 0.0)
                   : vec2(0.0, fy < 0.5 * boy.y ? -1.0 : 1.0);
  e *= (1.0 - smoothstep(derz, derz + pah, dm)) * (1.0 - harc) * 0.55;
  return vec3(mix(ton, 0.64, harc), e);
}
// Kiremit (alaturka): sütun sütun yuvarlak kiremit, aralarında oluk; her
// sıranın alt dudağı alttakinin tepesine gölge düşürüyor.
vec3 kiremitDoku(vec2 uv, vec2 aa) {
  vec2 boy = vec2(0.5, 0.62);
  float sira = floor(uv.y / boy.y);
  float fy = uv.y / boy.y - sira;
  float x = uv.x / boy.x + 0.1 * (karma(vec2(sira, 3.1)) - 0.5);
  float kol = floor(x);
  float sx = (x - kol) * 2.0 - 1.0;
  float a = 0.7 * max(aa.x / boy.x, aa.y / boy.y) + 1e-4;
  float oluk = smoothstep(0.8 - 2.0 * a, 0.95, abs(sx));
  float golge = smoothstep(0.68, 1.0, fy);
  float ton = 0.97 + 0.2 * karma(vec2(kol, sira) + 1.7);
  float k = ton * (1.0 - 0.38 * oluk) * (1.0 - 0.32 * golge);
  vec2 e = vec2(sx * 0.55 * (1.0 - oluk), -0.55 * (1.0 - smoothstep(0.0, 0.16, fy)));
  return vec3(k, e);
}
// Arduvaz: yarım kaydırmalı ince levhalar, aralarında yarık; alt kenar
// kalın, üst sıranın gölgesi.
vec3 arduvazDoku(vec2 uv, vec2 aa) {
  vec2 boy = vec2(0.6, 0.45);
  float sira = floor(uv.y / boy.y);
  float fy = uv.y / boy.y - sira;
  float x = uv.x / boy.x + 0.5 * mod(sira, 2.0);
  float kol = floor(x);
  float fx = x - kol;
  float a = 0.7 * max(aa.x / boy.x, aa.y / boy.y) + 1e-4;
  float yarik = 1.0 - smoothstep(0.035 - a, 0.035 + a, min(fx, 1.0 - fx));
  float golge = smoothstep(0.7, 1.0, fy);
  float ton = 0.92 + 0.26 * karma(vec2(kol, sira) + 5.1);
  float k = ton * (1.0 - 0.4 * yarik) * (1.0 - 0.3 * golge);
  return vec3(k, 0.0, -0.5 * (1.0 - smoothstep(0.0, 0.14, fy)));
}
// Saman: eğim boyunca lifler, kat kat; her katın alt kenarı kabarık.
vec3 samanDoku(vec2 uv, vec2 aa) {
  float kat = 0.9;
  float sira = floor(uv.y / kat);
  float fy = uv.y / kat - sira;
  vec2 p = vec2(uv.x * 5.0, uv.y * 0.5 + sira * 13.7);
  float lif = gurultu(p) * 0.6 + gurultu(p * vec2(2.3, 1.0) + 3.3) * 0.4;
  float yan = gurultu(p + vec2(0.3, 0.0)) - gurultu(p - vec2(0.3, 0.0));
  float golge = smoothstep(0.62, 1.0, fy);
  float k = (0.9 + 0.3 * lif) * (1.0 - 0.3 * golge);
  return vec3(k, yan * 0.6, -0.45 * (1.0 - smoothstep(0.0, 0.2, fy)));
}
// Tahta kaplama: yatay tahtalar, aralarında ince yarık, arada bir ek
// yeri; her tahtanın alt kenarı alttakinin üstüne biniyor; boyunca lif.
vec3 tahtaDoku(vec2 uv, vec2 aa) {
  float H = 0.42;
  float sira = floor(uv.y / H);
  float fy = uv.y / H - sira;
  float a = 0.7 * aa.y / H + 1e-4;
  float yarik = 1.0 - smoothstep(0.045 - a, 0.045 + a, min(fy, 1.0 - fy));
  float x = uv.x / 3.2 + karma(vec2(sira, 2.3));
  float fx = fract(x) * 3.2;
  float b = 0.7 * aa.x + 1e-4;
  float ek = 1.0 - smoothstep(0.03 - b, 0.03 + b, min(fx, 3.2 - fx));
  float ton = 0.9 + 0.2 * karma(vec2(floor(x), sira) + 4.4);
  float lif = gurultu(vec2(uv.x * 0.9, uv.y * 16.0 + sira * 5.0));
  float k = ton * (0.9 + 0.2 * lif) * (1.0 - 0.45 * max(yarik, ek));
  return vec3(k, 0.0, -0.45 * (1.0 - smoothstep(0.0, 0.25, fy)));
}
vec3 malzeme(vec2 uv, vec2 aa, float no) {
  vec3 r;
  float olcu;
  if (no < 1.5) { r = orgu(uv, vec2(1.25, 0.6), 0.045, 0.1, aa); olcu = 0.6; }
  else if (no < 2.5) { r = orgu(uv, vec2(1.5, 1.15), 0.055, 0.14, aa); olcu = 1.15; }
  else if (no < 3.5) { r = kiremitDoku(uv, aa); olcu = 0.5; }
  else if (no < 4.5) { r = arduvazDoku(uv, aa); olcu = 0.45; }
  else if (no < 5.5) { r = samanDoku(uv, aa); olcu = 0.45; }
  else { r = tahtaDoku(uv, aa); olcu = 0.42; }
  // Desen piksele sığmayacak kadar küçülünce (şehir haritasındaki minik
  // bina) titreşmesin: yavaşça düz renge dönüyor.
  float sil = smoothstep(0.1, 0.3, max(aa.x, aa.y) / olcu);
  return vec3(mix(r.x, 1.0, sil), r.yz * (1.0 - sil));
}
vec2 paketle(float v) {
  v = clamp(v, 0.0, 0.99998);
  float h = floor(v * 255.0) / 255.0;
  return vec2(h, (v - h) * 255.0);
}
void main() {
  if (u_sahneVar == 1) {
    vec2 e = texelFetch(u_sahne, ivec2(gl_FragCoord.xy) - u_sahneKay, 0).rg;
    float sd = e.x + e.y / 255.0;
    // Boş piksel (hiçbir şey çizilmemiş) örtmüyor; zemin ve nesne örtüyor.
    if (sd > 1e-4 && gl_FragCoord.z > sd + 1e-4) discard;
  }
  // Su: derinlik piksel başına sınanıyor; kıyı çizgisi d = 0 eğrisi, bir
  // piksel genişliğinde yumuşak, üstünde kum şeridi (0 > d > -1), kıyıya
  // değdiği yerde ince açık şerit (köpük). Yüzeyde küçük dalgalar: eğim
  // gürültüden, güneşi yer yer yansıtıyor.
  float d = v_su.w;
  float w = max(fwidth(d), 1e-5);
  float s = smoothstep(-w, w, d);
  float kopuk = s * (1.0 - smoothstep(w, 4.0 * w, d));
  vec3 kara = mix(v_kum, v_renk, smoothstep(0.0, 1.0, -d));
  vec3 taban = mix(mix(kara, v_su.rgb, s), vec3(1.0), 0.22 * kopuk);
  vec3 n = normalize(v_normal);
  // Türevler dallanmadan önce: komşu piksel başka yüzden olabilir.
  vec3 yuzN = normalize(cross(dFdx(v_konum), dFdy(v_konum)));
  vec2 dokuAa = fwidth(v_doku.xy);
  if (s > 0.0) {
    // Yönlü, yumuşak kırışıklık: bir yanda uzun, öbür yanda kısa dalga.
    vec2 p = v_konum.xy * u_dalga * vec2(1.0, 2.4);
    float h0 = dalga(p);
    vec2 e = vec2(dalga(p + vec2(0.2, 0.0)) - h0, dalga(p + vec2(0.0, 0.2)) - h0) / 0.2;
    n = normalize(mix(n, normalize(vec3(-e * vec2(0.18, 0.42), 1.0)), s));
  }
  // Kenar bulucu desensiz rengi ve normali görüyor: derzde, kiremit
  // sırasında çizgi çekmesin.
  vec3 tabanCizgi = taban;
  vec3 nCizgi = n;
  if (v_doku.z > 0.5 && v_doku.z < 6.5 && s < 0.5) {
    // Yüzün çerçevesi, ağdakiyle aynı: u yatay (yüz boyunca), v eğim
    // boyunca yukarı; yatay yüzde x ve y.
    if (dot(yuzN, n) < 0.0) yuzN = -yuzN;
    float yu = length(yuzN.xy);
    vec3 t = vec3(1.0, 0.0, 0.0);
    vec3 b = vec3(0.0, 1.0, 0.0);
    if (!(v_doku.z > 1.5 && v_doku.z < 2.5) && yu >= 0.15) {
      t = vec3(-yuzN.y, yuzN.x, 0.0) / yu;
      b = cross(yuzN, t);
    }
    vec3 m = malzeme(v_doku.xy, dokuAa, v_doku.z);
    taban *= m.x;
    n = normalize(n + t * m.y + b * m.z);
  }
  float parlak = mix(v_ek.w, 0.85, s);
  vec3 c;
  // Ortam gölgesinin bu piksele ne kadar işleyeceği: ortam ışığının payı
  // ve biraz da güneş (temas hissi). Işıyan yüz ve su kararmıyor — suyun
  // kıyı üçgenleri eğimli, orada gölge suyun ortasına çizgi çekiyordu.
  float aoAgirlik = 0.0;
  float isima = 0.0;
  if (v_ek.x > 0.0) {
    float k = 0.75 + v_ek.x * 0.5;
    c = k <= 1.0 ? taban * k : taban + (1.0 - taban) * min(1.0, k - 1.0);
    isima = min(1.0, v_ek.x);
  } else {
    float g = golge(n);
    vec3 ortam = ${ORTAM.toFixed(4)} * mix(vec3(${YER}), vec3(${GOK}), n.z * 0.5 + 0.5);
    float dif = ${YAYGIN.toFixed(4)} * max(dot(n, u_isik), 0.0) * mix(${(1 - GOLGE_GUC).toFixed(4)}, 1.0, g);
    vec3 k = ortam + dif * vec3(${GUNES});
    c = taban * min(k, vec3(1.0)) + (1.0 - taban) * max(k - vec3(1.0), vec3(0.0));
    if (parlak > 0.0) {
      // Metal: göğü yansıtan yüz açılıyor, yeri yansıtan koyulaşıyor. Düz
      // yüzlü modelde her yüz tek bir değer alıyor; yüzler arasındaki bu
      // sert ayrım metali mat boyadan ayıran şey. Su kendi rengini koruyor.
      // Dik yüz (gövde zırhı, kılıç ağzı) güneşi hiç yansıtmıyor — kamera
      // tepeden bakıyor — ama ufkun güneş yanı parlak: yuvarlak zırhın
      // güneşe dönük yanı açılıyor, öbür yanı koyulaşıyor.
      vec3 r = reflect(-u_goz, n);
      float gok = smoothstep(-0.45, 0.45, r.z);
      float yan = max(dot(normalize(r.xy + vec2(1e-4)), normalize(u_isik.xy)), 0.0);
      float cevre = mix(0.7, 1.25, gok) + 0.75 * yan * yan * yan * (1.0 - abs(r.z));
      c *= mix(1.0, cevre, parlak * (1.0 - s));
      // Güneşin yansıması: yüzler iri, dar bir tepe çoğu yüzü ıskalıyor.
      vec3 h = normalize(u_isik + u_goz);
      float sp = pow(max(dot(n, h), 0.0), mix(10.0, 90.0, parlak * parlak)) * parlak * g;
      c += sp * 0.9 * vec3(${GUNES});
      // Parıltı bandı (stilize): tepeden bakan kamerada dik metal (gövde
      // zırhı, kılıç ağzı) güneşi fizik gereği hiç yansıtmıyor; normal
      // göğe doğru bükülünce güneşe ve bakana dönük yan, yuvarlak zırhın
      // üstünde dikey bir parlak şerit oluyor. Yatay ve eğik yüz zaten
      // yukarıdaki yansımayı alıyor; bu yalnız dik yüzde güçlü.
      float m = parlak * (1.0 - s);
      vec3 nb = normalize(n + vec3(0.0, 0.0, ${ZIRH_BUKUM.toFixed(2)}));
      float dik = 1.0 - abs(n.z);
      float bant = pow(max(dot(nb, h), 0.0), mix(8.0, 40.0, parlak * parlak));
      c += bant * m * dik * g * ${ZIRH_PARILTI.toFixed(2)} * vec3(${GUNES});
    }
    float o = (ortam.r + ortam.g + ortam.b) / 3.0;
    float pay = o / max(o + dif, 1e-3);
    aoAgirlik = (pay + (1.0 - pay) * 0.3) * (1.0 - s);
  }
  float a = v_ek.y;
  o_renk = vec4(min(c, vec3(1.0)) * a, a);
  o_normal = vec4(nCizgi * 0.5 + 0.5, v_ek.z);
  // Kaplama: 1 nesne, 0,75 yer (arazi, yol, tarla), 0,625 çimen (yer; malzeme 7,
  // hareket katmanının maskesi); 0 boş. Okuyanlar eşikle (0,5 ve 0,9) bakıyor.
  o_taban = vec4(tabanCizgi, u_yer > 0.5 ? (v_doku.z > 6.5 ? 0.625 : 0.75) : 1.0);
  // a: ortam gölgesi ağırlığı 0–0,9; 1 su (hareket katmanının maskesi).
  o_ek = vec4(paketle(gl_FragCoord.z), isima, s > 0.5 ? 1.0 : aoAgirlik * 0.9);
}`;

const GOLGE_KOSE = `#version 300 es
layout(location=0) in vec3 a_konum;
uniform mat4 u_isikMat;
void main() { gl_Position = u_isikMat * vec4(a_konum, 1.0); }`;

const GOLGE_PARCA = `#version 300 es
precision mediump float;
void main() {}`;

const COZ_KOSE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/*
 * Kenar, ortam gölgesi, hare ve indirgeme. Her çıktı pikseli 2×2 örneğin
 * ortalaması; her örnek kendi kenarını ve ortam gölgesini buluyor:
 *   1) Siluet: `r` uzaktaki komşu boşsa ya da belirgin arkadaysa (derinlik).
 *   2) Kırılım/renk: `r2` uzaktaki komşunun normali ya da taban rengi
 *      farklıysa — öndeki taraf çizer.
 *   3) Ortam gölgesi (ekran uzayı): yarıçap içindeki komşular yüzeyin
 *      önüne ne kadar yükseliyor. Bina dibi, çatı altı, ayak dibi, iki
 *      duvarın birleştiği köşe kararıyor. Yalnız ortam ışığına (ve biraz
 *      güneşe, temas hissi için) uygulanıyor; ışıyan yüz kararmıyor.
 * Sonra ışıyan yüzlerin (ateş, pencere, büyü) çevresine yumuşak hare.
 * Çizgi koyuluğu yüzün kendi değeri (SVG'deki kenar rengiyle aynı oran).
 */
const COZ_PARCA = `#version 300 es
precision highp float;
uniform sampler2D u_renk;
uniform sampler2D u_normal;
uniform sampler2D u_taban;
uniform sampler2D u_derinlik;
uniform sampler2D u_ek;
uniform ivec2 u_boyut;
uniform int u_r;
uniform int u_r2;
uniform float u_derinEsik;
uniform int u_ss;
uniform vec3 u_sag;
uniform vec3 u_yukari;
uniform vec3 u_goz;
uniform float u_birim;
uniform float u_derinBoy;
uniform float u_aoPx;
uniform float u_aoGuc;
uniform float u_hare;
uniform float u_harePx;
uniform float u_ton;
// 1: derinlik ek dokudan (salınan parçanın karesi: derinliğe yazmadan çiziliyor).
uniform int u_ekD;
// Çıktı kaydırması: salınan parçanın karesi atlasta başka yere yazılıyor.
uniform ivec2 u_kay;
out vec4 o;
/*
 * Renk düzenlemesi: hafif S eğrisi (orta ton yerinde, uçlar açılıyor),
 * az doygun renge biraz canlılık, gölgede serin ışıkta sıcak ton. Düz
 * boyanmış sahnenin "bilgisayar çizimi" soğukluğunu alıyor; arayüzün sıcak
 * paletine yaklaştırıyor.
 */
vec3 tonla(vec3 c) {
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.2);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float doy = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + 0.16 * (1.0 - doy));
  c *= mix(vec3(0.97, 0.99, 1.04), vec3(1.04, 1.0, 0.95), smoothstep(0.12, 0.85, l));
  return clamp(c, 0.0, 1.0);
}
ivec2 sinirla(ivec2 p) { return clamp(p, ivec2(0), u_boyut - 1); }
float ac(vec2 p) { return p.x + p.y / 255.0; }
float derin(ivec2 p) { return u_ekD == 1 ? ac(texelFetch(u_ek, p, 0).rg) : texelFetch(u_derinlik, p, 0).r; }
float titrek(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 gorunum(ivec2 p) {
  return vec3(vec2(p) * u_birim, -ac(texelFetch(u_ek, p, 0).rg) * u_derinBoy);
}
// Yüzeyin gerçek düzlemi, derinlikten: iki yandan kısa olan fark (kenarda
// öbür yüzeye atlamasın). Köşe normali yumuşak ama arazi düz yüzlü; eğik
// bir üçgende komşular yumuşak normalin düzleminin üstünde kalıyor ve
// üçgen toptan kararıyordu.
vec3 fark(ivec2 p, vec3 P, ivec2 d) {
  ivec2 ia = sinirla(p + d);
  ivec2 ib = sinirla(p - d);
  vec3 a = gorunum(ia) - P;
  vec3 b = P - gorunum(ib);
  // Çerçeve kenarında bir yan kendisine düşüyor (sıfır fark).
  if (ia == p) return b;
  if (ib == p) return a;
  return abs(a.z) < abs(b.z) ? a : b;
}
float ortamGolgesi(ivec2 p) {
  vec3 P = gorunum(p);
  vec3 N = normalize(cross(fark(p, P, ivec2(1, 0)), fark(p, P, ivec2(0, 1))));
  if (N.z < 0.0) N = -N;
  // Yer yeri örtmüyor: yol ve tarla araziye tek tek oturan düz plakalar,
  // üst üste bindikleri yerde halka halka kararıyorlardı. Yer yalnız
  // üstündeki nesneden (duvar, ağaç) gölge alıyor.
  bool yer = texelFetch(u_taban, p, 0).a < 0.9;
  float R = u_aoPx * u_birim;
  float aci = titrek(vec2(p)) * 6.2831853;
  float t = 0.0;
  for (int i = 0; i < 12; i++) {
    float f = (float(i) + 0.5) / 12.0;
    float a = aci + float(i) * 2.3999632;
    ivec2 q = sinirla(p + ivec2(vec2(cos(a), sin(a)) * f * u_aoPx));
    float kq = texelFetch(u_taban, q, 0).a;
    if (kq < 0.5 || (yer && kq < 0.9)) continue;
    vec3 v = gorunum(q) - P;
    float l = length(v);
    if (l < 1e-5) continue;
    t += max(0.0, (dot(v / l, N) - ${AO_ESIK.toFixed(2)}) / ${(1 - AO_ESIK).toFixed(2)}) * (1.0 - smoothstep(0.6 * R, R, l));
  }
  return clamp(1.0 - u_aoGuc * t / 12.0, 0.0, 1.0);
}
vec4 ornek(ivec2 p) {
  vec4 c = texelFetch(u_renk, p, 0);
  vec4 t = texelFetch(u_taban, p, 0);
  if (t.a < 0.5) return c;
  if (u_aoPx > 0.5) {
    float ea = texelFetch(u_ek, p, 0).a;
    float agirlik = ea < 0.95 ? ea / 0.9 : 0.0;
    if (agirlik > 0.01) c.rgb *= mix(1.0, ortamGolgesi(p), agirlik);
  }
  vec4 nn = texelFetch(u_normal, p, 0);
  vec3 n = nn.xyz * 2.0 - 1.0;
  float f = nn.a;
  if (f > 0.995) return c;
  float d = derin(p);
  ivec2 yon[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
  bool kenar = false;
  for (int i = 0; i < 4 && !kenar; i++) {
    ivec2 q = sinirla(p + yon[i] * u_r);
    if (texelFetch(u_taban, q, 0).a < 0.5) kenar = true;
    else if (derin(q) - d > u_derinEsik) kenar = true;
  }
  for (int i = 0; i < 4 && !kenar; i++) {
    ivec2 q = sinirla(p + yon[i] * u_r2);
    vec4 tq = texelFetch(u_taban, q, 0);
    if (tq.a < 0.5) continue;
    float dq = derin(q);
    if (d - dq > u_derinEsik) continue;
    vec3 nq = texelFetch(u_normal, q, 0).xyz * 2.0 - 1.0;
    if (dot(n, nq) < 0.8 || distance(t.rgb, tq.rgb) > 0.035) kenar = true;
  }
  if (kenar) c.rgb *= f;
  return c;
}
void main() {
  ivec2 b = (ivec2(gl_FragCoord.xy) - u_kay) * u_ss;
  vec4 s = vec4(0.0);
  for (int i = 0; i < u_ss; i++)
    for (int j = 0; j < u_ss; j++) s += ornek(b + ivec2(i, j));
  o = s / float(u_ss * u_ss);
  if (u_hare > 0.0) {
    vec3 g = vec3(0.0);
    float top = 0.0;
    float aci = titrek(gl_FragCoord.xy) * 6.2831853;
    for (int i = 0; i < 24; i++) {
      float f = sqrt((float(i) + 0.5) / 24.0);
      float a = aci + float(i) * 2.3999632;
      ivec2 q = sinirla(b + ivec2(vec2(cos(a), sin(a)) * f * u_harePx));
      float agirlik = exp(-3.0 * f * f);
      float e = texelFetch(u_ek, q, 0).b;
      if (e > 0.0) g += texelFetch(u_renk, q, 0).rgb * e * agirlik;
      top += agirlik;
    }
    g *= u_hare / top;
    o.rgb += g;
    o.a = min(1.0, o.a + (1.0 - o.a) * max(g.r, max(g.g, g.b)));
  }
  // Renk düzenlemesi önceden çarpılmamış renge (saydam figürün kenarı
  // kararmasın).
  if (u_ton > 0.0 && o.a > 0.004) {
    vec3 d = min(o.rgb / o.a, vec3(1.0));
    o.rgb = mix(d, tonla(d), u_ton) * o.a;
  }
}`;

/*
 * Tilt-shift: çözülmüş resim ara dokudan okunuyor; odak bandı keskin,
 * bandın dışında bulanıklık kenara doğru büyüyor (yumuşak adımla). Disk
 * biçimli 24 örnek, piksel başına döndürülmüş (bant bant iz kalmasın).
 * Önceden çarpılmış renk: saydam kenar doğru karışıyor.
 */
const BULANIK_PARCA = `#version 300 es
precision highp float;
uniform sampler2D u_kaynak;
uniform vec2 u_boyut;
uniform float u_odak;
uniform float u_bant;
uniform float u_yaricap;
uniform vec2 u_kay;
// Bandın ölçüldüğü yer kaynaktaki yerden farklıysa (salınan parçanın sayfası).
uniform vec2 u_bantKay;
out vec4 o;
float titrek(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 p = gl_FragCoord.xy - u_kay;
  float y = (p.y + u_bantKay.y) / u_boyut.y;
  float uzak = clamp((abs(y - u_odak) - u_bant) / max(1e-3, 0.5 - u_bant), 0.0, 1.0);
  float r = u_yaricap * uzak * uzak * (3.0 - 2.0 * uzak);
  if (r < 0.35) {
    o = texture(u_kaynak, p / u_boyut);
    return;
  }
  vec4 t = vec4(0.0);
  float aci = titrek(p) * 6.2831853;
  for (int i = 0; i < 24; i++) {
    float f = sqrt((float(i) + 0.5) / 24.0);
    float a = aci + float(i) * 2.3999632;
    t += texture(u_kaynak, (p + vec2(cos(a), sin(a)) * f * r) / u_boyut);
  }
  o = t / 24.0;
}`;

/*
 * Hareket katmanları: ana resimle aynı boyda ve kırpımda, ayrı PNG'ler.
 * Sayfa (`Sahne.hareket`) bunları CSS ile oynatıyor; GPU bir kez çiziyor.
 *   0) Su maskesi: pikselin ne kadarı su (beyaz, saydamlıkla). Üstünde
 *      kayan parıltı dokusu yalnız suya düşüyor; önündeki köprü, kayık,
 *      ağaç maskeyi zaten örtüyor (derinlik).
 *   1) Işık: ışıyan yüzlerin (ateş, pencere, büyü) rengi ve ana resimdekinden
 *      geniş bir hare. Sayfada "ekran" karışımıyla, saydamlığı titreyerek.
 *   2) Çimen maskesi: pikselin ne kadarı görünen çimen (yer, malzeme 7).
 *      Sayfada üstünden rüzgâr dalgaları kayıyor (ot çizgileri sayfanın
 *      küçük karosunda: gürültülü maske PNG'de sıkışmıyordu). Önündeki
 *      bina, ağaç, figür maskeyi örtüyor.
 * Önceden çarpılmış renk.
 */
const KATMAN_PARCA = `#version 300 es
precision highp float;
uniform sampler2D u_renk;
uniform sampler2D u_ek;
uniform sampler2D u_taban;
uniform ivec2 u_boyut;
uniform int u_ss;
uniform int u_tur;
uniform float u_harePx;
uniform float u_hare;
out vec4 o;
ivec2 sinirla(ivec2 p) { return clamp(p, ivec2(0), u_boyut - 1); }
float titrek(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 isiyan(ivec2 q) { return texelFetch(u_renk, q, 0).rgb * texelFetch(u_ek, q, 0).b; }
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * u_ss;
  float n = float(u_ss * u_ss);
  if (u_tur == 2) {
    float c = 0.0;
    for (int i = 0; i < u_ss; i++)
      for (int j = 0; j < u_ss; j++) {
        float k = texelFetch(u_taban, b + ivec2(i, j), 0).a;
        c += step(0.55, k) * step(k, 0.7);
      }
    o = vec4(c / n);
    return;
  }
  if (u_tur == 0) {
    float su = 0.0;
    for (int i = 0; i < u_ss; i++)
      for (int j = 0; j < u_ss; j++) su += step(0.95, texelFetch(u_ek, b + ivec2(i, j), 0).a);
    o = vec4(su / n);
    return;
  }
  vec3 g = vec3(0.0);
  for (int i = 0; i < u_ss; i++)
    for (int j = 0; j < u_ss; j++) g += isiyan(b + ivec2(i, j));
  g /= n;
  vec3 h = vec3(0.0);
  float top = 0.0;
  float aci = titrek(gl_FragCoord.xy) * 6.2831853;
  for (int i = 0; i < 32; i++) {
    float f = sqrt((float(i) + 0.5) / 32.0);
    float a = aci + float(i) * 2.3999632;
    float w = exp(-2.5 * f * f);
    h += isiyan(sinirla(b + ivec2(vec2(cos(a), sin(a)) * f * u_harePx))) * w;
    top += w;
  }
  g = min(g * 0.6 + h * u_hare / top, vec3(1.0));
  o = vec4(g, max(g.r, max(g.g, g.b)));
}`;

type Tuval = OffscreenCanvas | HTMLCanvasElement;

interface Kaynak {
  gl: WebGL2RenderingContext;
  tuval: Tuval;
  ana: WebGLProgram;
  golge: WebGLProgram;
  coz: WebGLProgram;
  bulanik: WebGLProgram;
  katman: WebGLProgram;
  golgeFbo: WebGLFramebuffer;
  golgeDoku: WebGLTexture;
  anaFbo: WebGLFramebuffer;
  dokular: WebGLTexture[];
  derinlik: WebGLTexture;
  /** Ana hedeflerin şu anki boyu (büyüyerek). */
  en: number;
  boy: number;
  /** Tilt-shift ara hedefi: çözülmüş resim, çıktı boyunda. */
  araFbo: WebGLFramebuffer;
  ara: WebGLTexture;
  araEn: number;
  araBoy: number;
  /** Salınan parçaların kare atlası (GPU'da kuruluyor, en sonda bir kez okunuyor). */
  atlasFbo: WebGLFramebuffer;
  atlas: WebGLTexture;
  atlasEn: number;
  atlasBoy: number;
  /** Ana geçişin ek dokusunun kopyası: salınan parçaları sahnenin önündekiler örtüyor. */
  sahneFbo: WebGLFramebuffer;
  sahne: WebGLTexture;
  sahneEn: number;
  sahneBoy: number;
}

let kaynak: Kaynak | null = null;
let durum: 'denenmedi' | 'hazir' | 'yok' = 'denenmedi';

function derle(gl: WebGL2RenderingContext, kose: string, parca: string): WebGLProgram {
  const yap = (tur: number, kaynak: string) => {
    const s = gl.createShader(tur)!;
    gl.shaderSource(s, kaynak);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) ?? 'derlemeHatasi');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, yap(gl.VERTEX_SHADER, kose));
  gl.attachShader(p, yap(gl.FRAGMENT_SHADER, parca));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? 'baglamaHatasi');
  return p;
}

function doku(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

/**
 * Yazılım sürücüsü: GPU yok, WebGL işlemcide öykünülüyor (SwiftShader,
 * llvmpipe, Windows'un temel sürücüsü). Orada bu çizici hem yavaş hem
 * pahalı — 2×2 örnekleme ve gölge haritası bütün çekirdekleri alıp ana
 * iş parçacığını ve CSS geçişlerini aç bırakıyordu. SVG orada daha iyi.
 */
const YAZILIM = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function yazilimMi(gl: WebGL2RenderingContext): boolean {
  const e = gl.getExtension('webgl_debug_renderer_info');
  const ad = `${gl.getParameter(gl.RENDERER)} ${e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''}`;
  return YAZILIM.test(ad);
}

function kur(yazilimaIzin = false): Kaynak | null {
  if (durum === 'yok') return null;
  if (kaynak) return kaynak;
  try {
    const tuval: Tuval =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    const gl = tuval.getContext('webgl2', {
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('webgl2Yok');
    if (!yazilimaIzin && yazilimMi(gl)) {
      gl.getExtension('webgl_lose_context')?.loseContext();
      throw new Error('yazilimSurucu');
    }
    (tuval as HTMLCanvasElement).addEventListener?.('webglcontextlost', (e: Event) => {
      e.preventDefault();
      durum = 'yok';
      kaynak = null;
    });

    const golgeDoku = doku(gl);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.DEPTH_COMPONENT24,
      GOLGE_BOYU,
      GOLGE_BOYU,
      0,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT,
      null,
    );
    const golgeFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, golgeFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, golgeDoku, 0);

    kaynak = {
      gl,
      tuval,
      ana: derle(gl, ANA_KOSE, ANA_PARCA),
      golge: derle(gl, GOLGE_KOSE, GOLGE_PARCA),
      coz: derle(gl, COZ_KOSE, COZ_PARCA),
      bulanik: derle(gl, COZ_KOSE, BULANIK_PARCA),
      katman: derle(gl, COZ_KOSE, KATMAN_PARCA),
      golgeFbo,
      golgeDoku,
      anaFbo: gl.createFramebuffer()!,
      dokular: [doku(gl), doku(gl), doku(gl), doku(gl)],
      derinlik: doku(gl),
      en: 0,
      boy: 0,
      araFbo: gl.createFramebuffer()!,
      ara: doku(gl),
      araEn: 0,
      araBoy: 0,
      atlasFbo: gl.createFramebuffer()!,
      atlas: doku(gl),
      atlasEn: 0,
      atlasBoy: 0,
      sahneFbo: gl.createFramebuffer()!,
      sahne: doku(gl),
      sahneEn: 0,
      sahneBoy: 0,
    };
    // Ara doku süzgeçli okunuyor (bulanıklık örnekleri piksel arasına düşüyor).
    gl.bindTexture(gl.TEXTURE_2D, kaynak.ara);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    durum = 'hazir';
    return kaynak;
  } catch {
    durum = 'yok';
    kaynak = null;
    return null;
  }
}

/**
 * Ana hedefleri gereken boya büyütür (iş sürerken küçültmüyor: bir sonraki
 * iş yine sığsın). Bellek yetmezse false: o iş SVG'ye düşüyor.
 */
function hedefleriHazirla(k: Kaynak, en: number, boy: number): boolean {
  const { gl } = k;
  if (en <= k.en && boy <= k.boy) return true;
  k.en = Math.max(en, k.en);
  k.boy = Math.max(boy, k.boy);
  // Önceki hatalar sayılmasın (sınırlı: bağlam kaybında da döngü bitsin).
  for (let i = 0; i < 8 && gl.getError() !== gl.NO_ERROR; i++);
  hedefleriAyir(k);
  const tamam =
    gl.getError() !== gl.OUT_OF_MEMORY &&
    gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  if (!tamam) {
    // Bir dahaki iş (belki daha küçük) sıfırdan ayırsın.
    k.en = 0;
    k.boy = 0;
  }
  return tamam;
}

/** Tilt-shift ara hedefini çıktı boyuna getirir; bellek yetmezse false (bulanıklıksız çizilir). */
function araHazirla(k: Kaynak, en: number, boy: number): boolean {
  const { gl } = k;
  if (k.araEn === en && k.araBoy === boy) return true;
  for (let i = 0; i < 8 && gl.getError() !== gl.NO_ERROR; i++);
  gl.bindTexture(gl.TEXTURE_2D, k.ara);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, en, boy, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, k.araFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, k.ara, 0);
  const tamam =
    gl.getError() !== gl.OUT_OF_MEMORY &&
    gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  k.araEn = tamam ? en : 0;
  k.araBoy = tamam ? boy : 0;
  return tamam;
}

/** Tek renk hedefini (doku + çerçeve) gereken boya getirir; bellek yetmezse false. */
function hedefHazirla(
  gl: WebGL2RenderingContext,
  fbo: WebGLFramebuffer,
  t: WebGLTexture,
  en: number,
  boy: number,
): boolean {
  for (let i = 0; i < 8 && gl.getError() !== gl.NO_ERROR; i++);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, en, boy, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return (
    gl.getError() !== gl.OUT_OF_MEMORY &&
    gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  );
}

/**
 * Salınan parçaların hedefleri: kare atlası ve sahnenin derinlik kopyası.
 * Bellek yetmezse false: parçalar ana resme durağan çiziliyor.
 */
function atlasHazirla(k: Kaynak, en: number, boy: number, sen: number, sboy: number): boolean {
  const { gl } = k;
  if (k.atlasEn !== en || k.atlasBoy !== boy) {
    const tamam = hedefHazirla(gl, k.atlasFbo, k.atlas, en, boy);
    k.atlasEn = tamam ? en : 0;
    k.atlasBoy = tamam ? boy : 0;
    if (!tamam) return false;
  }
  if (k.sahneEn !== sen || k.sahneBoy !== sboy) {
    const tamam = hedefHazirla(gl, k.sahneFbo, k.sahne, sen, sboy);
    k.sahneEn = tamam ? sen : 0;
    k.sahneBoy = tamam ? sboy : 0;
    if (!tamam) return false;
  }
  return true;
}

/**
 * Parça kutularını çizim sayfalarına yerleştirir (raf raf; aralarında boşluk:
 * ortam gölgesi ve bulanıklık komşu hücreye uzanmasın). Her sayfa ana
 * hedeflerin boyunda; genelde tek sayfa.
 */
export function sayfalaraYerlestir(
  kutular: [number, number, number, number][],
  en: number,
  boy: number,
  bosluk: number,
): { sayfa: number; x: number; y: number }[] {
  const yer: { sayfa: number; x: number; y: number }[] = [];
  let sayfa = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  for (const [, , w, h] of kutular) {
    if (x > 0 && x + w > en) {
      x = 0;
      y += raf + bosluk;
      raf = 0;
    }
    if (y > 0 && y + h > boy) {
      sayfa++;
      x = 0;
      y = 0;
      raf = 0;
    }
    yer.push({ sayfa, x, y });
    x += w + bosluk;
    raf = Math.max(raf, h);
  }
  return yer;
}

function hedefleriAyir(k: Kaynak) {
  const { gl } = k;
  for (const t of k.dokular) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, k.en, k.boy, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, k.derinlik);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.DEPTH_COMPONENT24,
    k.en,
    k.boy,
    0,
    gl.DEPTH_COMPONENT,
    gl.UNSIGNED_INT,
    null,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, k.anaFbo);
  k.dokular.forEach((t, i) =>
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0),
  );
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, k.derinlik, 0);
}

/** Satır satır verilen 4×4 matrisi GLSL'in sütun sırasına çevirir. */
function matris(satirlar: number[][]): Float32Array {
  const m = new Float32Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) m[c * 4 + r] = satirlar[r]![c]!;
  return m;
}

const nokta = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Derinlik tamponunun dünya birimindeki boyu (görüntü matrisiyle aynı pay). */
function derinlikBoyu(derinlik: [number, number]): number {
  const pay = (derinlik[1] - derinlik[0]) * 0.02 + 0.01;
  return derinlik[1] - derinlik[0] + 2 * pay;
}

/** Görüntü: dünya → SVG görüş kutusu (y aşağı) → kırpma uzayı. */
export function goruntuMatrisi(
  kamera: Kamera | undefined,
  kutu: [number, number, number, number],
  derinlik: [number, number],
): Float32Array {
  const { sag, yukari, c } = kameraTabani(kamera);
  const [vx, vy, vw, vh] = kutu;
  const pay = (derinlik[1] - derinlik[0]) * 0.02 + 0.01;
  const d0 = derinlik[0] - pay;
  const aralik = derinlik[1] + pay - d0;
  return matris([
    [(sag[0] * 2) / vw, (sag[1] * 2) / vw, (sag[2] * 2) / vw, (-2 * vx) / vw - 1],
    [(yukari[0] * 2) / vh, (yukari[1] * 2) / vh, (yukari[2] * 2) / vh, (2 * vy) / vh + 1],
    [(-2 * c[0]) / aralik, (-2 * c[1]) / aralik, (-2 * c[2]) / aralik, 1 + (2 * d0) / aralik],
    [0, 0, 0, 1],
  ]);
}

/** Işık kamerası: ışığa dik ortografik kutu, sahnenin bütün köşelerini içine alıyor. */
function isikKamerasi(ag: Ag, lz: V3): { mat: Float32Array; genislik: number } {
  const bx: V3 = [-lz[1], lz[0], 0];
  const lb = Math.hypot(bx[0], bx[1]) || 1;
  const lx: V3 = [bx[0] / lb, bx[1] / lb, 0];
  const ly: V3 = [
    lz[1] * lx[2] - lz[2] * lx[1],
    lz[2] * lx[0] - lz[0] * lx[2],
    lz[0] * lx[1] - lz[1] * lx[0],
  ];
  const en = [Infinity, Infinity, Infinity];
  const cok = [-Infinity, -Infinity, -Infinity];
  for (const x of [ag.enAz[0], ag.enCok[0]])
    for (const y of [ag.enAz[1], ag.enCok[1]])
      for (const z of [ag.enAz[2], ag.enCok[2]]) {
        const q: V3 = [x, y, z];
        [nokta(q, lx), nokta(q, ly), nokta(q, lz)].forEach((v, i) => {
          en[i] = Math.min(en[i]!, v);
          cok[i] = Math.max(cok[i]!, v);
        });
      }
  const sx = cok[0]! - en[0]! || 1;
  const sy = cok[1]! - en[1]! || 1;
  const sz = cok[2]! - en[2]! || 1;
  return {
    mat: matris([
      [(2 * lx[0]) / sx, (2 * lx[1]) / sx, (2 * lx[2]) / sx, (-2 * en[0]!) / sx - 1],
      [(2 * ly[0]) / sy, (2 * ly[1]) / sy, (2 * ly[2]) / sy, (-2 * en[1]!) / sy - 1],
      [(-2 * lz[0]) / sz, (-2 * lz[1]) / sz, (-2 * lz[2]) / sz, 1 + (2 * en[2]!) / sz],
      [0, 0, 0, 1],
    ]),
    genislik: Math.max(sx, sy),
  };
}

function tampon(gl: WebGL2RenderingContext, veri: Float32Array, yalnizKonum = false) {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const b = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, veri, gl.STATIC_DRAW);
  const adim = (yalnizKonum ? 3 : KOSE) * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, adim, 0);
  if (!yalnizKonum) {
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, adim, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, adim, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, adim, 36);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, adim, 52);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 3, gl.FLOAT, false, adim, 68);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 3, gl.FLOAT, false, adim, 80);
  }
  gl.bindVertexArray(null);
  return {
    vao,
    say: veri.length / (yalnizKonum ? 3 : KOSE),
    sil: () => {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(b);
    },
  };
}

/** Çizicinin işi: ağ hazır (modelden `agYap` ile). İşçiye aktarılabilir. */
export interface CizimIstegi {
  ag: Ag;
  /** Yazılım sürücüsünde de çiz (yalnız geliştirme ve denetim; bkz. `gl.ts`). */
  yazilimaIzin?: boolean;
  kamera?: Kamera;
  /** Görüş kutusu: SVG'nin viewBox'ı (x, y, en, boy). */
  kutu: [number, number, number, number];
  /** Çıktı boyu (piksel). */
  en: number;
  boy: number;
  /** Işık yönü; verilmezse bütün çizimlerin ışığı (`ISIK`). */
  isik?: V3;
  /** Ortam gölgesi yarıçapı (dünya birimi); 0 kapalı, verilmezse sahnenin boyundan. */
  ao?: number;
  /** Hare gücü; 0 kapalı. */
  hare?: number;
  /**
   * Tilt-shift: keskin kalan odak bandının yarı yüksekliği (çıktı boyuna
   * oran; bant ortada). Verilmezse yok. Yalnız geniş sahneler (bölge afişi,
   * ekran zemini, diyar kapağı) istiyor; figür ve bina simgesi değil.
   */
  tilt?: number;
  /** Renk düzenlemesinin gücü (0 kapalı, 1 tam); verilmezse tam. */
  ton?: number;
  /**
   * Hareket katmanlarını da çiz (su maskesi, ışık, çimen maskesi; bkz. `KATMAN_PARCA`).
   * Ağ `agYap(..., { dumansiz: true })` ile kurulmuş olmalı: duman sayfada
   * canlı yükseliyor.
   */
  hareket?: boolean;
  /**
   * Dalgalanan bayrakların kareleri (`bayrakAni.bayrakKareleri`). Ağ
   * `bayraksiz` kurulmuş olmalı: kumaş ana resimde yok, atlasta dalgalanıyor.
   */
  bayrak?: BayrakKareleri;
  /** Bir CSS pikselinin çıktıdaki karşılığı: kenar çizgisinin kalınlığı. */
  olcek: number;
}

/** Bayrak kumaşının her anı; her karede bayraklar aynı sırayla ardışık. */
export interface BayrakKareleri {
  /** Kare sayısı: en uzun turunki. */
  kare: number;
  /**
   * f. karenin üçgen tamponu (`KOSE` düzeninde, ağın nesne tamponu gibi).
   * Tembel: çizici kareleri sırayla istiyor, her kare istenince kuruluyor
   * ve çizildikten sonra bırakılıyor (bellekte bir kare).
   */
  kareAl?: (f: number) => Float32Array;
  /** Önceden kurulmuş kareler: işçiye aktarılabilen biçim (`kareleriKur`). */
  kareler?: Float32Array[];
  /** Her bayrağın bir karedeki köşe sayısı (bütün karelerde aynı). */
  gruplar: number[];
  /** Her bayrağın bir turunun süresi (sn): sayfa kareleri bu hızda oynatıyor. */
  sureler: number[];
  /**
   * Her parçanın bir turundaki kare sayısı (canlı parçada kendi sayısı);
   * verilmezse hepsi `kareler.length`. Turu kısa olan parça sonraki
   * karelerde çizilmiyor.
   */
  kareSayilari?: number[];
  /**
   * Her parçanın bütün karelerde kameranın düzleminde kapladığı yer (dünya
   * birimi): [sağ en az, sağ en çok, yukarı en az, yukarı en çok]. Atlas
   * kareler kurulmadan bununla yerleştiriliyor.
   */
  kapsam: [number, number, number, number][];
}

/** f. karenin tamponu: tembelse kuruluyor, değilse hazır. */
function kareTamponu(by: BayrakKareleri, f: number): Float32Array {
  return by.kareAl ? by.kareAl(f) : by.kareler![f]!;
}

/** Bayrak atlası: her bayrak bir satır, satırda kareler yan yana. */
export interface BayrakAtlasi {
  resim: Blob;
  /** Her bayrağın resimdeki kutusu (x, y, en, boy; piksel, y aşağı); boşsa 0 boy. */
  kutular: [number, number, number, number][];
  /** Resmin (ana çıktının) boyu: kutuların ölçeği. */
  en: number;
  boy: number;
  kare: number;
  /** Her bayrağın bir turunun süresi (sn). */
  sureler: number[];
  /** Her parçanın kare sayısı (bkz. `BayrakKareleri.kareSayilari`). */
  kareSayilari: number[];
}

/** Çizimin çıktısı: resim ve (hareketli sahnede, varsa) katmanları. */
export interface CizimSonucu {
  resim: Blob;
  su?: Blob;
  isik?: Blob;
  cimen?: Blob;
  bayrak?: BayrakAtlasi;
  /** Canlı dumanın kaynakları (hareketli sahne; bkz. `duman.ts`). */
  dumanlar?: DumanKaynagi[];
}

/** Atlas rafının eni: çok ağaçlı sahnede atlas tek uzun sütun olmasın. */
const ATLAS_EN = 4096;

/**
 * Atlasın düzeni: her parçanın kareleri yan yana bir blok; bloklar raf raf
 * (raf dolunca alta). `yer`: her bloğun sol üstü.
 */
export function atlasDuzeni(
  kutular: [number, number, number, number][],
  kare: number | number[],
): { yer: [number, number][]; en: number; boy: number; sutun: number[] } {
  const say = (i: number) => (typeof kare === 'number' ? kare : (kare[i] ?? 1));
  // Uzun turlu parça (canlı: koşan at, 48 kare) rafa sığmıyorsa kareleri
  // satır satır sarılıyor: sütun sayısı kare sayısını tam bölen, rafa
  // sığan en büyük sayı (son satır da dolu, sayfa iki adımla oynatıyor).
  const sutun = kutular.map(([, , w], i) => {
    const k = say(i);
    const sigan = Math.max(1, Math.floor(ATLAS_EN / Math.max(1, w)));
    let s = Math.min(k, sigan);
    while (k % s) s--;
    return s;
  });
  const raf = Math.max(ATLAS_EN, ...kutular.map(([, , w], i) => w * sutun[i]!));
  const yer: [number, number][] = [];
  let x = 0;
  let y = 0;
  let h0 = 0;
  let en = 0;
  kutular.forEach(([, , w, h], i) => {
    const b = w * sutun[i]!;
    const bh = h * (say(i) / sutun[i]!);
    if (x > 0 && x + b > raf) {
      y += h0;
      x = 0;
      h0 = 0;
    }
    yer.push([x, y]);
    x += b;
    h0 = Math.max(h0, bh);
    en = Math.max(en, x);
  });
  return { yer, en, boy: y + h0, sutun };
}

async function blobla(tuval: Tuval): Promise<Blob | null> {
  if ('convertToBlob' in tuval) return tuval.convertToBlob({ type: 'image/png' });
  return new Promise((coz) => (tuval as HTMLCanvasElement).toBlob((b) => coz(b), 'image/png'));
}

/**
 * İşçiye giden iş: kurulmuş ağ, ya da yalnız çizimin anahtarı (`tarif`).
 * Tarifte model, ağ, bayrak kareleri ve duman kaynakları işçide kuruluyor
 * (`tarif.ts`); ana iş parçacığına yalnız bir dizge düşüyor.
 */
export type IsciIstegi = CizimIstegi | (Omit<CizimIstegi, 'ag' | 'bayrak'> & { tarif: string });

/** İşçinin cevabı: resim, ya da "burada WebGL2 yok" (ağ geri aktarılıyor). */
export interface IsciCevabi {
  id: number;
  sonuc?: CizimSonucu | null;
  yok?: boolean;
  ag?: Ag;
  bayrak?: BayrakKareleri;
  dumanlar?: DumanKaynagi[];
}

/** İsteğin tamponları: işçiyle kopyasız (aktararak) gidip geliyor. */
export const aktarilanlar = ({
  ag,
  bayrak,
}: {
  ag?: Ag;
  bayrak?: BayrakKareleri;
}): Transferable[] =>
  ag
    ? [
        ag.yer.buffer,
        ag.nesne.buffer,
        ag.saydam.buffer,
        ag.golge.buffer,
        ag.bez.buffer,
        ...(bayrak?.kareler?.map((k) => k.buffer) ?? []),
      ]
    : [];

/** Çizicinin durumu: `yok` ise WebGL2 bu bağlamda yok ya da kayboldu. */
export function glDurumu(): typeof durum {
  return durum;
}

/**
 * Tek bir çizim: PNG blob'ları ya da (WebGL yoksa/bozulduysa) null. Çağıran
 * işleri tek tek veriyor (sıra `gl.ts`'de ve işçide).
 */
export async function cizBlob(istek: CizimIstegi): Promise<CizimSonucu | null> {
  clearTimeout(bosaltma);
  try {
    return await ciz(istek);
  } finally {
    bosaltma = setTimeout(bosalt, BOSTA_MS);
  }
}

async function ciz(istek: CizimIstegi): Promise<CizimSonucu | null> {
  const k = kur(istek.yazilimaIzin);
  if (!k) return null;
  const { gl } = k;
  const { ag } = istek;
  const en = Math.max(1, Math.min(ORNEK_SINIRI, Math.round(istek.en)));
  const boy = Math.max(1, Math.min(ORNEK_SINIRI, Math.round(istek.boy)));
  // Büyük çıktı (dünya zemini) tek örnekle: 2×2'si bellek sınırını aşıyor.
  const ss = Math.max(en, boy) * SS <= ORNEK_SINIRI ? SS : 1;
  const sen = en * ss;
  const sboy = boy * ss;
  if (!hedefleriHazirla(k, sen, sboy)) return null;

  const goruntu = goruntuMatrisi(istek.kamera, istek.kutu, ag.derinlik);
  const lz = istek.isik ?? ISIK;
  const isik = isikKamerasi(ag, lz);
  const golgeVar = ag.golge.length > 0;
  const silinecek: (() => void)[] = [];

  // 1) Gölge haritası: yalnız nesneler, iki yüzlü.
  if (golgeVar) {
    const t = tampon(gl, ag.golge, true);
    silinecek.push(t.sil);
    gl.bindFramebuffer(gl.FRAMEBUFFER, k.golgeFbo);
    gl.viewport(0, 0, GOLGE_BOYU, GOLGE_BOYU);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    gl.useProgram(k.golge);
    gl.uniformMatrix4fv(gl.getUniformLocation(k.golge, 'u_isikMat'), false, isik.mat);
    gl.bindVertexArray(t.vao);
    gl.drawArrays(gl.TRIANGLES, 0, t.say);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  // Salınan parçalar (bayrak, sancak, ağaç) için kare atlası kurulabilir
  // mi: kurulamazsa (çok büyük, bellek) onlar ana resme çiziliyor.
  const by = istek.hareket ? istek.bayrak : undefined;
  let plan: {
    kutular: [number, number, number, number][];
    duzen: ReturnType<typeof atlasDuzeni>;
    kare: number;
  } | null = null;
  if (by && by.kare > 0) {
    const r0 = Math.max(1, Math.round(0.7 * istek.olcek * ss));
    const tiltVar = istek.tilt !== undefined && istek.tilt < 0.5;
    const pay = 2 + r0 + (tiltVar ? Math.ceil(TILT_YARICAP * en) : 0);
    const kutular = bayrakKutulari(by, istek.kutu, en, boy, pay);
    const duzen = atlasDuzeni(kutular, by.kareSayilari ?? by.kare);
    const sinir = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (
      duzen.en > 0 &&
      duzen.boy > 0 &&
      duzen.en <= sinir &&
      duzen.boy <= sinir &&
      atlasHazirla(k, duzen.en, duzen.boy, sen, sboy)
    )
      plan = { kutular, duzen, kare: by.kare };
  }

  // 2) Ana geçiş: renk, normal+çizgi, taban rengi; derinlik.
  gl.bindFramebuffer(gl.FRAMEBUFFER, k.anaFbo);
  gl.drawBuffers([
    gl.COLOR_ATTACHMENT0,
    gl.COLOR_ATTACHMENT1,
    gl.COLOR_ATTACHMENT2,
    gl.COLOR_ATTACHMENT3,
  ]);
  gl.viewport(0, 0, sen, sboy);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, sen, sboy);
  for (let i = 0; i < 4; i++) gl.clearBufferfv(gl.COLOR, i, [0, 0, 0, 0]);
  gl.depthMask(true);
  gl.clearBufferfv(gl.DEPTH, 0, [1]);
  gl.disable(gl.SCISSOR_TEST);

  gl.useProgram(k.ana);
  const u = (ad: string) => gl.getUniformLocation(k.ana, ad);
  gl.uniformMatrix4fv(u('u_goruntu'), false, goruntu);
  gl.uniformMatrix4fv(u('u_isikMat'), false, isik.mat);
  gl.uniform3f(u('u_isik'), lz[0], lz[1], lz[2]);
  const taban = kameraTabani(istek.kamera);
  gl.uniform3f(u('u_goz'), taban.c[0], taban.c[1], taban.c[2]);
  // Dünya birimi / örnek pikseli; dalgalar ekranda ~11 piksellik.
  const birim = istek.kutu[2] / sen;
  gl.uniform1f(u('u_dalga'), 1 / (22 * birim));
  gl.uniform1f(u('u_golgeVar'), golgeVar ? 1 : 0);
  gl.uniform1f(u('u_texel'), 1 / GOLGE_BOYU);
  gl.uniform1f(u('u_normalKay'), (isik.genislik / GOLGE_BOYU) * 1.5);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, k.golgeDoku);
  gl.uniform1i(u('u_golge'), 0);
  gl.uniform2f(u('u_kaydir'), 0, 0);
  gl.uniform1i(u('u_sahneVar'), 0);
  // Kullanılmasa da örnekleyici geçerli bir birimde olmalı: gölge haritasıyla
  // (başka türde örnekleyici) aynı birim ya da hedefe bağlı bir doku çizimi
  // geçersiz kılıyor.
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, k.sahne);
  gl.uniform1i(u('u_sahne'), 1);
  gl.disable(gl.CULL_FACE);

  // a) Yer: ressam sırası, derinlik yok.
  gl.uniform1f(u('u_yer'), 1);
  if (ag.yer.length) {
    const t = tampon(gl, ag.yer);
    silinecek.push(t.sil);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(t.vao);
    gl.drawArrays(gl.TRIANGLES, 0, t.say);
  }
  // b) Nesneler: derinlik tamponu.
  gl.uniform1f(u('u_yer'), 0);
  if (ag.nesne.length) {
    const t = tampon(gl, ag.nesne);
    silinecek.push(t.sil);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.bindVertexArray(t.vao);
    gl.drawArrays(gl.TRIANGLES, 0, t.say);
  }
  // Salınan parçalar atlasa giremediyse burada, durağan.
  if (!plan && ag.bez.length) {
    const t = tampon(gl, ag.bez);
    silinecek.push(t.sil);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.bindVertexArray(t.vao);
    gl.drawArrays(gl.TRIANGLES, 0, t.say);
  }
  // c) Saydam: yalnız renge, önceden çarpılmış harmanla.
  if (ag.saydam.length) {
    const t = tampon(gl, ag.saydam);
    silinecek.push(t.sil);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(t.vao);
    gl.drawArrays(gl.TRIANGLES, 0, t.say);
    gl.disable(gl.BLEND);
  }

  // 3) Kenar + indirgeme → tuval (tilt-shift varsa önce ara dokuya).
  if (k.tuval.width !== en) k.tuval.width = en;
  if (k.tuval.height !== boy) k.tuval.height = boy;
  const tilt = istek.tilt !== undefined && istek.tilt < 0.5 && araHazirla(k, en, boy);
  gl.bindFramebuffer(gl.FRAMEBUFFER, tilt ? k.araFbo : null);
  gl.viewport(0, 0, en, boy);
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(true);
  const uc = (ad: string) => gl.getUniformLocation(k.coz, ad);
  const cozHazirla = () => {
    gl.useProgram(k.coz);
    ['u_renk', 'u_normal', 'u_taban'].forEach((ad, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, k.dokular[i]!);
      gl.uniform1i(uc(ad), i);
    });
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, k.derinlik);
    gl.uniform1i(uc('u_derinlik'), 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, k.dokular[3]!);
    gl.uniform1i(uc('u_ek'), 4);
  };
  cozHazirla();
  gl.uniform3f(uc('u_sag'), taban.sag[0], taban.sag[1], taban.sag[2]);
  gl.uniform3f(uc('u_yukari'), taban.yukari[0], taban.yukari[1], taban.yukari[2]);
  gl.uniform3f(uc('u_goz'), taban.c[0], taban.c[1], taban.c[2]);
  gl.uniform1f(uc('u_birim'), birim);
  gl.uniform1f(uc('u_derinBoy'), derinlikBoyu(ag.derinlik));
  // Ortam gölgesi yarıçapı: sahnenin boyuna göre (bina sahnesinde bir
  // kapı eşiği, figürde bir kol-gövde aralığı); örnek pikselinde sınırlı.
  const aoR =
    istek.ao ?? Math.min(1.2, Math.max(0.05, 0.012 * Math.max(istek.kutu[2], istek.kutu[3])));
  const aoPx = aoR > 0 ? Math.min(64, aoR / birim) : 0;
  gl.uniform1f(uc('u_aoPx'), aoPx);
  gl.uniform1i(uc('u_ekD'), 0);
  gl.uniform2i(uc('u_kay'), 0, 0);
  gl.uniform1f(uc('u_aoGuc'), AO_GUC);
  // Hare: ~6 CSS pikseli yarıçap.
  gl.uniform1f(uc('u_hare'), istek.hare ?? HARE_GUC);
  const harePx = Math.max(4, 6 * istek.olcek * ss);
  gl.uniform1f(uc('u_harePx'), harePx);
  gl.uniform2i(uc('u_boyut'), sen, sboy);
  // Çizgi: SVG'deki gibi ~0,7 CSS pikseli; siluette tek yanlı, kırılımda iki yanlı.
  gl.uniform1i(uc('u_ss'), ss);
  const r = Math.max(1, Math.round(0.7 * istek.olcek * ss));
  gl.uniform1i(uc('u_r'), r);
  gl.uniform1i(uc('u_r2'), Math.max(1, Math.round(r / 2)));
  // Derinlik sıçraması: dünya biriminde eşik, piksel boyuna göre büyüyor
  // (dik açıyla görülen yüzey komşusundan doğal olarak uzak).
  const aralik = ag.derinlik[1] - ag.derinlik[0] || 1;
  gl.uniform1f(uc('u_derinEsik'), Math.max(0.25, 6 * r * birim) / (aralik * 1.04));
  gl.uniform1f(uc('u_ton'), istek.ton ?? 1);
  gl.bindVertexArray(null);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // 4) Tilt-shift: ara doku → tuval.
  const ub = (ad: string) => gl.getUniformLocation(k.bulanik, ad);
  // Kaynak dokudan hedefe (kaydırarak); bant 1 ve yarıçap 0 düz kopya.
  const bulanikCiz = (
    hedef: WebGLFramebuffer | null,
    kay: [number, number],
    dokusu: WebGLTexture,
    boyut: [number, number],
    bant: number,
    yaricap: number,
    bantKay: [number, number] = [0, 0],
  ) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, hedef);
    gl.useProgram(k.bulanik);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dokusu);
    gl.uniform1i(ub('u_kaynak'), 0);
    gl.uniform2f(ub('u_boyut'), boyut[0], boyut[1]);
    gl.uniform1f(ub('u_odak'), TILT_ODAK);
    gl.uniform1f(ub('u_bant'), bant);
    gl.uniform1f(ub('u_yaricap'), yaricap);
    gl.uniform2f(ub('u_kay'), kay[0], kay[1]);
    gl.uniform2f(ub('u_bantKay'), bantKay[0], bantKay[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const bulandir = (
    hedef: WebGLFramebuffer | null = null,
    kay: [number, number] = [0, 0],
    bantKay: [number, number] = [0, 0],
  ) => {
    if (tilt) bulanikCiz(hedef, kay, k.ara, [en, boy], istek.tilt!, TILT_YARICAP * en, bantKay);
  };
  bulandir();

  for (const s of silinecek) s();
  if (gl.isContextLost()) return null;
  const resim = await blobla(k.tuval);
  if (!resim) return null;
  const sonuc: CizimSonucu = { resim };
  if (!istek.hareket) return sonuc;

  // 5) Hareket katmanları: aynı hedeflerden, aynı kırpım ve bulanıklıkla.
  // Her biri tuvale sırayla; önceki PNG'ye dönüşmeden tuval yeniden
  // çizilmiyor. Sıradaki iş bu bitmeden başlamıyor, hedefler yerinde.
  for (const [tur, ad, var_] of [
    [0, 'su', ag.suVar],
    [1, 'isik', ag.isimaVar],
    [2, 'cimen', ag.cimenVar],
  ] as const) {
    if (!var_) continue;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tilt ? k.araFbo : null);
    gl.viewport(0, 0, en, boy);
    gl.useProgram(k.katman);
    const uk = (ad: string) => gl.getUniformLocation(k.katman, ad);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, k.dokular[0]!);
    gl.uniform1i(uk('u_renk'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, k.dokular[3]!);
    gl.uniform1i(uk('u_ek'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, k.dokular[2]!);
    gl.uniform1i(uk('u_taban'), 2);
    gl.uniform2i(uk('u_boyut'), sen, sboy);
    gl.uniform1i(uk('u_ss'), ss);
    gl.uniform1i(uk('u_tur'), tur);
    gl.uniform1f(uk('u_harePx'), harePx * KATMAN_HARE_YARICAP);
    gl.uniform1f(uk('u_hare'), KATMAN_HARE_GUC);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    bulandir();
    if (gl.isContextLost()) return sonuc;
    const b = await blobla(k.tuval);
    if (b) sonuc[ad] = b;
  }

  // 6) Salınan parçalar (bayrak, sancak, ağaç): her karede bütün parçalar
  // tek geçişte, ana hedeflerde çakışmayan hücrelere kaydırılarak
  // çiziliyor (sayfa). Sahnenin önündekiler (kule, çatı, yamaç) ana geçişin
  // derinlik kopyasıyla örtüyor; parçanın kendi içi donanım derinliğiyle.
  // Sonra sayfa bir kez çözülüyor (kenar, ortam gölgesi, renk; tilt-shift
  // parçanın gerçek yerine göre) ve hücreler doğrudan GPU'daki atlasa
  // yazılıyor. Kare başına üç hedef değişimi, parça sayısından bağımsız
  // (telefonun döşemeli GPU'sunda her hedef değişimi pahalı). Ana resimde
  // bu parçalar yok (`bayraksiz`).
  if (plan && by) {
    const { kutular, duzen, kare } = plan;
    const [Wa, Ha] = [duzen.en, duzen.boy];
    const dolu = kutular.flatMap((q, i) => (q[2] > 0 && q[3] > 0 ? [i] : []));
    // Hücreler arası boşluk: ortam gölgesi ve bulanıklık komşuya uzanmasın.
    const bosluk = Math.max(Math.ceil(aoPx / ss), Math.ceil(TILT_YARICAP * en)) + 2;
    const yerlesim = sayfalaraYerlestir(kutular, en, boy, bosluk);
    const sayfaSayisi = dolu.reduce((m, i) => Math.max(m, yerlesim[i]!.sayfa + 1), 0);
    const bas: number[] = [];
    by.gruplar.reduce((t, n) => (bas.push(t), t + n), 0);
    const u = (ad: string) => gl.getUniformLocation(k.ana, ad);
    // Sahnenin derinliği (ek doku) kopyalanıyor: ana hedefler sayfaya gidiyor.
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, k.anaFbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT3);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, k.sahneFbo);
    gl.blitFramebuffer(0, 0, sen, sboy, 0, 0, sen, sboy, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, k.atlasFbo);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    const kareSayisi = (i: number) => by.kareSayilari?.[i] ?? kare;
    for (let f = 0; f < kare; f++) {
      const t = tampon(gl, kareTamponu(by, f));
      for (let sayfa = 0; sayfa < sayfaSayisi; sayfa++) {
        // Turu bu kareden kısa olan parça çizilmiyor (atlasta yeri yok).
        const uyeler = dolu.filter((i) => yerlesim[i]!.sayfa === sayfa && f < kareSayisi(i));
        if (!uyeler.length) continue;
        // a) Sayfa: hedefler ve derinlik boş, parçalar hücrelerinde.
        gl.bindFramebuffer(gl.FRAMEBUFFER, k.anaFbo);
        gl.drawBuffers([
          gl.COLOR_ATTACHMENT0,
          gl.COLOR_ATTACHMENT1,
          gl.COLOR_ATTACHMENT2,
          gl.COLOR_ATTACHMENT3,
        ]);
        gl.viewport(0, 0, sen, sboy);
        gl.disable(gl.SCISSOR_TEST);
        for (let j = 0; j < 4; j++) gl.clearBufferfv(gl.COLOR, j, [0, 0, 0, 0]);
        gl.depthMask(true);
        gl.clearBufferfv(gl.DEPTH, 0, [1]);
        gl.useProgram(k.ana);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, k.golgeDoku);
        gl.uniform1i(u('u_golge'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, k.sahne);
        gl.uniform1i(u('u_sahne'), 1);
        gl.uniform1i(u('u_sahneVar'), 1);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        gl.disable(gl.BLEND);
        gl.enable(gl.SCISSOR_TEST);
        gl.bindVertexArray(t.vao);
        for (const i of uyeler) {
          const [x, y, w, h] = kutular[i]!;
          const { x: px, y: py } = yerlesim[i]!;
          const dx = px - x;
          const dy = py - y;
          // Kutunun dışına taşan (ekran kenarında kırpılmış) parça komşu hücreye girmesin.
          gl.scissor(px * ss, (boy - py - h) * ss, w * ss, h * ss);
          gl.uniform2f(u('u_kaydir'), (2 * dx) / en, (-2 * dy) / boy);
          gl.uniform2i(u('u_sahneKay'), dx * ss, -dy * ss);
          gl.drawArrays(gl.TRIANGLES, bas[i]!, by.gruplar[i]!);
        }
        gl.bindVertexArray(null);
        gl.uniform2f(u('u_kaydir'), 0, 0);
        gl.uniform1i(u('u_sahneVar'), 0);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
        // b) Çözme: kenar ve ortam gölgesi parçanın kendi derinliğinden,
        // renk düzenlemesi; hare yok. Tilt-shift varsa bütün sayfa ara
        // dokuya, yoksa hücre hücre doğrudan atlasa.
        const hedefi = (i: number) => {
          const [x, y, w, h] = kutular[i]!;
          const { x: px, y: py } = yerlesim[i]!;
          const [ax, ay] = duzen.yer[i]!;
          const sutun = duzen.sutun[i]!;
          const hx = ax + (f % sutun) * w;
          const hy = Ha - (ay + Math.floor(f / sutun) * h) - h;
          return {
            hx,
            hy,
            w,
            h,
            kay: [hx - px, hy - (boy - py - h)] as [number, number],
            bantKay: [x - px, py - y] as [number, number],
          };
        };
        if (tilt) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, k.araFbo);
          gl.viewport(0, 0, en, boy);
          gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
          cozHazirla();
          gl.uniform1f(uc('u_hare'), 0);
          gl.uniform1i(uc('u_ekD'), 1);
          gl.uniform2i(uc('u_kay'), 0, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          // c) Bulanıklık: sayfadan atlasa, bant parçanın gerçek yerinden.
          gl.viewport(0, 0, Wa, Ha);
          gl.enable(gl.SCISSOR_TEST);
          for (const i of uyeler) {
            const { hx, hy, w, h, kay, bantKay } = hedefi(i);
            gl.scissor(hx, hy, w, h);
            bulandir(k.atlasFbo, kay, bantKay);
          }
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, k.atlasFbo);
          gl.viewport(0, 0, Wa, Ha);
          cozHazirla();
          gl.uniform1f(uc('u_hare'), 0);
          gl.uniform1i(uc('u_ekD'), 1);
          gl.enable(gl.SCISSOR_TEST);
          for (const i of uyeler) {
            const { hx, hy, w, h, kay } = hedefi(i);
            gl.scissor(hx, hy, w, h);
            gl.uniform2i(uc('u_kay'), kay[0], kay[1]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          }
        }
        gl.disable(gl.SCISSOR_TEST);
      }
      t.sil();
      if (gl.isContextLost()) return sonuc;
    }
    // Atlas → tuval → PNG (tek okuma).
    k.tuval.width = Wa;
    k.tuval.height = Ha;
    gl.viewport(0, 0, Wa, Ha);
    bulanikCiz(null, [0, 0], k.atlas, [Wa, Ha], 1, 0);
    if (gl.isContextLost()) return sonuc;
    const resim = await blobla(k.tuval);
    if (resim)
      sonuc.bayrak = {
        resim,
        kutular,
        en,
        boy,
        kare,
        sureler: by.sureler,
        kareSayilari: kutular.map((_, i) => kareSayisi(i)),
      };
  }
  return sonuc;
}

/**
 * Her bayrağın resimdeki kutusu: bütün karelerde kumaşın kapladığı yer
 * (`BayrakKareleri.kapsam`), kenar çizgisi ve bulanıklık payıyla; resmin
 * dışı kırpılmış.
 */
function bayrakKutulari(
  by: BayrakKareleri,
  [vx, vy, vw, vh]: [number, number, number, number],
  en: number,
  boy: number,
  pay: number,
): [number, number, number, number][] {
  return by.kapsam.map(([s0, s1, u0, u1]) => {
    // Ekranda y aşağı: yukarının en çoğu resmin tepesi.
    const x0 = ((s0 - vx) / vw) * en;
    const x1 = ((s1 - vx) / vw) * en;
    const y0 = ((-u1 - vy) / vh) * boy;
    const y1 = ((-u0 - vy) / vh) * boy;
    const a = Math.max(0, Math.floor(x0 - pay));
    const b = Math.max(0, Math.floor(y0 - pay));
    const c = Math.min(en, Math.ceil(x1 + pay));
    const d = Math.min(boy, Math.ceil(y1 + pay));
    return c > a && d > b ? [a, b, c - a, d - b] : [0, 0, 0, 0];
  });
}

/**
 * Sıra boşalınca büyük hedefler bırakılıyor: 2×2 örneklemeli tam ekran
 * bir afişin dokuları telefonda onlarca MB tutuyor; resim bir kez
 * çizildikten sonra onlara gerek yok. Gölge haritası ve programlar kalıyor
 * (bir sonraki iş yeniden derlemesin).
 */
const BOSTA_MS = 4000;
let bosaltma: ReturnType<typeof setTimeout> | undefined;

function bosalt() {
  const k = kaynak;
  if (!k || k.gl.isContextLost()) return;
  k.en = 1;
  k.boy = 1;
  hedefleriAyir(k);
  k.araEn = 0;
  k.araBoy = 0;
  k.gl.bindTexture(k.gl.TEXTURE_2D, k.ara);
  k.gl.texImage2D(k.gl.TEXTURE_2D, 0, k.gl.RGBA8, 1, 1, 0, k.gl.RGBA, k.gl.UNSIGNED_BYTE, null);
  k.atlasEn = 0;
  k.atlasBoy = 0;
  k.gl.bindTexture(k.gl.TEXTURE_2D, k.atlas);
  k.gl.texImage2D(k.gl.TEXTURE_2D, 0, k.gl.RGBA8, 1, 1, 0, k.gl.RGBA, k.gl.UNSIGNED_BYTE, null);
  k.sahneEn = 0;
  k.sahneBoy = 0;
  k.gl.bindTexture(k.gl.TEXTURE_2D, k.sahne);
  k.gl.texImage2D(k.gl.TEXTURE_2D, 0, k.gl.RGBA8, 1, 1, 0, k.gl.RGBA, k.gl.UNSIGNED_BYTE, null);
  k.tuval.width = 1;
  k.tuval.height = 1;
}
