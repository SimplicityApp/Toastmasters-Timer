import { getCardImageUrl } from './cardArtwork';

const STATUS_COLORS = {
  blue: '#1e3a5f',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#dc2626',
};

const DEFAULT_BG = '#ffffff';

/**
 * Set document body background from timer status (blue/green/yellow/red).
 *
 * The selected card set's image for this status shows full-bleed behind the
 * app. The flat status color is always set underneath the image, so the
 * signal stays correct while the image paints — and if it ever fails to.
 *
 * @param {'blue' | 'green' | 'yellow' | 'red'} status
 */
export function setPageBackgroundFromStatus(status) {
  if (typeof document === 'undefined') return;
  const color = STATUS_COLORS[status] || DEFAULT_BG;
  document.body.style.backgroundColor = color;
  const cardImage = getCardImageUrl(status);
  if (cardImage) {
    document.body.style.backgroundImage = `url("${cardImage}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else {
    document.body.style.backgroundImage = '';
  }
}

/**
 * Reset body background to default (e.g. when leaving /app).
 */
export function resetPageBackground() {
  if (typeof document === 'undefined') return;
  document.body.style.backgroundColor = DEFAULT_BG;
  document.body.style.backgroundImage = '';
}
