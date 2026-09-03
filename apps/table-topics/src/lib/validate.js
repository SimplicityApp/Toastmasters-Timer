import { normalizeText, tokenJaccard } from './normalize.js';

export const DEFAULT_RULES = {
  minPerCategory: 15,
  // Ceiling per category: enough for years of weekly meetings without repeats,
  // and it keeps the bank (and the category pages) from growing forever. The
  // weekly routine skips categories that are full.
  maxPerCategory: 80,
  minLen: 10,
  maxLen: 140,
  fuzzyThreshold: 0.8,
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the whole question bank. Returns a list of human-readable problems;
 * an empty list means the bank is publishable. Pure: no I/O.
 */
export function validateBank(bank, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const problems = [];
  const add = (msg) => problems.push(msg);

  if (!bank || typeof bank !== 'object' || !Array.isArray(bank.categories)) {
    return ['bank.categories must be an array'];
  }
  if (bank.categories.length === 0) add('bank has no categories');

  const slugs = new Set();
  const ids = new Set();
  const seenNormalized = new Map(); // normalized text -> id
  const all = []; // { id, text }

  bank.categories.forEach((cat, ci) => {
    const where = `categories[${ci}]`;
    if (!cat || typeof cat !== 'object') return add(`${where} is not an object`);
    if (typeof cat.slug !== 'string' || !SLUG_RE.test(cat.slug)) add(`${where}.slug invalid: ${JSON.stringify(cat.slug)}`);
    else if (slugs.has(cat.slug)) add(`duplicate category slug: ${cat.slug}`);
    else slugs.add(cat.slug);
    if (typeof cat.name !== 'string' || !cat.name.trim()) add(`${where}.name missing`);
    if (typeof cat.description !== 'string' || cat.description.trim().length < 20) add(`${where}.description missing or too short (min 20 chars)`);
    if (!Array.isArray(cat.questions)) return add(`${where}.questions must be an array`);
    if (cat.questions.length < r.minPerCategory) add(`${cat.slug}: only ${cat.questions.length} questions (min ${r.minPerCategory})`);
    if (cat.questions.length > r.maxPerCategory) add(`${cat.slug}: ${cat.questions.length} questions exceeds the ceiling of ${r.maxPerCategory}`);

    const idRe = new RegExp(`^${cat.slug}-\\d{3}$`);
    cat.questions.forEach((q, qi) => {
      const qwhere = `${cat.slug}[${qi}]`;
      if (!q || typeof q !== 'object') return add(`${qwhere} is not an object`);
      if (typeof q.id !== 'string' || !idRe.test(q.id)) add(`${qwhere}.id must match ${cat.slug}-NNN, got ${JSON.stringify(q.id)}`);
      else if (ids.has(q.id)) add(`duplicate id: ${q.id}`);
      else ids.add(q.id);
      if (typeof q.added !== 'string' || !DATE_RE.test(q.added) || Number.isNaN(Date.parse(q.added))) add(`${qwhere}.added must be YYYY-MM-DD`);
      if (typeof q.text !== 'string') return add(`${qwhere}.text missing`);
      const text = q.text;
      if (text !== text.trim()) add(`${q.id}: text has leading/trailing whitespace`);
      if (text.length < r.minLen) add(`${q.id}: text shorter than ${r.minLen} chars`);
      if (text.length > r.maxLen) add(`${q.id}: text longer than ${r.maxLen} chars (${text.length})`);
      if (!text.trim().endsWith('?')) add(`${q.id}: text must end with '?'`);
      if (/\s{2,}/.test(text)) add(`${q.id}: text has double spaces`);
      const norm = normalizeText(text);
      if (seenNormalized.has(norm)) add(`${q.id}: duplicate of ${seenNormalized.get(norm)}`);
      else seenNormalized.set(norm, q.id);
      all.push({ id: q.id, text });
    });
  });

  // Near-duplicates across the whole bank. O(n²) but n is a few thousand at most.
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (normalizeText(all[i].text) === normalizeText(all[j].text)) continue; // already reported
      const sim = tokenJaccard(all[i].text, all[j].text);
      if (sim >= r.fuzzyThreshold) {
        add(`${all[j].id}: near-duplicate of ${all[i].id} (similarity ${sim.toFixed(2)})`);
      }
    }
  }

  return problems;
}

/** Next free id for a category, e.g. 'travel-021'. */
export function nextId(category) {
  let max = 0;
  for (const q of category.questions) {
    const m = /-(\d{3})$/.exec(q.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${category.slug}-${String(max + 1).padStart(3, '0')}`;
}
