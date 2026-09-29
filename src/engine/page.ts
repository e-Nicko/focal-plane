// The set:
// one page plane in an empty dark space.
// 3D here does only three things:
// it holds the plane, it gives the camera something to look at,
// and it writes depth, which the lens turns into focus.

import * as THREE from 'three';
import { UNIT } from './camera.js';
import { PAGE_VERT, PAGE_FRAG } from './shaders.js';
import type { Edit, FrameState, Grade, Quality } from './types.js';

// Canvas px per page px.
// The master draws the page at 5x,
// so text stays crisp when a 4K frame looks at a third of the page.
export const DENSITY: Record<Quality, number> = { draft: 1.5, high: 2.5, master: 5 };

export class PageScene {
  readonly scene = new THREE.Scene();
  readonly clearColor: number;
  // the grade in use: the edit's, with any overrides
  grade: Grade;

  // One canvas for whichever shot is on screen, resized at each cut.
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: THREE.CanvasTexture;
  private readonly uniforms: { map: { value: THREE.CanvasTexture }; uRect: { value: THREE.Vector4 }; uPage: { value: THREE.Color } };
  private readonly plane: THREE.Mesh;
  private density = DENSITY.high;
  // the index of the shot the canvas is sized for
  private active = -1;

  private readonly edit: Edit;

  constructor(renderer: THREE.WebGLRenderer, edit: Edit, quality: Quality = 'high') {
    this.edit = edit;
    this.grade = { ...edit.grade };
    this.clearColor = new THREE.Color(edit.page).getHex();
    this.scene.background = new THREE.Color(edit.page);

    // Uploaded as plain RGBA8, unflipped and premultiplied:
    // that keeps Chrome on its GPU-to-GPU copy path
    // (an sRGB format with flipY sends every upload through the CPU).
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available.');
    this.ctx = ctx;
    const tex = (this.tex = new THREE.CanvasTexture(this.canvas));
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.premultiplyAlpha = true;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    this.uniforms = {
      map: { value: tex },
      uRect: { value: new THREE.Vector4() },
      uPage: { value: new THREE.Color(edit.page) },
    };
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: PAGE_VERT, fragmentShader: PAGE_FRAG }),
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.scene.add(this.plane);
    this.setQuality(quality);
  }

  setQuality(q: Quality): void {
    this.density = DENSITY[q];
    this.active = -1;               // resize on the next frame
  }

  setGrade(overrides: Partial<Grade>): void {
    this.grade = { ...this.edit.grade, ...overrides };
  }

  update(fs: FrameState): void {
    const { shot } = fs;
    const { w, h } = shot.size;
    if (fs.index !== this.active) {
      const cw = Math.round(w * this.density), ch = Math.round(h * this.density);
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
        this.tex.dispose();
      }
      this.active = fs.index;
    }
    const ctx = this.ctx;
    ctx.setTransform(this.density, 0, 0, this.density, 0, 0);
    ctx.save();
    shot.draw(ctx, w, h, fs.lt, fs.ui);
    ctx.restore();
    this.tex.needsUpdate = true;
    this.uniforms.uRect.value.set(-w / 2 / UNIT, -h / 2 / UNIT, w / UNIT, h / UNIT);
  }
}
