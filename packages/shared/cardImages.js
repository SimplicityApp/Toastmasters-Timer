// Timing-card artwork selection: which set of card images the timer shows.
//
// Two built-in sets ship with the app as static files under /backgrounds; the
// organizer can also add custom sets of uploaded images. Uploads are stored as
// data: URLs because neither app has a backend for them: localStorage is the
// only durable store both the web timer and the Zoom webview have, and a
// data: URL is a src every consumer already accepts — <img>, CSS url(), and
// the overlay decode path.

const CUSTOM_CARD_IMAGES_KEY = 'toastmaster_custom_card_images';

export const CARD_COLORS = ['blue', 'green', 'yellow', 'red'];

// Cache-buster for the built-in files. They are served with
// `max-age=31536000, immutable`, so this must be bumped whenever their
// content changes or existing clients keep the old asset for a year.
export const CARD_ASSET_VERSION = '3';

// The built-in sets, in the order the picker shows them. File names are
// relative to the backgrounds directory each app serves them from.
export const DEFAULT_CARD_SETS = [
  {
    id: 'classic',
    label: 'Classic',
    files: {
      blue: 'timer-blue-background.png',
      green: 'timer-green-background.png',
      yellow: 'timer-yellow-background.png',
      red: 'timer-red-background.png',
    },
  },
  {
    id: 'modern',
    label: 'Modern',
    files: {
      blue: 'timer-blue-modern.png',
      green: 'timer-green-modern.png',
      yellow: 'timer-yellow-modern.png',
      red: 'timer-red-modern.png',
    },
  },
];

const DEFAULT_SET_ID = DEFAULT_CARD_SETS[0].id;
const CLASSIC_FILES = DEFAULT_CARD_SETS[0].files;

function getDefaultCardSet(id) {
  return DEFAULT_CARD_SETS.find((set) => set.id === id) || null;
}

// A stored value must already be a decodable image src. Guards against a
// corrupted entry wedging the overlay pipeline: a bad src fails every push
// for that color until the user finds and clears it by hand.
function isCardDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

// Uploads are re-encoded to fit this box before storing. 1280x720 matches the
// built-in cards and the Zoom overlay pipeline's own working size; anything
// larger would only be downscaled again on every push, while costing
// localStorage quota (~5MB total) that the custom sets have to share.
const CARD_MAX_WIDTH = 1280;
const CARD_MAX_HEIGHT = 720;
const CARD_JPEG_QUALITY = 0.85;

/**
 * Keep only what the rest of the app can trust: known set ids, custom sets
 * with at least one valid data URL, and a selection that points at a set
 * that actually exists.
 */
function normalizeSettings(raw) {
  const settings = { selectedSetId: DEFAULT_SET_ID, customSets: [] };
  if (!raw || typeof raw !== 'object') return settings;

  if (Array.isArray(raw.customSets)) {
    for (const set of raw.customSets) {
      if (!set || typeof set.id !== 'string' || !set.id.startsWith('custom-')) continue;
      const images = {};
      for (const color of CARD_COLORS) {
        if (isCardDataUrl(set.images?.[color])) images[color] = set.images[color];
      }
      if (Object.keys(images).length > 0 && !settings.customSets.some((s) => s.id === set.id)) {
        settings.customSets.push({ id: set.id, images });
      }
    }
  }

  const selected = raw.selectedSetId;
  if (getDefaultCardSet(selected) || settings.customSets.some((s) => s.id === selected)) {
    settings.selectedSetId = selected;
  }
  return settings;
}

/**
 * Read the stored settings straight from localStorage. The pre-set format
 * (a plain color -> data URL map of per-color overrides) migrates into one
 * selected custom set, so earlier uploads keep showing.
 * @returns {{selectedSetId: string, customSets: Array<{id: string, images: Object<string, string>}>}}
 */
export function loadCardImageSettings() {
  try {
    const raw = localStorage.getItem(CUSTOM_CARD_IMAGES_KEY);
    if (!raw) return normalizeSettings(null);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !('customSets' in parsed) && !('selectedSetId' in parsed)) {
      const images = {};
      for (const color of CARD_COLORS) {
        if (isCardDataUrl(parsed[color])) images[color] = parsed[color];
      }
      if (Object.keys(images).length > 0) {
        return normalizeSettings({ selectedSetId: 'custom-1', customSets: [{ id: 'custom-1', images }] });
      }
      return normalizeSettings(null);
    }
    return normalizeSettings(parsed);
  } catch (error) {
    console.error('Failed to load card image settings:', error);
    return normalizeSettings(null);
  }
}

// Module-level cache, so per-second render paths can ask without re-parsing
// what can be megabytes of JSON. Lazy: nothing pays the parse until the
// first card is actually resolved.
let settingsCache = null;

/**
 * The stored settings, cached. Callers on hot paths (status changes, page
 * background updates) use this rather than loadCardImageSettings().
 */
export function getCardImageSettings() {
  if (settingsCache === null) settingsCache = loadCardImageSettings();
  return settingsCache;
}

/**
 * Persist the settings and refresh the cache. With the default set selected
 * and no custom sets left the key is removed outright.
 *
 * @returns {boolean} false when storage refused it — in practice a quota
 *   overflow, which the caller should tell the user about rather than
 *   silently losing their upload
 */
export function saveCardImageSettings(settings) {
  const normalized = normalizeSettings(settings);
  try {
    if (normalized.selectedSetId === DEFAULT_SET_ID && normalized.customSets.length === 0) {
      localStorage.removeItem(CUSTOM_CARD_IMAGES_KEY);
    } else {
      localStorage.setItem(CUSTOM_CARD_IMAGES_KEY, JSON.stringify(normalized));
    }
    settingsCache = normalized;
    return true;
  } catch (error) {
    console.error('Failed to save card image settings:', error);
    // The cache must keep describing what is actually stored.
    settingsCache = null;
    return false;
  }
}

/**
 * An id no existing custom set uses.
 */
export function nextCustomSetId(customSets) {
  let n = 1;
  const taken = new Set((customSets || []).map((set) => set.id));
  while (taken.has(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

/**
 * The image the selected set shows for a color: an uploaded data URL, or the
 * file name of a built-in card. A custom set missing this color falls back to
 * the classic file, so a partial set still covers every status; an unknown
 * color falls back to blue, the card the timer opens on.
 *
 * @param {string} color
 * @returns {{dataUrl: string} | {file: string}}
 */
export function resolveCardImage(color) {
  const { selectedSetId, customSets } = getCardImageSettings();
  const defaultSet = getDefaultCardSet(selectedSetId);
  if (defaultSet) {
    return { file: defaultSet.files[color] || defaultSet.files.blue };
  }
  const custom = customSets.find((set) => set.id === selectedSetId);
  if (custom && isCardDataUrl(custom.images[color])) {
    return { dataUrl: custom.images[color] };
  }
  return { file: CLASSIC_FILES[color] || CLASSIC_FILES.blue };
}

/**
 * Turn an uploaded file into the data URL the store takes: decoded, scaled to
 * fit the card box, and re-encoded as JPEG. Re-encoding is not optional — a
 * phone photo is many MB and would blow the localStorage quota on its own,
 * and re-encoding also strips whatever metadata the file carried.
 *
 * @param {File|Blob} file - The upload, any image type the browser decodes
 * @returns {Promise<string>} data URL ready for saveCardImageSettings
 */
export function fileToCardDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: width, naturalHeight: height } = img;
      if (!width || !height) {
        reject(new Error('The file did not decode as an image'));
        return;
      }
      const scale = Math.min(1, CARD_MAX_WIDTH / width, CARD_MAX_HEIGHT / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      // JPEG has no alpha, so transparency would encode as black; white is
      // what a transparent logo on a timing card is drawn against.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', CARD_JPEG_QUALITY));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The file could not be read as an image'));
    };
    img.src = objectUrl;
  });
}
