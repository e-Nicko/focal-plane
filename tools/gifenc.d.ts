// gifenc ships without types; this is the part the tools use.
declare module 'gifenc' {
  export interface FrameOptions {
    // the colour table for this frame; required for the first one
    palette?: number[][];
    // milliseconds
    delay?: number;
    // 0 loops forever, -1 plays once
    repeat?: number;
    colorDepth?: number;
    transparent?: boolean;
    transparentIndex?: number;
    // GIF disposal method; -1 picks the default
    dispose?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): Encoder;
}
