import zoomSdk from '@zoom/appssdk';
import { loadOverlayMode, loadOverlayTimeReadout, saveOverlayTimeReadout } from '@toastmaster-timer/shared';

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

/**
 * Every SDK method the app calls: what to request for it, whether the timer can
 * work without it, and what breaks when it is missing.
 *
 * One list, feeding both the config() request and the debug panel, because these
 * two drifted apart badly. The panel reported on a hand-kept subset, so a client
 * missing appPopout or openUrl read as all-green — and config() asked for
 * "videoFilter" and "virtualBackground", which are not capabilities at all.
 *
 * A capability is the exact name of the API or event being granted; there is no
 * grouped name covering a family of calls. Those two invented names granted
 * nothing, which is why removeVirtualBackground came back refused while applying
 * a background appeared to work.
 *
 * `required` keeps config() alive on a limited client: reject the full request
 * and it is retried with these alone, so only what the timer genuinely cannot run
 * without belongs here. The video filter is the core function: Timer + Camera is
 * the default, but it degrades to the filter pipeline on clients that refuse
 * setVirtualBackground, so the filter APIs are the ones nothing can stand in for.
 *
 * Keep in step with the zoomSdk.* calls below — a test asserts it, both ways.
 */
export const USED_SDK_APIS = [
  { name: 'config', capability: null, required: true, purpose: 'Grants every capability below' },
  { name: 'setVideoFilter', capability: 'setVideoFilter', required: true, purpose: 'Timer Only' },
  { name: 'deleteVideoFilter', capability: 'deleteVideoFilter', required: true, purpose: 'Clearing Timer Only' },
  { name: 'setVirtualBackground', capability: 'setVirtualBackground', required: false, purpose: 'Timer + Camera' },
  { name: 'removeVirtualBackground', capability: 'removeVirtualBackground', required: false, purpose: 'Clearing Timer + Camera' },
  { name: 'getCurrentVirtualBackground', capability: 'getCurrentVirtualBackground', required: false, purpose: 'Leaving the user\'s own background alone' },
  { name: 'getVirtualBackgrounds', capability: 'getVirtualBackgrounds', required: false, purpose: 'Naming the background being restored' },
  { name: 'getVideoState', capability: 'getVideoState', required: false, purpose: 'Video-off warning' },
  { name: 'setVideoState', capability: 'setVideoState', required: false, purpose: 'Turn my video on' },
  { name: 'getMeetingParticipants', capability: 'getMeetingParticipants', required: false, purpose: 'Speaker suggestions' },
  { name: 'getUserContext', capability: 'getUserContext', required: false, purpose: 'Putting yourself in the speaker list' },
  { name: 'shareApp', capability: 'shareApp', required: false, purpose: 'Sharing the stage to the meeting' },
  { name: 'onShareApp', capability: 'onShareApp', required: false, purpose: 'Following Zoom\'s own sharing toolbar' },
  { name: 'onShareScreen', capability: 'onShareScreen', required: false, purpose: 'Noticing Zoom\'s own Stop Share' },
  { name: 'getMeetingView', capability: 'getMeetingView', required: false, purpose: 'Checking whether a share is really still up' },
  { name: 'onMeetingViewChange', capability: 'onMeetingViewChange', required: false, purpose: 'Noticing a share ending' },
  { name: 'appPopout', capability: 'appPopout', required: false, purpose: 'Opening the stage in its own window' },
  { name: 'onAppPopout', capability: 'onAppPopout', required: false, purpose: 'Following Zoom\'s own popout menu' },
  { name: 'onAppVisibilityChange', capability: 'onAppVisibilityChange', required: false, purpose: 'Noticing background changes' },
  { name: 'onMyMediaChange', capability: 'onMyMediaChange', required: false, purpose: 'Overlay sizing' },
  { name: 'openUrl', capability: 'openUrl', required: false, purpose: 'Marketplace review link' },
];

const capabilitiesWhere = (required) =>
  USED_SDK_APIS.filter((api) => api.capability && api.required === required).map(
    (api) => api.capability
  );

const REQUIRED_CAPABILITIES = capabilitiesWhere(true);
const OPTIONAL_CAPABILITIES = capabilitiesWhere(false);

// APIs this client refused, as reported by config(). Empty until config resolves.
//
// This is the only truthful answer to "can I call this?". `typeof zoomSdk.foo ===
// 'function'` is not: the npm SDK defines every documented method on its
// prototype, granted or not, so that check passes on every client and every
// guard written against it is dead code. config() does not reject when a
// capability is refused either — it resolves and names the refusals here.
//
// Calling a refused API rejects at the bridge, which is what made "clear my
// video" report a hard failure on clients that never granted
// removeVirtualBackground in the first place.
let unsupportedApis = new Set();

/**
 * Whether this client actually granted an API, as opposed to the SDK merely
 * defining it. Optimistic before config() resolves, which only affects calls
 * made during initialization.
 *
 * @param {string} name - SDK method name, e.g. 'removeVirtualBackground'
 * @returns {boolean}
 */
export function isApiAvailable(name) {
  if (!zoomSdk || typeof zoomSdk[name] !== 'function') return false;
  return !unsupportedApis.has(name);
}

// Overlay mode constants.
//
// Two families, and the difference matters at every call site below:
//   card / camera - push an image into the video pipeline (videoFilter or
//                   virtualBackground). The color rides on the user's tile.
//   stage         - puts the app's own UI on screen instead, pushing no pixels at
//                   all: the color is DOM rendered by the app, and the user's
//                   camera and background are left untouched.
export const OVERLAY_MODE_CARD = 'card';
export const OVERLAY_MODE_CAMERA = 'camera';
export const OVERLAY_MODE_STAGE = 'stage';
// What the Live tab starts in when nothing is saved. Timer + Camera is the pick
// because it keeps the organizer's face on screen: the color goes behind them
// rather than over them, which is what a first-time organizer expects a video
// timer to do. Like the card it changes nothing about the meeting on its own —
// no window undocks and no share starts. The stage is a deliberate choice the
// organizer makes from the menu, never where they land. On clients that never
// granted setVirtualBackground, camera mode degrades to the card pipeline.
export const DEFAULT_OVERLAY_MODE = OVERLAY_MODE_CAMERA;

// Modes an older build may have persisted, before sharing and popping out became
// actions taken from inside the stage rather than modes of their own. Only the
// window one is carried over: a saved preference must never start a screen share.
export const LEGACY_OVERLAY_MODES = { popout: OVERLAY_MODE_STAGE };

/**
 * The organizer's saved mode, migrated and validated, or the default.
 * Exported so the Live tab seeds its menu from the same answer.
 */
export function resolvePersistedOverlayMode() {
  const persisted = loadOverlayMode();
  const migrated = LEGACY_OVERLAY_MODES[persisted] || persisted;
  const known = [OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD, OVERLAY_MODE_CAMERA];
  return known.includes(migrated) ? migrated : DEFAULT_OVERLAY_MODE;
}

// Starts on the *persisted* mode, never blindly on the default. Zoom re-creates
// this webview every time the panel is closed and reopened, and the Live tab
// restores the saved mode into its menu — so waking up on the default here put
// the two out of agreement, and every push then drove the wrong pipeline. With
// Timer + Camera saved, that meant setVideoFilter covering the organizer's face
// with the full card while the menu promised their face would show; clearing
// could not stick, because the running timer re-pushed the filter on the next
// status change.
let currentOverlayMode = resolvePersistedOverlayMode();

/**
 * Whether a mode drives the video pipeline. The stage shows the color through the
 * app's own UI, so pushing a background as well would put it in two places.
 * @param {string} [mode] - Defaults to the current mode
 * @returns {boolean}
 */
export function isVideoOverlayMode(mode = currentOverlayMode) {
  return mode === OVERLAY_MODE_CARD || mode === OVERLAY_MODE_CAMERA;
}

// Track SDK initialization state
let sdkInitialized = false;
let sdkAvailable = false;
// The in-flight or settled initialization, so everyone awaits the same one.
// sdkInitialized says init has *started*; only this says when it has finished.
let sdkInitPromise = null;

// Track last error for debugging
let lastError = null;

// Log callback function - will be set by LiveTab component
let logCallback = null;

// Cache of in-flight and resolved ImageData loads, keyed by image URL. Storing
// the promise (not just the result) means a preload and a concurrent apply share
// one download + decode instead of each doing the whole job.
const imageDataCache = new Map();

// The overlay currently pushed to Zoom, or null if none:
//   { url, mode, budget, pipeline, label }
// budget is the overlay size the pixels were rendered for, or null for a fileUrl
// push, which carries no pixels and so never goes stale on a resolution change.
// pipeline says which SDK pipeline the push went through ('filter' or
// 'background'), which is no longer implied by the mode: Timer + Camera
// degrades to the filter on clients that refused setVirtualBackground. label is
// the elapsed-time readout baked into a filter frame, or null for a plain card.
let activeOverlay = null;

// The elapsed-time readout to render onto pushed frames, e.g. '02:35', or null
// while no speech is being timed. Both video modes are image pushes, so the
// count-up other participants see has to be baked into the pixels. In camera
// mode that costs the fileUrl shortcut while a speech runs — a frame carrying
// the time is different every second, so the pixels have to cross the bridge.
let overlayTimeLabel = null;

// Where the readout sits on the frame: normalized (0-1) center of the text.
// Upper-left by default, just below the Toastmasters logo that occupies the
// card's actual top-left corner. Not centered: the middle of the tile is
// where camera mode puts the organizer's head, which would hide a centered
// readout. The organizer repositions it by dragging the badge on the Live
// tab's preview; persisted because the choice is about where their own face
// is, which does not change between meetings.
export const DEFAULT_OVERLAY_TIME_POSITION = { x: 0.18, y: 0.3 };

// How tall the readout is, as a fraction of the frame. The +/- buttons beside
// the drag badge step through this range; the floor keeps the text a readable
// sliver rather than nothing, the ceiling keeps it from filling the tile.
export const DEFAULT_OVERLAY_TIME_SCALE = 0.18;
export const OVERLAY_TIME_SCALE_MIN = 0.06;
export const OVERLAY_TIME_SCALE_MAX = 0.33;

const storedReadout = loadOverlayTimeReadout();
let overlayTimePosition =
  storedReadout?.x !== undefined && storedReadout?.y !== undefined
    ? { x: storedReadout.x, y: storedReadout.y }
    : DEFAULT_OVERLAY_TIME_POSITION;
let overlayTimeScale = storedReadout?.scale ?? DEFAULT_OVERLAY_TIME_SCALE;
let overlayTimeVisible = storedReadout?.visible ?? true;

function persistOverlayTimeReadout() {
  saveOverlayTimeReadout({
    x: overlayTimePosition.x,
    y: overlayTimePosition.y,
    scale: overlayTimeScale,
    visible: overlayTimeVisible,
  });
}

/**
 * The readout the next frame should carry: the elapsed time, or null when
 * there is none to show — no speech, or the organizer switched it off.
 */
function effectiveTimeLabel() {
  return overlayTimeVisible ? overlayTimeLabel : null;
}

/** Repaint the pushed frame if it is carrying (or should now carry) a readout. */
function repaintOverlayFrame() {
  if (activeOverlay?.url && isVideoOverlayMode()) {
    applyOverlay(activeOverlay.url);
  }
}

/** @returns {{x: number, y: number}} Normalized center of the readout */
export function getOverlayTimePosition() {
  return { ...overlayTimePosition };
}

/**
 * Move the readout and repaint the frame participants are watching.
 * @param {{x: number, y: number}} position - Normalized (0-1) center
 */
export function setOverlayTimePosition(position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const next = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  if (next.x === overlayTimePosition.x && next.y === overlayTimePosition.y) return;
  overlayTimePosition = next;
  persistOverlayTimeReadout();
  // Only a frame that is actually carrying the readout needs repainting.
  if (effectiveTimeLabel()) repaintOverlayFrame();
}

/** @returns {number} Readout height as a fraction of the frame */
export function getOverlayTimeScale() {
  return overlayTimeScale;
}

/**
 * Resize the readout and repaint the frame participants are watching.
 * @param {number} scale - Text height as a fraction of the frame; clamped
 * @returns {number} The scale actually applied
 */
export function setOverlayTimeScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value)) return overlayTimeScale;
  const next = Math.min(OVERLAY_TIME_SCALE_MAX, Math.max(OVERLAY_TIME_SCALE_MIN, value));
  if (next === overlayTimeScale) return overlayTimeScale;
  overlayTimeScale = next;
  persistOverlayTimeReadout();
  if (effectiveTimeLabel()) repaintOverlayFrame();
  return overlayTimeScale;
}

/** @returns {boolean} Whether the readout is shown on pushed frames */
export function isOverlayTimeVisible() {
  return overlayTimeVisible;
}

/**
 * Show or hide the readout, repainting the frame either way: hiding a readout
 * that is up must push a plain frame, not merely stop updating.
 * @param {boolean} visible
 */
export function setOverlayTimeVisible(visible) {
  const next = Boolean(visible);
  if (next === overlayTimeVisible) return;
  overlayTimeVisible = next;
  persistOverlayTimeReadout();
  if (overlayTimeLabel) repaintOverlayFrame();
}

/**
 * Set the elapsed-time readout and repaint the frame other participants see.
 *
 * Driven by the timer once per second while a speech runs. Each change
 * re-pushes the visible frame — filter or background, whichever pipeline is
 * up; the overlay queue coalesces pushes a slow client cannot keep up with, so
 * the readout skips ahead rather than lagging behind. Clearing the label never
 * re-pushes — null means the speech is over, and whatever teardown or status
 * push follows owns the tile. A hidden readout never re-pushes either: the
 * frame it would repaint is identical.
 *
 * @param {string|null} label - Formatted elapsed time, or null between speeches
 */
export function setOverlayTimeLabel(label) {
  const next = label ?? null;
  if (next === overlayTimeLabel) return;
  overlayTimeLabel = next;
  if (next && overlayTimeVisible) repaintOverlayFrame();
}

/**
 * Bake the elapsed-time readout into a frame. Exported for testing.
 *
 * Drawn at the organizer's chosen position, clamped so the text never runs off
 * the frame. White digits over a dark keyline stay readable on all four
 * colors, yellow included — and over whatever the camera mode's cutout leaves
 * visible around the face.
 *
 * @param {ImageData} base - Decoded background (not mutated; it is cached)
 * @param {string} label - Formatted elapsed time
 * @param {{x: number, y: number}} [position] - Normalized center of the text
 * @param {number} [scale] - Text height as a fraction of the frame
 * @returns {ImageData} A new frame with the readout drawn on
 */
export function renderTimeOnFrame(base, label, position = overlayTimePosition, scale = overlayTimeScale) {
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(base, 0, 0);
  const fontSize = Math.round(base.height * scale);
  ctx.font = `bold ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pad = Math.round(base.height * 0.04);
  const textWidth = ctx.measureText(label).width;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const x = Math.round(clamp(position.x * base.width, pad + textWidth / 2, base.width - pad - textWidth / 2));
  const y = Math.round(clamp(position.y * base.height, pad + fontSize / 2, base.height - pad - fontSize / 2));
  ctx.lineWidth = Math.max(2, Math.round(fontSize / 12));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.strokeText(label, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x, y);
  return ctx.getImageData(0, 0, base.width, base.height);
}

// Camera resolution reported by onMyMediaChange, or null until one arrives.
let cameraResolution = null;

// Whether a virtual background of ours is currently on the user's video.
//
// Tracked separately from activeOverlay because it gates a user-visible cost:
// removeVirtualBackground always raises a confirmation dialog in the client, by
// Zoom's design, returning 10017 if the user declines. Calling it blindly means
// a "remove the video filter?" prompt every time, so it is only called when
// there is genuinely something of ours to remove. setVideoFilter's counterpart,
// deleteVideoFilter, prompts for nothing and needs no such guard.
//
// Persisted, because Zoom reloads the app's webview every time the panel is
// closed and reopened. A purely in-memory flag reads false in precisely the
// situation the "Clear Background" button exists for: a background of ours left
// on the tile by an earlier session.
const VIRTUAL_BACKGROUND_APPLIED_KEY = 'toastmaster_zoom_virtual_background_applied';

function readVirtualBackgroundApplied() {
  try {
    return localStorage.getItem(VIRTUAL_BACKGROUND_APPLIED_KEY) === 'true';
  } catch {
    return false;
  }
}

let virtualBackgroundApplied = readVirtualBackgroundApplied();

/**
 * Record whether one of our virtual backgrounds is on the user's video.
 * @param {boolean} applied
 */
function markVirtualBackgroundApplied(applied) {
  virtualBackgroundApplied = applied;
  try {
    if (applied) localStorage.setItem(VIRTUAL_BACKGROUND_APPLIED_KEY, 'true');
    else localStorage.removeItem(VIRTUAL_BACKGROUND_APPLIED_KEY);
  } catch {
    // Storage unavailable (private mode). The in-memory flag still holds for
    // this session, which is the pre-existing behaviour.
  }
}

// What the user had on their video before ours replaced it, so that clearing
// puts them back where they were instead of stripping them to a bare camera.
//
// Shape: { type: 'none' | 'blur' | 'image', id?: string, name?: string }, or
// null when the client could not say — in which case nothing here applies and
// the old remove-and-hope path runs unchanged.
const PREVIOUS_BACKGROUND_KEY = 'toastmaster_zoom_previous_background';

function readPreviousBackground() {
  try {
    const raw = localStorage.getItem(PREVIOUS_BACKGROUND_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePreviousBackground(background) {
  try {
    if (background) localStorage.setItem(PREVIOUS_BACKGROUND_KEY, JSON.stringify(background));
    else localStorage.removeItem(PREVIOUS_BACKGROUND_KEY);
  } catch {
    // See markVirtualBackgroundApplied.
  }
}

/**
 * Reduce whatever the client reports to { type, id, name }.
 *
 * Deliberately tolerant, and deliberately gives up rather than guesses. These
 * two APIs are grantable in the Marketplace but absent from @zoom/appssdk
 * 0.16.36, 0.16.40 and the CDN bundle, so their exact response shape cannot be
 * pinned down here — checked, not assumed. Returning null means "the client did
 * not tell us", which every caller treats as the old behaviour rather than as
 * an answer. A wrong guess would be worse than no guess: it decides whether the
 * user gets a confirmation dialog they did not need.
 *
 * @param {any} raw
 * @returns {{type: string, id?: string, name?: string}|null}
 */
export function normalizeVirtualBackground(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // getVirtualBackgrounds returns the list plus the applied one; the single
  // getter returns the applied one alone. Accept either, under any of the names
  // the response might carry it as.
  const current = raw.currentVirtualBackground || raw.current || raw.virtualBackground || raw;
  if (!current || typeof current !== 'object') return null;

  const label = [current.type, current.id, current.name]
    .find((value) => typeof value === 'string' && value.trim());
  if (!label) return null;

  const lowered = label.trim().toLowerCase();
  if (lowered === 'none') return { type: 'none' };
  if (lowered === 'blur') return { type: 'blur' };
  // Anything else names an actual image: the id identifies it, the name is for
  // telling the user which one we could not put back.
  const id = typeof current.id === 'string' ? current.id : undefined;
  const name = typeof current.name === 'string' ? current.name : undefined;
  if (!id && !name) return null;
  return { type: 'image', ...(id && { id }), ...(name && { name }) };
}

/** Whether two reads describe the same background. */
function sameBackground(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type !== 'image') return true;
  return a.id ? a.id === b.id : a.name === b.name;
}

/**
 * What is on the user's video right now, or null when the client cannot say.
 * @returns {Promise<{type: string, id?: string, name?: string}|null>}
 */
async function readCurrentVirtualBackground() {
  try {
    // Spelled out rather than indexed, so a test can see which methods this
    // module calls and hold USED_SDK_APIS to them.
    if (isApiAvailable('getCurrentVirtualBackground')) {
      return normalizeVirtualBackground(await zoomSdk.getCurrentVirtualBackground());
    }
    if (isApiAvailable('getVirtualBackgrounds')) {
      return normalizeVirtualBackground(await zoomSdk.getVirtualBackgrounds());
    }
    return null;
  } catch (error) {
    log(`Could not read the current virtual background: ${error.message || error.name}`, 'warn');
    return null;
  }
}

/**
 * Remember what the user had, just before ours goes over the top of it.
 *
 * Only ever called when we do not believe one of ours is already applied, so
 * the snapshot is always of theirs and never of our own branded image.
 */
async function snapshotUserBackground() {
  const current = await readCurrentVirtualBackground();
  if (!current) return;
  writePreviousBackground(current);
  log(`Remembered the user's background before replacing it: ${current.name || current.type}`, 'info');
}

/**
 * Whether one of ours is genuinely on the video, as opposed to merely recorded
 * as being there.
 *
 * The record goes stale the moment the user visits Background & Effects, and a
 * stale record is expensive: removing costs a confirmation dialog, and being
 * refused for a background that was never there is what reported "Zoom would
 * not clear your video" over a video that was already fine.
 *
 * @returns {Promise<boolean|null>} null when the client cannot say
 */
async function isOurBackgroundApplied() {
  const current = await readCurrentVirtualBackground();
  if (!current) return null;
  // Nothing at all is applied, so ours certainly is not.
  if (current.type === 'none') return false;
  // Their own is back up — they changed it themselves, or ours never took.
  if (sameBackground(current, readPreviousBackground())) return false;
  return true;
}

// Whether a video filter of ours is currently on the user's video.
//
// Persisted for the same reason as the background flag, and tracked separately
// from activeOverlay because the two answer different questions. activeOverlay
// answers "would this push be redundant?", and is deliberately dropped whenever
// the app comes back to the front — the user may have been in Background &
// Effects. Reading it as "is a filter of ours up?" made the clear button treat a
// genuine deleteVideoFilter failure as "there was nothing there anyway" and
// report success over a card that was still on the tile.
const VIDEO_FILTER_APPLIED_KEY = 'toastmaster_zoom_video_filter_applied';

function readVideoFilterApplied() {
  try {
    return localStorage.getItem(VIDEO_FILTER_APPLIED_KEY) === 'true';
  } catch {
    return false;
  }
}

let videoFilterApplied = readVideoFilterApplied();

/**
 * Record whether one of our video filters is on the user's video.
 * @param {boolean} applied
 */
function markVideoFilterApplied(applied) {
  videoFilterApplied = applied;
  try {
    if (applied) localStorage.setItem(VIDEO_FILTER_APPLIED_KEY, 'true');
    else localStorage.removeItem(VIDEO_FILTER_APPLIED_KEY);
  } catch {
    // See markVirtualBackgroundApplied.
  }
}

// What the app itself is doing, as opposed to what it has put on the video.
// Neither is an overlay, so neither is tracked by activeOverlay: appShareActive
// means the app is screen-shared into the meeting, appPoppedOut means it is
// undocked into its own window. Independent of each other and of the mode — they
// are actions the organizer takes from the stage, not modes.
let appShareActive = false;
let appPoppedOut = false;

// Notified when either changes, including when the user drives it from Zoom's own
// UI — the ellipsis menu for the window, the sharing toolbar for the share —
// rather than from our buttons.
let popoutChangeCallback = null;
let shareChangeCallback = null;

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
export function initializeZoomSdk() {
  // Single-flight. The old shape flipped sdkInitialized synchronously and then
  // awaited config(), so a second caller arriving during that await saw
  // "initialized" and carried straight on with sdkAvailable still false. Every
  // guard in this module is written as `if (!sdkInitialized) await
  // initializeZoomSdk()`, which made them protect only the never-started case
  // and not the far more common started-but-not-finished one.
  //
  // main.jsx renders before it starts init, on purpose, so the whole first
  // paint happens inside that window: mount effects run, ask the SDK for
  // something, and are told it is unavailable. Returning the same promise to
  // everyone makes waiting for it the default rather than something each
  // caller has to arrange.
  if (!sdkInitPromise) sdkInitPromise = initializeZoomSdkOnce();
  return sdkInitPromise;
}

async function initializeZoomSdkOnce() {
  sdkInitialized = true;

  try {
    // Check if we're in a Zoom environment
    // The SDK will be available when running in Zoom client
    log('Initializing Zoom SDK...', 'info');
    // Landscape 16:9, matching the branded backgrounds, so Timer Window mode
    // opens close to the asset's shape instead of the old 400x600 portrait that
    // letterboxed it badly. The client clamps this: documented minimums are
    // 336x342 on Windows and 320x760 on Mac, with a 75%-of-screen maximum, so a
    // small Mac display may still force a taller window. The layered backdrop in
    // TimerStage is what keeps those cases presentable — this only improves the
    // starting point, and the user can always resize.
    const baseOptions = { popoutSize: { width: 1152, height: 648 }, version: '1.0.0' };
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
    // config() resolves whether or not every capability was granted; the
    // refusals arrive here rather than as a rejection.
    unsupportedApis = new Set(configResult?.unsupportedApis || []);
    log(`Zoom SDK initialized successfully. Config: ${JSON.stringify(configResult)}`, 'info');
    const refused = USED_SDK_APIS.filter((api) => unsupportedApis.has(api.name));
    if (refused.length) {
      log(`Client refused: ${refused.map((api) => `${api.name} (${api.purpose})`).join(', ')}`, 'warn');
    }
    subscribeToCameraResolution();
    subscribeToAppPopout();
    subscribeToAppVisibility();
    subscribeToShareApp();
    subscribeToShareScreen();
    subscribeToMeetingView();
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

  // Re-push so what participants see matches the new resolution, but only if
  // pixels were actually rendered for the old one. A fileUrl push carries no
  // pixels — Zoom scales the file itself — so resolution has no bearing on it,
  // and a null budget is what marks that case.
  if (activeOverlay?.budget) {
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

// Zoom's codes for a stop aimed at a share that is not there. Both are the
// expected answer once the user has pressed Zoom's own Stop Share, not failures.
const ERROR_SHARE_NOT_STARTED = 10025;
const ERROR_NO_ONGOING_SHARE = 10189;

/**
 * Whether the client says this user is presenting, or null when it cannot say.
 *
 * Note what this can and cannot settle. `presenting` covers any share — ours, or
 * a screen share the user started themselves from Zoom's toolbar — so a true
 * never proves the thing on screen is our app. A false does prove the opposite:
 * nothing is being shared at all, so our share is certainly over. Only that
 * direction is acted on anywhere below.
 *
 * @returns {Promise<boolean|null>}
 */
async function readPresentingState() {
  if (!isApiAvailable('getMeetingView')) return null;
  try {
    const view = await zoomSdk.getMeetingView();
    return typeof view?.presenting === 'boolean' ? view.presenting : null;
  } catch (error) {
    // Documented desktop-only, and unavailable in some running contexts.
    log(`Could not read the meeting view: ${error.message || error.name}`, 'warn');
    return null;
  }
}

// When the share was last started, on the monotonic clock. The client's own view
// state does not update in the same instant the share begins, so a read taken
// just after a start can say "nobody is presenting" about a share that is coming
// up — and starting a share can hide and re-show the app, which is exactly what
// triggers the refocus check. Believing that read would flip the button back to
// "Screenshare" mid-share, which is worse than the stale label this all exists to
// fix: pressing it then asks Zoom to start a second share.
let appShareStartedAt = 0;
const SHARE_SETTLE_MS = 3000;

/** Monotonic where available; the wall clock is only a fallback. */
function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Record that the share is over, and tell whoever is showing a button for it.
 * @param {string} reason - For the debug log
 */
function markShareStopped(reason) {
  if (!appShareActive) return;
  appShareActive = false;
  log(`App share is no longer active (${reason})`, 'info');
  if (shareChangeCallback) shareChangeCallback(false);
}

/**
 * Reconcile our record of the share against what the client actually has on
 * screen, and report what is true.
 *
 * The backstop behind the three share events, for the one moment they cannot
 * cover: while the app is in the background, an event may be missed outright.
 * Called on refocus, so it is a check made when something might have changed
 * unseen — never a poll.
 *
 * Asks nothing of the client unless a share is believed to be up, and nothing at
 * all in the moments just after one starts, when the answer cannot be trusted
 * yet.
 *
 * @returns {Promise<boolean>} Whether the app share is still believed to be up
 */
export async function syncAppShareState() {
  await initializeZoomSdk();
  if (!sdkAvailable || !appShareActive) return appShareActive;
  if (now() - appShareStartedAt < SHARE_SETTLE_MS) return appShareActive;

  if ((await readPresentingState()) === false) {
    markShareStopped('Zoom reports nothing being shared');
  }
  return appShareActive;
}

/**
 * Start or stop sharing the app itself into the meeting.
 *
 * This is a screen share of the app's own webview, not a video effect: the
 * camera pipeline is untouched, so the user keeps their face and whatever
 * background they already chose. What participants see is whatever the app
 * panel is showing, which is why the stage view has to carry its own controls.
 *
 * A stop refused *because there was nothing to stop* is success rather than
 * failure: the share the organizer wanted gone is gone either way. That is the
 * common case once they have pressed Zoom's own Stop Share button, and calling
 * it an error put a toast in front of them for doing so.
 *
 * @param {boolean} active - True to start sharing, false to stop
 * @param {{withSound?: boolean}} [options]
 * @returns {Promise<boolean>} True if the client accepted the request
 */
export async function setAppShare(active, { withSound = false } = {}) {
  await initializeZoomSdk();

  if (!sdkAvailable || !zoomSdk || typeof zoomSdk.shareApp !== 'function') {
    log(`[MOCK] Would ${active ? 'start' : 'stop'} sharing the app`, 'warn');
    appShareActive = active;
    return false;
  }

  // Asked before the stop, but never instead of it. A read saying nothing is
  // being shared makes a failed stop the expected answer rather than a problem
  // to report — and the stop still goes to Zoom, because a read that has gone
  // stale must never leave the meeting watching a share we declared over.
  const nothingToStop = !active && (await readPresentingState()) === false;

  try {
    await zoomSdk.shareApp(active ? { action: 'start', withSound } : { action: 'stop' });
    appShareActive = active;
    if (active) appShareStartedAt = now();
    log(`App share ${active ? 'started' : 'stopped'}`, 'info');
    return true;
  } catch (error) {
    if (!active && (nothingToStop || error.code === ERROR_SHARE_NOT_STARTED || error.code === ERROR_NO_ONGOING_SHARE)) {
      // The share was stopped from Zoom's own toolbar, so there was nothing left
      // for this call to stop. Either the client told us so up front, or it is
      // saying so now by refusing. Nothing is wrong: the share is over, which is
      // what was asked for — and reporting a failure for it is what put a "Zoom
      // would not stop the share" toast in front of someone who had just
      // stopped it themselves.
      markShareStopped(`nothing left to stop${error.code ? ` (code ${error.code})` : ''}`);
      return true;
    }
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
  await initializeZoomSdk();

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
 * Register a callback for share state changes, so the stage's share button shows
 * what is true rather than what we last asked for. The organizer can stop a share
 * from Zoom's own sharing toolbar, which never goes near our button.
 * @param {Function|null} callback - Receives the new sharing boolean
 */
export function setShareChangeCallback(callback) {
  shareChangeCallback = callback;
}

/**
 * Track sharing from an onShareApp event. Exported for testing.
 * @param {Object|string} event - OnShareAppEvent: 'start' | 'stop', or an object
 *   carrying one under `action`, depending on client version
 */
export function handleShareApp(event) {
  const action = typeof event === 'string' ? event : event?.action;
  if (action !== 'start' && action !== 'stop') return;

  const sharing = action === 'start';
  if (sharing === appShareActive) return;

  appShareActive = sharing;
  if (sharing) appShareStartedAt = now();
  log(`App share ${sharing ? 'started' : 'stopped'} by the client`, 'info');
  if (shareChangeCallback) shareChangeCallback(sharing);
}

/**
 * Subscribe to share updates. Failure is non-fatal: the button still starts and
 * stops the share, it just will not follow a stop made from Zoom's own toolbar.
 */
function subscribeToShareApp() {
  if (!zoomSdk || typeof zoomSdk.onShareApp !== 'function') {
    log('onShareApp unavailable; share state will not track the Zoom toolbar', 'warn');
    return;
  }
  try {
    zoomSdk.onShareApp(handleShareApp);
    log('Subscribed to onShareApp', 'info');
  } catch (error) {
    log(`Failed to subscribe to onShareApp: ${error.message || error.name}`, 'warn');
  }
}

// Who we are in this meeting, so a share event can be told apart from someone
// else's. Null until read, and null forever on a client that refuses
// getUserContext — in which case share events are left alone rather than guessed
// at. Meeting-specific and stable across breakout rooms, unlike participantId.
let selfParticipantUUID = null;

/**
 * Read and cache this user's participant UUID.
 *
 * Wanted before any share event arrives, which is why it is read at init rather
 * than on demand: an event handler cannot wait for it, and the first Stop Share
 * is exactly the one that matters.
 *
 * @returns {Promise<string|null>}
 */
async function readSelfParticipantUUID() {
  if (selfParticipantUUID) return selfParticipantUUID;
  if (!isApiAvailable('getUserContext')) return null;
  try {
    const context = await zoomSdk.getUserContext();
    selfParticipantUUID = context?.participantUUID || context?.participantId || null;
    return selfParticipantUUID;
  } catch (error) {
    log(`Could not read your own participant id: ${error.message || error.name}`, 'warn');
    return null;
  }
}

/**
 * Track our share ending from an onShareScreen event. Exported for testing.
 *
 * This is the event that actually reports Zoom's own Stop Share button, and the
 * reason the stage no longer has to poll for it. onShareApp is the documented
 * event for an app share and is subscribed as well, but it is not delivered on
 * every client; onShareScreen is meeting-wide, supported further back, and an app
 * share is a screen share as far as the meeting is concerned.
 *
 * Meeting-wide is also the catch: it fires for everybody, so it is only acted on
 * when the UUID is ours. Where we could not learn our own UUID the event is
 * ignored outright — mistaking someone else's share ending for ours would leave
 * the button offering "Screenshare" over a stage the meeting is still watching,
 * and pressing it would then ask Zoom to start a second share.
 *
 * @param {Object} event - OnShareScreenEvent
 */
export function handleShareScreen(event) {
  if (event?.action !== 'stop') return;
  if (!appShareActive) return;

  const who = event.participantUUID;
  if (!selfParticipantUUID) {
    log('A screen share stopped, but this client never told us who we are; leaving the share state alone', 'warn');
    return;
  }
  if (who && who !== selfParticipantUUID) return;

  markShareStopped('Zoom reports our screen share stopped');
}

/**
 * Subscribe to meeting-wide screen share updates, and learn who we are so the
 * events can be attributed. Non-fatal where either is missing: the share state
 * then falls back to onShareApp, to onMeetingViewChange, and to the check made
 * before each stop.
 */
function subscribeToShareScreen() {
  if (!zoomSdk || typeof zoomSdk.onShareScreen !== 'function') {
    log('onShareScreen unavailable; share state will not follow Zoom\'s Stop Share', 'warn');
    return;
  }
  // Not awaited: init should not wait on it, and it only has to land before the
  // organizer stops a share they have not started yet.
  readSelfParticipantUUID();
  try {
    zoomSdk.onShareScreen(handleShareScreen);
    log('Subscribed to onShareScreen', 'info');
  } catch (error) {
    log(`Failed to subscribe to onShareScreen: ${error.message || error.name}`, 'warn');
  }
}

/**
 * Track a share ending from an onMeetingViewChange event. Exported for testing.
 *
 * The third of the three events that can report a share ending, kept because the
 * other two are refusable independently of it and none of them is delivered
 * everywhere. Only `presenting: false` is acted on — the event carries only the
 * parameters that changed, and a true would not tell us whose share it is (see
 * readPresentingState).
 *
 * @param {Object} event - OnMeetingViewChangeEvent
 */
export function handleMeetingViewChange(event) {
  if (event?.presenting !== false) return;
  markShareStopped('the meeting view reports no one presenting');
}

/**
 * Subscribe to meeting view updates. Desktop only, and non-fatal where it is
 * missing: the share state then falls back to onShareApp, to onShareScreen, and
 * to the check made before each stop.
 */
function subscribeToMeetingView() {
  if (!zoomSdk || typeof zoomSdk.onMeetingViewChange !== 'function') {
    log('onMeetingViewChange unavailable; share state will not follow Zoom\'s Stop Share', 'warn');
    return;
  }
  try {
    zoomSdk.onMeetingViewChange(handleMeetingViewChange);
    log('Subscribed to onMeetingViewChange', 'info');
  } catch (error) {
    log(`Failed to subscribe to onMeetingViewChange: ${error.message || error.name}`, 'warn');
  }
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
 * Track the app being hidden and shown again. Exported for testing.
 *
 * Coming back to the front is the one moment we know the user has been somewhere
 * else in Zoom — quite possibly Background & Effects, swapping the branded image
 * for one of their own or clearing it. Nothing reports that, so the only safe
 * move is to stop believing our record of what is on their video: the next push
 * then reapplies for real instead of being skipped as redundant.
 *
 * The same reasoning covers the share, which they may equally have stopped from
 * Zoom's toolbar while they were away — except that one the client can be asked
 * about outright, so it is reconciled rather than forgotten.
 *
 * @param {Object} event - OnAppVisibilityChangeEvent
 */
export function handleAppVisibilityChange(event) {
  if (event?.visible !== true) return;
  // Deliberately not awaited: this is an event handler, and the answer only has
  // to arrive before the organizer reaches for the share button.
  syncAppShareState();
  if (!activeOverlay) return;
  log('App back in front; forgetting what we believed was on the video', 'info');
  activeOverlay = null;
}

/**
 * Subscribe to app visibility. Desktop only, and non-fatal where it is missing:
 * camera mode never trusts the record anyway, so the loss is limited to card mode
 * skipping a redundant-looking push after the user edited their video filters.
 */
function subscribeToAppVisibility() {
  if (!zoomSdk || typeof zoomSdk.onAppVisibilityChange !== 'function') {
    log('onAppVisibilityChange unavailable; overlay state will not reset on refocus', 'warn');
    return;
  }
  try {
    zoomSdk.onAppVisibilityChange(handleAppVisibilityChange);
    log('Subscribed to onAppVisibilityChange', 'info');
  } catch (error) {
    log(`Failed to subscribe to onAppVisibilityChange: ${error.message || error.name}`, 'warn');
  }
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
 * Which of the APIs the app uses this client does not offer.
 *
 * Answered from config()'s refusal list, not from the presence of the method:
 * the npm SDK defines all of them on every client, so a presence check reported
 * a limited client as all-green.
 *
 * @returns {Array<{name: string, required: boolean, purpose: string}>}
 */
export function getMissingSdkApis() {
  if (!zoomSdk) return USED_SDK_APIS;
  return USED_SDK_APIS.filter((api) => !isApiAvailable(api.name));
}

/**
 * Get SDK status for debugging
 */
export function getSdkStatus() {
  const missingApis = getMissingSdkApis();
  const status = {
    initialized: sdkInitialized,
    available: sdkAvailable,
    sdkExists: typeof zoomSdk !== 'undefined',
    apiCount: USED_SDK_APIS.length,
    missingApis,
    // Kept because the video-off banner branches on it by name.
    hasSetVideoFilter: zoomSdk && typeof zoomSdk.setVideoFilter === 'function',
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
 * Whether something of ours is currently on the user's video.
 *
 * Callers use this to decide whether taking the overlay down is worth a
 * confirmation dialog, so it has to survive a reload. Zoom re-creates the app's
 * webview every time the panel is closed and reopened, which zeroes activeOverlay
 * while the virtual background it describes is still sitting on the organizer's
 * face. Reading only that in-memory record is what left a branded background up
 * for a whole meeting: idle or not, nothing believed there was anything to remove.
 *
 * Covers both pipelines, so callers no longer need a "card mode always clears"
 * special case to compensate for the filter being invisible here.
 *
 * @returns {boolean}
 */
export function isOverlayActive() {
  return activeOverlay !== null || virtualBackgroundApplied || videoFilterApplied;
}

/**
 * Run an overlay SDK operation, one at a time, dropping any *push* that a newer
 * request has already superseded.
 *
 * Each push is multiple MB across the webview -> native bridge and takes as long
 * as it takes. Without this, several pushes run concurrently and can land out of
 * order, leaving a stale color on screen after a newer one was requested.
 *
 * Only pushes are droppable. A queued removal must always run: it targets a
 * different pipeline than the push that outran it, so skipping it leaves a card
 * on the tile that nothing will ever take down. That is exactly how switching
 * to Timer + Camera could trap the full card over the organizer's face — the
 * mode switch queued the filter teardown, a status push landed behind it and
 * superseded it, and the teardown never ran. Per-second count-up pushes make
 * that race routine rather than rare.
 *
 * @param {Function} op - Async operation to run
 * @param {{supersedable?: boolean}} [options] - supersedable false marks a
 *   removal, which newer requests must never skip
 * @returns {Promise<void>}
 */
function enqueueOverlayOp(op, { supersedable = true } = {}) {
  const requestId = ++overlayRequestId;
  const run = () => {
    if (supersedable && requestId !== overlayRequestId) {
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
 *
 * Entering the stage starts nothing on its own — no share, no undocked window.
 * Those are actions the organizer takes from the stage itself, so that a screen
 * share is always something they pressed a button for. Leaving the stage does
 * unwind both, since neither should outlive the view that offered it.
 *
 * @param {string} mode - New overlay mode ('card', 'camera' or 'stage')
 * @param {string|null} currentImageUrl - Current image URL to reapply, or null to skip reapply
 * @returns {Promise<void>}
 */
export async function setOverlayMode(mode, currentImageUrl) {
  if (mode === currentOverlayMode) return;
  // Remove overlay using the old mode, captured now because currentOverlayMode
  // changes before the queued operation runs.
  const previousMode = currentOverlayMode;
  if (!isVideoOverlayMode(previousMode)) {
    await leaveStage();
  } else if (!isVideoOverlayMode(mode)) {
    // Entering the stage: clear both pipelines rather than just unwinding the
    // previous one, and do it outside the queue so no concurrent push can drop it.
    await clearVideoPipelines();
  } else {
    // Only the outgoing mode's pipeline: the incoming one is about to overwrite
    // its own, and setVirtualBackground replaces without a removal first.
    await enqueueOverlayOp(
      () => removeOverlayInternal(pipelinesForMode(previousMode), previousMode),
      { supersedable: false }
    );
  }
  currentOverlayMode = mode;

  // Reapply with new mode if an image URL is provided
  if (currentImageUrl) {
    await applyOverlay(currentImageUrl);
  }
}

// Zoom's code for "there was nothing applied", which is a normal outcome here,
// not a failure.
const ERROR_NOTHING_APPLIED = 10195;

/**
 * Take our branded background off by putting the user's own back, rather than
 * stripping their video to a bare camera.
 *
 * Replacing beats removing wherever it can. Someone who joined the meeting
 * blurred wants to leave it blurred; wiping them to None is a change they never
 * asked for and have to undo themselves, in a panel, mid-meeting.
 *
 * What is actually restorable is narrower than it looks, and the ceiling is
 * Zoom's, not ours:
 *
 * - Blur goes back exactly. It costs a confirmation dialog — setVirtualBackground
 *   documents the same 10017-on-deny as removal does for blur: true — so this is
 *   a better outcome for the same price, not a cheaper one.
 * - None is removal, which is what removal already means.
 * - One of their own images cannot be put back at all. setVirtualBackground takes
 *   imageData, a fileUrl or blur — never an id — and getVirtualBackgroundData,
 *   which would turn the id into pixels, is not in any shipped SDK build. The
 *   caller is told, so the organizer hears it from us rather than discovering it
 *   on their own tile.
 *
 * @returns {Promise<{lost: boolean}>} lost is true when the user's own image was
 *   dropped because Zoom offers no way to put it back.
 */
async function restoreOrRemoveBackground() {
  const previous = readPreviousBackground();

  if (previous?.type === 'blur' && isApiAvailable('setVirtualBackground')) {
    log('Restoring the blur the user had before', 'info');
    await zoomSdk.setVirtualBackground({ blur: true });
    return { lost: false };
  }

  const lost = previous?.type === 'image';
  if (lost) {
    log(`No way to put "${previous.name || 'the user\'s own background'}" back; removing instead`, 'warn');
  }
  await zoomSdk.removeVirtualBackground();
  return { lost };
}
// removeVirtualBackground always asks the user to confirm. This is them saying no.
const ERROR_REMOVAL_DECLINED = 10017;

/**
 * Clear the video pipelines: the timer card, and any virtual background of ours.
 *
 * Three callers, same requirement. Entering a stage mode must leave the user's
 * video completely untouched — that is the whole promise of share and popout:
 * your own face, your own background. The "Clear Background" button is the
 * organizer's way out when something of ours is stuck on their tile. And RESET
 * hands the video back on its way to zeroing the clock, since undoing a speech
 * that should not have started has to undo what the meeting could see of it.
 *
 * Only applicable pipelines are touched, and only genuine failures are reported:
 *
 * - The video filter is always attempted. Deleting one prompts for nothing and
 *   costs nothing, and it is the pipeline card mode uses.
 * - The virtual background is attempted only when one is believed to be up, or
 *   when the user asks from camera mode — the only mode that applies one. Asking
 *   Zoom to remove a background that was never there raises a pointless
 *   confirmation dialog and then errors.
 * - An error on a pipeline we did not believe was holding anything is not a
 *   failure, whatever code it carries. "Remove the thing that was not there"
 *   failing is the expected answer, and different clients word it differently;
 *   treating it as an error is what made the button report failure in card mode.
 * - A pipeline this client never granted us is reported as such rather than
 *   attempted. Calling a refused API rejects at the bridge with a code that
 *   looks like any other failure, and the advice that follows from it is
 *   completely different: no retry will ever work, and the only way out is
 *   Zoom's own Background & Effects panel.
 * - The background is checked against the video before being touched, on clients
 *   that can answer. A record that has gone stale — the user changed their
 *   background themselves, which nothing reports — otherwise costs them a
 *   confirmation dialog for a background of ours that is not even there.
 *
 * Bypasses the overlay queue for the same reason leaveStage does.
 *
 * @returns {Promise<{ok: boolean, declined: boolean, ungranted: string[], lostBackground: boolean}>}
 *   ok is false only when something we believed was applied would not come off;
 *   declined is true when the user dismissed Zoom's removal confirmation, which
 *   changed nothing; ungranted names the pipelines this client refuses to let the
 *   app touch while something of ours is believed to be on them; lostBackground
 *   is true when the user's own image could not be put back.
 */
export async function clearVideoPipelines() {
  await initializeZoomSdk();

  // What we believe is on each pipeline. Both records are persisted, because
  // Zoom reloads the webview whenever the panel is reopened — which is exactly
  // when an organizer reaches for this button.
  const hadFilter = videoFilterApplied;
  let hadBackground = virtualBackgroundApplied;
  activeOverlay = null;

  if (!sdkAvailable || !zoomSdk) {
    log('[MOCK] Would clear video filter and virtual background', 'warn');
    markVirtualBackgroundApplied(false);
    markVideoFilterApplied(false);
    return { ok: false, declined: false, ungranted: [], lostBackground: false };
  }

  // Ask the video rather than the record, where the client will answer. Only a
  // definite "no" is acted on: null means it could not say, which leaves the
  // record in charge exactly as before.
  if (hadBackground && (await isOurBackgroundApplied()) === false) {
    log('Zoom reports nothing of ours on the video; leaving the background alone', 'info');
    markVirtualBackgroundApplied(false);
    writePreviousBackground(null);
    hadBackground = false;
  }

  let lostBackground = false;

  // Independently attempted: one failing must not leave the other applied.
  //
  // Each pipeline is attempted only when it is holding something of ours. The
  // filter used to be attempted unconditionally, on the grounds that deleting
  // one is silent and free. It is neither: Zoom errors when there is nothing to
  // delete, and deleteVideoFilter is documented to delete filters set by other
  // apps and to set the user's Video Filters setting to None — so pressing the
  // eraser in camera mode reached past our own overlay and turned off a filter
  // the organizer had chosen themselves.
  const attempts = [];
  if (hadFilter) {
    attempts.push({
      what: 'video filter',
      expected: true,
      // deleteVideoFilter is the documented removal. setVideoFilter(null) is the
      // fallback for clients that granted the setter but not the deleter.
      api: isApiAvailable('deleteVideoFilter') ? 'deleteVideoFilter' : 'setVideoFilter',
      run: () =>
        isApiAvailable('deleteVideoFilter')
          ? zoomSdk.deleteVideoFilter()
          : zoomSdk.setVideoFilter({ fileUrl: null }),
    });
  }
  // On the record, never speculatively — the guard above has already downgraded
  // the record to a definite no wherever the client could answer. On clients
  // that cannot, the record is all there is: getVideoSettings reports camera,
  // HD, mirror and ratio, but nothing about the background. Asking anyway means
  // a "remove your virtual background?" dialog in front of someone who has no
  // virtual background at all.
  if (hadBackground) {
    attempts.push({
      what: 'virtual background',
      expected: true,
      api: 'removeVirtualBackground',
      run: async () => { lostBackground = (await restoreOrRemoveBackground()).lost; },
    });
  }

  let ok = true;
  let declined = false;
  const ungranted = [];
  // Only forget a pipeline once it is genuinely clear: a declined, refused or
  // failed removal leaves it up, and the next attempt still needs to know that.
  let backgroundGone = true;
  let filterGone = true;

  const stillThere = (what) => {
    if (what === 'virtual background') backgroundGone = false;
    else filterGone = false;
  };

  for (const { what, expected, api, run } of attempts) {
    if (!isApiAvailable(api)) {
      // Nothing to retry and nothing to apologise for when the pipeline was
      // empty anyway — this only matters when something of ours is on it.
      log(`Client did not grant ${api}; cannot clear the ${what}`, expected ? 'warn' : 'info');
      if (expected) {
        ungranted.push(what);
        stillThere(what);
      }
      continue;
    }
    try {
      const result = run();
      if (result) await result;
      log(`Cleared ${what}`, 'info');
    } catch (error) {
      const code = error.code ?? 'none';
      if (error.code === ERROR_REMOVAL_DECLINED) {
        log(`User declined to remove the ${what}`, 'info');
        declined = true;
        stillThere(what);
      } else if (error.code === ERROR_NOTHING_APPLIED || !expected) {
        log(`No ${what} to clear (code ${code})`, 'info');
      } else {
        log(`Could not clear ${what} (code ${code}): ${error.message || error.name}`, 'warn');
        ok = false;
        stillThere(what);
      }
    }
  }

  if (backgroundGone) {
    markVirtualBackgroundApplied(false);
    // Spent: the user is back on their own background, so there is nothing left
    // to restore them to. Keeping it would restore a stale choice next time.
    writePreviousBackground(null);
  }
  if (filterGone) markVideoFilterApplied(false);
  return { ok, declined, ungranted, lostBackground };
}

/**
 * Leave the stage: stop any share it started, and dock the window if it is out.
 * Neither should outlive the view that offered it — closing the stage while the
 * meeting is still watching it would be the worst kind of surprise.
 *
 * Deliberately NOT routed through enqueueOverlayOp. That queue drops any request
 * a newer one has superseded, which is right for image pushes and wrong here:
 * leaving the stage also flips React state, whose effects fire an applyOverlay
 * for the incoming mode. That push bumps the request id and the queued teardown
 * is skipped — the visible symptom being an X button that closes the stage while
 * the meeting is still being shared.
 */
export async function leaveStage() {
  await initializeZoomSdk();
  activeOverlay = null;

  // Stop first, dock second: the share is what the meeting can see.
  if (appShareActive) await setAppShare(false);
  if (appPoppedOut) await setAppPopout(false);
}

/**
 * Which pipeline a video mode drives. Used to tear down only what the outgoing
 * mode put up: the incoming one overwrites its own pipeline on the next push, so
 * removing it first would be a confirmation dialog in exchange for nothing.
 *
 * @param {string} mode
 * @returns {{filter: boolean, background: boolean}}
 */
function pipelinesForMode(mode) {
  return { filter: mode === OVERLAY_MODE_CARD, background: mode === OVERLAY_MODE_CAMERA };
}

// Both pipelines, for callers that want the video handed back whole rather than
// one mode's worth of it.
const ALL_PIPELINES = { filter: true, background: true };

/**
 * Take our overlay off the pipelines named, and only where one of ours is up.
 *
 * Nothing is removed speculatively. A removal aimed at an empty pipeline is not
 * free: Zoom errors on it, a background removal costs the user a confirmation
 * dialog before it even fails, and deleteVideoFilter is documented to delete
 * filters set by other apps and to set the user's Video Filters setting to None
 * — so an unconditional call reaches past our own overlay into their setup.
 *
 * Which pipelines to consider is the caller's to say, because the two callers
 * genuinely differ. A mode switch tears down the mode it is leaving. Handing the
 * video back — a finished speech, the eraser — takes off whatever is there,
 * since to the organizer a filter and a background are the same branded card.
 *
 * @param {{filter: boolean, background: boolean}} pipelines
 * @param {string} label - What is being torn down, for the log
 */
async function removeOverlayInternal(pipelines, label) {
  await initializeZoomSdk();

  const hadFilter = pipelines.filter && videoFilterApplied;
  const hadBackground = pipelines.background && virtualBackgroundApplied;
  const mode = label;

  // Clear this up front: once removal is requested, nothing is considered
  // applied, even if the removal itself fails because there was no overlay.
  activeOverlay = null;

  try {
    if (sdkAvailable && zoomSdk) {
      if (!hadFilter && !hadBackground) {
        log(`Nothing of ours on the video; nothing to remove (mode: ${mode})`, 'info');
      }
      if (hadBackground) {
        if (!isApiAvailable('removeVirtualBackground')) {
          log('Client did not grant removeVirtualBackground; leaving the background in place', 'warn');
        } else if ((await isOurBackgroundApplied()) === false) {
          // Must not put a dialog in front of someone whose background is
          // already their own.
          log('Zoom reports the background is not ours; leaving it alone', 'info');
          markVirtualBackgroundApplied(false);
          writePreviousBackground(null);
        } else {
          log('Putting the user\'s own background back', 'info');
          await restoreOrRemoveBackground();
          markVirtualBackgroundApplied(false);
          writePreviousBackground(null);
          log('Successfully cleared our virtual background', 'info');
        }
      }
      if (hadFilter) {
        if (isApiAvailable('deleteVideoFilter')) {
          log('Deleting video filter', 'info');
          await zoomSdk.deleteVideoFilter();
          markVideoFilterApplied(false);
          log('Successfully deleted video filter', 'info');
        } else if (isApiAvailable('setVideoFilter')) {
          log('Removing video filter via setVideoFilter(null)', 'info');
          await zoomSdk.setVideoFilter({ fileUrl: null });
          markVideoFilterApplied(false);
          log('Successfully removed video filter', 'info');
        } else {
          log('Client did not grant deleteVideoFilter; leaving the filter in place', 'warn');
        }
      }
    } else {
      log(`[MOCK] Would remove overlay (mode: ${mode}, SDK not available)`, 'warn');
    }
  } catch (error) {
    log(`Failed to remove overlay (mode: ${mode}): ${error.message || error.name}`, 'error');
    if (error.code) {
      log(`Error code: ${error.code}`, 'error');
      if (error.code === ERROR_NOTHING_APPLIED) {
        log('No overlay exists to remove', 'warn');
        // Nothing was there, so stop recording one. Otherwise a flag left true
        // by an overlay the user cleared themselves would ask Zoom to remove it
        // — and prompt them for it — on every idle moment from here on. Only
        // the pipelines this call was asked about: the other was never touched
        // and its record is still the best thing we have.
        if (pipelines.background) markVirtualBackgroundApplied(false);
        if (pipelines.filter) markVideoFilterApplied(false);
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
 *
 * This is only ever an optimization, and a distrusted one: what is on the user's
 * video is Zoom's state, not ours, and the user can change it at any time through
 * Zoom's own UI without a word to the app. Skipping a push on the strength of a
 * record that has quietly gone stale is what left the branded image off for the
 * rest of a meeting.
 *
 * So it never speaks for camera mode: Background & Effects is a panel the user
 * visits, and a virtual background is pushed by fileUrl, costing no pixels across
 * the bridge — there is nothing worth protecting there. Card mode keeps the guard
 * because a video filter ships megabytes of ImageData, and the record is dropped
 * there too whenever the app comes back to the front.
 *
 * Two call sites pushing the same color at once are collapsed by the overlay
 * queue, which drops superseded requests, so that is not this function's job.
 *
 * @param {string} imageUrl
 * @returns {boolean}
 */
function isAlreadyShowing(imageUrl) {
  if (currentOverlayMode === OVERLAY_MODE_CAMERA) return false;
  if (!activeOverlay) return false;
  if (activeOverlay.url !== imageUrl || activeOverlay.mode !== currentOverlayMode) return false;
  // A frame carrying a different time readout is a different frame — and so is
  // one carrying the same readout somewhere else or at another size, right
  // after a drag or a +/- press.
  if ((activeOverlay.label ?? null) !== effectiveTimeLabel()) return false;
  if (
    activeOverlay.label &&
    (activeOverlay.position?.x !== overlayTimePosition.x ||
      activeOverlay.position?.y !== overlayTimePosition.y ||
      activeOverlay.scale !== overlayTimeScale)
  ) {
    return false;
  }
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
  await initializeZoomSdk();

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
      // Camera mode degrades to the filter pipeline on clients that refuse
      // setVirtualBackground: the face is lost but the color signal — the whole
      // point of the timer — survives. Camera is the default mode now, so a
      // silent no-op here would mean a first-run organizer sees nothing at all.
      const cameraModeGranted =
        currentOverlayMode === OVERLAY_MODE_CAMERA && isApiAvailable('setVirtualBackground');
      if (currentOverlayMode === OVERLAY_MODE_CAMERA && !cameraModeGranted && isApiAvailable('setVideoFilter')) {
        log('Client did not grant setVirtualBackground; showing Timer + Camera as a plain card', 'warn');
      }
      if (cameraModeGranted) {
        // Before the first push of a session, and never once ours is up: what
        // is on the video now is theirs, and it is the only chance to learn
        // what to put back. No-ops on clients that cannot report it.
        if (!virtualBackgroundApplied) await snapshotUserBackground();
        const label = effectiveTimeLabel();
        // setVirtualBackground accepts a fileUrl, which lets the Zoom client
        // fetch the image itself. That skips both the decode and the multi-MB
        // ImageData transfer across the bridge — but only a frame with nothing
        // baked into it can take it. While a speech runs, the frame carries the
        // count-up and is different every second, so the pixels have to cross.
        if (!label) {
          try {
            log(`Applying virtual background by fileUrl: ${imageUrl}`, 'info');
            const result = await zoomSdk.setVirtualBackground({ fileUrl: imageUrl });
            log(`Successfully applied virtual background by fileUrl. Result: ${JSON.stringify(result)}`, 'info');
            // No pixels pushed, so no budget to go stale.
            activeOverlay = { url: imageUrl, mode: currentOverlayMode, budget: null, pipeline: 'background' };
            markVirtualBackgroundApplied(true);
            lastError = null;
            return;
          } catch (fileUrlError) {
            // The native client may not be able to reach the URL (restricted
            // network, proxy, TLS inspection). Fall back to shipping the pixels.
            log(`fileUrl virtual background failed: ${fileUrlError.message || fileUrlError.name}. Falling back to imageData.`, 'warn');
          }
        }

        log(`Loading image for overlay (mode: ${currentOverlayMode}): ${imageUrl}`, 'info');
        const budget = getOverlayBudget();
        const imageData = await loadImageAsImageData(imageUrl);
        log(`Loaded ImageData: ${imageData.width}x${imageData.height}`, 'info');
        let frame = imageData;
        if (label) {
          try {
            frame = renderTimeOnFrame(imageData, label);
          } catch (error) {
            // The readout is a bonus; the color is the signal. Push the plain
            // background rather than nothing.
            log(`Could not render the time onto the background: ${error.message || error.name}`, 'warn');
          }
        }
        const result = await zoomSdk.setVirtualBackground({ imageData: frame });
        log(`Successfully applied virtual background. Result: ${JSON.stringify(result)}`, 'info');
        activeOverlay = { url: imageUrl, mode: currentOverlayMode, budget, pipeline: 'background', label, position: overlayTimePosition, scale: overlayTimeScale };
        markVirtualBackgroundApplied(true);
        lastError = null;
        return;
      } else {
        // Card pipeline: setVideoFilter covers the entire video. Both Timer
        // Only and a degraded Timer + Camera land here.
        if (isApiAvailable('setVideoFilter')) {
          log(`Loading image for overlay (mode: ${currentOverlayMode}): ${imageUrl}`, 'info');
          const budget = getOverlayBudget();
          const imageData = await loadImageAsImageData(imageUrl);
          log(`Loaded ImageData: ${imageData.width}x${imageData.height}`, 'info');
          // Bake the count-up into the frame while a speech is running, so the
          // participants watching the card see the time too, not just the color.
          const label = effectiveTimeLabel();
          let frame = imageData;
          if (label) {
            try {
              frame = renderTimeOnFrame(imageData, label);
            } catch (error) {
              // The readout is a bonus; the color is the signal. Push the
              // plain card rather than nothing.
              log(`Could not render the time onto the card: ${error.message || error.name}`, 'warn');
            }
          }
          const result = await zoomSdk.setVideoFilter({ imageData: frame });
          log(`Successfully applied video filter overlay. Result: ${JSON.stringify(result)}`, 'info');
          activeOverlay = { url: imageUrl, mode: currentOverlayMode, budget, pipeline: 'filter', label, position: overlayTimePosition, scale: overlayTimeScale };
          markVideoFilterApplied(true);
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
 * Hand the organizer their video back: take off whichever pipeline is holding
 * our card.
 *
 * Both are considered, not just the current mode's. "Show your own background"
 * is a promise about their face, and an organizer who was in camera mode earlier
 * in the meeting does not think of the leftover as a background — they think of
 * it as the timer still being on them.
 *
 * @returns {Promise<void>}
 */
export function removeOverlay() {
  const mode = currentOverlayMode;
  // On the stage there is no overlay to remove: the color is DOM, and the share
  // and the window are the organizer's to end, not something a status change or
  // a finished speech should tear down under them.
  if (!isVideoOverlayMode(mode)) return Promise.resolve();
  return enqueueOverlayOp(() => removeOverlayInternal(ALL_PIPELINES, mode), { supersedable: false });
}

/**
 * Get current video state (on/off)
 * @returns {Promise<boolean | null>} True if video is on, false if off, null if unable to determine
 */
export async function getVideoState() {
  // Ensure SDK is initialized first
  await initializeZoomSdk();

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
  await initializeZoomSdk();

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

// Roles Zoom lets call getMeetingParticipants. The SDK documents role as
// 'host' | 'coHost' | 'attendee' | 'panelist'; compared case- and
// punctuation-insensitively because clients have spelled co-host both ways.
const ROLES_THAT_CAN_LIST_PARTICIPANTS = ['host', 'cohost'];

const normalizeRole = (role) =>
  typeof role === 'string' ? role.toLowerCase().replace(/[^a-z]/g, '') : '';

/** One participant, from either API's field names. */
const toParticipant = (p, index) => ({
  id: p.participantUUID || p.participantId || p.userId || p.id || `user-${index}`,
  name: p.screenName || p.displayName || p.userName || p.name || 'Unknown',
});

/**
 * Everyone in the meeting, the app's own user included.
 *
 * Two APIs, because neither covers the room on its own: getMeetingParticipants
 * returns everybody *except* the caller, and getUserContext returns only the
 * caller. Merging them is what puts the organizer in their own speaker list,
 * which is where the name they most often need to time actually lives.
 *
 * They also differ in who may call them, and that is what `restricted` reports.
 * getUserContext works for every role; getMeetingParticipants is documented
 * host and co-host only. A timer run by someone who is neither used to get an
 * empty list and no reason for it.
 *
 * @returns {Promise<{participants: Array<{id: string, name: string}>, role: string, restricted: boolean}>}
 *   restricted is true when the full list was withheld because of the caller's
 *   role, which is the one cause the organizer can do something about.
 */
export async function getZoomParticipants() {
  // Waited on, not merely checked. SpeakerInput asks for this from a mount
  // effect, and main.jsx deliberately renders before it starts SDK init — so
  // this call has always landed inside that gap, read sdkAvailable as false and
  // returned an empty list. It is fetched once, so there was no second attempt
  // to correct it, and the suggestions stayed empty for the whole meeting.
  await initializeZoomSdk();

  if (!sdkAvailable) {
    log('[MOCK] SDK is not available; no participants to report.', 'warn');
    return { participants: [], role: '', restricted: false };
  }

  // Self first: it works for every role, so the list is never empty just
  // because the organizer is not hosting.
  let self = null;
  let role = '';
  if (isApiAvailable('getUserContext')) {
    try {
      const context = await zoomSdk.getUserContext();
      role = normalizeRole(context?.role);
      // Same read the share events need to tell our own share from anyone
      // else's; caching it here spares a second call for it.
      selfParticipantUUID = selfParticipantUUID || context?.participantUUID || context?.participantId || null;
      if (context?.screenName) self = toParticipant(context, 0);
      else log('getUserContext returned no screenName; leaving yourself out of the list', 'warn');
    } catch (error) {
      log(`Could not read your own user context: ${error.message || error.name} (code ${error.code ?? 'none'})`, 'warn');
    }
  } else {
    // Silent before: the one branch that produces a missing name with nothing
    // in the log to explain it. Almost always the capability not being enabled
    // on the Marketplace listing, which no amount of retrying fixes.
    log('getUserContext not granted by this client; your own name will be missing from the list', 'warn');
  }

  // getMeetingParticipants, not getParticipants: the latter is not an API the
  // SDK has, so this call threw every time and the suggestions were always
  // empty.
  let others = [];
  let listFailed = false;
  try {
    const response = await zoomSdk.getMeetingParticipants();
    if (Array.isArray(response?.participants)) {
      others = response.participants.map(toParticipant);
    }
  } catch (error) {
    listFailed = true;
    log(`Could not list meeting participants: ${error.message || error.name} (code ${error.code ?? 'none'})`, 'warn');
  }

  // Attempted regardless of role rather than skipped on one: the role string is
  // the client's to spell, and a refusal we can see beats a list we withheld on
  // a guess. The role only decides what the organizer is told afterwards.
  const restricted =
    listFailed && Boolean(role) && !ROLES_THAT_CAN_LIST_PARTICIPANTS.includes(role);
  if (restricted) {
    log(`Participant list needs host or co-host; this account is "${role}"`, 'warn');
  }

  // Self first so the organizer's own name leads the list, then dedupe: a
  // client that does include the caller in getMeetingParticipants must not
  // produce them twice.
  const seen = new Set();
  const participants = [self, ...others].filter(Boolean).filter((person) => {
    const key = person.id || person.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { participants, role, restricted };
}
