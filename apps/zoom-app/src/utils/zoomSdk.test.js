import { describe, it, expect, vi, afterEach } from 'vitest';

// The Zoom Apps SDK touches browser globals at import time and deadlocks under
// vitest + jsdom. The unit under test does not use the SDK, so stub it out.
vi.mock('@zoom/appssdk', () => ({ default: {} }));

import { imageToImageData } from './zoomSdk';

describe('imageToImageData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not horizontally mirror the source image', () => {
    // Zoom only mirrors video in the local self-view; mirroring the background
    // here would make the Toastmasters logo appear backwards to every other
    // participant. Track every operation performed on the 2D context to verify
    // the helper never applies a horizontal flip.
    const operations = [];
    const ctx = {
      scale: (...args) => operations.push(['scale', ...args]),
      drawImage: (...args) => operations.push(['drawImage', args[1], args[2]]),
      getImageData: (x, y, w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      }),
    };
    const fakeCanvas = { width: 0, height: 0, getContext: () => ctx };
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return fakeCanvas;
      throw new Error(`Unexpected createElement('${tag}')`);
    });

    const fakeImage = { naturalWidth: 4, naturalHeight: 1 };
    imageToImageData(fakeImage, 4, 1);

    const horizontalFlips = operations.filter(
      ([op, sx, sy]) => op === 'scale' && sx === -1 && sy === 1
    );
    expect(horizontalFlips).toHaveLength(0);

    const drawCalls = operations.filter(([op]) => op === 'drawImage');
    expect(drawCalls).toEqual([['drawImage', 0, 0]]);
  });
});
