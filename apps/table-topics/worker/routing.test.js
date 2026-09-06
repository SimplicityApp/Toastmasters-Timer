import { describe, it, expect, vi } from 'vitest';
import worker from './index.js';

function makeEnv(presentPaths = []) {
  const present = new Set(presentPaths);
  return {
    ASSETS: {
      fetch: vi.fn((request) => {
        const { pathname } = new URL(request.url);
        const found = present.has(pathname);
        return Promise.resolve(
          new Response(found ? `content of ${pathname}` : 'not found', {
            status: found ? 200 : 404,
            headers: { 'x-asset-path': pathname, 'content-type': 'text/html' },
          })
        );
      }),
    },
  };
}
const get = (url) => new Request(url, { headers: { host: new URL(url).host } });

describe('canonical host', () => {
  it('301s the apex to www keeping path and query', async () => {
    const res = await worker.fetch(get('https://tabletopics.toastmusters.com/topics/travel-places/?q=x'), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://www.tabletopics.toastmusters.com/topics/travel-places/?q=x');
  });

  it('301s the dev apex to its own www', async () => {
    const res = await worker.fetch(get('https://tabletopics-dev.toastmusters.com/'), makeEnv());
    expect(res.headers.get('location')).toBe('https://www.tabletopics-dev.toastmusters.com/');
  });

  it.each([
    'https://www.tabletopics.toastmusters.com/',
    'https://www.tabletopics-dev.toastmusters.com/',
    'http://localhost:8789/',
    'http://tabletopics.toastmusters.com/', // wrangler dev rewrites Host; http must not redirect
  ])('does not redirect %s', async (url) => {
    const res = await worker.fetch(get(url), makeEnv(['/index.html', '/']));
    expect(res.status).not.toBe(301);
  });
});

describe('assets and 404', () => {
  it('serves an existing asset with security headers', async () => {
    const res = await worker.fetch(get('https://www.tabletopics.toastmusters.com/today/'), makeEnv(['/today/']));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self' https://e.simple-tech.app");
    expect(res.headers.get('content-security-policy')).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(res.headers.get('content-security-policy')).toContain('https://fonts.googleapis.com');
    expect(res.headers.get('content-security-policy')).toContain('https://fonts.gstatic.com');
    expect(res.headers.get('content-security-policy')).toContain('https://static.cloudflareinsights.com');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('serves /404.html with a 404 status for unknown paths', async () => {
    const res = await worker.fetch(get('https://www.tabletopics.toastmusters.com/nope'), makeEnv(['/404.html']));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-asset-path')).toBe('/404.html');
    expect(await res.text()).toBe('content of /404.html');
  });

  it('marks the dev host noindex', async () => {
    const res = await worker.fetch(get('https://www.tabletopics-dev.toastmusters.com/'), makeEnv(['/']));
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('caches hashed assets immutably and questions.json for an hour', async () => {
    const env = makeEnv(['/assets/generator.abc12345.js', '/questions.json']);
    const a = await worker.fetch(get('https://www.tabletopics.toastmusters.com/assets/generator.abc12345.js'), env);
    expect(a.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const q = await worker.fetch(get('https://www.tabletopics.toastmusters.com/questions.json'), env);
    expect(q.headers.get('cache-control')).toBe('public, max-age=3600');
  });
});
