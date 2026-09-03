import { describe, it, expect } from 'vitest';
import { flattenQuestions, drawQuestion, todaySet, utcDateString } from '../src/lib/picker.js';

const bank = {
  categories: Array.from({ length: 4 }, (_, c) => ({
    slug: `cat${c}`,
    name: `Cat ${c}`,
    description: 'x'.repeat(30),
    questions: Array.from({ length: 6 }, (_, i) => ({
      id: `cat${c}-${String(i + 1).padStart(3, '0')}`,
      text: `Question ${c}-${i}?`,
      added: '2026-09-02',
    })),
  })),
};

describe('picker', () => {
  it('flattens and tags each question with its category', () => {
    const pool = flattenQuestions(bank.categories);
    expect(pool).toHaveLength(24);
    expect(pool[7]).toMatchObject({ id: 'cat1-002', category: 'cat1', categoryName: 'Cat 1' });
  });

  it('drawQuestion is deterministic per seed and honours excludeId', () => {
    const pool = flattenQuestions(bank.categories);
    const a = drawQuestion(pool, 'seed-1');
    expect(drawQuestion(pool, 'seed-1')).toEqual(a);
    expect(drawQuestion(pool, 123)).toEqual(drawQuestion(pool, 123));
    for (let s = 0; s < 40; s++) {
      expect(drawQuestion(pool, s, a.id).id).not.toBe(a.id);
    }
    expect(drawQuestion([], 'x')).toBeNull();
    expect(drawQuestion([pool[0]], 'x', pool[0].id)).toEqual(pool[0]);
  });

  it('todaySet is stable for a date, differs between dates, and spreads categories', () => {
    const a = todaySet(bank.categories, '2026-09-02', 10);
    const b = todaySet(bank.categories, '2026-09-02', 10);
    const c = todaySet(bank.categories, '2026-09-03', 10);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(a.map((q) => q.id)).not.toEqual(c.map((q) => q.id));
    expect(a).toHaveLength(10);
    expect(new Set(a.map((q) => q.id)).size).toBe(10);
    // 4 categories → the first 4 picks are one per category.
    expect(new Set(a.slice(0, 4).map((q) => q.category)).size).toBe(4);
  });

  it('todaySet caps at the pool size', () => {
    expect(todaySet(bank.categories, '2026-09-02', 100)).toHaveLength(24);
  });

  it('utcDateString formats YYYY-MM-DD in UTC', () => {
    expect(utcDateString(new Date('2026-09-02T23:59:59Z'))).toBe('2026-09-02');
    expect(utcDateString(new Date('2026-09-03T00:00:00Z'))).toBe('2026-09-03');
  });
});

import { drawUnseen, drawSet } from '../src/lib/picker.js';

describe('drawUnseen', () => {
  const pool = flattenQuestions(bank.categories).slice(0, 5);
  it('prefers unseen questions and reports when the cycle restarts', () => {
    const seen = new Set([pool[0].id, pool[1].id, pool[2].id]);
    for (let s = 0; s < 30; s++) {
      const { question, cycled } = drawUnseen(pool, s, null, seen);
      expect(cycled).toBe(false);
      expect([pool[3].id, pool[4].id]).toContain(question.id);
    }
    const all = new Set(pool.map((q) => q.id));
    const { question, cycled } = drawUnseen(pool, 1, pool[4].id, all);
    expect(cycled).toBe(true);
    expect(question.id).not.toBe(pool[4].id);
    expect(drawUnseen([], 1, null, new Set())).toEqual({ question: null, cycled: false });
  });
});

describe('drawSet', () => {
  const pool = flattenQuestions(bank.categories);
  it('returns distinct questions, deterministic per seed, avoiding what is on screen', () => {
    const a = drawSet(pool, 'seed', 3).questions;
    expect(a).toHaveLength(3);
    expect(new Set(a.map((q) => q.id)).size).toBe(3);
    expect(drawSet(pool, 'seed', 3).questions.map((q) => q.id)).toEqual(a.map((q) => q.id));
    const b = drawSet(pool, 'seed2', 3, a.map((q) => q.id)).questions;
    expect(b.some((q) => a.find((x) => x.id === q.id))).toBe(false);
  });

  it('prefers unseen and reports cycling when fewer than count remain unseen', () => {
    const seen = new Set(pool.slice(2).map((q) => q.id)); // only 2 unseen
    const { questions, cycled } = drawSet(pool, 7, 3, [], seen);
    expect(cycled).toBe(true);
    expect(questions.slice(0, 2).map((q) => q.id).sort()).toEqual([pool[0].id, pool[1].id].sort());
    expect(questions).toHaveLength(3);
    expect(drawSet(pool, 7, 3, [], new Set()).cycled).toBe(false);
  });

  it('backfills from the on-screen set when the pool is tiny', () => {
    const tiny = pool.slice(0, 4);
    const onScreen = tiny.slice(0, 3).map((q) => q.id);
    const { questions } = drawSet(tiny, 1, 3, onScreen);
    expect(questions).toHaveLength(3);
    expect(questions[0].id).toBe(tiny[3].id);
    expect(drawSet([], 1, 3)).toEqual({ questions: [], cycled: false });
  });
});
