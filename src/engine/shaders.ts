// GLSL for the page plane and the post-processing chain.
// Written for three.js ShaderMaterial on WebGL 2:
// three prefixes #version 300 es and maps gl_FragColor and texture2D,
// so dynamic loops and textureLod are available.

// ---------------------------------------------------------------------------------------------
// The page plane.
// The active shot's canvas is mapped onto the plane;
// outside the canvas the plane continues in the page colour,
// so the edge of the page is never visible.
export const PAGE_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const PAGE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec4 uRect;      // x0, z0, width, depth of the canvas on the plane
uniform vec3 uPage;      // page colour, linear
varying vec3 vWorld;
void main() {
  vec2 uv = (vWorld.xz - uRect.xy) / uRect.zw;
  vec3 col = uPage;
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    // the canvas is uploaded as raw sRGB bytes, top row first (Chrome's fast copy path);
    // decode here
    vec3 enc = texture2D(map, uv).rgb;
    col = mix(enc / 12.92, pow((enc + 0.055) / 1.055, vec3(2.4)), step(0.04045, enc));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------------------------
// Fullscreen pass vertex shader (PlaneGeometry(2, 2) straight to clip space).
export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DEPTH_GLSL = /* glsl */ `
uniform float uNear, uFar;
float viewZ(float d) {                 // perspective depth buffer -> positive view distance
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
`;

// Circle of confusion, signed (negative in front of the focal plane), in full-res pixels.
// Thin lens, for subjects far beyond the focal length:
// c = K * (1/zf - 1/z) * H.
const COC_GLSL = /* glsl */ `
uniform float uFocus;      // focal distance (view z)
uniform float uAperture;   // K: blur as a fraction of image height per unit of (1/zf - 1/z)
uniform float uMaxCoc;     // clamp, full-res px
uniform float uHeight;     // full-res image height in px
float cocPx(float z) { return clamp(uAperture * (1.0 / uFocus - 1.0 / z) * uHeight, -uMaxCoc, uMaxCoc); }
`;

// Depth of field, pass 1:
// downsample to half resolution, colour plus signed CoC (half-res px) in alpha.
// A Karis-weighted 4-tap average keeps single bright pixels from strobing.
// The CoC takes the nearest of the taps,
// so foreground edges dilate outward
// and blurred foreground can spill over sharp background.
export const DOF_PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;       // 1 / full-res size
varying vec2 vUv;
${DEPTH_GLSL}
${COC_GLSL}
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c0 = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb;
  vec3 c1 = texture2D(tColor, vUv + vec2( o.x, -o.y)).rgb;
  vec3 c2 = texture2D(tColor, vUv + vec2(-o.x,  o.y)).rgb;
  vec3 c3 = texture2D(tColor, vUv + vec2( o.x,  o.y)).rgb;
  float w0 = 1.0 / (1.0 + max(max(c0.r, c0.g), c0.b));
  float w1 = 1.0 / (1.0 + max(max(c1.r, c1.g), c1.b));
  float w2 = 1.0 / (1.0 + max(max(c2.r, c2.g), c2.b));
  float w3 = 1.0 / (1.0 + max(max(c3.r, c3.g), c3.b));
  vec3 col = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3) / (w0 + w1 + w2 + w3);
  float d0 = texture2D(tDepth, vUv + vec2(-o.x, -o.y)).r;
  float d1 = texture2D(tDepth, vUv + vec2( o.x, -o.y)).r;
  float d2 = texture2D(tDepth, vUv + vec2(-o.x,  o.y)).r;
  float d3 = texture2D(tDepth, vUv + vec2( o.x,  o.y)).r;
  float z = viewZ(min(min(d0, d1), min(d2, d3)));
  float zc = viewZ(texture2D(tDepth, vUv).r);
  float coc = cocPx(z);
  float cocC = cocPx(zc);
  // keep the dilated value only when it is a foreground (negative) CoC larger than the centre's
  float signedCoc = (coc < 0.0 && abs(coc) > abs(cocC)) ? coc : cocC;
  gl_FragColor = vec4(col, signedCoc * 0.5);
}
`;

// Depth of field, pass 2:
// bokeh gather on a golden-angle spiral (after Dennis Gustafsson's single-pass bokeh).
// A ring sample contributes if its own CoC reaches back to this pixel;
// background samples cannot spread over sharper foreground.
// Cat's-eye vignetting clips the discs toward the frame edges.
export const DOF_GATHER_FRAG = /* glsl */ `
uniform sampler2D tPre;          // half-res: rgb, a = signed CoC in half-res px
uniform vec2 uTexel;             // 1 / half-res size
uniform float uMaxRadius;        // half-res px
uniform float uRadScale;         // spiral step, lower = more samples
uniform vec2 uAspect;            // (w/h, 1)
uniform float uCatEye;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
void main() {
  vec4 c = texture2D(tPre, vUv);
  float cc = abs(c.a);
  vec3 acc = c.rgb;
  float tot = 1.0;
  float nearCov = 0.0;
  vec2 fromCenter = (vUv - 0.5) * uAspect;
  float radius = uRadScale;
  float ang = 0.0;
  for (int i = 0; i < 4096; i++) {
    if (radius >= uMaxRadius) break;
    vec2 off = vec2(cos(ang), sin(ang)) * radius;
    vec4 s = texture2D(tPre, vUv + off * uTexel);
    float sc = abs(s.a);
    if (s.a > c.a) sc = min(sc, cc * 2.0);
    // cat's eye: the sample's disc intersected with a second disc shifted toward the frame centre
    vec2 shift = fromCenter * uCatEye * sc;
    float inEye = step(length(off - shift), sc * 1.05 + 0.5);
    float m = smoothstep(radius - 0.5, radius + 0.5, sc) * inEye;
    acc += mix(acc / tot, s.rgb, m);
    if (s.a < -0.5) nearCov += m;
    tot += 1.0;
    radius += uRadScale / radius;
    ang += GOLDEN;
  }
  gl_FragColor = vec4(acc / tot, clamp(nearCov / tot * 3.0, 0.0, 1.0));
}
`;

// Depth of field, pass 3:
// blend the sharp full-res frame with the half-res bokeh by per-pixel CoC.
export const DOF_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBokeh;
uniform vec2 uTexelHalf;
varying vec2 vUv;
${DEPTH_GLSL}
${COC_GLSL}
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  float coc = abs(cocPx(viewZ(texture2D(tDepth, vUv).r)));
  vec4 b = texture2D(tBokeh, vUv);
  // a light 4-tap tent on the upsample hides the half-res grid on hard bokeh edges
  vec2 o = uTexelHalf * 0.5;
  b.rgb = (b.rgb * 2.0 + texture2D(tBokeh, vUv + vec2(o.x, o.y)).rgb + texture2D(tBokeh, vUv - vec2(o.x, o.y)).rgb
          + texture2D(tBokeh, vUv + vec2(o.x, -o.y)).rgb + texture2D(tBokeh, vUv - vec2(o.x, -o.y)).rgb) / 6.0;
  float m = smoothstep(0.6, 2.2, coc);
  m = max(m, smoothstep(0.0, 0.6, b.a));
  gl_FragColor = vec4(mix(sharp, b.rgb, m), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------
// FXAA (after Timothy Lottes' FXAA 3.11, console-quality variant) on the HDR frame.
// Luma comes from a tonemapped estimate,
// so bright edges are judged the way they will be seen.
// Used when the scene renders without MSAA:
// at 4K, ANGLE's multisampled half-float target is about 20 times slower.
export const FXAA_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
float luma(vec3 c) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return l / (1.0 + l); }
void main() {
  vec3 rgbM = texture2D(tSrc, vUv).rgb;
  float lM = luma(rgbM);
  float lNW = luma(texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb);
  float lNE = luma(texture2D(tSrc, vUv + vec2( 1.0, -1.0) * uTexel).rgb);
  float lSW = luma(texture2D(tSrc, vUv + vec2(-1.0,  1.0) * uTexel).rgb);
  float lSE = luma(texture2D(tSrc, vUv + vec2( 1.0,  1.0) * uTexel).rgb);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) { gl_FragColor = vec4(rgbM, 1.0); return; }
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 a = 0.5 * (texture2D(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tSrc, vUv - dir * 0.5).rgb + texture2D(tSrc, vUv + dir * 0.5).rgb);
  float lB = luma(b);
  gl_FragColor = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
}
`;

// ---------------------------------------------------------------------------------------------
// Bloom: soft-knee threshold, 13-tap downsample chain, tent upsample.
// In this look it is nearly off;
// it only softens the hottest whites a little.
export const BLOOM_PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold, uKnee;
varying vec2 vUv;
vec3 tap(vec2 uv) { return texture2D(tSrc, uv).rgb; }
void main() {
  vec2 o = uTexel;
  vec3 c = (tap(vUv) * 4.0 + tap(vUv + vec2(o.x, o.y)) + tap(vUv - vec2(o.x, o.y)) + tap(vUv + vec2(o.x, -o.y)) + tap(vUv - vec2(o.x, -o.y))) / 8.0;
  float br = max(max(c.r, c.g), c.b);
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

export const BLOOM_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;      // of the source
varying vec2 vUv;
vec3 t(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = t(vec2(-2, 2)), b = t(vec2(0, 2)), c = t(vec2(2, 2));
  vec3 d = t(vec2(-2, 0)), e = t(vec2(0, 0)), f = t(vec2(2, 0));
  vec3 g = t(vec2(-2, -2)), h = t(vec2(0, -2)), i = t(vec2(2, -2));
  vec3 j = t(vec2(-1, 1)), k = t(vec2(1, 1)), l = t(vec2(-1, -1)), m = t(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const BLOOM_UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;   // lower (smaller) level
uniform sampler2D tBase;  // current level to add onto
uniform vec2 uTexel;      // of the source
uniform float uRadius;
varying vec2 vUv;
vec3 t(vec2 o) { return texture2D(tSrc, vUv + o * uTexel * uRadius).rgb; }
void main() {
  vec3 col = t(vec2(0, 0)) * 4.0
    + (t(vec2(-1, 0)) + t(vec2(1, 0)) + t(vec2(0, -1)) + t(vec2(0, 1))) * 2.0
    + t(vec2(-1, -1)) + t(vec2(1, -1)) + t(vec2(-1, 1)) + t(vec2(1, 1));
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + col / 16.0, 1.0);
}
`;

// ---------------------------------------------------------------------------------------------
// The grade:
// bloom, exposure, Khronos PBR Neutral tonemap, lens CA, vignette,
// then lift and gain in display space, grain and dither.
export const FINAL_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uVignette;
uniform float uCA;
uniform float uGrain;
uniform float uFade;
uniform float uFrame;
uniform float uLift;     // output black level (0..1, display-referred)
uniform float uGain;     // output white level
varying vec2 vUv;

// Khronos PBR Neutral, after the reference implementation (Apache-2.0):
// https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral
vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

void main() {
  vec2 cuv = vUv - 0.5;
  float r2 = dot(cuv, cuv);
  vec2 caOff = cuv * r2 * uCA;
  vec3 col;
  col.r = texture2D(tSrc, vUv - caOff).r;
  col.g = texture2D(tSrc, vUv).g;
  col.b = texture2D(tSrc, vUv + caOff).b;
  col += texture2D(tBloom, vUv).rgb * uBloom;
  col *= uExposure;
  col = neutral(col);
  float vig = smoothstep(0.95, 0.2, length(cuv * vec2(1.0, 0.82)));
  col *= mix(1.0 - uVignette, 1.0, vig);
  col *= uFade;
  vec3 s = uLift + toSRGB(col) * (uGain - uLift);
  float n = hash(vec3(gl_FragCoord.xy, uFrame)) + hash(vec3(gl_FragCoord.xy + 17.0, uFrame * 1.7)) - 1.0;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  s += n * uGrain * (0.35 + 0.65 * smoothstep(0.0, 0.35, lum) * (1.0 - smoothstep(0.6, 1.0, lum)));
  s += (hash(vec3(gl_FragCoord.xy, uFrame + 3.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(s, 1.0);
}
`;
