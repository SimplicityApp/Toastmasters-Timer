const STATUS_COLORS = {
  blue: '#1e3a5f',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#dc2626',
};

const DEFAULT_BG = '#ffffff';

/**
 * Set document body background color from timer status (blue/green/yellow/red).
 * @param {'blue' | 'green' | 'yellow' | 'red'} status
 */
export function setPageBackgroundFromStatus(status) {
  if (typeof document === 'undefined') return;
  const color = STATUS_COLORS[status] || DEFAULT_BG;
  document.body.style.backgroundColor = color;
}

/**
 * Reset body background to default (e.g. when leaving /app).
 */
export function resetPageBackground() {
  if (typeof document === 'undefined') return;
  document.body.style.backgroundColor = DEFAULT_BG;
}
