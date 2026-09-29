// The player:
// boots the renderer, plays an edit in real time with a small transport,
// and exposes a capture API (window.__film) for the offline tools.
// With ?capture in the URL it renders nothing on its own
// and waits for the tools to ask for frames.

import * as THREE from 'three';
import { PageScene } from './page.js';
import { Pipeline } from './pipeline.js';
import { isQuality, type Edit, type FrameState, type Grade, type Quality } from './types.js';
import type { ExportApp, ExportOptions } from './export.js';

// What the tools can call on the page in capture mode.
export interface FilmApi {
  duration: number;
  fps: number;
  // the shots of the edit, with their global start times
  shots: { id: string; start: number; duration: number }[];
  setSize(w: number, h: number): void;
  setQuality(q: Quality): void;
  // overrides of the edit's grade; {} restores it
  setGrade(o: Partial<Grade>): void;
  renderAt(t: number, frame?: number): { t: number; shot: string; focus: number };
  // renders the frame at t and returns it as a data URL
  shot(t: number, type?: string, q?: number): string;
  // GPU milliseconds per pipeline stage for the frame at t
  timings(t: number): Record<string, number>;
  exportMP4(opts?: ExportOptions): Promise<Blob>;
  stats(): { W: number; H: number; quality: Quality };
}

declare global {
  interface Window {
    __film?: FilmApi;
  }
}

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`index.html has no ${selector}`);
  return el;
}

const FONT_FACES = [
  '400 13px "IBM Plex Sans"', '500 13px "IBM Plex Sans"', '600 13px "IBM Plex Sans"',
  '400 13px "IBM Plex Mono"', '500 13px "IBM Plex Mono"',
];

interface Player {
  playing: boolean;
  t: number;
  last: number;
  frame: number;
  // a frame is due even though nothing is playing
  dirty?: boolean;
  onTime?: (t: number) => void;
}

export async function boot(edit: Edit): Promise<void> {
  const params = new URLSearchParams(location.search);
  const CAPTURE = params.has('capture');
  // the canvases measure and draw text: fonts must be ready before the first frame
  await Promise.all(FONT_FACES.map((f) => document.fonts.load(f).catch(() => null)));

  const canvas = $<HTMLCanvasElement>('#film');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE,
  });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the grade writes display values itself

  const qParam = params.get('q');
  let quality: Quality = CAPTURE ? 'master' : isQuality(qParam) ? qParam : 'high';
  const page = new PageScene(renderer, edit, quality);
  const pipe = new Pipeline(renderer, quality);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 90);

  let W = 0, H = 0;
  function setSize(w: number, h: number): void {
    w = Math.max(16, Math.round(w));
    h = Math.max(9, Math.round(h));
    if (w === W && h === H) return;
    W = w;
    H = h;
    renderer.setSize(w, h, false);
    pipe.setSize(w, h);
  }
  function applyCamera(c: FrameState['camera']): void {
    camera.position.set(...c.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(...c.look);
    camera.rotateZ(THREE.MathUtils.degToRad(c.roll));
    camera.fov = c.fov;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  function renderFrame(t: number, frame = 0): FrameState {
    const fs = edit.stateAt(t);
    applyCamera(fs.camera);
    page.update(fs);
    pipe.render(page, camera, fs, frame);
    return fs;
  }
  function setQuality(q: Quality): void {
    quality = q;
    page.setQuality(q);
    pipe.setQuality(q);
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const player: Player = { playing: !CAPTURE && !reduced, t: reduced ? edit.poster : 0, last: performance.now(), frame: 0 };

  const app: ExportApp = {
    canvas, duration: edit.duration, renderFrame,
    beginOffline(w, h) {
      const prev = { W, H, quality, playing: player.playing };
      player.playing = false;
      setQuality('master');
      setSize(w, h);
      renderFrame(0, 0);
      return () => { setQuality(prev.quality); W = 0; setSize(prev.W, prev.H); player.playing = prev.playing; };
    },
  };

  window.__film = {
    duration: edit.duration,
    fps: edit.fps,
    shots: edit.shots.map((s, i) => ({ id: s.id, start: edit.starts[i], duration: s.duration })),
    setSize,
    setQuality(q) {
      if (!isQuality(q)) throw new Error(`Unknown quality "${q}": use draft, high or master.`);
      setQuality(q);
    },
    setGrade: (o) => page.setGrade(o),
    renderAt(t, frame = 0) {
      const fs = renderFrame(t, frame);
      return { t: fs.t, shot: fs.shot.id, focus: fs.camera.focus };
    },
    shot(t, type = 'image/png', q = 0.95) {
      renderFrame(t, Math.round(t * edit.fps));
      return canvas.toDataURL(type, q);
    },
    timings(t) {
      renderFrame(t, 0);
      pipe.timings = {};
      renderFrame(t, 0);
      const out = pipe.timings;
      pipe.timings = null;
      return out;
    },
    async exportMP4(opts = {}) {
      const { exportMP4 } = await import('./export.js');
      return exportMP4(app, opts);
    },
    stats: () => ({ W, H, quality }),
  };

  // compile every shot's first frames now, not in the middle of playback
  const warm = () => edit.starts.forEach((s) => renderFrame(s + 0.5, 0));

  if (CAPTURE) {
    setSize(+(params.get('w') || 1920), +(params.get('h') || 1080));
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    warm();
    renderFrame(0, 0);
    document.documentElement.dataset.ready = '1';
    return;
  }

  function fit(): void {
    const stage = $('#stage'), vw = stage.clientWidth, vh = stage.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'draft' ? 1 : 1.5);
    let w = vw, h = (vw * 9) / 16;
    if (h > vh) { h = vh; w = (vh * 16) / 9; }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    setSize(w * dpr, h * dpr);
  }
  fit();
  new ResizeObserver(fit).observe($('#stage'));
  warm();
  renderFrame(player.t, 0);
  setupHud(edit, player, { setQuality: (q) => { setQuality(q); fit(); }, getQuality: () => quality });
  document.documentElement.dataset.ready = '1';

  function tick(now: number): void {
    const dt = Math.min(0.1, (now - player.last) / 1000);
    player.last = now;
    if (player.playing) {
      player.t += dt;
      if (player.t >= edit.duration) player.t -= edit.duration;
    }
    if (player.playing || player.dirty) {
      renderFrame(player.t, player.frame++);
      player.dirty = false;
      player.onTime?.(player.t);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- transport ----------
function setupHud(edit: Edit, player: Player, { setQuality, getQuality }: { setQuality: (q: Quality) => void; getQuality: () => Quality }): void {
  const hud = $('#hud'), play = $('#play'), scrub = $<HTMLInputElement>('#scrub'), tc = $('#timecode'), qsel = $<HTMLSelectElement>('#quality');
  let scrubbing = false, idle: ReturnType<typeof setTimeout> | undefined;
  const fmt = (t: number): string => {
    const s = Math.floor(t), cs = Math.floor((t - s) * 100);
    return `00:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };
  $('#subtitle').textContent = `${edit.shots.length} shots · ${edit.duration.toFixed(1)} s · real-time three.js`;
  scrub.max = String(edit.duration);

  function poke(): void {
    hud.classList.remove('is-idle');
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (player.playing && !hud.matches(':hover') && !hud.contains(document.activeElement)) hud.classList.add('is-idle');
    }, 2600);
  }
  const setPlaying = (p: boolean): void => {
    player.playing = p;
    play.setAttribute('aria-label', p ? 'Pause' : 'Play');
    play.dataset.state = p ? 'playing' : 'paused';
    poke();
  };
  player.onTime = (t) => {
    if (!scrubbing) scrub.value = t.toFixed(2);
    tc.textContent = `${fmt(t)} / ${fmt(edit.duration)}`;
  };
  player.onTime(player.t);
  setPlaying(player.playing);

  play.addEventListener('click', () => setPlaying(!player.playing));
  scrub.addEventListener('input', () => { scrubbing = true; player.t = +scrub.value; player.dirty = true; });
  scrub.addEventListener('change', () => { scrubbing = false; });
  qsel.value = getQuality();
  qsel.addEventListener('change', () => {
    if (isQuality(qsel.value)) setQuality(qsel.value);
    player.dirty = true;
  });
  for (const ev of ['pointermove', 'pointerdown', 'keydown']) window.addEventListener(ev, poke, { passive: true });
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, select, button') && e.key !== ' ') return;
    if (e.key === ' ') { e.preventDefault(); setPlaying(!player.playing); }
    else if (e.key === 'ArrowRight') { player.t = Math.min(edit.duration - 0.01, player.t + 0.5); player.dirty = true; }
    else if (e.key === 'ArrowLeft') { player.t = Math.max(0, player.t - 0.5); player.dirty = true; }
    else if (e.key === 'h' || e.key === 'H') hud.classList.toggle('is-hidden');
    else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.().catch(() => {});
  });
  poke();

  // The master can be rendered right here, wherever WebCodecs is available (https or localhost).
  if (typeof VideoEncoder === 'undefined') { $('.render-group').hidden = true; return; }
  const panel = $('#render-panel'), bar = $('#render-bar'), label = $('#render-label'), cancel = $('#render-cancel');
  const link = $<HTMLAnchorElement>('#render-link');
  let ctrl: AbortController | null = null;
  $('#render').addEventListener('click', async () => {
    const [w, h] = $<HTMLSelectElement>('#render-res').value.split('x').map(Number);
    ctrl = new AbortController();
    panel.hidden = false;
    link.hidden = true;
    cancel.hidden = false;
    bar.style.width = '0%';
    label.textContent = 'Preparing the master…';
    try {
      const blob = await window.__film!.exportMP4({
        width: w, height: h, fps: 60, signal: ctrl.signal,
        onProgress: ({ frame, total, eta }) => {
          bar.style.width = `${(frame / total) * 100}%`;
          label.textContent = `Frame ${frame} of ${total} · about ${Math.ceil(eta)} s left`;
        },
      });
      link.href = URL.createObjectURL(blob);
      link.download = `focal-plane-${h}p60.mp4`;
      link.textContent = `Save MP4 · ${(blob.size / 1048576).toFixed(0)} MB`;
      link.hidden = false;
      label.textContent = 'Master ready.';
    } catch (e) {
      const err = e as Error;
      label.textContent = err.name === 'AbortError' ? 'Render cancelled.' : `Render failed: ${err.message}`;
    } finally {
      cancel.hidden = true;
      ctrl = null;
      player.dirty = true;
    }
  });
  cancel.addEventListener('click', () => ctrl?.abort());
}
