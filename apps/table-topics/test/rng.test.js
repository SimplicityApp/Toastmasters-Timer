import { describe, it, expect } from 'vitest';
import { hashSeed, mulberry32, pickIndex, shuffle } from '../src/lib/rng.js';

describe('rng', () => {
  it('hashSeed is deterministic and spreads nearby strings', () => {
    expect(hashSeed('today:2026-09-02')).toBe(hashSeed('today:2026-09-02'));
    expect(hashSeed('today:2026-09-02')).not.toBe(hashSeed('today:2026-09-03'));
    expect(hashSeed('')).toBeGreaterThanOrEqual(0);
  });

  it('mulberry32 yields the same sequence for the same seed, in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('pickIndex stays in range', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const idx = pickIndex(rng, 5);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5);
    }
  });

  it('shuffle is a permutation and does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.slice().sort((x, y) => x - y)).toEqual(input);
    expect(shuffle(input, mulberry32(1))).toEqual(out);
  });
});
