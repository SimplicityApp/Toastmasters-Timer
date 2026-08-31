import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Guards the shipped overlay assets, not the code that loads them. An oversized
// source PNG is invisible in review but expensive at runtime: the Zoom Apps SDK
// takes raw ImageData, so pixel count translates directly into bytes across the
// webview -> native bridge, and setVideoFilter documents a 15MB ceiling.
const BACKGROUNDS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../public/backgrounds');

const OVERLAY_FILES = [
  'timer-blue-background.png',
  'timer-green-background.png',
  'timer-yellow-background.png',
  'timer-red-background.png',
  'timer-blue-modern.png',
  'timer-green-modern.png',
  'timer-yellow-modern.png',
  'timer-red-modern.png',
];

// The source budget, deliberately larger than OVERLAY_CEILING_* in zoomSdk.js
// (640x360): the asset is downscaled to the ceiling before it reaches Zoom, and
// keeping 2x headroom means the ceiling can be raised without re-exporting. A
// source larger than this is not a rendering bug, just wasted download and decode.
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;

const ZOOM_IMAGE_DATA_LIMIT_BYTES = 15 * 1024 * 1024;

/** Read width/height from a PNG's IHDR chunk (bytes 16-24 of the file). */
function readPngDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('shipped background assets', () => {
  it.each(OVERLAY_FILES)('%s fits the overlay budget', (file) => {
    const bytes = readFileSync(join(BACKGROUNDS_DIR, file));

    // PNG magic number, so a truncated or wrong-format file fails loudly here
    // rather than as an opaque decode error inside the Zoom client.
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const { width, height } = readPngDimensions(bytes);
    expect(width).toBeLessThanOrEqual(MAX_WIDTH);
    expect(height).toBeLessThanOrEqual(MAX_HEIGHT);

    // Raw RGBA is what actually crosses the bridge; 4 bytes per pixel.
    expect(width * height * 4).toBeLessThan(ZOOM_IMAGE_DATA_LIMIT_BYTES);
  });

  it('keeps every overlay at a consistent 16:9 aspect ratio', () => {
    const ratios = OVERLAY_FILES.map((file) => {
      const { width, height } = readPngDimensions(readFileSync(join(BACKGROUNDS_DIR, file)));
      return (width / height).toFixed(4);
    });

    // Zoom scales the overlay to the video stream. A mismatched source would be
    // stretched or letterboxed for one color only, which reads as a rendering bug.
    expect(new Set(ratios).size).toBe(1);
    expect(Number(ratios[0])).toBeCloseTo(16 / 9, 3);
  });
});
