import { hashSeed, mulberry32, pickIndex, shuffle } from './rng.js';

/** Flatten the bank into one pool, tagging each question with its category. */
export function flattenQuestions(categories) {
  const pool = [];
  for (const cat of categories) {
    for (const q of cat.questions) {
      pool.push({ ...q, category: cat.slug, categoryName: cat.name });
    }
  }
  return pool;
}

/**
 * Draw one question from a pool. `seed` may be a string or a number; the same
 * seed always yields the same question. `excludeId` avoids showing the same
 * question twice in a row when the pool has more than one entry.
 */
export function drawQuestion(pool, seed, excludeId = null) {
  if (!pool.length) return null;
  const rng = mulberry32(typeof seed === 'number' ? seed : hashSeed(String(seed)));
  let candidates = pool;
  if (excludeId && pool.length > 1) {
    candidates = pool.filter((q) => q.id !== excludeId);
  }
  return candidates[pickIndex(rng, candidates.length)];
}

/** 'YYYY-MM-DD' in UTC, so every visitor worldwide gets the same day's set. */
export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * The day's set: `n` questions chosen deterministically from the date, spread
 * across categories (one per category first, then fill from the remainder).
 */
export function todaySet(categories, dateStr, n = 10) {
  const rng = mulberry32(hashSeed(`today:${dateStr}`));
  const shuffled = shuffle(flattenQuestions(categories), rng);
  const picked = [];
  const seenCategories = new Set();
  for (const q of shuffled) {
    if (picked.length >= n) break;
    if (!seenCategories.has(q.category)) {
      seenCategories.add(q.category);
      picked.push(q);
    }
  }
  if (picked.length < n) {
    const pickedIds = new Set(picked.map((q) => q.id));
    for (const q of shuffled) {
      if (picked.length >= n) break;
      if (!pickedIds.has(q.id)) picked.push(q);
    }
  }
  return picked;
}
