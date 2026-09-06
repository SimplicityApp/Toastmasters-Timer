// Table Topics generator Worker: serves the pre-rendered site in ./dist with a
// canonical-host redirect, a real 404, and security headers. Deliberately a
// trimmed copy of the timer Worker (../../../worker/index.js); when a third
// tool arrives, the shared parts move to packages/edge.

// All JS is external and hashed, so scripts need no 'unsafe-inline'. The
// stylesheet imports Google Fonts, hence the two font hosts. The
// toastmusters.com zone has Cloudflare Web Analytics on, which injects its
// beacon into HTML responses; allow it rather than have it blocked noisily.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://e.simple-tech.app https://us-assets.i.posthog.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://e.simple-tech.app https://us.i.posthog.com https://*.posthog.com https://cloudflareinsights.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Bare apex hosts 301 to their www counterpart so there is one indexable
// origin. The https guard keeps `wrangler dev` (which rewrites Host to the
// first route) from bouncing localhost requests to production.
const APEX_HOST_PATTERN = /^tabletopics(-dev)?\.toastmusters\.com$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === 'https:' && APEX_HOST_PATTERN.test(url.hostname)) {
      url.hostname = `www.${url.hostname}`;
      return Response.redirect(url.toString(), 301);
    }

    let response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      const notFound = await env.ASSETS.fetch(new Request(new URL('/404.html', url.origin), { method: 'GET' }));
      response = new Response(notFound.body, { status: 404, statusText: 'Not Found', headers: notFound.headers });
    }
    return withSecurityHeaders(response, url);
  },
};

export function withSecurityHeaders(response, url) {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubdomains');

  // The dev host mirrors production content with production canonicals; keep
  // it out of the index regardless.
  if (url.hostname.includes('-dev.')) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  if (url.pathname.startsWith('/assets/')) {
    // Content-hashed by the build.
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (url.pathname === '/questions.json') {
    headers.set('Cache-Control', 'public, max-age=3600');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
