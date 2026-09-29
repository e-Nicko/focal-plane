// The render pipeline:
// HDR scene -> bokeh depth of field -> FXAA (when there is no MSAA) -> bloom -> grade to the canvas.
// Every effect size is relative to the image height,
// so a 1080p preview and the 4K master frame the same picture.

import * as THREE from 'three';
import {
  QUAD_VERT, DOF_PREFILTER_FRAG, DOF_GATHER_FRAG, DOF_COMPOSITE_FRAG,
  BLOOM_PREFILTER_FRAG, BLOOM_DOWN_FRAG, BLOOM_UP_FRAG, FINAL_FRAG, FXAA_FRAG,
} from './shaders.js';
import type { PageScene } from './page.js';
import type { FrameState, Quality } from './types.js';

export interface QualitySettings {
  msaa: number;
  dofSamples: number;
  bloomLevels: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  draft: { msaa: 4, dofSamples: 110, bloomLevels: 5 },
  high: { msaa: 4, dofSamples: 260, bloomLevels: 6 },
  // No MSAA on the master:
  // at 4K, ANGLE's multisampled half-float target costs over a second per frame.
  // FXAA replaces it.
  master: { msaa: 0, dofSamples: 720, bloomLevels: 6 },
};

const NEAR = 0.05, FAR = 90;

function target(w: number, h: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
}

// Uniform slots, typed by what they hold.
const texture = () => ({ value: null as THREE.Texture | null });
const v2 = () => ({ value: new THREE.Vector2() });
const num = (value: number) => ({ value });
const coc = () => ({
  uNear: num(NEAR), uFar: num(FAR), uFocus: num(4),
  uAperture: num(0.1), uMaxCoc: num(40), uHeight: num(1080),
});

// A full-screen pass: a fragment shader and its uniforms.
class Pass<U extends Record<string, THREE.IUniform>> {
  readonly material: THREE.ShaderMaterial;
  readonly uniforms: U;
  constructor(frag: string, uniforms: U) {
    this.uniforms = uniforms;
    this.material = new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  }
}

// Sets the circle-of-confusion uniforms shared by the prefilter and the composite.
function setCoc(u: ReturnType<typeof coc>, focus: number, aperture: number, maxCoc: number, height: number): void {
  u.uFocus.value = focus;
  u.uAperture.value = aperture;
  u.uMaxCoc.value = maxCoc;
  u.uHeight.value = height;
}

export class Pipeline {
  private quality: Quality;
  private q: QualitySettings;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));

  private readonly pre = new Pass(DOF_PREFILTER_FRAG, { tColor: texture(), tDepth: texture(), uTexel: v2(), ...coc() });
  private readonly gather = new Pass(DOF_GATHER_FRAG, {
    tPre: texture(), uTexel: v2(), uMaxRadius: num(20), uRadScale: num(1),
    uAspect: { value: new THREE.Vector2(16 / 9, 1) }, uCatEye: num(0.28),
  });
  private readonly comp = new Pass(DOF_COMPOSITE_FRAG, { tColor: texture(), tDepth: texture(), tBokeh: texture(), uTexelHalf: v2(), ...coc() });
  private readonly fxaa = new Pass(FXAA_FRAG, { tSrc: texture(), uTexel: v2() });
  private readonly bPre = new Pass(BLOOM_PREFILTER_FRAG, { tSrc: texture(), uTexel: v2(), uThreshold: num(1.0), uKnee: num(0.5) });
  private readonly bDown = new Pass(BLOOM_DOWN_FRAG, { tSrc: texture(), uTexel: v2() });
  private readonly bUp = new Pass(BLOOM_UP_FRAG, { tSrc: texture(), tBase: texture(), uTexel: v2(), uRadius: num(1.0) });
  private readonly final = new Pass(FINAL_FRAG, {
    tSrc: texture(), tBloom: texture(), uBloom: num(0), uExposure: num(1),
    uVignette: num(0), uCA: num(0), uGrain: num(0), uFade: num(1), uFrame: num(0),
    uLift: num(0), uGain: num(1),
  });

  private w = 0;
  private h = 0;
  private sceneRT?: THREE.WebGLRenderTarget;
  private preRT?: THREE.WebGLRenderTarget;
  private gatherRT?: THREE.WebGLRenderTarget;
  private dofRT?: THREE.WebGLRenderTarget;
  private aaRT: THREE.WebGLRenderTarget | null = null;
  private bloomRT: THREE.WebGLRenderTarget[] = [];
  private bloomUpRT: THREE.WebGLRenderTarget[] = [];

  // set to {} to fence and time every stage
  timings: Record<string, number> | null = null;
  private px = new Uint8Array(4);
  private t0: number | null = null;

  private readonly renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer, quality: Quality = 'high') {
    this.renderer = renderer;
    this.quality = quality;
    this.q = QUALITY[quality];
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setQuality(name: Quality): void {
    if (name === this.quality) return;
    this.quality = name;
    this.q = QUALITY[name];
    const w = this.w, h = this.h;
    this.w = 0;
    this.setSize(w, h);
  }

  setSize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: this.q.msaa, depthBuffer: true, depthTexture: depth,
    });
    this.preRT = target(w / 2, h / 2);
    this.gatherRT = target(w / 2, h / 2);
    this.dofRT = target(w, h);
    this.aaRT = this.q.msaa ? null : target(w, h);
    this.bloomRT = [];
    let bw = w / 2, bh = h / 2;
    for (let i = 0; i < this.q.bloomLevels; i++) { this.bloomRT.push(target(bw, bh)); bw /= 2; bh /= 2; }
    this.bloomUpRT = this.bloomRT.slice(0, -1).map((r) => target(r.width, r.height));
  }

  dispose(): void {
    for (const rt of [this.sceneRT, this.preRT, this.gatherRT, this.dofRT, this.aaRT]) rt?.dispose();
    for (const rt of [...this.bloomRT, ...this.bloomUpRT]) rt.dispose();
    this.sceneRT = this.preRT = this.gatherRT = this.dofRT = undefined;
    this.aaRT = null;
    this.bloomRT = [];
    this.bloomUpRT = [];
  }

  private blit(pass: Pass<Record<string, THREE.IUniform>>, rt: THREE.WebGLRenderTarget | null): void {
    this.quad.material = pass.material;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  // Chrome turns gl.finish() into a flush;
  // a one-pixel readback is the real GPU fence.
  private mark(name: string): void {
    if (!this.timings) return;
    const gl = this.renderer.getContext();
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.px);
    this.renderer.setRenderTarget(prev);
    const now = performance.now();
    if (this.t0 != null) this.timings[name] = +(now - this.t0).toFixed(1);
    this.t0 = now;
  }

  // frame is the index of the frame, the seed of the grain.
  render(page: PageScene, camera: THREE.PerspectiveCamera, fs: FrameState, frame: number): void {
    const { sceneRT, preRT, gatherRT, dofRT } = this;
    if (!sceneRT || !preRT || !gatherRT || !dofRT) throw new Error('Pipeline.setSize() must be called before render().');
    const r = this.renderer, w = this.w, h = this.h;
    this.t0 = null;
    this.mark('start');
    camera.near = NEAR;
    camera.far = FAR;
    camera.updateProjectionMatrix();

    const K = fs.camera.aperture, focus = fs.camera.focus;
    const maxCoc = Math.round(h * 0.038);

    // 1. the scene in HDR, with depth
    r.setRenderTarget(sceneRT);
    r.setClearColor(page.clearColor, 1);
    r.clear();
    r.render(page.scene, camera);
    this.mark('scene');

    // 2. depth of field
    setCoc(this.pre.uniforms, focus, K, maxCoc, h);
    this.pre.uniforms.tColor.value = sceneRT.texture;
    this.pre.uniforms.tDepth.value = sceneRT.depthTexture;
    this.pre.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.blit(this.pre, preRT);

    const maxR = maxCoc / 2 + 1;
    const g = this.gather.uniforms;
    g.tPre.value = preRT.texture;
    g.uTexel.value.set(2 / w, 2 / h);
    g.uMaxRadius.value = maxR;
    g.uRadScale.value = Math.max(0.35, (maxR * maxR) / (2 * this.q.dofSamples));
    g.uAspect.value.set(w / h, 1);
    this.blit(this.gather, gatherRT);

    setCoc(this.comp.uniforms, focus, K, maxCoc, h);
    this.comp.uniforms.tColor.value = sceneRT.texture;
    this.comp.uniforms.tDepth.value = sceneRT.depthTexture;
    this.comp.uniforms.tBokeh.value = gatherRT.texture;
    this.comp.uniforms.uTexelHalf.value.set(2 / w, 2 / h);
    this.blit(this.comp, dofRT);
    this.mark('dof');

    // 3. without MSAA, smooth geometric edges on the HDR frame
    let frameRT = dofRT;
    if (this.aaRT) {
      this.fxaa.uniforms.tSrc.value = dofRT.texture;
      this.fxaa.uniforms.uTexel.value.set(1 / w, 1 / h);
      this.blit(this.fxaa, this.aaRT);
      frameRT = this.aaRT;
    }

    // 4. bloom
    this.bPre.uniforms.tSrc.value = frameRT.texture;
    this.bPre.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.blit(this.bPre, this.bloomRT[0]);
    for (let i = 1; i < this.bloomRT.length; i++) {
      const src = this.bloomRT[i - 1];
      this.bDown.uniforms.tSrc.value = src.texture;
      this.bDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.blit(this.bDown, this.bloomRT[i]);
    }
    let low = this.bloomRT[this.bloomRT.length - 1];
    for (let i = this.bloomRT.length - 2; i >= 0; i--) {
      this.bUp.uniforms.tSrc.value = low.texture;
      this.bUp.uniforms.tBase.value = this.bloomRT[i].texture;
      this.bUp.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      this.blit(this.bUp, this.bloomUpRT[i]);
      low = this.bloomUpRT[i];
    }
    this.mark('bloom');

    // 5. the grade, to the canvas
    const f = this.final.uniforms, gr = page.grade;
    f.tSrc.value = frameRT.texture;
    f.tBloom.value = low.texture;
    f.uFade.value = fs.fade;
    f.uFrame.value = frame % 997;
    f.uBloom.value = gr.bloom; f.uExposure.value = gr.exposure; f.uVignette.value = gr.vignette;
    f.uCA.value = gr.ca; f.uGrain.value = gr.grain; f.uLift.value = gr.lift; f.uGain.value = gr.gain;
    this.blit(this.final, null);
    this.mark('grade');
  }
}
