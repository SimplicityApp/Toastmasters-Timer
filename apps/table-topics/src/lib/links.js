/**
 * The exact role key in the timer's DEFAULT_ROLE_RULES. The timer matches it
 * verbatim; do not send 'Table Topics' (that string is not a rules key).
 */
export const TABLE_TOPICS_ROLE = 'Table Topics Speech';

/** Deep link that opens the web timer with the Table Topics preset and the question as the speaker line. */
export function timerDeepLink(text, timerAppUrl) {
  const params = new URLSearchParams({ role: TABLE_TOPICS_ROLE, name: text });
  return `${timerAppUrl}?${params.toString().replace(/\+/g, '%20')}`;
}

/** Shareable link to one question on a given page (`path` starts with '/'). */
export function shareLink(origin, path, id) {
  return `${origin}${path}?q=${encodeURIComponent(id)}`;
}
