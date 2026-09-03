import { describe, it, expect } from 'vitest';
import { validateBank, nextId } from '../src/lib/validate.js';
import { normalizeText, tokenJaccard } from '../src/lib/normalize.js';

function q(slug, n, text, added = '2026-09-02') {
  return { id: `${slug}-${String(n).padStart(3, '0')}`, text, added };
}
function cat(slug, texts) {
  return {
    slug,
    name: slug.toUpperCase(),
    description: `Questions about ${slug}, long enough to pass.`,
    questions: texts.map((t, i) => q(slug, i + 1, t)),
  };
}
const distinct = (prefix, n) =>
  Array.from({ length: n }, (_, i) => `${prefix} number ${i} about topic ${String.fromCharCode(97 + i)} today?`);

const good = { version: 1, categories: [cat('alpha', distinct('Alpha question', 15)), cat('beta', distinct('Beta prompt', 15))] };

describe('validateBank', () => {
  it('accepts a clean bank', () => {
    expect(validateBank(good)).toEqual([]);
  });

  it('rejects a non-object bank', () => {
    expect(validateBank(null)).toEqual(['bank.categories must be an array']);
  });

  it.each([
    ['bad slug', (b) => { b.categories[0].slug = 'Alpha_1'; }, /slug invalid/],
    ['duplicate slug', (b) => { b.categories[1].slug = 'alpha'; }, /duplicate category slug/],
    ['short description', (b) => { b.categories[0].description = 'short'; }, /description/],
    ['too few questions', (b) => { b.categories[0].questions.pop(); }, /only 14 questions/],
    ['bad id shape', (b) => { b.categories[0].questions[0].id = 'alpha-1'; }, /must match alpha-NNN/],
    ['duplicate id', (b) => { b.categories[0].questions[1].id = 'alpha-001'; }, /duplicate id/],
    ['bad date', (b) => { b.categories[0].questions[0].added = '2026/09/02'; }, /added must be/],
    ['no question mark', (b) => { b.categories[0].questions[0].text = 'This has no question mark at all'; }, /must end with '\?'/],
    ['too long', (b) => { b.categories[0].questions[0].text = `${'x'.repeat(150)}?`; }, /longer than 140/],
    ['too short', (b) => { b.categories[0].questions[0].text = 'Why?'; }, /shorter than 10/],
    ['whitespace', (b) => { b.categories[0].questions[0].text = ' Padded question here?'; }, /leading\/trailing whitespace/],
    ['double space', (b) => { b.categories[0].questions[0].text = 'Double  space question here?'; }, /double spaces/],
    ['exact duplicate', (b) => { b.categories[1].questions[0].text = b.categories[0].questions[3].text.toUpperCase(); }, /duplicate of alpha-004/],
    ['near duplicate', (b) => { b.categories[1].questions[0].text = 'Alpha question number 0 about topic a today, please?'; }, /near-duplicate of alpha-001/],
  ])('flags %s', (_name, mutate, pattern) => {
    const bank = structuredClone(good);
    mutate(bank);
    const problems = validateBank(bank);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => pattern.test(p))).toBe(true);
  });

  it('nextId continues after the current maximum', () => {
    expect(nextId(good.categories[0])).toBe('alpha-016');
    expect(nextId({ slug: 'z', questions: [] })).toBe('z-001');
  });
});

describe('normalize', () => {
  it('normalizes case, punctuation and accents', () => {
    expect(normalizeText('  Café,  "Great" — day?! ')).toBe('cafe great day');
  });
  it('tokenJaccard is 1 for identical and low for unrelated', () => {
    expect(tokenJaccard('What is your favorite food?', 'what is your favourite food')).toBeLessThan(1);
    expect(tokenJaccard('a b c', 'a b c')).toBe(1);
    expect(tokenJaccard('apple pear', 'car train')).toBe(0);
  });
});
