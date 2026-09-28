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

const ANA_KOSE = `#version 300 es
layout(location=0) in vec3 a_konum;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec3 a_renk;
layout(location=3) in vec4 a_ek;
layout(location=4) in vec4 a_su;
layout(location=5) in vec3 a_kum;
uniform mat4 u_goruntu;
out vec3 v_konum;
out vec3 v_normal;
out vec3 v_renk;
out vec4 v_ek;
out vec4 v_su;
out vec3 v_kum;
void main() {
  v_konum = a_konum;
  v_normal = a_normal;
  v_renk = a_renk;
  v_ek = a_ek;
  v_su = a_su;
  v_kum = a_kum;
  gl_Position = u_goruntu * vec4(a_konum, 1.0);
}`;

const ANA_PARCA = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_konum;
in vec3 v_normal;
in vec3 v_renk;
in vec4 v_ek;
in vec4 v_su;
in vec3 v_kum;
uniform sampler2DShadow u_golge;
uniform mat4 u_isikMat;
uniform vec3 u_isik;
uniform float u_golgeVar;
uniform float u_texel;
uniform float u_normalKay;
layout(location=0) out vec4 o_renk;
layout(location=1) out vec4 o_normal;
layout(location=2) out vec4 o_taban;
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
void main() {
  // Su: derinlik piksel başına sınanıyor; kıyı çizgisi d = 0 eğrisi, bir
  // piksel genişliğinde yumuşak, üstünde kum şeridi (0 > d > -1). Su yüzeyi
  // yatay (ışığı düz alıyor), kıyıya değdiği yerde ince açık şerit (köpük).
  float d = v_su.w;
  float w = max(fwidth(d), 1e-5);
  float s = smoothstep(-w, w, d);
  float kopuk = s * (1.0 - smoothstep(w, 4.0 * w, d));
  vec3 kara = mix(v_kum, v_renk, smoothstep(0.0, 1.0, -d));
  vec3 taban = mix(mix(kara, v_su.rgb, s), vec3(1.0), 0.22 * kopuk);
  vec3 n = normalize(mix(normalize(v_normal), vec3(0.0, 0.0, 1.0), s));
  float k;
  if (v_ek.x > 0.0) {
    k = 0.75 + v_ek.x * 0.5;
  } else {
    float dif = max(dot(n, u_isik), 0.0);
    k = ${ORTAM.toFixed(4)} + ${YAYGIN.toFixed(4)} * dif * mix(${(1 - GOLGE_GUC).toFixed(4)}, 1.0, golge(n));
  }
  vec3 c = k <= 1.0 ? taban * k : taban + (1.0 - taban) * min(1.0, k - 1.0);
  float a = v_ek.y;
  o_renk = vec4(c * a, a);
  o_normal = vec4(n * 0.5 + 0.5, v_ek.z);
  o_taban = vec4(taban, 1.0);
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
 * Kenar ve indirgeme. Her çıktı pikseli 2×2 örneğin ortalaması; her örnek
 * kendi kenarını buluyor:
 *   1) Siluet: `r` uzaktaki komşu boşsa ya da belirgin arkadaysa (derinlik).
 *   2) Kırılım/renk: `r2` uzaktaki komşunun normali ya da taban rengi
 *      farklıysa — öndeki taraf çizer.
 * Çizgi koyuluğu yüzün kendi değeri (SVG'deki kenar rengiyle aynı oran).
 */
const COZ_PARCA = `#version 300 es
precision highp float;
uniform sampler2D u_renk;
uniform sampler2D u_normal;
uniform sampler2D u_taban;
uniform sampler2D u_derinlik;
uniform ivec2 u_boyut;
uniform int u_r;
uniform int u_r2;
uniform float u_derinEsik;
uniform int u_ss;
out vec4 o;
ivec2 sinirla(ivec2 p) { return clamp(p, ivec2(0), u_boyut - 1); }
vec4 ornek(ivec2 p) {
  vec4 c = texelFetch(u_renk, p, 0);
  vec4 t = texelFetch(u_taban, p, 0);
  if (t.a < 0.5) return c;
  vec4 nn = texelFetch(u_normal, p, 0);
  float f = nn.a;
  if (f > 0.995) return c;
  vec3 n = nn.xyz * 2.0 - 1.0;
  float d = texelFetch(u_derinlik, p, 0).r;
  ivec2 yon[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
  bool kenar = false;
  for (int i = 0; i < 4 && !kenar; i++) {
    ivec2 q = sinirla(p + yon[i] * u_r);
    if (texelFetch(u_taban, q, 0).a < 0.5) kenar = true;
    else if (texelFetch(u_derinlik, q, 0).r - d > u_derinEsik) kenar = true;
  }
  for (int i = 0; i < 4 && !kenar; i++) {
    ivec2 q = sinirla(p + yon[i] * u_r2);
    vec4 tq = texelFetch(u_taban, q, 0);
    if (tq.a < 0.5) continue;
    float dq = texelFetch(u_derinlik, q, 0).r;
    if (d - dq > u_derinEsik) continue;
    vec3 nq = texelFetch(u_normal, q, 0).xyz * 2.0 - 1.0;
    if (dot(n, nq) < 0.8 || distance(t.rgb, tq.rgb) > 0.035) kenar = true;
  }
  if (kenar) c.rgb *= f;
  return c;
}
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * u_ss;
  vec4 s = vec4(0.0);
  for (int i = 0; i < u_ss; i++)
    for (int j = 0; j < u_ss; j++) s += ornek(b + ivec2(i, j));
  o = s / float(u_ss * u_ss);
}`;

type Tuval = OffscreenCanvas | HTMLCanvasElement;

interface Kaynak {
  gl: WebGL2RenderingContext;
  tuval: Tuval;
  ana: WebGLProgram;
  golge: WebGLProgram;
  coz: WebGLProgram;
  golgeFbo: WebGLFramebuffer;
  golgeDoku: WebGLTexture;
  anaFbo: WebGLFramebuffer;
  dokular: WebGLTexture[];
  derinlik: WebGLTexture;
  /** Ana hedeflerin şu anki boyu (büyüyerek). */
  en: number;
  boy: number;
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
  const e = gl.getExtension('WEBGL_debug_renderer_info');
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
      gl.getExtension('WEBGL_lose_context')?.loseContext();
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
      golgeFbo,
      golgeDoku,
      anaFbo: gl.createFramebuffer()!,
      dokular: [doku(gl), doku(gl), doku(gl)],
      derinlik: doku(gl),
      en: 0,
      boy: 0,
    };
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
  /** Bir CSS pikselinin çıktıdaki karşılığı: kenar çizgisinin kalınlığı. */
  olcek: number;
}

async function blobla(tuval: Tuval): Promise<Blob | null> {
  if ('convertToBlob' in tuval) return tuval.convertToBlob({ type: 'image/png' });
  return new Promise((coz) => (tuval as HTMLCanvasElement).toBlob((b) => coz(b), 'image/png'));
}

/** İşçinin cevabı: resim, ya da "burada WebGL2 yok" (ağ geri aktarılıyor). */
export interface IsciCevabi {
  id: number;
  blob?: Blob | null;
  yok?: boolean;
  ag?: Ag;
}

/** Ağın tamponları: işçiyle kopyasız (aktararak) gidip geliyor. */
export const aktarilanlar = (ag: Ag): Transferable[] => [
  ag.yer.buffer,
  ag.nesne.buffer,
  ag.saydam.buffer,
  ag.golge.buffer,
];

/** Çizicinin durumu: `yok` ise WebGL2 bu bağlamda yok ya da kayboldu. */
export function glDurumu(): typeof durum {
  return durum;
}

/**
 * Tek bir çizim: PNG blob'u ya da (WebGL yoksa/bozulduysa) null. Çağıran
 * işleri tek tek veriyor (sıra `gl.ts`'de ve işçide).
 */
export async function cizBlob(istek: CizimIstegi): Promise<Blob | null> {
  clearTimeout(bosaltma);
  try {
    return await ciz(istek);
  } finally {
    bosaltma = setTimeout(bosalt, BOSTA_MS);
  }
}

async function ciz(istek: CizimIstegi): Promise<Blob | null> {
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

  // 2) Ana geçiş: renk, normal+çizgi, taban rengi; derinlik.
  gl.bindFramebuffer(gl.FRAMEBUFFER, k.anaFbo);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
  gl.viewport(0, 0, sen, sboy);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, sen, sboy);
  for (let i = 0; i < 3; i++) gl.clearBufferfv(gl.COLOR, i, [0, 0, 0, 0]);
  gl.depthMask(true);
  gl.clearBufferfv(gl.DEPTH, 0, [1]);
  gl.disable(gl.SCISSOR_TEST);

  gl.useProgram(k.ana);
  const u = (ad: string) => gl.getUniformLocation(k.ana, ad);
  gl.uniformMatrix4fv(u('u_goruntu'), false, goruntu);
  gl.uniformMatrix4fv(u('u_isikMat'), false, isik.mat);
  gl.uniform3f(u('u_isik'), lz[0], lz[1], lz[2]);
  gl.uniform1f(u('u_golgeVar'), golgeVar ? 1 : 0);
  gl.uniform1f(u('u_texel'), 1 / GOLGE_BOYU);
  gl.uniform1f(u('u_normalKay'), (isik.genislik / GOLGE_BOYU) * 1.5);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, k.golgeDoku);
  gl.uniform1i(u('u_golge'), 0);
  gl.disable(gl.CULL_FACE);

  // a) Yer: ressam sırası, derinlik yok.
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
  if (ag.nesne.length) {
    const t = tampon(gl, ag.nesne);
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
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(t.vao);
    gl.drawArrays(gl.TRIANGLES, 0, t.say);
    gl.disable(gl.BLEND);
  }

  // 3) Kenar + indirgeme → tuval.
  if (k.tuval.width !== en) k.tuval.width = en;
  if (k.tuval.height !== boy) k.tuval.height = boy;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, en, boy);
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.useProgram(k.coz);
  const uc = (ad: string) => gl.getUniformLocation(k.coz, ad);
  ['u_renk', 'u_normal', 'u_taban'].forEach((ad, i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, k.dokular[i]!);
    gl.uniform1i(uc(ad), i);
  });
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, k.derinlik);
  gl.uniform1i(uc('u_derinlik'), 3);
  gl.uniform2i(uc('u_boyut'), sen, sboy);
  // Çizgi: SVG'deki gibi ~0,7 CSS pikseli; siluette tek yanlı, kırılımda iki yanlı.
  gl.uniform1i(uc('u_ss'), ss);
  const r = Math.max(1, Math.round(0.7 * istek.olcek * ss));
  gl.uniform1i(uc('u_r'), r);
  gl.uniform1i(uc('u_r2'), Math.max(1, Math.round(r / 2)));
  // Derinlik sıçraması: dünya biriminde eşik, piksel boyuna göre büyüyor
  // (dik açıyla görülen yüzey komşusundan doğal olarak uzak).
  const birimPiksel = istek.kutu[2] / sen;
  const aralik = ag.derinlik[1] - ag.derinlik[0] || 1;
  gl.uniform1f(uc('u_derinEsik'), Math.max(0.25, 6 * r * birimPiksel) / (aralik * 1.04));
  gl.bindVertexArray(null);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  for (const s of silinecek) s();
  if (gl.isContextLost()) return null;
  return blobla(k.tuval);
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
  k.tuval.width = 1;
  k.tuval.height = 1;
}
