import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleStats } from './stats.js';

const ctx = { waitUntil: () => {} };
const request = new Request('https://www.timer.simple-tech.app/api/stats');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('handleStats', () => {
  it('serves the baked fallback when no API key is configured', async () => {
    const res = await handleStats(request, {}, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.timerUsers).toBeGreaterThan(0);
    expect(body.countries).toBeGreaterThan(0);
    expect(body.speechesTimed).toBeGreaterThan(0);
    expect(body.speechSeconds).toBeGreaterThan(0);
  });

  it('returns live numbers from the PostHog query result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ results: [[600, 60, 1600, 150000]] }), { status: 200 })
      )
    );

    const res = await handleStats(request, { POSTHOG_QUERY_API_KEY: 'phx_test' }, ctx);
    const body = await res.json();
    expect(body).toEqual({
      timerUsers: 600,
      countries: 60,
      speechesTimed: 1600,
      speechSeconds: 150000,
      fallback: false,
    });
    // A successful answer is cacheable for minutes (near-live); the fallback
    // for even less.
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('falls back when PostHog errors, with a short cache TTL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

    const res = await handleStats(request, { POSTHOG_QUERY_API_KEY: 'phx_test' }, ctx);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
  });

  it('falls back when the query result has an unexpected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }))
    );

    const res = await handleStats(request, { POSTHOG_QUERY_API_KEY: 'phx_test' }, ctx);
    const body = await res.json();
    expect(body.fallback).toBe(true);
  });
});
