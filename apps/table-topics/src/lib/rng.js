/**
 * Deterministic randomness shared by the build script and the browser.
 * Same seed → same sequence everywhere, which is what makes "Today's set"
 * identical for every visitor and reproducible in tests.
 */

/** FNV-1a 32-bit hash of a string → unsigned 32-bit integer. */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [0, n). */
export function pickIndex(rng, n) {
  return Math.floor(rng() * n);
}

/** Seeded Fisher–Yates shuffle; returns a new array. */
export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
