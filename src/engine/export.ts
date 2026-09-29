// The offline master.
// Every frame is rendered deterministically at a fixed size
// and encoded to H.264 in the browser with WebCodecs, then muxed to MP4.
// No screen capture, no dropped frames:
// frame i is time i / fps.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// What the exporter needs from the player.
export interface ExportApp {
  duration: number;
  canvas: HTMLCanvasElement;
  renderFrame(t: number, frame: number): unknown;
  // switches to a fixed offline size and master quality; returns a function that restores live mode
  beginOffline(w: number, h: number): () => void;
}

export interface Progress {
  frame: number;
  total: number;
  elapsed: number;
  // seconds left
  eta: number;
}

export interface ExportOptions {
  width?: number;
  height?: number;
  fps?: number;
  // the range of the edit to render, in seconds
  from?: number;
  to?: number;
  // bits per second
  bitrate?: number;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal | null;
}

export async function exportMP4(app: ExportApp, {
  width = 3840, height = 2160, fps = 60, from = 0, to = app.duration,
  bitrate = 64e6, onProgress = () => {}, signal = null,
}: ExportOptions = {}): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser has no WebCodecs video encoder. Use a recent Chrome or Edge, over https or localhost.');
  }
  const codec = 'avc1.640034';        // H.264 High, level 5.2: 4K at 60 fps
  const support = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: fps });
  if (!support.supported) throw new Error(`H.264 ${width}x${height}@${fps} is not supported by this browser's encoder.`);

  const out = new ArrayBufferTarget();
  const muxer = new Muxer({ target: out, video: { codec: 'avc', width, height, frameRate: fps }, fastStart: 'in-memory' });
  // the encoder reports errors from its own callback
  const failed: { error: Error | null } = { error: null };
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failed.error = e; },
  });
  encoder.configure({ codec, width, height, bitrate, bitrateMode: 'variable', framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } });

  const restore = app.beginOffline(width, height);
  const total = Math.round((to - from) * fps);
  const started = performance.now();
  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      if (failed.error) throw failed.error;
      app.renderFrame(from + i / fps, i);
      // the frame is read in the same task that drew it,
      // so the drawing buffer is still valid
      const frame = new VideoFrame(app.canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 2));
      if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
      const el = (performance.now() - started) / 1000;
      onProgress({ frame: i + 1, total, elapsed: el, eta: (el / (i + 1)) * (total - i - 1) });
    }
    await encoder.flush();
    if (failed.error) throw failed.error;
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
    restore();
  }
  return new Blob([out.buffer], { type: 'video/mp4' });
}
