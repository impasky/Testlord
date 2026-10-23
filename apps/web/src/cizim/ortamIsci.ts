/// <reference lib="webworker" />
/**
 * Ortam tuvali işçisi (docs/24 "Ortam tuvali"): canlı sahnenin su
 * parıltısını, çimendeki rüzgârı ve ışık titremesini TEK tuvalde, tek
 * geçişte çiziyor.
 *
 * Telefon raporu (Mali-G52, `?olcum=1`): Şehir'de karelerin %15'i takıldı,
 * hiçbir çizim sürmezken de; öbür ekranlarda hiç. Bu katmanlar CSS'te dört
 * sahne boyu katmandı: su ve çimen maskeli, ışığın iki kopyası maskeli ve
 * "ekran" karışımlı (akşam bir de süzgeçli). Bileşikleyici her karede her
 * biri için ayrı bir ara yüzey çizip karıştırıyordu. Burada saniyede en
 * çok `KARE_ARASI`'na bir kare; sayfada tek, düz bir katman (önceden
 * çarpılmış renk, "üstüne" karışım). Işığın "ekran" karışımının yerine
 * "üstüne": ışık PNG'si zaten öyle (renk ve en parlak kanal saydamlık);
 * baskın kanal aynı, öbürleri hâlenin altında biraz koyu.
 *
 * Hareketler CSS'tekinin aynısı (`ortam.ts`). Çizemezse (WebGL2 yok,
 * bağlam düştü) sayfaya `hata`: sahne CSS katmanlarına dönüyor.
 */
import {
  CIMEN_SAYDAM,
  ISIK_A,
  ISIK_B,
  ISIK_KARO,
  RUZGAR,
  RUZGAR_KARO,
  SU_A,
  SU_B,
  SU_KARO,
  SU_SAYDAM,
  isikLekeleri,
  isikSaydamligi,
  kayma,
  ruzgarDeseni,
  suDeseni,
  type OrtamCevabi,
  type OrtamDokulari,
  type OrtamMesaji,
} from './ortam';

const kapsam = self as unknown as DedicatedWorkerGlobalScope;

/**
 * İki çizim arası en az (ms): saniyede ~20 kare. Ortam yavaş ve yumuşak
 * (rüzgâr saniyede ~50 CSS pikseli, su ~16); parçalar ve duman kendi
 * hızında (CSS).
 */
const KARE_ARASI = 1000 / 20;

/**
 * Tuvalin en çok pikseli: katmanlar daha büyükse küçültülerek çiziliyor
 * (yerleşkede 1344×1400 → ~760×790, CSS pikseli başına ~1). Katmanlar
 * yumuşak; sayfada zaten ana resmin çözünürlüğünden büyütülüyorlardı.
 */
const EN_COK_PIKSEL = 600_000;

const KOSE = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 1), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  v_uv = vec2(p.x, 1.0 - p.y);
}`;

/** Maskeler tek dokuda, tuvalin boyunda: kırmızı çimen, yeşil su (bir kez). */
const PAKET = `#version 300 es
precision mediump float;
uniform sampler2D u_cimen;
uniform sampler2D u_su;
uniform vec2 u_var;
in vec2 v_uv;
out vec4 o;
void main() {
  o = vec4(
    u_var.x > 0.5 ? texture(u_cimen, v_uv).r : 0.0,
    u_var.y > 0.5 ? texture(u_su, v_uv).r : 0.0,
    0.0, 1.0);
}`;

/*
 * Kare başına: maske ve ışık birer okuma; karolar yalnız maskenin dolu
 * olduğu yerde (rüzgâr çimende, parıltı suda, leke ışıkta).
 */
const PARCA = `#version 300 es
precision highp float;
uniform sampler2D u_maske;
uniform sampler2D u_isik;
uniform sampler2D u_ruzgar;
uniform sampler2D u_parilti;
uniform sampler2D u_benek;
uniform vec2 u_css;
uniform vec3 u_var;
uniform vec2 u_ruzgarKay;
uniform vec2 u_suA;
uniform vec2 u_suB;
uniform vec2 u_isikS;
uniform float u_aksam;
in vec2 v_uv;
out vec4 o;
vec4 ust(vec4 a, vec4 b) { return a + b * (1.0 - a.a); }
// Akşam: CSS brightness(1.6) saturate(1.25), önceden çarpılmamış renkte.
vec4 aksam(vec4 l) {
  if (l.a <= 0.0) return l;
  vec3 c = clamp(l.rgb / l.a * 1.6, 0.0, 1.0);
  const float s = 1.25;
  mat3 m = mat3(
    0.213 + 0.787 * s, 0.213 - 0.213 * s, 0.213 - 0.213 * s,
    0.715 - 0.715 * s, 0.715 + 0.285 * s, 0.715 - 0.715 * s,
    0.072 - 0.072 * s, 0.072 - 0.072 * s, 0.072 + 0.928 * s);
  return vec4(clamp(m * c, 0.0, 1.0) * l.a, l.a);
}
void main() {
  vec2 p = v_uv * u_css;
  vec2 mk = texture(u_maske, v_uv).rg;
  vec4 r = vec4(0.0);
  if (mk.r > 0.0)
    r = texture(u_ruzgar, (p - u_ruzgarKay) / vec2(${RUZGAR_KARO[0].toFixed(1)}, ${RUZGAR_KARO[1].toFixed(1)}))
      * (mk.r * ${CIMEN_SAYDAM.toFixed(3)});
  if (mk.g > 0.0) {
    vec4 a = texture(u_parilti, (p - u_suA) / vec2(${SU_A.karo[0].toFixed(1)}, ${SU_A.karo[1].toFixed(1)}));
    vec4 b = texture(u_parilti, (p - u_suB) / vec2(${SU_B.karo[0].toFixed(1)}, ${SU_B.karo[1].toFixed(1)}))
      * ${SU_B.saydam.toFixed(3)};
    r = ust(ust(b, a) * (mk.g * ${SU_SAYDAM.toFixed(3)}), r);
  }
  if (u_var.z > 0.5) {
    vec4 l = texture(u_isik, v_uv);
    if (l.a > 0.0) {
      if (u_aksam > 0.5) l = aksam(l);
      float m = texture(u_benek, p / ${ISIK_KARO.toFixed(1)}).r;
      r = ust(l * ((1.0 - m) * u_isikS.y), ust(l * (m * u_isikS.x), r));
    }
  }
  o = r;
}`;

interface Doku {
  doku: WebGLTexture;
  en: number;
  boy: number;
}

interface Durum {
  gl: WebGL2RenderingContext;
  tuval: OffscreenCanvas;
  ana: Program;
  paket: Program;
  karolar: { parilti: WebGLTexture; ruzgar: WebGLTexture; benek: WebGLTexture; bos: WebGLTexture };
  /** Çimen ve su maskesi tek dokuda (tuvalin boyunda), ışık ayrı. */
  maske?: WebGLTexture;
  isik?: WebGLTexture;
  aksam: boolean;
  /** Katman yüklemesinin sırası: eski yükleme yenisinin üstüne yazmasın. */
  surum: number;
  css: [number, number];
  acik: boolean;
  cerceve: number | null;
  son: number;
  kapandi: boolean;
}

interface Program {
  p: WebGLProgram;
  u: (ad: string) => WebGLUniformLocation | null;
}

const TUVALLER = new Map<number, Durum>();

const sonraki: (f: (t: number) => void) => number =
  typeof kapsam.requestAnimationFrame === 'function'
    ? (f) => kapsam.requestAnimationFrame(f)
    : (f) => setTimeout(() => f(performance.now()), KARE_ARASI) as unknown as number;
const birak: (n: number) => void =
  typeof kapsam.cancelAnimationFrame === 'function'
    ? (n) => kapsam.cancelAnimationFrame(n)
    : (n) => clearTimeout(n);

function cevap(m: OrtamCevabi) {
  kapsam.postMessage(m);
}

function program(gl: WebGL2RenderingContext, parca: string): Program | null {
  const p = gl.createProgram();
  for (const [tur, kaynak] of [
    [gl.VERTEX_SHADER, KOSE],
    [gl.FRAGMENT_SHADER, parca],
  ] as const) {
    const s = gl.createShader(tur);
    if (!s) return null;
    gl.shaderSource(s, kaynak);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  const yerler = new Map<string, WebGLUniformLocation | null>();
  return {
    p,
    u: (ad) => {
      if (!yerler.has(ad)) yerler.set(ad, gl.getUniformLocation(p, ad));
      return yerler.get(ad)!;
    },
  };
}

function dokuKur(gl: WebGL2RenderingContext, tekrar: boolean): WebGLTexture {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const sar = tekrar ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, sar);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, sar);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

/** Desen karosu: 2B tuvalde çizilip önceden çarpılmış RGBA olarak. */
function karo(
  gl: WebGL2RenderingContext,
  en: number,
  boy: number,
  ciz: (c: OffscreenCanvasRenderingContext2D) => void,
): WebGLTexture {
  const tuval = new OffscreenCanvas(en, boy);
  const c = tuval.getContext('2d')!;
  ciz(c);
  const t = dokuKur(gl, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, tuval);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  return t;
}

/** Sahnenin katmanı (PNG): maske tek kanal (saydamlık), ışık önceden çarpılmış RGBA. */
async function katmanAl(
  gl: WebGL2RenderingContext,
  blob: Blob | undefined,
  maske: boolean,
): Promise<Doku | undefined> {
  if (!blob) return undefined;
  try {
    const bmp = await createImageBitmap(blob, {
      premultiplyAlpha: 'premultiply',
      colorSpaceConversion: 'none',
    });
    if (gl.isContextLost()) return undefined;
    const doku = dokuKur(gl, false);
    if (maske) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, bmp);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    const d = { doku, en: bmp.width, boy: bmp.height };
    bmp.close();
    return d;
  } catch {
    // Çözülemedi: o katman yok.
    return undefined;
  }
}

/** Çimen ve su maskesini tuvalin boyunda tek dokuya yazıyor (`PAKET`). */
function maskeleriPaketle(
  d: Durum,
  cimen: Doku | undefined,
  su: Doku | undefined,
): WebGLTexture | undefined {
  if (!cimen && !su) return undefined;
  const { gl, paket } = d;
  const [w, h] = [d.tuval.width, d.tuval.height];
  const t = dokuKur(gl, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  gl.viewport(0, 0, w, h);
  gl.useProgram(paket.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, cimen?.doku ?? null);
  gl.uniform1i(paket.u('u_cimen'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, su?.doku ?? null);
  gl.uniform1i(paket.u('u_su'), 1);
  gl.uniform2f(paket.u('u_var'), cimen ? 1 : 0, su ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  return t;
}

async function katmanYukle(d: Durum, k: OrtamDokulari) {
  const surum = ++d.surum;
  const { gl } = d;
  const [su, cimen, isik] = await Promise.all([
    katmanAl(gl, k.su, true),
    katmanAl(gl, k.cimen, true),
    katmanAl(gl, k.isik, false),
  ]);
  const birak2 = (...x: (Doku | undefined)[]) => {
    for (const y of x) if (y) gl.deleteTexture(y.doku);
  };
  if (surum !== d.surum || d.kapandi) return birak2(su, cimen, isik);
  // Tuval katmanların çözünürlüğünde (en büyüğü), çok büyükse küçülterek.
  const [en, boy] = [su, cimen, isik].reduce<[number, number]>(
    (m, x) => (x && x.en * x.boy > m[0] * m[1] ? [x.en, x.boy] : m),
    [0, 0],
  );
  if (en && boy) {
    const k2 = Math.min(1, Math.sqrt(EN_COK_PIKSEL / (en * boy)));
    d.tuval.width = Math.max(1, Math.round(en * k2));
    d.tuval.height = Math.max(1, Math.round(boy * k2));
  }
  if (d.maske) gl.deleteTexture(d.maske);
  if (d.isik) gl.deleteTexture(d.isik);
  d.maske = maskeleriPaketle(d, cimen, su);
  birak2(su, cimen);
  d.isik = isik?.doku;
  d.aksam = !!k.aksam;
  ciz(d, performance.now() / 1000);
  oynat(d);
}

function ciz(d: Durum, t: number) {
  const { gl, ana } = d;
  if (gl.isContextLost()) return;
  gl.viewport(0, 0, d.tuval.width, d.tuval.height);
  if (!d.maske && !d.isik) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return;
  }
  gl.useProgram(ana.p);
  const bagla = (birim: number, ad: string, t2: WebGLTexture | undefined) => {
    gl.activeTexture(gl.TEXTURE0 + birim);
    gl.bindTexture(gl.TEXTURE_2D, t2 ?? null);
    gl.uniform1i(ana.u(ad), birim);
  };
  bagla(0, 'u_maske', d.maske);
  bagla(1, 'u_isik', d.isik);
  bagla(2, 'u_ruzgar', d.karolar.ruzgar);
  bagla(3, 'u_parilti', d.karolar.parilti);
  bagla(4, 'u_benek', d.karolar.benek);
  gl.uniform2f(ana.u('u_css'), d.css[0], d.css[1]);
  gl.uniform3f(ana.u('u_var'), 0, 0, d.isik ? 1 : 0);
  const r = kayma(t, RUZGAR.sure, RUZGAR.kayma);
  const a = kayma(t, SU_A.sure, SU_A.kayma);
  const b = kayma(t, SU_B.sure, SU_B.kayma);
  gl.uniform2f(ana.u('u_ruzgarKay'), r[0], r[1]);
  gl.uniform2f(ana.u('u_suA'), a[0], a[1]);
  gl.uniform2f(ana.u('u_suB'), SU_B.baslangic[0] + b[0], SU_B.baslangic[1] + b[1]);
  gl.uniform2f(
    ana.u('u_isikS'),
    isikSaydamligi(t, ISIK_A.sure, ISIK_A.gecikme),
    isikSaydamligi(t, ISIK_B.sure, ISIK_B.gecikme),
  );
  gl.uniform1f(ana.u('u_aksam'), d.aksam ? 1 : 0);
  // Maske yoksa (yalnız ışık) boş doku sıfır okunmuyor: siyah dokuyla bağla.
  if (!d.maske) bagla(0, 'u_maske', d.karolar.bos);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function oynat(d: Durum) {
  if (d.cerceve !== null || !d.acik || d.kapandi) return;
  const adim = (an: number) => {
    d.cerceve = null;
    if (!d.acik || d.kapandi) return;
    // Biraz pay: 60 Hz ekranda iki karede bir.
    if (an - d.son >= KARE_ARASI - 4) {
      d.son = an;
      ciz(d, an / 1000);
    }
    d.cerceve = sonraki(adim);
  };
  d.cerceve = sonraki(adim);
}

function durdur(d: Durum) {
  if (d.cerceve !== null) birak(d.cerceve);
  d.cerceve = null;
}

function kur(m: Extract<OrtamMesaji, { tip: 'kur' }>) {
  const { id, tuval } = m;
  const gl = tuval.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  const ana = gl && program(gl, PARCA);
  const paket = gl && program(gl, PAKET);
  if (!gl || !ana || !paket) return cevap({ tip: 'hata', id });
  gl.bindVertexArray(gl.createVertexArray());
  gl.disable(gl.BLEND);
  const bos = dokuKur(gl, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const d: Durum = {
    gl,
    tuval,
    ana,
    paket,
    karolar: {
      parilti: karo(gl, ...SU_KARO, suDeseni),
      ruzgar: karo(gl, ...RUZGAR_KARO, ruzgarDeseni),
      benek: karo(gl, ISIK_KARO, ISIK_KARO, isikLekeleri),
      bos,
    },
    aksam: false,
    surum: 0,
    css: m.css,
    acik: m.acik,
    cerceve: null,
    son: 0,
    kapandi: false,
  };
  tuval.addEventListener('webglcontextlost', () => {
    durdur(d);
    cevap({ tip: 'hata', id });
  });
  TUVALLER.set(id, d);
}

kapsam.onmessage = (e: MessageEvent<OrtamMesaji>) => {
  const m = e.data;
  if (m.tip === 'kur') return kur(m);
  const d = TUVALLER.get(m.id);
  if (!d) return;
  if (m.tip === 'katman') void katmanYukle(d, m.katman);
  else if (m.tip === 'boyut') d.css = m.css;
  else if (m.tip === 'oyna') {
    d.acik = m.acik;
    if (m.acik) oynat(d);
    else durdur(d);
  } else if (m.tip === 'kapat') {
    d.kapandi = true;
    durdur(d);
    TUVALLER.delete(m.id);
    const ext = d.gl.getExtension('webgl_lose_context');
    ext?.loseContext();
  }
};
