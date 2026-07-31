import zoomSdk from '@zoom/appssdk';

// Production base URL for background images
const PRODUCTION_BASE_URL = 'https://www.timer.simple-tech.app';

// Bump this version when background images are updated to bust CDN/browser cache.
// The files are served with `max-age=31536000, immutable`, so without a bump
// existing clients keep the old asset for a year.
// 3: re-exported at 1280x720 (was 2560x1440, which produced a 14.7MB ImageData
//    against the Zoom SDK's documented 15MB limit).
const BACKGROUND_VERSION = '3';

// Zoom overlay image filenames (Toastmasters-branded backgrounds)
const ZOOM_OVERLAY_FILES = {
  blue: 'timer-blue-background.png',
  green: 'timer-green-background.png',
  yellow: 'timer-yellow-background.png',
  red: 'timer-red-background.png',
};

/**
 * Path the app is served under, with leading and trailing slashes. This app is
 * built with Vite base '/zoom/', so its static files live under that prefix, not
 * at the origin root — origin + '/backgrounds/...' hits the SPA catch-all rewrite
 * and returns index.html, which then fails to decode as an image.
 * Exported for testing.
 */
export function getBasePath() {
  const base = import.meta.env?.BASE_URL || '/';
  const withLeading = base.startsWith('/') ? base : `/${base}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

// Get the URL for a background image (works in both dev and production)
export function getBackgroundUrl(color) {
  const imageFile = ZOOM_OVERLAY_FILES[color] || ZOOM_OVERLAY_FILES.blue;
  const path = `${getBasePath()}backgrounds/${imageFile}?v=${BACKGROUND_VERSION}`;

  // In browser, use the current origin (works automatically in production)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  // Fallback to production URL if window is not available
  return `${PRODUCTION_BASE_URL}${path}`;
}

// Every overlay pixel costs 4 bytes of ImageData across the webview -> native
// bridge, and that transfer is what makes the color change take seconds on slower
// clients. setVideoFilter documents a 15MB ceiling, which the old 2560x1440 asset
// nearly hit at 14.7MB. Sizes for reference:
//   2560x1440 = 14.7MB   1280x720 = 3.7MB   960x540 = 2.1MB   640x360 = 0.9MB
//
// The overlay is a flat color plus a logo, so it needs far fewer pixels than a
// camera feed: the color carries the timing signal and stays exact at any size.
// 640x360 was picked by rendering the shipped asset through a downscale-then-
// upscale round trip; it is where the "TOASTMASTERS" wordmark stops being crisp,
// and below it the logo breaks down. Raising this costs bytes on every push.
const OVERLAY_CEILING_WIDTH = 640;
const OVERLAY_CEILING_HEIGHT = 360;

const REQUIRED_CAPABILITIES = ['shareApp', 'videoFilter', 'virtualBackground'];

// Capabilities the app works fine without: if a client rejects any of them,
// config() is retried with the required set only, because losing config()
// altogether would disable every overlay rather than just one nicety.
//   onMyMediaChange - reports the camera resolution the SDK recommends matching
//   openUrl         - opens the Marketplace listing in the user's browser
//   appPopout       - desktop only, so mobile clients reject it; popout mode is
//                     unavailable there but every other mode still works
const OPTIONAL_CAPABILITIES = ['onMyMediaChange', 'openUrl', 'appPopout', 'onAppPopout'];

// Overlay mode constants.
//
// Two families, and the difference matters at every call site below:
//   card / camera   - push an image into the video pipeline (videoFilter or
//                     virtualBackground). The color rides on the user's tile.
//   share / popout  - put the app's own UI on screen instead, so they push no
//                     pixels at all: the color is DOM rendered by the app, and
//                     the user's camera and background are left untouched.
export const OVERLAY_MODE_CARD = 'card';
export const OVERLAY_MODE_CAMERA = 'camera';
export const OVERLAY_MODE_SHARE = 'share';
export const OVERLAY_MODE_POPOUT = 'popout';
let currentOverlayMode = OVERLAY_MODE_CARD;

/**
 * Whether a mode drives the video pipeline. The stage modes (share, popout)
 * show the color through the app's own UI, so pushing a background as well
 * would put the color in two places at once.
 * @param {string} [mode] - Defaults to the current mode
 * @returns {boolean}
 */
export function isVideoOverlayMode(mode = currentOverlayMode) {
  return mode === OVERLAY_MODE_CARD || mode === OVERLAY_MODE_CAMERA;
}

// Track SDK initialization state
let sdkInitialized = false;
let sdkAvailable = false;

// Track last error for debugging
let lastError = null;

// Log callback function - will be set by LiveTab component
let logCallback = null;

// Cache of in-flight and resolved ImageData loads, keyed by image URL. Storing
// the promise (not just the result) means a preload and a concurrent apply share
// one download + decode instead of each doing the whole job.
const imageDataCache = new Map();

// The overlay currently pushed to Zoom, or null if none:
//   { url, mode, budget }
// budget is the overlay size the pixels were rendered for, or null for a fileUrl
// push, which carries no pixels and so never goes stale on a resolution change.
let activeOverlay = null;

// Camera resolution reported by onMyMediaChange, or null until one arrives.
let cameraResolution = null;

// Stage-mode state. Neither is a video overlay, so neither is tracked by
// activeOverlay: appShareActive means the app is screen-shared into the meeting,
// appPoppedOut means it is undocked into its own window.
let appShareActive = false;
let appPoppedOut = false;

// Notified when the popout state changes, including when the user drives it from
// Zoom's own ellipsis menu rather than from our toggle.
let popoutChangeCallback = null;

// Monotonic id used to drop overlay requests that a newer one has superseded.
let overlayRequestId = 0;

// Serializes SDK overlay calls; see enqueueOverlayOp.
let overlayQueue = Promise.resolve();

/**
 * Set log callback for debug panel
 * @param {Function} callback - Function to call with log messages
 */
export function setLogCallback(callback) {
  logCallback = callback;
}

/**
 * Internal logging function
 */
function log(message, type = 'info') {
  if (logCallback) {
    logCallback(message, type);
  }
  // Also log to console
  if (type === 'error') {
    console.error(message);
  } else if (type === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

/**
 * Initialize Zoom SDK
 */
export async function initializeZoomSdk() {
  if (sdkInitialized) {
    console.log(`Zoom SDK already initialized. Available: ${sdkAvailable}`);
    return sdkAvailable;
  }

  sdkInitialized = true;

  try {
    // Check if we're in a Zoom environment
    // The SDK will be available when running in Zoom client
    log('Initializing Zoom SDK...', 'info');
    const baseOptions = { popoutSize: { width: 400, height: 600 }, version: '1.0.0' };
    let configResult;
    try {
      configResult = await zoomSdk.config({
        ...baseOptions,
        capabilities: [...REQUIRED_CAPABILITIES, ...OPTIONAL_CAPABILITIES],
      });
    } catch (optionalCapabilityError) {
      log(
        `Config failed with optional capabilities (${optionalCapabilityError.message || optionalCapabilityError.name}). Retrying with required only.`,
        'warn'
      );
      configResult = await zoomSdk.config({
        ...baseOptions,
        capabilities: [...REQUIRED_CAPABILITIES],
      });
    }

    sdkAvailable = true;
    log(`Zoom SDK initialized successfully. Config: ${JSON.stringify(configResult)}`, 'info');
    log('Video filter capability is available', 'info');
    subscribeToCameraResolution();
    subscribeToAppPopout();
    return true;
  } catch (error) {
    // SDK not available (running locally or not in Zoom environment)
    sdkAvailable = false;
    log('[MOCK] Zoom SDK: Running in mock mode (not in Zoom environment)', 'warn');
    log(`SDK initialization error: ${error.message || error.name} (Code: ${error.code || 'N/A'})`, 'warn');
    log('Note: Virtual backgrounds will only work when running inside Zoom client', 'warn');
    return false;
  }
}

/**
 * Open a link outside the app. The Zoom client webview ignores a plain
 * target="_blank" anchor, so links have to go through the SDK; window.open is
 * the fallback for local development and for clients that refused the openUrl
 * capability.
 *
 * @param {string} url - Absolute URL to open
 * @returns {Promise<boolean>} True if the URL was handed off successfully
 */
export async function openExternalUrl(url) {
  if (sdkAvailable && typeof zoomSdk.openUrl === 'function') {
    try {
      await zoomSdk.openUrl({ url });
      return true;
    } catch (error) {
      log(`openUrl failed, falling back to window.open: ${error.message || error.name}`, 'warn');
    }
  }

  try {
    // The Zoom webview usually refuses window.open and returns null, so the
    // return value is the only way to know the link actually went somewhere.
    if (window.open(url, '_blank', 'noopener,noreferrer')) return true;
    log(`window.open was blocked for ${url}`, 'warn');
    return false;
  } catch (error) {
    log(`Failed to open ${url}: ${error.message || error.name}`, 'error');
    return false;
  }
}

/**
 * Camera resolution reported by the client, or null if never reported.
 * @returns {{width: number, height: number}|null}
 */
export function getCameraResolution() {
  return cameraResolution ? { ...cameraResolution } : null;
}

/**
 * Track the camera resolution from an onMyMediaChange event and resize the
 * visible overlay to match. Exported for testing.
 * @param {Object} event - OnMyMediaChangeEvent
 */
export function handleMyMediaChange(event) {
  const video = event?.media?.video;
  // A payload may carry only { state } when the camera is toggled, and audio
  // events carry no video key at all.
  const width = Number(video?.width);
  const height = Number(video?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }
  if (cameraResolution && cameraResolution.width === width && cameraResolution.height === height) {
    return;
  }

  cameraResolution = { width, height };
  log(`Camera resolution reported: ${width}x${height}`, 'info');

  // Anything decoded for the previous resolution is the wrong size now.
  imageDataCache.clear();

  // Re-push so what participants see matches the new resolution, but only if an
  // overlay is actually showing. The redundant-push guard compares the budget the
  // pixels were rendered for, so this is not treated as a duplicate.
  if (activeOverlay) {
    applyOverlay(activeOverlay.url);
  }
}

/**
 * Subscribe to camera resolution updates. Failure is non-fatal: the overlay just
 * stays at the default size.
 */
function subscribeToCameraResolution() {
  if (!zoomSdk || typeof zoomSdk.onMyMediaChange !== 'function') {
    log('onMyMediaChange unavailable; overlay stays at the default size', 'warn');
    return;
  }
  try {
    zoomSdk.onMyMediaChange(handleMyMediaChange);
    log('Subscribed to onMyMediaChange for camera resolution', 'info');
  } catch (error) {
    log(`Failed to subscribe to onMyMediaChange: ${error.message || error.name}`, 'warn');
  }
}

/**
 * Whether the app is currently screen-shared into the meeting.
 * @returns {boolean}
 */
export function isAppShareActive() {
  return appShareActive;
}

/**
 * Whether the app is currently undocked into its own window.
 * @returns {boolean}
 */
export function isAppPoppedOut() {
  return appPoppedOut;
}

/**
 * Start or stop sharing the app itself into the meeting.
 *
 * This is a screen share of the app's own webview, not a video effect: the
 * camera pipeline is untouched, so the user keeps their face and whatever
 * background they already chose. What participants see is whatever the app
 * panel is showing, which is why the stage view has to carry its own controls.
 *
 * @param {boolean} active - True to start sharing, false to stop
 * @param {{withSound?: boolean}} [options]
 * @returns {Promise<boolean>} True if the client accepted the request
 */
export async function setAppShare(active, { withSound = false } = {}) {
  if (!sdkInitialized) {
    await initializeZoomSdk();
  }

  if (!sdkAvailable || !zoomSdk || typeof zoomSdk.shareApp !== 'function') {
    log(`[MOCK] Would ${active ? 'start' : 'stop'} sharing the app`, 'warn');
    appShareActive = active;
    return false;
  }

  try {
    await zoomSdk.shareApp(active ? { action: 'start', withSound } : { action: 'stop' });
    appShareActive = active;
    log(`App share ${active ? 'started' : 'stopped'}`, 'info');
    return true;
  } catch (error) {
    log(`Failed to ${active ? 'start' : 'stop'} app share: ${error.message || error.name}`, 'error');
    if (error.code) log(`Error code: ${error.code}`, 'error');
    // Only a start can leave the meeting sharing; a failed stop means the share
    // is either already gone or still up, and the next state change re-reconciles.
    if (active) appShareActive = false;
    return false;
  }
}

/**
 * Pop the app out into its own window, or merge it back into the main client.
 * Equivalent to "Popout" / "Merge Back to Main Window" in the app's ellipsis
 * menu. Desktop only: other clients report 10247, or reject the capability
 * outright at config() time.
 *
 * @param {boolean} popped - True to undock, false to dock back
 * @returns {Promise<boolean>} True if the client accepted the request
 */
export async function setAppPopout(popped) {
  if (!sdkInitialized) {
    await initializeZoomSdk();
  }

  if (!sdkAvailable || !zoomSdk || typeof zoomSdk.appPopout !== 'function') {
    log(`[MOCK] Would ${popped ? 'undock' : 'dock'} the app window`, 'warn');
    appPoppedOut = popped;
    return false;
  }

  try {
    await zoomSdk.appPopout({ action: popped ? 'undock' : 'dock' });
    // onAppPopout also reports this, but the event does not arrive on every
    // client, so the requested state is recorded here too.
    appPoppedOut = popped;
    log(`App window ${popped ? 'undocked' : 'docked'}`, 'info');
    return true;
  } catch (error) {
    log(`Failed to ${popped ? 'undock' : 'dock'} the app: ${error.message || error.name}`, 'error');
    if (error.code) {
      log(`Error code: ${error.code}`, 'error');
      if (error.code === 10247) {
        log('This client or running context does not support popping the app out', 'warn');
      }
    }
    return false;
  }
}

/**
 * Register a callback for popout state changes, so the UI stays in sync when the
 * user pops the app out from Zoom's own menu instead of from our toggle.
 * @param {Function|null} callback - Receives the new popped-out boolean
 */
export function setPopoutChangeCallback(callback) {
  popoutChangeCallback = callback;
}

/**
 * Track the docked/undocked state from an onAppPopout event. Exported for testing.
 * @param {Object} event - OnAppPopoutEvent
 */
export function handleAppPopout(event) {
  const action = event?.action;
  if (action !== 'dock' && action !== 'undock') return;

  const popped = action === 'undock';
  if (popped === appPoppedOut) return;

  appPoppedOut = popped;
  log(`App window ${popped ? 'undocked' : 'docked'} by the client`, 'info');
  if (popoutChangeCallback) popoutChangeCallback(popped);
}

/**
 * Subscribe to popout updates. Failure is non-fatal: the toggle still drives the
 * window, it just will not follow changes made from Zoom's own menu.
 */
function subscribeToAppPopout() {
  if (!zoomSdk || typeof zoomSdk.onAppPopout !== 'function') {
    log('onAppPopout unavailable; popout state will not track the client menu', 'warn');
    return;
  }
  try {
    zoomSdk.onAppPopout(handleAppPopout);
    log('Subscribed to onAppPopout', 'info');
  } catch (error) {
    log(`Failed to subscribe to onAppPopout: ${error.message || error.name}`, 'warn');
  }
}

/**
 * Check if SDK is available (for debugging)
 */
export function isSdkAvailable() {
  return sdkAvailable;
}

/**
 * Get SDK status for debugging
 */
export function getSdkStatus() {
  const status = {
    initialized: sdkInitialized,
    available: sdkAvailable,
    sdkExists: typeof zoomSdk !== 'undefined',
    hasSetVideoFilter: zoomSdk && typeof zoomSdk.setVideoFilter === 'function',
    hasDeleteVideoFilter: zoomSdk && typeof zoomSdk.deleteVideoFilter === 'function',
    hasGetUserContext: zoomSdk && typeof zoomSdk.getUserContext === 'function',
    hasGetVideoState: zoomSdk && typeof zoomSdk.getVideoState === 'function',
    hasSetVideoState: zoomSdk && typeof zoomSdk.setVideoState === 'function',
    hasSetVirtualBackground: zoomSdk && typeof zoomSdk.setVirtualBackground === 'function',
    hasRemoveVirtualBackground: zoomSdk && typeof zoomSdk.removeVirtualBackground === 'function',
    hasShareApp: zoomSdk && typeof zoomSdk.shareApp === 'function',
    hasAppPopout: zoomSdk && typeof zoomSdk.appPopout === 'function',
    overlayMode: currentOverlayMode,
    appShareActive,
    appPoppedOut,
    // Overlay sizing, so a slow-color-change report can be diagnosed from the
    // debug panel without a code change.
    cameraResolution: cameraResolution ? `${cameraResolution.width}x${cameraResolution.height}` : 'unreported',
    overlayBudget: (() => {
      const b = getOverlayBudget();
      return `${b.width}x${b.height}`;
    })(),
  };
  
  // Get available methods for debugging
  if (zoomSdk && typeof zoomSdk === 'object') {
    status.availableMethods = Object.keys(zoomSdk).filter(key => typeof zoomSdk[key] === 'function');
  }
  
  return status;
}

/**
 * Size to aim the overlay at, before the source image is considered.
 * Exported for testing.
 * @returns {{width: number, height: number}}
 */
export function getOverlayBudget() {
  // The SDK suggests matching the camera resolution, but that advice assumes
  // camera-like content. For a flat color plus a logo the camera resolution is
  // only useful as an *upper* bound — never send more pixels than the stream can
  // display, and never more than the content needs. Treating it as a target
  // instead would make a 720p camera cost more than sending nothing at all.
  if (cameraResolution) {
    return {
      width: Math.min(cameraResolution.width, OVERLAY_CEILING_WIDTH),
      height: Math.min(cameraResolution.height, OVERLAY_CEILING_HEIGHT),
    };
  }
  return { width: OVERLAY_CEILING_WIDTH, height: OVERLAY_CEILING_HEIGHT };
}

/**
 * Fit a source image inside the overlay budget, preserving aspect ratio.
 * Never upscales, and never exceeds the ceiling. Exported for testing.
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {{width: number, height: number}} [budget] - Defaults to getOverlayBudget()
 * @returns {{width: number, height: number}}
 */
export function getOverlayDimensions(naturalWidth, naturalHeight, budget = getOverlayBudget()) {
  const maxWidth = Math.min(budget.width, OVERLAY_CEILING_WIDTH);
  const maxHeight = Math.min(budget.height, OVERLAY_CEILING_HEIGHT);
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

/**
 * Convert a drawable source (HTMLImageElement, HTMLCanvasElement, etc.) to ImageData
 * by drawing it onto an offscreen canvas at the requested size. Exported for testing.
 */
export function imageToImageData(drawable, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // Pass the destination size so an oversized source is scaled down rather than
  // cropped. Note that omitting it would draw at natural size.
  ctx.drawImage(drawable, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Load image from URL and convert to ImageData, sharing one download + decode
 * across concurrent callers. Exported for testing.
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<ImageData>} ImageData object
 */
export function loadImageAsImageData(imageUrl) {
  const budget = getOverlayBudget();
  // Keyed by budget as well as URL: the same image decoded for a 640x360 camera
  // is not reusable once the camera reports 1280x720.
  const key = `${imageUrl}@${budget.width}x${budget.height}`;

  const cached = imageDataCache.get(key);
  if (cached) {
    log(`Using cached ImageData for: ${imageUrl}`, 'info');
    return cached;
  }

  const pending = decodeImage(imageUrl, budget);
  imageDataCache.set(key, pending);
  // Drop failed loads from the cache so a later attempt can retry.
  pending.catch(() => imageDataCache.delete(key));
  return pending;
}

/**
 * Read width/height from a PNG's IHDR chunk without decoding the pixels.
 * Returns null if the bytes are not a PNG. Exported for testing.
 * @param {ArrayBuffer} buffer
 * @returns {{width: number, height: number}|null}
 */
export function readPngSize(buffer) {
  const bytes = new Uint8Array(buffer);
  const signature = [0x89, 0x50, 0x4e, 0x47];
  if (bytes.length < 24 || !signature.every((byte, i) => bytes[i] === byte)) {
    return null;
  }
  const view = new DataView(buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Whether this environment can decode straight to a target size. */
function canDecodeAtTargetSize() {
  return typeof createImageBitmap === 'function' && typeof fetch === 'function';
}

/**
 * Download an image and decode it to ImageData.
 * @param {string} imageUrl - URL of the image
 * @param {{width: number, height: number}} budget - Target size to fit within
 * @returns {Promise<ImageData>} ImageData object
 */
function decodeImage(imageUrl, budget) {
  log(`Loading image: ${imageUrl}`, 'info');

  if (canDecodeAtTargetSize()) {
    return decodeAtTargetSize(imageUrl, budget).catch((error) => {
      log(`Target-size decode failed (${error.message || error.name}); falling back to Image()`, 'warn');
      return decodeViaImageElement(imageUrl, budget);
    });
  }
  return decodeViaImageElement(imageUrl, budget);
}

/**
 * Decode directly to the target size, so the browser never materializes the
 * full-resolution bitmap. The source dimensions come from the PNG header rather
 * than a decode, which keeps the scale aspect-correct even when the camera
 * reports a different aspect ratio than the asset.
 * @param {string} imageUrl - URL of the image
 * @param {{width: number, height: number}} budget - Target size to fit within
 * @returns {Promise<ImageData>} ImageData object
 */
async function decodeAtTargetSize(imageUrl, budget) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${imageUrl}`);
  }
  const buffer = await response.arrayBuffer();

  const natural = readPngSize(buffer);
  if (!natural) {
    // Without the header we cannot compute a target size without decoding first,
    // which is the very thing this path exists to avoid.
    throw new Error('response is not a PNG');
  }

  const { width, height } = getOverlayDimensions(natural.width, natural.height, budget);
  const bitmap = await createImageBitmap(new Blob([buffer]), {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  });

  try {
    const imageData = imageToImageData(bitmap, width, height);
    log(
      `Decoded ${natural.width}x${natural.height} straight to ${width}x${height}, ImageData size: ${imageData.data.length} bytes (cached)`,
      'info'
    );
    return imageData;
  } finally {
    // Release the native bitmap rather than waiting for GC.
    bitmap.close?.();
  }
}

/**
 * Decode via an Image element, then downscale on the canvas. Kept as the fallback
 * because a direct Image() load has historically behaved better than fetch inside
 * the Zoom client.
 * @param {string} imageUrl - URL of the image
 * @param {{width: number, height: number}} budget - Target size to fit within
 * @returns {Promise<ImageData>} ImageData object
 */
function decodeViaImageElement(imageUrl, budget) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Image load timeout after 10 seconds: ${imageUrl}`));
      }
    }, 10000);
    
    img.onload = () => {
      if (resolved) return;
      clearTimeout(timeout);
      
      // Verify image actually loaded
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        resolved = true;
        reject(new Error(`Image loaded but has invalid dimensions: ${img.naturalWidth}x${img.naturalHeight}`));
        return;
      }
      
      try {
        const { width, height } = getOverlayDimensions(img.naturalWidth, img.naturalHeight, budget);
        const imageData = imageToImageData(img, width, height);

        log(`Loaded image: ${img.naturalWidth}x${img.naturalHeight} -> ${width}x${height}, ImageData size: ${imageData.data.length} bytes (cached)`, 'info');
        resolved = true;
        resolve(imageData);
      } catch (error) {
        log(`Error converting image to ImageData: ${error.message}`, 'error');
        resolved = true;
        reject(error);
      }
    };
    
    img.onerror = (event) => {
      if (resolved) return;
      clearTimeout(timeout);
      const errorMsg = `Image load failed: ${event.message || event.type || 'Unknown error'}`;
      log(`Image onerror event: ${errorMsg}`, 'error');
      log(`Image naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight}`, 'error');
      log(`Image complete: ${img.complete}, width: ${img.width}, height: ${img.height}`, 'error');
      resolved = true;
      reject(new Error(`Failed to load image from ${imageUrl}: ${errorMsg}`));
    };
    
    // Set src to load image (works like UI images in Zoom client)
    img.src = imageUrl;
  });
}

/**
 * Pre-load all background images and cache them as ImageData
 * This should be called when the app initializes
 */
export async function preloadBackgroundImages() {
  // Map status colors to Zoom overlay image URLs (timer-*-background.*)
  // Blue is what the card shows first, so decode it before the others. Loading
  // all four at once puts three decodes the user is not waiting on ahead of the
  // one they are.
  const colors = ['blue', 'green', 'yellow', 'red'];
  log('Pre-loading background images...', 'info');

  for (const color of colors) {
    try {
      await loadImageAsImageData(getBackgroundUrl(color));
      log(`Pre-loaded ${color} status`, 'info');
    } catch (error) {
      log(`Failed to pre-load ${color} status: ${error.message}`, 'warn');
    }
  }

  log(`Pre-loading complete. Cached ${imageDataCache.size} images.`, 'info');
}

/**
 * Get current overlay mode
 * @returns {string} Current overlay mode ('card' or 'camera')
 */
export function getOverlayMode() {
  return currentOverlayMode;
}

/**
 * Whether an overlay is currently pushed to Zoom.
 * @returns {boolean}
 */
export function isOverlayActive() {
  return activeOverlay !== null;
}

/**
 * Run an overlay SDK operation, one at a time, dropping any request that a newer
 * one has already superseded.
 *
 * Each push is multiple MB across the webview -> native bridge and takes as long
 * as it takes. Without this, several pushes run concurrently and can land out of
 * order, leaving a stale color on screen after a newer one was requested.
 * @param {Function} op - Async operation to run
 * @returns {Promise<void>}
 */
function enqueueOverlayOp(op) {
  const requestId = ++overlayRequestId;
  const run = () => {
    if (requestId !== overlayRequestId) {
      log('Skipping overlay request superseded by a newer one', 'info');
      return undefined;
    }
    return op();
  };
  // Same handler for both outcomes: one failed op must not stall the queue.
  overlayQueue = overlayQueue.then(run, run);
  return overlayQueue;
}

/**
 * Set overlay mode, tearing down whatever the previous mode had on screen and
 * bringing up the new one.
 * @param {string} mode - New overlay mode ('card', 'camera', 'share' or 'popout')
 * @param {string|null} currentImageUrl - Current image URL to reapply, or null to skip reapply
 * @returns {Promise<boolean>} False only when a stage mode was refused by the client
 */
export async function setOverlayMode(mode, currentImageUrl) {
  if (mode === currentOverlayMode) return true;
  // Remove overlay using the old mode, captured now because currentOverlayMode
  // changes before the queued operation runs.
  const previousMode = currentOverlayMode;
  await enqueueOverlayOp(() => removeOverlayInternal(previousMode));
  currentOverlayMode = mode;

  // Stage modes put the app itself on screen rather than pushing pixels, so they
  // are entered here instead of through applyOverlay.
  if (mode === OVERLAY_MODE_SHARE) {
    return setAppShare(true);
  }
  if (mode === OVERLAY_MODE_POPOUT) {
    return setAppPopout(true);
  }

  // Reapply with new mode if an image URL is provided
  if (currentImageUrl) {
    await applyOverlay(currentImageUrl);
  }
  return true;
}

/**
 * Internal helper to remove whatever a mode had on screen.
 * @param {string} mode - Overlay mode to tear down
 */
async function removeOverlayInternal(mode) {
  if (!sdkInitialized) {
    log('SDK not initialized yet, initializing now...', 'warn');
    await initializeZoomSdk();
  }

  // Clear this up front: once removal is requested, nothing is considered
  // applied, even if the removal itself fails because there was no overlay.
  activeOverlay = null;

  // Stage modes never pushed a background, so there is nothing to clear from the
  // video pipeline — but the share or the popped-out window has to come down.
  if (mode === OVERLAY_MODE_SHARE) {
    if (appShareActive) await setAppShare(false);
    return;
  }
  if (mode === OVERLAY_MODE_POPOUT) {
    if (appPoppedOut) await setAppPopout(false);
    return;
  }

  try {
    if (sdkAvailable && zoomSdk) {
      if (mode === OVERLAY_MODE_CAMERA) {
        if (typeof zoomSdk.removeVirtualBackground === 'function') {
          log('Removing virtual background', 'info');
          await zoomSdk.removeVirtualBackground();
          log('Successfully removed virtual background', 'info');
        } else {
          log('[MOCK] Would remove virtual background', 'warn');
        }
      } else {
        if (typeof zoomSdk.deleteVideoFilter === 'function') {
          log('Deleting video filter', 'info');
          await zoomSdk.deleteVideoFilter();
          log('Successfully deleted video filter', 'info');
        } else if (typeof zoomSdk.setVideoFilter === 'function') {
          log('Removing video filter via setVideoFilter(null)', 'info');
          await zoomSdk.setVideoFilter({ fileUrl: null });
          log('Successfully removed video filter', 'info');
        } else {
          log('[MOCK] Would remove video filter', 'warn');
        }
      }
    } else {
      log(`[MOCK] Would remove overlay (mode: ${mode}, SDK not available)`, 'warn');
    }
  } catch (error) {
    log(`Failed to remove overlay (mode: ${mode}): ${error.message || error.name}`, 'error');
    if (error.code) {
      log(`Error code: ${error.code}`, 'error');
      if (error.code === 10195) {
        log('No overlay exists to remove', 'warn');
      }
    }
  }
}

/**
 * Apply video filter overlay using Zoom SDK. Queued behind any overlay call
 * already in flight, and dropped if a newer overlay call supersedes it.
 * @param {string} imageUrl - URL of the image to use as overlay
 * @returns {Promise<void>}
 */
export function applyOverlay(imageUrl) {
  return enqueueOverlayOp(() => applyOverlayInternal(imageUrl));
}

/**
 * Whether what is already on screen matches what we are about to push.
 * @param {string} imageUrl
 * @returns {boolean}
 */
function isAlreadyShowing(imageUrl) {
  if (!activeOverlay) return false;
  if (activeOverlay.url !== imageUrl || activeOverlay.mode !== currentOverlayMode) return false;
  // A fileUrl push is size-independent, so it is never stale.
  if (!activeOverlay.budget) return true;
  const budget = getOverlayBudget();
  return activeOverlay.budget.width === budget.width && activeOverlay.budget.height === budget.height;
}

/**
 * @param {string} imageUrl - URL of the image to use as overlay
 */
async function applyOverlayInternal(imageUrl) {
  // Ensure SDK is initialized before attempting to set filter
  if (!sdkInitialized) {
    log('SDK not initialized yet, initializing now...', 'warn');
    await initializeZoomSdk();
  }

  // In a stage mode the app renders the color itself. TimerContext calls this on
  // every status change regardless of mode, so the guard lives here rather than
  // at each call site.
  if (!isVideoOverlayMode()) {
    log(`Stage mode (${currentOverlayMode}) renders the color in-app; skipping video push`, 'info');
    return;
  }

  if (!imageUrl) {
    log('No image URL provided for overlay', 'warn');
    return;
  }

  if (isAlreadyShowing(imageUrl)) {
    log(`Overlay already showing ${imageUrl}, skipping redundant push`, 'info');
    return;
  }

  try {
    if (sdkAvailable && zoomSdk) {
      if (currentOverlayMode === OVERLAY_MODE_CAMERA) {
        // Camera mode: use setVirtualBackground so user's face shows on top
        if (typeof zoomSdk.setVirtualBackground === 'function') {
          // setVirtualBackground accepts a fileUrl, which lets the Zoom client
          // fetch the image itself. That skips both the decode and the multi-MB
          // ImageData transfer across the bridge. setVideoFilter has no such
          // option, so this shortcut is camera mode only.
          try {
            log(`Applying virtual background by fileUrl: ${imageUrl}`, 'info');
            const result = await zoomSdk.setVirtualBackground({ fileUrl: imageUrl });
            log(`Successfully applied virtual background by fileUrl. Result: ${JSON.stringify(result)}`, 'info');
            // No pixels pushed, so no budget to go stale.
            activeOverlay = { url: imageUrl, mode: currentOverlayMode, budget: null };
            lastError = null;
            return;
          } catch (fileUrlError) {
            // The native client may not be able to reach the URL (restricted
            // network, proxy, TLS inspection). Fall back to shipping the pixels.
            log(`fileUrl virtual background failed: ${fileUrlError.message || fileUrlError.name}. Falling back to imageData.`, 'warn');
          }

          log(`Loading image for overlay (mode: ${currentOverlayMode}): ${imageUrl}`, 'info');
          const budget = getOverlayBudget();
          const imageData = await loadImageAsImageData(imageUrl);
          log(`Loaded ImageData: ${imageData.width}x${imageData.height}`, 'info');
          const result = await zoomSdk.setVirtualBackground({ imageData });
          log(`Successfully applied virtual background. Result: ${JSON.stringify(result)}`, 'info');
          activeOverlay = { url: imageUrl, mode: currentOverlayMode, budget };
          lastError = null;
          return;
        }
      } else {
        // Card mode: use setVideoFilter (covers entire video)
        if (typeof zoomSdk.setVideoFilter === 'function') {
          log(`Loading image for overlay (mode: ${currentOverlayMode}): ${imageUrl}`, 'info');
          const budget = getOverlayBudget();
          const imageData = await loadImageAsImageData(imageUrl);
          log(`Loaded ImageData: ${imageData.width}x${imageData.height}`, 'info');
          const result = await zoomSdk.setVideoFilter({ imageData });
          log(`Successfully applied video filter overlay. Result: ${JSON.stringify(result)}`, 'info');
          activeOverlay = { url: imageUrl, mode: currentOverlayMode, budget };
          lastError = null;
          if (result && result.status) {
            log(`Filter set status: ${result.status}`, 'info');
          }
          return;
        }
      }
    }

    // SDK not available or function not found
    log(`[MOCK] Would apply overlay (mode: ${currentOverlayMode}, ${imageUrl})`, 'warn');
    if (!sdkAvailable) {
      log(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`, 'warn');
    }
    if (!zoomSdk) {
      log(`[MOCK] zoomSdk object is not available`, 'warn');
    } else {
      const availableMethods = Object.keys(zoomSdk).filter(key => typeof zoomSdk[key] === 'function');
      log(`[MOCK] Required overlay function not available. Available methods: ${availableMethods.join(', ')}`, 'warn');
    }
  } catch (error) {
    log(`Failed to apply video filter overlay: ${error.message || error.name}`, 'error');
    log(`Error details: ${JSON.stringify({ message: error.message, code: error.code, name: error.name })}`, 'error');
    
    // Store error for debug panel
    let errorMessage = `Failed to apply overlay: ${error.message || error.name || 'Unknown error'}`;
    if (error.code) {
      errorMessage += ` (Code: ${error.code})`;
    }
    
    // Provide helpful error message
    if (error.message && error.message.includes('permission')) {
      errorMessage = 'Permission error: Make sure video filters are enabled in your Zoom settings';
      log('⚠️ ' + errorMessage, 'error');
    } else if (error.message && error.message.includes('video')) {
      errorMessage = 'Video error: Make sure your video is turned on in the Zoom meeting';
      log('⚠️ ' + errorMessage, 'error');
    } else if (error.code) {
      errorMessage = `Error code: ${error.code}. Check Zoom SDK documentation for this error code.`;
      log(`⚠️ ${errorMessage}`, 'error');
    }
    
    lastError = errorMessage;
    
    // Don't throw - allow app to continue functioning
  }
}

/**
 * Remove current overlay (dispatches to correct removal based on current mode)
 * @returns {Promise<void>}
 */
export function removeOverlay() {
  const mode = currentOverlayMode;
  return enqueueOverlayOp(() => removeOverlayInternal(mode));
}

/**
 * Get current video state (on/off)
 * @returns {Promise<boolean | null>} True if video is on, false if off, null if unable to determine
 */
export async function getVideoState() {
  // Ensure SDK is initialized first
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.getVideoState === 'function') {
      const result = await zoomSdk.getVideoState();
      
      // According to Zoom SDK: GetVideoStateResponse = { video: boolean }
      // video: false means off, true means on
      const videoState = result?.video;
      
      // Only return false if explicitly false, otherwise return null if undefined
      if (videoState === false) {
        console.log('Zoom SDK: Video state: OFF');
        log('Zoom SDK: Video state: OFF', 'info');
        return false;
      } else if (videoState === true) {
        console.log('Zoom SDK: Video state: ON');
        log('Zoom SDK: Video state: ON', 'info');
        return true;
      } else {
        console.warn('Zoom SDK: Video state is undefined, cannot determine. Result:', result);
        log(`Zoom SDK: Video state is undefined, cannot determine. Result: ${JSON.stringify(result)}`, 'warn');
        return null; // Return null if we can't determine
      }
    } else {
      console.warn('[MOCK] Zoom SDK: Would get video state (SDK not available)');
      log('[MOCK] Zoom SDK: Would get video state (SDK not available)', 'warn');
      // Return null in mock mode to indicate we can't determine (don't show warning)
      return null;
    }
  } catch (error) {
    console.error('Failed to get video state:', error);
    log(`Failed to get video state: ${error.message || error.name}`, 'error');
    // Return null on error to indicate we can't determine (don't show warning)
    return null;
  }
}

/**
 * Set video state (turn video on/off)
 * @param {boolean} enabled - True to turn video on, false to turn off
 */
export async function setVideoState(enabled) {
  // Ensure SDK is initialized
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.setVideoState === 'function') {
      // According to Zoom SDK: SetVideoStateOptions = { video: boolean }
      console.log(`Zoom SDK: Attempting to set video state to ${enabled ? 'ON' : 'OFF'}`);
      log(`Zoom SDK: Attempting to set video state to ${enabled ? 'ON' : 'OFF'}`, 'info');
      const result = await zoomSdk.setVideoState({ video: enabled });
      console.log(`Zoom SDK: Successfully set video state to ${enabled ? 'ON' : 'OFF'}`, result);
      log(`Zoom SDK: Successfully set video state to ${enabled ? 'ON' : 'OFF'}`, 'info');
      return result;
    } else {
      console.warn(`[MOCK] Zoom SDK: Would set video state to ${enabled ? 'ON' : 'OFF'} (SDK not available)`);
      log(`[MOCK] Zoom SDK: Would set video state to ${enabled ? 'ON' : 'OFF'} (SDK not available)`, 'warn');
      if (!sdkAvailable) {
        console.warn(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`);
        log(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`, 'warn');
      }
      if (!zoomSdk || typeof zoomSdk.setVideoState !== 'function') {
        console.warn(`[MOCK] setVideoState function is not available on zoomSdk object`);
        log(`[MOCK] setVideoState function is not available on zoomSdk object`, 'warn');
      }
      return null;
    }
  } catch (error) {
    console.error('Failed to set video state:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // Provide helpful error message
    if (error.message && error.message.includes('permission')) {
      console.error('⚠️ Permission error: Video state control may require user permission');
    }
    
    throw error; // Re-throw so caller can handle it
  }
}

/**
 * Get list of Zoom participants
 * @returns {Array} Array of participant objects
 */
export async function getZoomParticipants() {
  try {
    if (sdkAvailable) {
      // Try to get participants from Zoom SDK
      // Note: This API may require specific scopes/permissions
      try {
        const participants = await zoomSdk.getParticipants();
        if (participants && Array.isArray(participants)) {
          return participants.map((p, index) => ({
            id: p.userId || p.id || `user-${index}`,
            name: p.displayName || p.userName || p.name || 'Unknown'
          }));
        }
      } catch (sdkError) {
        // Participants API might not be available or require additional permissions
        console.log('Participants API not available:', sdkError.message);
      }
      return [];
    } else {
      // Mock participants for local development
      log(`[MOCK] SDK is not available; no participants to report.`, 'warn');
      return [];
    }
  } catch (error) {
    console.error('Failed to get Zoom participants:', error);
    // Return mock data as fallback
    return [];
  }
}
