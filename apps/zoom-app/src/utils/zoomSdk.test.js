import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The Zoom Apps SDK touches browser globals at import time and deadlocks under
// vitest + jsdom, so stub it out. hoisted() keeps the fake reachable from the
// hoisted vi.mock factory.
const { sdkMock } = vi.hoisted(() => ({
  sdkMock: {
    config: vi.fn(),
    setVideoFilter: vi.fn(),
    deleteVideoFilter: vi.fn(),
    setVirtualBackground: vi.fn(),
    removeVirtualBackground: vi.fn(),
    shareApp: vi.fn(),
    appPopout: vi.fn(),
    onAppPopout: vi.fn(),
  },
}));

vi.mock('@zoom/appssdk', () => ({ default: sdkMock }));

/**
 * jsdom has no real 2D canvas, so route createElement('canvas') to a fake whose
 * context records every operation performed on it.
 */
function stubCanvas() {
  const operations = [];
  const ctx = {
    scale: (...args) => operations.push(['scale', ...args]),
    drawImage: (...args) => operations.push(['drawImage', ...args.slice(1)]),
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
  return { operations, fakeCanvas };
}

/**
 * Replace global Image with a stub that reports a fixed natural size and fires
 * onload asynchronously. Returns the list of src values that were requested.
 */
function stubImage(naturalWidth = 2560, naturalHeight = 1440) {
  const loads = [];
  class FakeImage {
    constructor() {
      this.naturalWidth = naturalWidth;
      this.naturalHeight = naturalHeight;
      this.complete = true;
    }
    set src(value) {
      loads.push(value);
      setTimeout(() => this.onload && this.onload(), 0);
    }
  }
  vi.stubGlobal('Image', FakeImage);
  return loads;
}

/** Minimal PNG-shaped buffer: signature plus an IHDR carrying width/height. */
function fakePngBuffer(width, height) {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes.buffer;
}

/**
 * Stub fetch + createImageBitmap so decoding takes the target-size path.
 * Returns the recorded createImageBitmap options.
 */
function stubTargetSizeDecode(buffer = fakePngBuffer(1280, 720)) {
  const calls = [];
  const closed = [];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(buffer),
  }));
  vi.stubGlobal('createImageBitmap', vi.fn(async (_blob, options) => {
    calls.push(options);
    return {
      width: options.resizeWidth,
      height: options.resizeHeight,
      close: () => closed.push(true),
    };
  }));
  return { calls, closed };
}

/** Fresh module instance, so module-level caches and queues do not leak. */
async function loadModule() {
  vi.resetModules();
  return import('./zoomSdk');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  sdkMock.config.mockReset();
  sdkMock.setVideoFilter.mockReset();
  sdkMock.deleteVideoFilter.mockReset();
  sdkMock.setVirtualBackground.mockReset();
  sdkMock.removeVirtualBackground.mockReset();
  sdkMock.shareApp.mockReset();
  sdkMock.appPopout.mockReset();
  sdkMock.onAppPopout.mockReset();
});

describe('getBackgroundUrl', () => {
  it('places backgrounds under the app base path, not the origin root', async () => {
    const { getBackgroundUrl, getBasePath } = await loadModule();

    const url = getBackgroundUrl('blue');

    // The app is built with Vite base '/zoom/' in production. Requesting
    // origin + '/backgrounds/...' instead hits the SPA catch-all rewrite and
    // returns index.html, which fails to decode as an image and leaves the
    // meeting with no background at all.
    // Version-agnostic: BACKGROUND_VERSION is bumped whenever the assets change.
    expect(url).toMatch(
      new RegExp(
        `^${window.location.origin}${getBasePath()}backgrounds/timer-blue-background\\.png\\?v=\\d+$`
      )
    );
  });

  it('falls back to the blue background for an unknown color', async () => {
    const { getBackgroundUrl } = await loadModule();
    expect(getBackgroundUrl('chartreuse')).toContain('timer-blue-background.png');
  });

  it('normalizes a base path that is missing its trailing slash', async () => {
    const { getBasePath } = await loadModule();
    vi.stubEnv('BASE_URL', '/zoom');
    // Vite normally guarantees the trailing slash; do not depend on it, since a
    // missing one silently yields '/zoombackgrounds/...'.
    expect(getBasePath()).toBe('/zoom/');
  });
});

describe('getOverlayDimensions', () => {
  it('scales an oversized background down to the default budget', async () => {
    const { getOverlayDimensions } = await loadModule();
    // 2560x1440 is 14.7 MB of ImageData across the Zoom bridge, against a
    // documented 15 MB limit; 640x360 is 0.9 MB for the same visible result.
    expect(getOverlayDimensions(2560, 1440)).toEqual({ width: 640, height: 360 });
  });

  it('never upscales a source that already fits', async () => {
    const { getOverlayDimensions } = await loadModule();
    expect(getOverlayDimensions(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it('preserves aspect ratio for non-16:9 sources', async () => {
    const { getOverlayDimensions } = await loadModule();
    // Height is the binding constraint here, so width scales by the same factor.
    expect(getOverlayDimensions(2000, 2000)).toEqual({ width: 360, height: 360 });
  });

  it('honours a caller-supplied budget', async () => {
    const { getOverlayDimensions } = await loadModule();
    expect(getOverlayDimensions(1280, 720, { width: 480, height: 270 })).toEqual({
      width: 480,
      height: 270,
    });
  });

  it('clamps a budget larger than the ceiling', async () => {
    const { getOverlayDimensions } = await loadModule();
    // A camera reporting 4K must not produce a 33 MB push that Zoom would reject.
    expect(getOverlayDimensions(3840, 2160, { width: 3840, height: 2160 })).toEqual({
      width: 640,
      height: 360,
    });
  });

  it('defaults to the 640x360 ceiling when no camera has reported', async () => {
    const { getOverlayBudget } = await loadModule();
    expect(getOverlayBudget()).toEqual({ width: 640, height: 360 });
  });
});

describe('imageToImageData', () => {
  it('does not horizontally mirror the source image', async () => {
    // Zoom only mirrors video in the local self-view; mirroring the background
    // here would make the Toastmasters logo appear backwards to every other
    // participant.
    const { imageToImageData } = await loadModule();
    const { operations } = stubCanvas();

    imageToImageData({ naturalWidth: 4, naturalHeight: 1 }, 4, 1);

    const horizontalFlips = operations.filter(
      ([op, sx, sy]) => op === 'scale' && sx === -1 && sy === 1
    );
    expect(horizontalFlips).toHaveLength(0);
  });

  it('draws at the requested size so oversized sources scale instead of cropping', async () => {
    const { imageToImageData } = await loadModule();
    const { operations, fakeCanvas } = stubCanvas();

    const result = imageToImageData({ naturalWidth: 2560, naturalHeight: 1440 }, 1280, 720);

    // Destination width/height must be passed; without them drawImage renders at
    // natural size and getImageData returns the top-left crop.
    expect(operations.filter(([op]) => op === 'drawImage')).toEqual([
      ['drawImage', 0, 0, 1280, 720],
    ]);
    expect(fakeCanvas).toMatchObject({ width: 1280, height: 720 });
    expect(result).toMatchObject({ width: 1280, height: 720 });
  });
});

describe('loadImageAsImageData', () => {
  beforeEach(() => {
    stubCanvas();
  });

  it('shares one download and decode between concurrent callers', async () => {
    const { loadImageAsImageData } = await loadModule();
    const loads = stubImage();

    const [first, second] = await Promise.all([
      loadImageAsImageData('/backgrounds/blue.png'),
      loadImageAsImageData('/backgrounds/blue.png'),
    ]);

    // A preload and a concurrent apply must not each decode 2560x1440.
    expect(loads).toEqual(['/backgrounds/blue.png']);
    expect(second).toBe(first);
  });

  it('reuses the resolved ImageData on later calls', async () => {
    const { loadImageAsImageData } = await loadModule();
    const loads = stubImage();

    const first = await loadImageAsImageData('/backgrounds/blue.png');
    const second = await loadImageAsImageData('/backgrounds/blue.png');

    expect(loads).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('does not cache a failed load, so a later attempt can retry', async () => {
    const { loadImageAsImageData } = await loadModule();
    const loads = [];
    class FailingImage {
      set src(value) {
        loads.push(value);
        setTimeout(() => this.onerror && this.onerror({ type: 'error' }), 0);
      }
    }
    vi.stubGlobal('Image', FailingImage);

    await expect(loadImageAsImageData('/backgrounds/blue.png')).rejects.toThrow();
    await expect(loadImageAsImageData('/backgrounds/blue.png')).rejects.toThrow();

    expect(loads).toHaveLength(2);
  });
});

describe('applyOverlay', () => {
  beforeEach(() => {
    stubCanvas();
    stubImage();
    sdkMock.config.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({ status: 'ok' });
    sdkMock.deleteVideoFilter.mockResolvedValue({});
  });

  it('skips a push when the same overlay is already showing', async () => {
    const { initializeZoomSdk, applyOverlay, isOverlayActive } = await loadModule();
    await initializeZoomSdk();

    await applyOverlay('/backgrounds/blue.png');
    await applyOverlay('/backgrounds/blue.png');

    // resetTimer runs on every speaker/role change; re-pushing an identical
    // background costs seconds on a slow client for no visible change.
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(1);
    expect(isOverlayActive()).toBe(true);
  });

  it('pushes again after the overlay has been removed', async () => {
    const { initializeZoomSdk, applyOverlay, removeOverlay, isOverlayActive } = await loadModule();
    await initializeZoomSdk();

    await applyOverlay('/backgrounds/blue.png');
    await removeOverlay();
    expect(isOverlayActive()).toBe(false);

    await applyOverlay('/backgrounds/blue.png');
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(2);
  });

  it('collapses queued color changes to the newest one', async () => {
    const { initializeZoomSdk, applyOverlay } = await loadModule();
    await initializeZoomSdk();

    // Fired without awaiting, the way the rAF timer tick does on a fast
    // green -> yellow -> red run.
    const pushes = [
      applyOverlay('/backgrounds/green.png'),
      applyOverlay('/backgrounds/yellow.png'),
      applyOverlay('/backgrounds/red.png'),
    ];
    await Promise.all(pushes);

    // Superseded colors are dropped rather than pushed late and out of order.
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(1);
  });

  it('sends imageData in card mode, since setVideoFilter has no fileUrl option', async () => {
    const { initializeZoomSdk, applyOverlay, getOverlayDimensions } = await loadModule();
    await initializeZoomSdk();

    await applyOverlay('/backgrounds/blue.png');

    const [options] = sdkMock.setVideoFilter.mock.calls[0];
    // Sized by the overlay budget, not the 2560x1440 the stub image reports.
    expect(options.imageData).toMatchObject(getOverlayDimensions(2560, 1440));
    expect(options.fileUrl).toBeUndefined();
  });

  it('keeps working after a failed push', async () => {
    const { initializeZoomSdk, applyOverlay } = await loadModule();
    await initializeZoomSdk();

    sdkMock.setVideoFilter.mockRejectedValueOnce(new Error('bridge error'));
    await applyOverlay('/backgrounds/green.png');

    sdkMock.setVideoFilter.mockResolvedValue({ status: 'ok' });
    await applyOverlay('/backgrounds/red.png');

    // A rejected op must not leave the shared queue in a rejected state.
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(2);
  });
});

describe('readPngSize', () => {
  it('reads dimensions from the IHDR chunk', async () => {
    const { readPngSize } = await loadModule();
    expect(readPngSize(fakePngBuffer(2560, 1440))).toEqual({ width: 2560, height: 1440 });
  });

  it('returns null for bytes that are not a PNG', async () => {
    const { readPngSize } = await loadModule();
    const notPng = new Uint8Array(32);
    notPng.set([0xff, 0xd8, 0xff, 0xe0], 0); // JPEG
    expect(readPngSize(notPng.buffer)).toBeNull();
  });

  it('returns null for a buffer too short to hold an IHDR', async () => {
    const { readPngSize } = await loadModule();
    expect(readPngSize(new Uint8Array(8).buffer)).toBeNull();
  });
});

describe('decoding at target size', () => {
  beforeEach(() => {
    stubCanvas();
  });

  it('decodes straight to the budget size instead of full resolution', async () => {
    const { loadImageAsImageData } = await loadModule();
    const { calls } = stubTargetSizeDecode(fakePngBuffer(1280, 720));
    const loads = stubImage();

    const imageData = await loadImageAsImageData('/backgrounds/blue.png');

    // 1280x720 source fitted into the 640x360 default budget, decoded once at
    // that size rather than decoded large and resampled.
    expect(calls).toEqual([{ resizeWidth: 640, resizeHeight: 360, resizeQuality: 'high' }]);
    expect(imageData).toMatchObject({ width: 640, height: 360 });
    expect(loads).toEqual([]); // the Image() path was not used
  });

  it('keeps the asset aspect ratio when the camera reports a different one', async () => {
    const { loadImageAsImageData, handleMyMediaChange } = await loadModule();
    const { calls } = stubTargetSizeDecode(fakePngBuffer(1280, 720));

    // 4:3 camera against a 16:9 asset. Naively resizing to 480x360 would stretch
    // the logo; the fit must stay 16:9.
    handleMyMediaChange({ media: { video: { width: 480, height: 360 } }, timestamp: 1 });
    await loadImageAsImageData('/backgrounds/blue.png');

    expect(calls[0]).toMatchObject({ resizeWidth: 480, resizeHeight: 270 });
  });

  it('releases the native bitmap after reading the pixels', async () => {
    const { loadImageAsImageData } = await loadModule();
    const { closed } = stubTargetSizeDecode();

    await loadImageAsImageData('/backgrounds/blue.png');

    expect(closed).toEqual([true]);
  });

  it.each([
    ['fetch rejects', () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))],
    [
      'the response is not ok',
      () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, arrayBuffer: () => Promise.resolve(new ArrayBuffer(32)) })),
    ],
    [
      'the response is not a PNG',
      () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(32)) })),
    ],
    [
      'createImageBitmap throws',
      () => vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed'))),
    ],
  ])('falls back to the Image() path when %s', async (_label, breakIt) => {
    const { loadImageAsImageData } = await loadModule();
    stubTargetSizeDecode();
    breakIt();
    const loads = stubImage(1280, 720);

    const imageData = await loadImageAsImageData('/backgrounds/blue.png');

    // A direct Image() load has historically behaved better inside the Zoom
    // client, so it must remain a working escape hatch.
    expect(loads).toEqual(['/backgrounds/blue.png']);
    expect(imageData).toMatchObject({ width: 640, height: 360 });
  });

  it('uses the Image() path when the environment lacks createImageBitmap', async () => {
    const { loadImageAsImageData } = await loadModule();
    vi.stubGlobal('createImageBitmap', undefined);
    const loads = stubImage(1280, 720);

    const imageData = await loadImageAsImageData('/backgrounds/blue.png');

    expect(loads).toEqual(['/backgrounds/blue.png']);
    expect(imageData).toMatchObject({ width: 640, height: 360 });
  });
});

describe('camera resolution tracking', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({ status: 'ok' });
    sdkMock.deleteVideoFilter.mockResolvedValue({});
  });

  it('subscribes to onMyMediaChange and requests it as a capability', async () => {
    const { initializeZoomSdk } = await loadModule();
    sdkMock.onMyMediaChange = vi.fn();

    await initializeZoomSdk();

    expect(sdkMock.config.mock.calls[0][0].capabilities).toContain('onMyMediaChange');
    expect(sdkMock.onMyMediaChange).toHaveBeenCalledWith(expect.any(Function));
    delete sdkMock.onMyMediaChange;
  });

  it('still initializes when the client rejects the optional capability', async () => {
    const { initializeZoomSdk, isSdkAvailable } = await loadModule();
    sdkMock.config.mockRejectedValueOnce(new Error('unsupported capability'));

    await initializeZoomSdk();

    // Losing config() entirely would disable every overlay, so the retry drops
    // the optional capability rather than the whole SDK.
    expect(isSdkAvailable()).toBe(true);
    expect(sdkMock.config.mock.calls[1][0].capabilities).not.toContain('onMyMediaChange');
    expect(sdkMock.config.mock.calls[1][0].capabilities).toContain('videoFilter');
  });

  it('sizes the overlay to the reported camera resolution', async () => {
    const { handleMyMediaChange, getOverlayBudget, getOverlayDimensions } = await loadModule();

    handleMyMediaChange({ media: { video: { width: 480, height: 270 } }, timestamp: 1 });

    expect(getOverlayBudget()).toEqual({ width: 480, height: 270 });
    // Below the ceiling, so the camera resolution binds: 0.5 MB instead of 0.9 MB.
    expect(getOverlayDimensions(1280, 720)).toEqual({ width: 480, height: 270 });
  });

  it.each([
    ['720p', 1280, 720],
    ['1080p', 1920, 1080],
    ['4K', 3840, 2160],
  ])('treats a %s camera as an upper bound, not a target', async (_label, width, height) => {
    const { handleMyMediaChange, getOverlayBudget, getOverlayDimensions } = await loadModule();

    handleMyMediaChange({ media: { video: { width, height } }, timestamp: 1 });

    // Matching the camera would make a 720p webcam cost 3.7 MB per push, worse
    // than sending nothing camera-shaped at all. The content sets the ceiling.
    expect(getOverlayBudget()).toEqual({ width: 640, height: 360 });
    expect(getOverlayDimensions(1280, 720)).toEqual({ width: 640, height: 360 });
  });

  it.each([
    ['video with only a state flag', { media: { video: { state: false } }, timestamp: 1 }],
    ['an audio-only payload', { media: { audio: { state: true } }, timestamp: 1 }],
    ['a zero dimension', { media: { video: { width: 0, height: 0 } }, timestamp: 1 }],
    ['a missing media key', { timestamp: 1 }],
    ['no event at all', undefined],
  ])('ignores %s', async (_label, event) => {
    const { handleMyMediaChange, getOverlayBudget, getCameraResolution } = await loadModule();

    expect(() => handleMyMediaChange(event)).not.toThrow();

    expect(getCameraResolution()).toBeNull();
    expect(getOverlayBudget()).toEqual({ width: 640, height: 360 });
  });

  it('re-pushes the visible overlay when the resolution changes', async () => {
    const { initializeZoomSdk, applyOverlay, handleMyMediaChange } = await loadModule();
    await initializeZoomSdk();
    stubImage();

    await applyOverlay('/backgrounds/blue.png');
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(1);

    // Below the ceiling, so this genuinely changes the effective budget.
    handleMyMediaChange({ media: { video: { width: 480, height: 270 } }, timestamp: 2 });
    await applyOverlay('/backgrounds/blue.png'); // drains the queue

    // Same URL, so this only happens because the guard compares the budget the
    // pixels were rendered for. The new push must carry the new size.
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(2);
    const [options] = sdkMock.setVideoFilter.mock.calls[1];
    expect(options.imageData).toMatchObject({ width: 480, height: 270 });
  });

  it('does not push anything when no overlay is showing', async () => {
    const { initializeZoomSdk, handleMyMediaChange } = await loadModule();
    await initializeZoomSdk();
    stubImage();

    handleMyMediaChange({ media: { video: { width: 480, height: 270 } }, timestamp: 2 });
    await Promise.resolve();

    expect(sdkMock.setVideoFilter).not.toHaveBeenCalled();
  });

  it('ignores a repeat of the resolution it already has', async () => {
    const { initializeZoomSdk, applyOverlay, handleMyMediaChange } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await applyOverlay('/backgrounds/blue.png');

    const event = { media: { video: { width: 480, height: 270 } }, timestamp: 2 };
    handleMyMediaChange(event);
    handleMyMediaChange(event);
    await applyOverlay('/backgrounds/blue.png');

    // Two pushes: the original and one re-push. Not three.
    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(2);
  });
});

describe('applyOverlay in camera mode', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
  });

  it('passes a fileUrl and never downloads or decodes the image', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, OVERLAY_MODE_CAMERA } = await loadModule();
    await initializeZoomSdk();
    const loads = stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);

    await applyOverlay('https://zoom.example/backgrounds/blue.png');

    // The Zoom client fetches the image itself, so no pixels cross the bridge.
    expect(sdkMock.setVirtualBackground).toHaveBeenCalledWith({
      fileUrl: 'https://zoom.example/backgrounds/blue.png',
    });
    expect(loads).toEqual([]);
  });

  it('falls back to imageData when the client cannot fetch the fileUrl', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, getOverlayDimensions, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    const loads = stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);

    // A restricted network or proxy can stop the native client reaching the URL.
    sdkMock.setVirtualBackground.mockRejectedValueOnce(new Error('fetch failed'));

    await applyOverlay('https://zoom.example/backgrounds/blue.png');

    expect(loads).toEqual(['https://zoom.example/backgrounds/blue.png']);
    const [options] = sdkMock.setVirtualBackground.mock.calls[1];
    expect(options.imageData).toMatchObject(getOverlayDimensions(2560, 1440));
  });

  it('does not re-push on a resolution change, since a fileUrl carries no pixels', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, handleMyMediaChange, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);
    await applyOverlay('https://zoom.example/backgrounds/blue.png');
    expect(sdkMock.setVirtualBackground).toHaveBeenCalledTimes(1);

    handleMyMediaChange({ media: { video: { width: 480, height: 270 } }, timestamp: 2 });
    await applyOverlay('https://zoom.example/backgrounds/blue.png');

    // Zoom scales the file itself, so resolution has no bearing on this push.
    expect(sdkMock.setVirtualBackground).toHaveBeenCalledTimes(1);
  });

  it('marks the overlay active after a fileUrl push, so removal still works', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, removeOverlay, isOverlayActive, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);

    await applyOverlay('https://zoom.example/backgrounds/blue.png');
    expect(isOverlayActive()).toBe(true);

    await removeOverlay();
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
    expect(isOverlayActive()).toBe(false);
  });
});

describe('stage modes (share and popout)', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
    sdkMock.shareApp.mockResolvedValue({});
    sdkMock.appPopout.mockResolvedValue({});
  });

  it('starts an app share on entering share mode and leaves the camera alone', async () => {
    const { initializeZoomSdk, setOverlayMode, isAppShareActive, OVERLAY_MODE_SHARE } = await loadModule();
    await initializeZoomSdk();

    await setOverlayMode(OVERLAY_MODE_SHARE, 'https://zoom.example/backgrounds/blue.png');

    expect(sdkMock.shareApp).toHaveBeenCalledWith({ action: 'start', withSound: false });
    expect(isAppShareActive()).toBe(true);
    // The whole point of share mode: the user keeps their own face and background.
    expect(sdkMock.setVirtualBackground).not.toHaveBeenCalled();
    expect(sdkMock.setVideoFilter).not.toHaveBeenCalled();
  });

  it('pushes no pixels while a stage mode is active, whoever asks', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, OVERLAY_MODE_SHARE } = await loadModule();
    await initializeZoomSdk();
    const loads = stubImage();
    await setOverlayMode(OVERLAY_MODE_SHARE, null);

    // TimerContext calls applyOverlay on every status change regardless of mode.
    await applyOverlay('https://zoom.example/backgrounds/red.png');

    expect(sdkMock.setVideoFilter).not.toHaveBeenCalled();
    expect(sdkMock.setVirtualBackground).not.toHaveBeenCalled();
    expect(loads).toEqual([]);
  });

  it('stops the share when leaving share mode', async () => {
    const { initializeZoomSdk, setOverlayMode, isAppShareActive, OVERLAY_MODE_SHARE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_SHARE, null);

    await setOverlayMode(OVERLAY_MODE_CARD, null);

    expect(sdkMock.shareApp).toHaveBeenLastCalledWith({ action: 'stop' });
    expect(isAppShareActive()).toBe(false);
  });

  it('undocks on entering popout mode and docks again on leaving', async () => {
    const { initializeZoomSdk, setOverlayMode, isAppPoppedOut, OVERLAY_MODE_POPOUT, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();

    await setOverlayMode(OVERLAY_MODE_POPOUT, null);
    expect(sdkMock.appPopout).toHaveBeenCalledWith({ action: 'undock' });
    expect(isAppPoppedOut()).toBe(true);

    await setOverlayMode(OVERLAY_MODE_CARD, null);
    expect(sdkMock.appPopout).toHaveBeenLastCalledWith({ action: 'dock' });
    expect(isAppPoppedOut()).toBe(false);
  });

  it('reports a refused popout instead of leaving the panel covered', async () => {
    const { initializeZoomSdk, setOverlayMode, isAppPoppedOut, OVERLAY_MODE_POPOUT } = await loadModule();
    await initializeZoomSdk();
    // 10247: the running context cannot pop out. Mobile clients also reject the
    // capability outright at config() time.
    const refusal = Object.assign(new Error('cannot popout'), { code: 10247 });
    sdkMock.appPopout.mockRejectedValueOnce(refusal);

    const accepted = await setOverlayMode(OVERLAY_MODE_POPOUT, null);

    expect(accepted).toBe(false);
    expect(isAppPoppedOut()).toBe(false);
  });

  it('does not dock a window the client already docked itself', async () => {
    const { initializeZoomSdk, setOverlayMode, handleAppPopout, isAppPoppedOut, OVERLAY_MODE_POPOUT, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_POPOUT, null);

    // The user merged the window back from Zoom's own ellipsis menu.
    handleAppPopout({ action: 'dock', timestamp: 1 });
    expect(isAppPoppedOut()).toBe(false);
    sdkMock.appPopout.mockClear();

    await setOverlayMode(OVERLAY_MODE_CARD, null);

    expect(sdkMock.appPopout).not.toHaveBeenCalled();
  });

  it('notifies the popout callback when the client docks the window', async () => {
    const { initializeZoomSdk, setPopoutChangeCallback, handleAppPopout } = await loadModule();
    await initializeZoomSdk();
    const seen = [];
    setPopoutChangeCallback((popped) => seen.push(popped));

    handleAppPopout({ action: 'undock', timestamp: 1 });
    handleAppPopout({ action: 'undock', timestamp: 2 }); // duplicate, no second call
    handleAppPopout({ action: 'dock', timestamp: 3 });
    handleAppPopout({ timestamp: 4 }); // malformed payload

    expect(seen).toEqual([true, false]);
  });

  it('restores the video overlay when returning from a stage mode', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_SHARE, OVERLAY_MODE_CAMERA } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_SHARE, null);

    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');

    expect(sdkMock.setVirtualBackground).toHaveBeenCalledWith({
      fileUrl: 'https://zoom.example/backgrounds/green.png',
    });
  });
});

describe('getZoomParticipants', () => {
  it('returns an empty list without logging a bogus error when the SDK is unavailable', async () => {
    // A fresh module has sdkAvailable === false, which is also what every
    // dev-server page load sees (SpeakerInput calls this on mount). The
    // unavailable branch used to log a variable that was not bound in its
    // scope, so the call threw a ReferenceError that the outer catch swallowed
    // and relogged as 'Failed to get Zoom participants: ReferenceError'.
    const { getZoomParticipants } = await loadModule();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getZoomParticipants()).resolves.toEqual([]);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('leaving a stage mode is never dropped by the overlay queue', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
    sdkMock.shareApp.mockResolvedValue({});
    sdkMock.appPopout.mockResolvedValue({});
  });

  it('stops the share even when a newer overlay push supersedes the teardown', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, isAppShareActive, OVERLAY_MODE_SHARE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_SHARE, null);
    expect(isAppShareActive()).toBe(true);

    // Exactly what the UI does on exit: React flips the mode, whose effect fires
    // an applyOverlay for the incoming card mode while the teardown is in flight.
    // Routed through the queue, that push would bump the request id and the
    // teardown would be skipped, leaving the meeting shared with no stage on
    // screen and no way back to it.
    const exiting = setOverlayMode(OVERLAY_MODE_CARD, 'https://zoom.example/backgrounds/blue.png');
    applyOverlay('https://zoom.example/backgrounds/blue.png');
    await exiting;

    expect(sdkMock.shareApp).toHaveBeenCalledWith({ action: 'stop' });
    expect(isAppShareActive()).toBe(false);
  });

  it('stops the share even if the active flag went stale', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_SHARE, OVERLAY_MODE_CARD } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_SHARE, null);
    sdkMock.shareApp.mockClear();

    // Zoom reports nothing when the user stops the share from its own toolbar,
    // so the stop is attempted regardless of what the flag says.
    await setOverlayMode(OVERLAY_MODE_CARD, null);

    expect(sdkMock.shareApp).toHaveBeenCalledWith({ action: 'stop' });
  });
});

describe('entering a stage mode leaves the camera untouched', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
    sdkMock.shareApp.mockResolvedValue({});
    sdkMock.appPopout.mockResolvedValue({});
  });

  it('clears the virtual background when switching from camera mode to share', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_CAMERA, OVERLAY_MODE_SHARE } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    sdkMock.removeVirtualBackground.mockClear();

    await setOverlayMode(OVERLAY_MODE_SHARE, null);

    // Otherwise the color stays behind the user's face while the stage is shared.
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
  });

  it('does not touch the virtual background when none of ours is applied', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_CARD, OVERLAY_MODE_POPOUT } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CARD, 'https://zoom.example/backgrounds/blue.png');
    sdkMock.deleteVideoFilter.mockClear();
    sdkMock.removeVirtualBackground.mockClear();

    await setOverlayMode(OVERLAY_MODE_POPOUT, null);

    // deleteVideoFilter is silent, so it is always safe to call. Its virtual
    // background counterpart raises a confirmation dialog every single time, so
    // calling it here would mean prompting the user to remove something that was
    // never applied.
    expect(sdkMock.deleteVideoFilter).toHaveBeenCalled();
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });

  it('stops prompting once the virtual background has been removed', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_CAMERA, OVERLAY_MODE_SHARE, OVERLAY_MODE_POPOUT } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    await setOverlayMode(OVERLAY_MODE_SHARE, null);
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalledTimes(1);
    sdkMock.removeVirtualBackground.mockClear();

    // Hopping between stage modes must not re-prompt: it is already gone.
    await setOverlayMode(OVERLAY_MODE_POPOUT, null);

    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });

  it('still clears the camera when a newer overlay push supersedes the switch', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, OVERLAY_MODE_CAMERA, OVERLAY_MODE_SHARE } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    sdkMock.removeVirtualBackground.mockClear();

    const switching = setOverlayMode(OVERLAY_MODE_SHARE, null);
    applyOverlay('https://zoom.example/backgrounds/red.png');
    await switching;

    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
  });

  it('carries on when the client reports there was nothing to clear', async () => {
    const { initializeZoomSdk, setOverlayMode, isAppShareActive, OVERLAY_MODE_SHARE } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    // 10195: no overlay exists to remove. Expected, not a reason to abort.
    sdkMock.deleteVideoFilter.mockRejectedValueOnce(Object.assign(new Error('none'), { code: 10195 }));
    sdkMock.removeVirtualBackground.mockRejectedValueOnce(Object.assign(new Error('none'), { code: 10195 }));

    const accepted = await setOverlayMode(OVERLAY_MODE_SHARE, null);

    expect(accepted).toBe(true);
    expect(isAppShareActive()).toBe(true);
  });
});
