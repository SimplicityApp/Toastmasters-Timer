import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// The module's own source, so the API list can be checked against the calls it
// actually makes rather than against a second hand-kept list.
import zoomSdkSource from './zoomSdk.js?raw';

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
    onShareScreen: vi.fn(),
    getMeetingView: vi.fn(),
    onMeetingViewChange: vi.fn(),
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

// The module reads its "a background of ours is applied" flag from localStorage
// at import time, so a leftover value would follow the next loadModule().
beforeEach(() => {
  localStorage.clear();
});

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
  sdkMock.onShareScreen.mockReset();
  sdkMock.getMeetingView.mockReset();
  sdkMock.onMeetingViewChange.mockReset();
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
    // Timer Card is what the retry has to preserve: it is the default mode and
    // every other mode degrades to it.
    expect(sdkMock.config.mock.calls[1][0].capabilities).toContain('setVideoFilter');
    expect(sdkMock.config.mock.calls[1][0].capabilities).toContain('deleteVideoFilter');
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
    // The re-push, if there were one, is queued rather than awaited.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Zoom scales the file itself, so resolution has no bearing on this push.
    // Checked on the resolution event alone: camera mode deliberately no longer
    // dedupes an explicit apply, since the user may have changed the background
    // in Zoom without telling us.
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

  // Added per-test rather than to the shared mock, which stays a picture of what
  // the SDK itself defines — getUserContext reaches the client through its proxy.
  const withUserContext = (context) => {
    sdkMock.getUserContext = vi.fn().mockResolvedValue(context);
  };

  afterEach(() => {
    delete sdkMock.getUserContext;
  });

  it('starts nothing on its own when the stage opens', async () => {
    const { initializeZoomSdk, setOverlayMode, isAppShareActive, isAppPoppedOut, OVERLAY_MODE_STAGE } =
      await loadModule();
    await initializeZoomSdk();

    await setOverlayMode(OVERLAY_MODE_STAGE, 'https://zoom.example/backgrounds/blue.png');

    // Opening a view must never broadcast anything. Sharing and popping out are
    // buttons on the stage, so a screen share is always something the organizer
    // pressed rather than a consequence of picking a mode.
    expect(sdkMock.shareApp).not.toHaveBeenCalled();
    expect(sdkMock.appPopout).not.toHaveBeenCalled();
    expect(isAppShareActive()).toBe(false);
    expect(isAppPoppedOut()).toBe(false);
    // And the camera is left alone, which is the whole point of the stage.
    expect(sdkMock.setVirtualBackground).not.toHaveBeenCalled();
    expect(sdkMock.setVideoFilter).not.toHaveBeenCalled();
  });

  it('shares the stage without touching the camera', async () => {
    const { initializeZoomSdk, setOverlayMode, setAppShare, isAppShareActive, OVERLAY_MODE_STAGE } =
      await loadModule();
    await initializeZoomSdk();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    expect(await setAppShare(true)).toBe(true);

    expect(sdkMock.shareApp).toHaveBeenCalledWith({ action: 'start', withSound: false });
    expect(isAppShareActive()).toBe(true);
    expect(sdkMock.setVirtualBackground).not.toHaveBeenCalled();
    expect(sdkMock.setVideoFilter).not.toHaveBeenCalled();
  });

  it('keeps the share when a popout is refused mid-share', async () => {
    const { initializeZoomSdk, setOverlayMode, setAppShare, setAppPopout, isAppShareActive, isAppPoppedOut, OVERLAY_MODE_STAGE } =
      await loadModule();
    await initializeZoomSdk();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);
    await setAppShare(true);
    // Zoom will not undock an app that is being shared. The stage hides the
    // button while sharing for that reason; this covers the request arriving
    // anyway, and the share surviving it.
    sdkMock.appPopout.mockRejectedValueOnce(Object.assign(new Error('cannot popout'), { code: 10247 }));

    expect(await setAppPopout(true)).toBe(false);

    expect(isAppPoppedOut()).toBe(false);
    expect(isAppShareActive()).toBe(true);
  });

  it('pushes no pixels while the stage is up, whoever asks', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, OVERLAY_MODE_STAGE } = await loadModule();
    await initializeZoomSdk();
    const loads = stubImage();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    // TimerContext calls applyOverlay on every status change regardless of mode.
    await applyOverlay('https://zoom.example/backgrounds/red.png');

    expect(sdkMock.setVideoFilter).not.toHaveBeenCalled();
    expect(sdkMock.setVirtualBackground).not.toHaveBeenCalled();
    expect(loads).toEqual([]);
  });

  it('stops a share and docks the window when the stage closes', async () => {
    const { initializeZoomSdk, setOverlayMode, setAppShare, setAppPopout, isAppShareActive, isAppPoppedOut, OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);
    await setAppShare(true);
    await setAppPopout(true);

    await setOverlayMode(OVERLAY_MODE_CARD, null);

    // Neither should outlive the view that offered it — least of all the share,
    // which would leave the meeting watching a stage that is no longer there.
    expect(sdkMock.shareApp).toHaveBeenLastCalledWith({ action: 'stop' });
    expect(sdkMock.appPopout).toHaveBeenLastCalledWith({ action: 'dock' });
    expect(isAppShareActive()).toBe(false);
    expect(isAppPoppedOut()).toBe(false);
  });

  it('reports a refused popout rather than claiming the window opened', async () => {
    const { initializeZoomSdk, setAppPopout, isAppPoppedOut } = await loadModule();
    await initializeZoomSdk();
    // 10247: the running context cannot pop out. Mobile clients also reject the
    // capability outright at config() time.
    sdkMock.appPopout.mockRejectedValueOnce(Object.assign(new Error('cannot popout'), { code: 10247 }));

    expect(await setAppPopout(true)).toBe(false);
    expect(isAppPoppedOut()).toBe(false);
  });

  it('does not dock a window the client already docked itself', async () => {
    const { initializeZoomSdk, setOverlayMode, setAppPopout, handleAppPopout, isAppPoppedOut, OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);
    await setAppPopout(true);

    // The user merged the window back from Zoom's own ellipsis menu.
    handleAppPopout({ action: 'dock', timestamp: 1 });
    expect(isAppPoppedOut()).toBe(false);
    sdkMock.appPopout.mockClear();

    await setOverlayMode(OVERLAY_MODE_CARD, null);

    expect(sdkMock.appPopout).not.toHaveBeenCalled();
  });

  it('follows a share stopped from Zoom\'s own toolbar', async () => {
    const { initializeZoomSdk, setAppShare, setShareChangeCallback, handleShareApp, isAppShareActive } =
      await loadModule();
    await initializeZoomSdk();
    const seen = [];
    setShareChangeCallback((sharing) => seen.push(sharing));
    await setAppShare(true);

    // Zoom's sharing toolbar never goes near our button, so without the event the
    // stage would keep offering "Stop sharing" for a share that already ended.
    handleShareApp('stop');
    expect(isAppShareActive()).toBe(false);

    handleShareApp('stop'); // duplicate, no second call
    handleShareApp({ action: 'start' }); // object form, seen on some clients
    handleShareApp('nonsense'); // malformed payload

    expect(seen).toEqual([false, true]);
  });

  it('follows Zoom\'s own Stop Share through onShareScreen', async () => {
    const { initializeZoomSdk, setAppShare, setShareChangeCallback, handleShareScreen, isAppShareActive } =
      await loadModule();
    // An app share is a screen share as far as the meeting is concerned, and this
    // event reaches clients that deliver neither onShareApp nor the meeting view.
    // It is what lets the stage follow Zoom's toolbar without polling for it.
    withUserContext({ participantUUID: 'me', screenName: 'Priya', role: 'host' });
    await initializeZoomSdk();
    const seen = [];
    setShareChangeCallback((sharing) => seen.push(sharing));
    await setAppShare(true);

    handleShareScreen({ participantUUID: 'me', action: 'stop', withSound: false, timestamp: 1 });

    expect(isAppShareActive()).toBe(false);
    expect(seen).toEqual([false]);
  });

  it('ignores a share of someone else\'s that stopped', async () => {
    const { initializeZoomSdk, setAppShare, handleShareScreen, isAppShareActive } = await loadModule();
    withUserContext({ participantUUID: 'me', screenName: 'Priya', role: 'host' });
    await initializeZoomSdk();
    await setAppShare(true);

    // The event is meeting-wide: it fires for everybody. Reading someone else's
    // share ending as ours would offer "Screenshare" over a stage the meeting is
    // still watching, and pressing it would ask Zoom for a second share.
    handleShareScreen({ participantUUID: 'someone-else', action: 'stop', timestamp: 1 });
    handleShareScreen({ participantUUID: 'me', action: 'start', timestamp: 2 });

    expect(isAppShareActive()).toBe(true);
  });

  it('leaves the share alone when it cannot tell whose it is', async () => {
    const { initializeZoomSdk, setAppShare, handleShareScreen, isAppShareActive } = await loadModule();
    // getUserContext refused — not defined on this client at all — so there is no
    // UUID to match against. Guessing is worse than the stale label: the other two
    // events and the check made before each stop still cover this client.
    await initializeZoomSdk();
    await setAppShare(true);

    handleShareScreen({ participantUUID: 'me', action: 'stop', timestamp: 1 });

    expect(isAppShareActive()).toBe(true);
  });

  it('follows a share stopped from Zoom\'s own toolbar through the meeting view', async () => {
    const { initializeZoomSdk, setAppShare, setShareChangeCallback, handleMeetingViewChange, isAppShareActive } =
      await loadModule();
    await initializeZoomSdk();
    const seen = [];
    setShareChangeCallback((sharing) => seen.push(sharing));
    await setAppShare(true);

    // onShareApp is the event for this, but it is not delivered by every client.
    handleMeetingViewChange({ presenting: false, timestamp: 1 });

    expect(isAppShareActive()).toBe(false);
    expect(seen).toEqual([false]);
  });

  it('reads nothing into a presenting flag that is on or absent', async () => {
    const { initializeZoomSdk, setAppShare, handleMeetingViewChange, isAppShareActive } = await loadModule();
    await initializeZoomSdk();
    await setAppShare(true);

    // Only the parameters that changed are present, so an event about the view
    // switching to gallery says nothing about sharing. And `presenting: true`
    // covers any share, ours or the user's own screen — never a reason to claim
    // the app is the thing on screen.
    handleMeetingViewChange({ view: 'gallery', timestamp: 1 });
    handleMeetingViewChange({ presenting: true, timestamp: 2 });

    expect(isAppShareActive()).toBe(true);
  });

  it('treats stopping an already-ended share as done, not as a failure', async () => {
    const { initializeZoomSdk, setAppShare, setShareChangeCallback, isAppShareActive } = await loadModule();
    await initializeZoomSdk();
    const seen = [];
    setShareChangeCallback((sharing) => seen.push(sharing));
    await setAppShare(true);
    sdkMock.shareApp.mockClear();
    // The organizer pressed Zoom's own Stop Share, and this client reported it
    // through neither onShareApp nor onMeetingViewChange. Whatever code the
    // refusal carries — clients word this differently — it is not a failure.
    sdkMock.getMeetingView.mockResolvedValue({ view: 'speaker', presenting: false });
    sdkMock.shareApp.mockRejectedValueOnce(Object.assign(new Error('failed to share'), { code: 10018 }));

    // The share they wanted gone is gone, so the button must not report failure.
    expect(await setAppShare(false)).toBe(true);
    expect(isAppShareActive()).toBe(false);
    expect(seen).toEqual([false]);
  });

  it('still asks Zoom to stop, in case the read had gone stale', async () => {
    const { initializeZoomSdk, setAppShare, isAppShareActive } = await loadModule();
    await initializeZoomSdk();
    await setAppShare(true);
    sdkMock.shareApp.mockClear();
    // A "nobody is presenting" read is never grounds for skipping the stop: if it
    // is wrong, skipping leaves the meeting watching a share we declared over.
    sdkMock.getMeetingView.mockResolvedValue({ view: 'speaker', presenting: false });

    expect(await setAppShare(false)).toBe(true);

    expect(sdkMock.shareApp).toHaveBeenCalledWith({ action: 'stop' });
    expect(isAppShareActive()).toBe(false);
  });

  it('accepts Zoom saying there was no share to stop', async () => {
    const { initializeZoomSdk, setAppShare, isAppShareActive } = await loadModule();
    await initializeZoomSdk();
    await setAppShare(true);
    // A client that cannot answer getMeetingView, so the truth only arrives as a
    // rejection from the stop itself. 10189: no ongoing screen share by this user.
    sdkMock.getMeetingView.mockRejectedValue(Object.assign(new Error('unsupported'), { code: 10116 }));
    sdkMock.shareApp.mockRejectedValueOnce(Object.assign(new Error('no share'), { code: 10189 }));

    expect(await setAppShare(false)).toBe(true);
    expect(isAppShareActive()).toBe(false);
  });

  it('still reports a stop the client genuinely refused', async () => {
    const { initializeZoomSdk, setAppShare } = await loadModule();
    await initializeZoomSdk();
    await setAppShare(true);
    sdkMock.getMeetingView.mockResolvedValue({ view: 'standard', presenting: true });
    sdkMock.shareApp.mockRejectedValueOnce(Object.assign(new Error('failed'), { code: 10018 }));

    // A share that is up and would not come down is exactly what the toast is
    // for; swallowing it would leave the meeting watching the stage.
    expect(await setAppShare(false)).toBe(false);
  });

  it('reconciles the share when the app comes back to the front', async () => {
    const { initializeZoomSdk, setAppShare, handleAppVisibilityChange, syncAppShareState, isAppShareActive } =
      await loadModule();
    await initializeZoomSdk();
    await setAppShare(true);
    sdkMock.getMeetingView.mockResolvedValue({ view: 'speaker', presenting: false });
    // Well past the settle window below, so this is the steady-state answer.
    vi.spyOn(performance, 'now').mockReturnValue(60_000);

    handleAppVisibilityChange({ visible: true, timestamp: 1 });
    // The handler cannot await; the state settles on the same check.
    await syncAppShareState();

    expect(isAppShareActive()).toBe(false);
  });

  it('ignores a poll that lands in the moments just after a share starts', async () => {
    const { initializeZoomSdk, setAppShare, syncAppShareState, isAppShareActive } = await loadModule();
    await initializeZoomSdk();
    await setAppShare(true);
    // The client's view state does not update in the same instant the share
    // begins. Believing this read would flip the button back to "Screenshare"
    // mid-share, and pressing it would then ask Zoom to start a second one.
    sdkMock.getMeetingView.mockResolvedValue({ view: 'speaker', presenting: false });

    expect(await syncAppShareState()).toBe(true);
    expect(sdkMock.getMeetingView).not.toHaveBeenCalled();
    expect(isAppShareActive()).toBe(true);
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

  it('restores the video overlay when returning from the stage', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_STAGE, OVERLAY_MODE_CAMERA } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);

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

    await expect(getZoomParticipants()).resolves.toEqual({
      participants: [],
      role: '',
      restricted: false,
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // getUserContext is grantable in the Marketplace but reaches the client
  // through the SDK's proxy, so it is added to the mock per-test rather than to
  // the shared one — which stays a picture of what the SDK itself defines.
  function withUserContext(context) {
    sdkMock.getUserContext = vi.fn().mockResolvedValue(context);
    return sdkMock.getUserContext;
  }

  async function initialized() {
    sdkMock.config.mockResolvedValue({});
    const module = await loadModule();
    await module.initializeZoomSdk();
    return module;
  }

  afterEach(() => {
    delete sdkMock.getUserContext;
    delete sdkMock.getMeetingParticipants;
  });

  it('puts the organizer in their own speaker list', async () => {
    // getMeetingParticipants returns everybody except the caller, so on its own
    // it never offers the organizer the one name they most often have to time.
    withUserContext({ screenName: 'Priya', role: 'host', participantUUID: 'me' });
    sdkMock.getMeetingParticipants = vi.fn().mockResolvedValue({
      participants: [{ screenName: 'Sam', participantUUID: 'p2' }],
    });
    const { getZoomParticipants } = await initialized();

    const result = await getZoomParticipants();

    // Self leads: it is the name most likely to be wanted.
    expect(result.participants).toEqual([
      { id: 'me', name: 'Priya' },
      { id: 'p2', name: 'Sam' },
    ]);
    expect(result.restricted).toBe(false);
  });

  it('does not list the organizer twice if the client already included them', async () => {
    withUserContext({ screenName: 'Priya', role: 'coHost', participantUUID: 'me' });
    sdkMock.getMeetingParticipants = vi.fn().mockResolvedValue({
      participants: [
        { screenName: 'Priya', participantUUID: 'me' },
        { screenName: 'Sam', participantUUID: 'p2' },
      ],
    });
    const { getZoomParticipants } = await initialized();

    expect((await getZoomParticipants()).participants).toEqual([
      { id: 'me', name: 'Priya' },
      { id: 'p2', name: 'Sam' },
    ]);
  });

  it('still offers the organizer their own name when they are not hosting', async () => {
    // getMeetingParticipants is host and co-host only. An attendee running the
    // timer used to get an empty list and no reason for it.
    withUserContext({ screenName: 'Priya', role: 'attendee', participantUUID: 'me' });
    sdkMock.getMeetingParticipants = vi.fn().mockRejectedValue(
      Object.assign(new Error('not allowed'), { code: 10102 })
    );
    const { getZoomParticipants } = await initialized();

    const result = await getZoomParticipants();

    expect(result.participants).toEqual([{ id: 'me', name: 'Priya' }]);
    // The one cause the organizer can act on, and the only one worth telling
    // them about.
    expect(result.restricted).toBe(true);
  });

  it('does not blame the role when a host\'s list fails for another reason', async () => {
    withUserContext({ screenName: 'Priya', role: 'host', participantUUID: 'me' });
    sdkMock.getMeetingParticipants = vi.fn().mockRejectedValue(new Error('bridge timeout'));
    const { getZoomParticipants } = await initialized();

    const result = await getZoomParticipants();

    // Telling a host to ask for co-host would be nonsense advice.
    expect(result.restricted).toBe(false);
    expect(result.participants).toEqual([{ id: 'me', name: 'Priya' }]);
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
    const { initializeZoomSdk, setOverlayMode, setAppShare, applyOverlay, isAppShareActive, OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);
    await setAppShare(true);
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

  it('does not stop a share the client already ended', async () => {
    const { initializeZoomSdk, setOverlayMode, setAppShare, handleShareApp, OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_STAGE, null);
    await setAppShare(true);

    // onShareApp reports a stop from Zoom's own toolbar, so the flag is
    // trustworthy now and a redundant stop is not needed to cover for it.
    handleShareApp('stop');
    sdkMock.shareApp.mockClear();

    await setOverlayMode(OVERLAY_MODE_CARD, null);

    expect(sdkMock.shareApp).not.toHaveBeenCalled();
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

  it('clears the virtual background when switching from camera mode to the stage', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_CAMERA, OVERLAY_MODE_STAGE } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    sdkMock.removeVirtualBackground.mockClear();

    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    // Otherwise the color stays behind the user's face while the stage is shared.
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
  });

  it('touches neither pipeline when nothing of ours is applied', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_STAGE } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    // Card mode from the start and no speech yet, so nothing was ever pushed.
    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    // Neither removal is free. The background one raises a confirmation dialog
    // every single time. deleteVideoFilter looked free, but Zoom documents it as
    // deleting filters set by other apps and setting the user's Video Filters
    // setting to None — so calling it on the way to the stage turned off a
    // filter the organizer had chosen for themselves.
    expect(sdkMock.deleteVideoFilter).not.toHaveBeenCalled();
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });

  it('takes down the card mode filter it did apply', async () => {
    const { initializeZoomSdk, applyOverlay, setOverlayMode, OVERLAY_MODE_STAGE } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await applyOverlay('https://zoom.example/backgrounds/blue.png');

    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    expect(sdkMock.deleteVideoFilter).toHaveBeenCalled();
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });

  it('stops prompting once the virtual background has been removed', async () => {
    const { initializeZoomSdk, setOverlayMode, OVERLAY_MODE_CAMERA, OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    await setOverlayMode(OVERLAY_MODE_STAGE, null);
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalledTimes(1);
    sdkMock.removeVirtualBackground.mockClear();

    // Returning to the stage must not re-prompt: it is already gone.
    await setOverlayMode(OVERLAY_MODE_CARD, null);
    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });

  it('still clears the camera when a newer overlay push supersedes the switch', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, OVERLAY_MODE_CAMERA, OVERLAY_MODE_STAGE } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    sdkMock.removeVirtualBackground.mockClear();

    const switching = setOverlayMode(OVERLAY_MODE_STAGE, null);
    applyOverlay('https://zoom.example/backgrounds/red.png');
    await switching;

    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
  });

  it('carries on when the client reports there was nothing to clear', async () => {
    const { initializeZoomSdk, setOverlayMode, getOverlayMode, OVERLAY_MODE_STAGE } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    // 10195: no overlay exists to remove. Expected, not a reason to abort.
    sdkMock.deleteVideoFilter.mockRejectedValueOnce(Object.assign(new Error('none'), { code: 10195 }));
    sdkMock.removeVirtualBackground.mockRejectedValueOnce(Object.assign(new Error('none'), { code: 10195 }));

    await setOverlayMode(OVERLAY_MODE_STAGE, null);

    expect(getOverlayMode()).toBe(OVERLAY_MODE_STAGE);
  });
});

describe('the debug panel reports on every API the app uses', () => {
  it('covers every zoomSdk call in the module', async () => {
    const called = new Set(
      [...zoomSdkSource.matchAll(/zoomSdk\.([a-zA-Z]+)\s*(?:\(|\?\.\()/g)].map(([, name]) => name)
    );
    const { USED_SDK_APIS } = await loadModule();
    const declared = new Set(USED_SDK_APIS.map((api) => api.name));

    // A method called but not declared is one the panel stays silent about, so a
    // client missing it reads as all-green. Add it to USED_SDK_APIS.
    expect([...called].filter((name) => !declared.has(name))).toEqual([]);
    // And the reverse, so the list does not accumulate APIs we stopped calling.
    expect([...declared].filter((name) => !called.has(name))).toEqual([]);
  });

  // Grantable in the Marketplace, absent from the npm typings — checked against
  // @zoom/appssdk 0.16.36, 0.16.40 and the CDN bundle in July 2026. Requesting
  // them is what makes the grant arrive on a client that has them, so the app
  // asks ahead of the SDK on purpose; config() lists any refusal in
  // unsupportedApis and isApiAvailable keeps every call site honest until then.
  // Delete an entry once the typings catch up — the assertion below covers it
  // again from that moment.
  const AHEAD_OF_SDK_CAPABILITIES = ['getCurrentVirtualBackground', 'getVirtualBackgrounds'];

  it('requests capabilities the SDK actually defines', async () => {
    // A capability is the exact API or event name. "videoFilter" and
    // "virtualBackground" look like they cover a family of calls but are not
    // capabilities at all, so requesting them granted nothing — and
    // removeVirtualBackground, never requested, came back refused.
    const typings = await import('@zoom/appssdk/dist/sdk.d.ts?raw').then((m) => m.default);
    const known = new Set(
      typings
        .match(/declare type Apis = ([^;]+);/)[1]
        .split('|')
        .map((name) => name.trim().replace(/'/g, ''))
    );
    const { USED_SDK_APIS } = await loadModule();

    const requested = USED_SDK_APIS
      .map((api) => api.capability)
      .filter(Boolean)
      .filter((name) => !AHEAD_OF_SDK_CAPABILITIES.includes(name));
    expect(requested.filter((name) => !known.has(name))).toEqual([]);
    // Guard the allowance itself: an entry that the SDK has since defined is
    // stale and should go back under the assertion above.
    expect(AHEAD_OF_SDK_CAPABILITIES.filter((name) => known.has(name))).toEqual([]);
    // And the method we call has to be the one we asked for.
    USED_SDK_APIS.filter((api) => api.capability).forEach((api) => {
      expect(api.capability).toBe(api.name);
    });
  });

  it('reports what a bare-bones client is missing, with a reason', async () => {
    const { getMissingSdkApis, USED_SDK_APIS } = await loadModule();
    // Nothing configured yet: every API reads as missing, each with its purpose.
    const missing = getMissingSdkApis();
    expect(missing.length).toBeGreaterThan(0);
    missing.forEach((api) => {
      expect(api.purpose).toBeTruthy();
      expect(typeof api.required).toBe('boolean');
    });
    expect(missing.length).toBeLessThanOrEqual(USED_SDK_APIS.length);
  });

  it('lists nothing once the client offers everything', async () => {
    const { getMissingSdkApis, USED_SDK_APIS } = await loadModule();
    // Added for this test only: sdkMock is shared, and leaving methods on it
    // would quietly change what every later test's client appears to support.
    const added = USED_SDK_APIS.map((api) => api.name).filter(
      (name) => typeof sdkMock[name] !== 'function'
    );
    added.forEach((name) => { sdkMock[name] = vi.fn(); });

    try {
      expect(getMissingSdkApis()).toEqual([]);
    } finally {
      added.forEach((name) => { delete sdkMock[name]; });
    }
  });
});

describe('the client owns the background, so our record of it goes stale', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
  });

  it('re-applies the branded background after the user swaps it in Zoom', async () => {
    const { initializeZoomSdk, setOverlayMode, applyOverlay, OVERLAY_MODE_CAMERA } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    expect(sdkMock.setVirtualBackground).toHaveBeenCalled();
    sdkMock.setVirtualBackground.mockClear();

    // The organizer opens Zoom's own Background & Effects panel and picks
    // something else, or clears it. Nothing reports that to the app, so our
    // record still claims green is up — and skipping the push on the strength of
    // that record leaves the branded image gone for the rest of the meeting.
    await applyOverlay('https://zoom.example/backgrounds/green.png');

    expect(sdkMock.setVirtualBackground).toHaveBeenCalled();
  });

  it('forgets what it believed once the app is brought back to the front', async () => {
    const { initializeZoomSdk, applyOverlay, isOverlayActive, handleAppVisibilityChange } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await applyOverlay('https://zoom.example/backgrounds/blue.png');
    expect(isOverlayActive()).toBe(true);
    sdkMock.setVideoFilter.mockClear();

    // Away and back: time enough to have changed anything in Zoom's own settings.
    handleAppVisibilityChange({ visible: false });
    handleAppVisibilityChange({ visible: true });

    await applyOverlay('https://zoom.example/backgrounds/blue.png');
    expect(sdkMock.setVideoFilter).toHaveBeenCalled();
  });

  it('knows a background of ours is up even after the webview was re-created', async () => {
    // Camera mode, branded background applied, then the organizer closes and
    // reopens the app panel. Zoom re-creates the webview, so the in-memory record
    // is gone while the background is still on their face. Callers ask
    // isOverlayActive() before paying for a removal dialog, so a false here is
    // what left the branded image up whether or not the timer was running.
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, setOverlayMode, isOverlayActive, removeOverlay, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);

    expect(isOverlayActive()).toBe(true);

    await removeOverlay();
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
    expect(isOverlayActive()).toBe(false);
  });

  it('stops believing in a background the user has already cleared themselves', async () => {
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, setOverlayMode, isOverlayActive, removeOverlay, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);
    // 10195: there was nothing to remove, because they cleared it in Zoom.
    sdkMock.removeVirtualBackground.mockRejectedValueOnce(
      Object.assign(new Error('none'), { code: 10195 })
    );

    await removeOverlay();

    // isOverlayActive is the gate callers check before paying for a removal.
    // Left true, every idle moment from here on would ask Zoom to remove a
    // background that is not there, prompting the organizer each time.
    expect(isOverlayActive()).toBe(false);
  });

  it('still collapses the duplicate push two call sites make for one change', async () => {
    const { initializeZoomSdk, applyOverlay } = await loadModule();
    await initializeZoomSdk();
    stubImage();

    // TimerContext and LiveTab both react to the same status change. The queue
    // drops the superseded request, so this must stay one push.
    await Promise.all([
      applyOverlay('https://zoom.example/backgrounds/red.png'),
      applyOverlay('https://zoom.example/backgrounds/red.png'),
    ]);

    expect(sdkMock.setVideoFilter).toHaveBeenCalledTimes(1);
  });
});

describe('clearing the video on request', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
  });

  it('removes only the pipeline that is actually holding our card', async () => {
    const { initializeZoomSdk, applyOverlay, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    // Card mode: a filter of ours, and no background at any point.
    await applyOverlay('https://zoom.example/backgrounds/blue.png');

    const result = await clearVideoPipelines();

    expect(sdkMock.deleteVideoFilter).toHaveBeenCalled();
    // Asking to remove a background that was never applied costs the user a
    // confirmation dialog and then fails.
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
  });

  it('touches neither pipeline when the video is already the user\'s own', async () => {
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();

    const result = await clearVideoPipelines();

    // Pressing the eraser on an untouched video must be a no-op, not a pair of
    // removals aimed at empty pipelines — deleteVideoFilter would take the
    // organizer's own filter down with it.
    expect(sdkMock.deleteVideoFilter).not.toHaveBeenCalled();
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
  });

  it('does not ask about a virtual background in camera mode when none is ours', async () => {
    const { initializeZoomSdk, setOverlayMode, clearVideoPipelines, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    await setOverlayMode(OVERLAY_MODE_CAMERA, null);
    sdkMock.removeVirtualBackground.mockClear();

    const result = await clearVideoPipelines();

    // Being in camera mode is not evidence that a background is applied. Zoom
    // offers no way to ask, so the record is all there is — and asking anyway
    // puts a "remove your virtual background?" dialog in front of someone who
    // does not have one.
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
  });

  it('reports success when a pipeline we never touched refuses to clear', async () => {
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();
    // Whatever the client calls it, "nothing was there" is the expected answer,
    // not a failure the organizer should see a red toast about.
    sdkMock.deleteVideoFilter.mockRejectedValueOnce(
      Object.assign(new Error('no filter'), { code: 99999 })
    );

    expect(await clearVideoPipelines()).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
  });

  it('reports failure when something we did apply will not come off', async () => {
    const { initializeZoomSdk, applyOverlay, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await applyOverlay('https://zoom.example/backgrounds/green.png');
    sdkMock.deleteVideoFilter.mockRejectedValueOnce(
      Object.assign(new Error('busy'), { code: 99999 })
    );

    expect(await clearVideoPipelines()).toEqual({ ok: false, declined: false, ungranted: [], lostBackground: false });
  });

  it('removes a background applied in camera mode, and only asks once', async () => {
    const { initializeZoomSdk, setOverlayMode, clearVideoPipelines, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    sdkMock.removeVirtualBackground.mockClear();

    expect(await clearVideoPipelines()).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalledTimes(1);

    // Already gone: clearing again must not re-prompt.
    sdkMock.removeVirtualBackground.mockClear();
    await clearVideoPipelines();
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });

  it('reports a declined confirmation as declined, not as a failure', async () => {
    const { initializeZoomSdk, setOverlayMode, clearVideoPipelines, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    // 10017: the user dismissed Zoom's "remove background?" dialog.
    sdkMock.removeVirtualBackground.mockRejectedValueOnce(
      Object.assign(new Error('declined'), { code: 10017 })
    );

    expect(await clearVideoPipelines()).toEqual({ ok: true, declined: true, ungranted: [], lostBackground: false });

    // Still up, so a second press must try again rather than assume it is gone.
    sdkMock.removeVirtualBackground.mockClear();
    await clearVideoPipelines();
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
  });

  it('still finds a background left behind by an earlier session', async () => {
    // Zoom reloads the webview whenever the panel is reopened, which is exactly
    // when an organizer reaches for this button. An in-memory flag would be false
    // here and the stuck background would survive the clear.
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();

    expect(await clearVideoPipelines()).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
    expect(localStorage.getItem('toastmaster_zoom_virtual_background_applied')).toBeNull();
  });

  it('still finds a filter left behind by an earlier session', async () => {
    // Same reload, the other pipeline. Reading activeOverlay for this made a
    // failed delete look like "there was nothing there", so the button reported
    // success over a card that was still on the tile.
    localStorage.setItem('toastmaster_zoom_video_filter_applied', 'true');
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();
    sdkMock.deleteVideoFilter.mockRejectedValueOnce(
      Object.assign(new Error('busy'), { code: 99999 })
    );

    expect(await clearVideoPipelines()).toEqual({ ok: false, declined: false, ungranted: [], lostBackground: false });
    // Still up, so the record must survive for the next attempt.
    expect(localStorage.getItem('toastmaster_zoom_video_filter_applied')).toBe('true');
  });

  it('names a pipeline the client refuses to let the app touch', async () => {
    // config() resolves even when a capability is refused; the refusal arrives
    // in unsupportedApis. Calling the API anyway rejects at the bridge, which
    // read as an ordinary failure and sent the organizer to check settings that
    // were never the problem.
    sdkMock.config.mockResolvedValue({ unsupportedApis: ['removeVirtualBackground'] });
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();

    expect(await clearVideoPipelines()).toEqual({
      ok: true,
      declined: false,
      ungranted: ['virtual background'],
      lostBackground: false,
    });
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    // Nothing was removed, so the record must not claim otherwise.
    expect(localStorage.getItem('toastmaster_zoom_virtual_background_applied')).toBe('true');
  });

  it('says nothing about a refused pipeline that was holding nothing', async () => {
    sdkMock.config.mockResolvedValue({ unsupportedApis: ['deleteVideoFilter', 'setVideoFilter'] });
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();

    // No filter of ours is up, so a missing removal API costs the organizer
    // nothing and is not worth a red toast.
    expect(await clearVideoPipelines()).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
  });

  it('falls back to setVideoFilter(null) when only the deleter is refused', async () => {
    sdkMock.config.mockResolvedValue({ unsupportedApis: ['deleteVideoFilter'] });
    localStorage.setItem('toastmaster_zoom_video_filter_applied', 'true');
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();

    expect(await clearVideoPipelines()).toEqual({ ok: true, declined: false, ungranted: [], lostBackground: false });
    expect(sdkMock.deleteVideoFilter).not.toHaveBeenCalled();
    expect(sdkMock.setVideoFilter).toHaveBeenCalledWith({ fileUrl: null });
  });
});

describe('capability reporting', () => {
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
  });

  it('reports a refused API as missing, not as present', async () => {
    // The npm SDK defines every documented method on its prototype whether or
    // not the client granted it, so a typeof check reported a limited client as
    // all-green. unsupportedApis is the only truthful signal.
    sdkMock.config.mockResolvedValue({ unsupportedApis: ['setVirtualBackground'] });
    const { initializeZoomSdk, getMissingSdkApis, isApiAvailable } = await loadModule();
    await initializeZoomSdk();

    expect(isApiAvailable('setVirtualBackground')).toBe(false);
    expect(isApiAvailable('setVideoFilter')).toBe(true);
    expect(getMissingSdkApis().map((api) => api.name)).toContain('setVirtualBackground');
  });
});

describe('putting the user back on their own background', () => {
  // getCurrentVirtualBackground is grantable in the Marketplace but absent from
  // the shipped SDK, so it is added to the mock here rather than to the shared
  // one — the module reaches it through isApiAvailable either way, and the
  // shared mock stays an honest picture of what a real client offers today.
  function withBackgroundReader(current) {
    sdkMock.getCurrentVirtualBackground = vi.fn().mockResolvedValue(current);
    return sdkMock.getCurrentVirtualBackground;
  }

  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
  });

  afterEach(() => {
    delete sdkMock.getCurrentVirtualBackground;
    delete sdkMock.getVirtualBackgrounds;
  });

  it('restores the blur the user arrived with instead of stripping them bare', async () => {
    const { initializeZoomSdk, setOverlayMode, clearVideoPipelines, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    const read = withBackgroundReader({ id: 'Blur' });

    // Snapshot happens on the first push, while their blur is still up.
    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    expect(read).toHaveBeenCalled();

    // Ours is up now, so the read reports something that is not their blur.
    read.mockResolvedValue({ id: 'timer-green' });
    const result = await clearVideoPipelines();

    expect(sdkMock.setVirtualBackground).toHaveBeenLastCalledWith({ blur: true });
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.lostBackground).toBe(false);
  });

  it('says so when the user had an image Zoom cannot put back', async () => {
    const { initializeZoomSdk, setOverlayMode, clearVideoPipelines, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    const read = withBackgroundReader({ id: 'vb-77', name: 'beach.png' });

    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    read.mockResolvedValue({ id: 'timer-green' });
    const result = await clearVideoPipelines();

    // setVirtualBackground takes imageData, a fileUrl or blur — never an id —
    // so removal is the closest available and the caller has to be told.
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, lostBackground: true });
  });

  it('leaves a background that is no longer ours completely alone', async () => {
    const { initializeZoomSdk, setOverlayMode, clearVideoPipelines, OVERLAY_MODE_CAMERA } =
      await loadModule();
    await initializeZoomSdk();
    stubImage();
    const read = withBackgroundReader({ id: 'vb-77', name: 'beach.png' });

    await setOverlayMode(OVERLAY_MODE_CAMERA, 'https://zoom.example/backgrounds/green.png');
    sdkMock.removeVirtualBackground.mockClear();
    sdkMock.setVirtualBackground.mockClear();
    // The user went to Background & Effects and put their own back. Nothing
    // reports that, so the record still says one of ours is up.
    read.mockResolvedValue({ id: 'vb-77', name: 'beach.png' });

    const result = await clearVideoPipelines();

    // Removing here would raise a confirmation dialog over a video that is
    // already exactly how they want it.
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    expect(sdkMock.setVirtualBackground).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, declined: false });
  });

  it('leaves a bare camera alone rather than removing nothing', async () => {
    // Set before the module loads: it reads the record at import time, so a
    // later write would leave the flag false and the test would pass for the
    // wrong reason.
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();
    withBackgroundReader({ id: 'None' });

    const result = await clearVideoPipelines();

    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true });
    expect(localStorage.getItem('toastmaster_zoom_virtual_background_applied')).toBeNull();
  });

  it('falls back to the old removal when the client cannot report the background', async () => {
    // No reader granted: exactly today's clients. The record stays in charge.
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, clearVideoPipelines } = await loadModule();
    await initializeZoomSdk();

    expect(await clearVideoPipelines()).toMatchObject({ ok: true });
    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
  });

  it('gives up rather than guessing at a response it does not recognise', async () => {
    // The response shape cannot be pinned down while the API is absent from the
    // SDK, so anything unfamiliar has to mean "the client did not say" — never
    // an answer that decides whether the user gets a dialog.
    const { normalizeVirtualBackground } = await loadModule();

    expect(normalizeVirtualBackground({ id: 'None' })).toEqual({ type: 'none' });
    expect(normalizeVirtualBackground({ type: 'blur' })).toEqual({ type: 'blur' });
    expect(normalizeVirtualBackground({ currentVirtualBackground: { id: 'Blur' } })).toEqual({ type: 'blur' });
    expect(normalizeVirtualBackground({ id: 'vb-1', name: 'beach.png' })).toEqual({
      type: 'image', id: 'vb-1', name: 'beach.png',
    });
    expect(normalizeVirtualBackground(undefined)).toBeNull();
    expect(normalizeVirtualBackground({})).toBeNull();
    expect(normalizeVirtualBackground({ somethingElse: 42 })).toBeNull();
  });
});

describe('handing the video back while the timer is idle', () => {
  // "Show your own background" is a promise about the organizer's face. Which of
  // the two pipelines happens to be holding the card is an implementation detail
  // they neither see nor care about, so the idle path has to take off whichever
  // one is up rather than whichever one the current mode would use.
  beforeEach(() => {
    stubCanvas();
    sdkMock.config.mockResolvedValue({});
    sdkMock.deleteVideoFilter.mockResolvedValue({});
    sdkMock.setVideoFilter.mockResolvedValue({});
    sdkMock.removeVirtualBackground.mockResolvedValue({});
    sdkMock.setVirtualBackground.mockResolvedValue({});
  });

  it('takes off a filter left over from card mode', async () => {
    const { initializeZoomSdk, applyOverlay, removeOverlay, isOverlayActive } = await loadModule();
    await initializeZoomSdk();
    stubImage();
    await applyOverlay('https://zoom.example/backgrounds/green.png');
    expect(isOverlayActive()).toBe(true);

    await removeOverlay();

    expect(sdkMock.deleteVideoFilter).toHaveBeenCalled();
    expect(isOverlayActive()).toBe(false);
  });

  it('takes off a background even when the mode has since moved to card', async () => {
    // Camera mode earlier in the meeting, then a reload that lands in card mode
    // with the branded background still on their face. Dispatching on the
    // current mode alone left it there for the rest of the meeting.
    localStorage.setItem('toastmaster_zoom_virtual_background_applied', 'true');
    const { initializeZoomSdk, removeOverlay, isOverlayActive, getOverlayMode, OVERLAY_MODE_CARD } =
      await loadModule();
    await initializeZoomSdk();
    expect(getOverlayMode()).toBe(OVERLAY_MODE_CARD);

    await removeOverlay();

    expect(sdkMock.removeVirtualBackground).toHaveBeenCalled();
    expect(isOverlayActive()).toBe(false);
  });

  it('does nothing at all when nothing of ours is up', async () => {
    // resetTimer runs on every speaker and role change, so this is the common
    // case, not the edge one.
    const { initializeZoomSdk, removeOverlay } = await loadModule();
    await initializeZoomSdk();

    await removeOverlay();

    expect(sdkMock.deleteVideoFilter).not.toHaveBeenCalled();
    expect(sdkMock.removeVirtualBackground).not.toHaveBeenCalled();
  });
});

describe('asking the SDK for something before init has finished', () => {
  it('waits for the in-flight init instead of reporting the SDK unavailable', async () => {
    // main.jsx renders the app and *then* starts init, on purpose, so every
    // mount effect runs inside that gap. SpeakerInput fetches participants from
    // one, once — so landing in the gap left the suggestions empty for the whole
    // meeting, whatever the caller's role or capabilities.
    let resolveConfig;
    sdkMock.config.mockReturnValue(new Promise((resolve) => { resolveConfig = resolve; }));
    sdkMock.getUserContext = vi.fn().mockResolvedValue({
      screenName: 'Priya', role: 'host', participantUUID: 'me',
    });
    sdkMock.getMeetingParticipants = vi.fn().mockResolvedValue({
      participants: [{ screenName: 'Sam', participantUUID: 'p2' }],
    });

    const { initializeZoomSdk, getZoomParticipants } = await loadModule();

    // Init started but not settled — exactly where the mount effect lands.
    const initializing = initializeZoomSdk();
    const fetching = getZoomParticipants();

    resolveConfig({});
    await initializing;

    expect((await fetching).participants).toEqual([
      { id: 'me', name: 'Priya' },
      { id: 'p2', name: 'Sam' },
    ]);

    delete sdkMock.getUserContext;
    delete sdkMock.getMeetingParticipants;
  });

  it('runs config once however many callers arrive at the same time', async () => {
    sdkMock.config.mockResolvedValue({});
    const { initializeZoomSdk } = await loadModule();

    await Promise.all([initializeZoomSdk(), initializeZoomSdk(), initializeZoomSdk()]);

    expect(sdkMock.config).toHaveBeenCalledTimes(1);
  });
});
