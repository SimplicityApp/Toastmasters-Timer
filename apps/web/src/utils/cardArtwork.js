import { CARD_COLORS, CARD_ASSET_VERSION, resolveCardImage } from '@toastmaster-timer/shared';

/**
 * URL of one built-in card file. The zoom app's background assets are served
 * under /zoom/ on this origin in both dev (the serveZoomPublic middleware in
 * vite.config.js) and production (combine:dist), so the web timer shows the
 * same artwork without shipping a second copy.
 */
export function getCardAssetUrl(file) {
  return `/zoom/backgrounds/${file}?v=${CARD_ASSET_VERSION}`;
}

/**
 * The image the timer shows for a status, from whichever card set is
 * selected: an uploaded data: URL or a built-in file URL. Undefined for
 * anything that is not a card color, so non-status states keep their
 * flat styling.
 */
export function getCardImageUrl(status) {
  if (!CARD_COLORS.includes(status)) return undefined;
  const resolved = resolveCardImage(status);
  return resolved.url || getCardAssetUrl(resolved.file);
}

/**
 * Warm the fetch and decode caches for every card of the selected set, so a
 * status switch (blue -> green -> yellow -> red) never waits on a network
 * round trip or a first decode — the same idea as the Zoom app's overlay
 * pre-load. Call after init and again whenever the selected set changes.
 * Fire-and-forget: a failure just means that card pays its decode when first
 * shown, which is where it already was.
 */
export function preloadCardImages() {
  for (const color of CARD_COLORS) {
    const url = getCardImageUrl(color);
    if (!url) continue;
    const img = new Image();
    img.src = url;
    img.decode?.().catch(() => {});
  }
}
