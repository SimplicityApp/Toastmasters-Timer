/** Lowercase, strip punctuation, collapse whitespace — the key used for duplicate detection. */
export function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenSet(text) {
  return new Set(normalizeText(text).split(' ').filter(Boolean));
}

/** Jaccard similarity of the two token sets, in [0, 1]. */
export function tokenJaccard(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size && !sb.size) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}
