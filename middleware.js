/**
 * Vercel Routing Middleware (framework: other)
 * @see https://vercel.com/docs/routing-middleware/api
 *
 * API compliance:
 * - File at project root, default export (api#routing-middleware-file-location-and-name)
 * - config.matcher: regex to skip static assets (api#match-paths-based-on-custom-matcher-config)
 * - rewrite(destination: URL) from @vercel/functions for zoom subdomain → /zoom/* (api#rewrites)
 * - next() from @vercel/functions to continue to static/rewrites (api#continuing-the-routing-middleware-chain)
 * - request: standard Request; use request.url, request.headers (api#request)
 */

import { next, rewrite } from '@vercel/functions';

export const config = {
  matcher: [
    '/((?!_next/|api/|.*\\.(?:ico|png|jpg|jpeg|gif|svg|css|js|woff2?|webp)$).*)',
  ],
};

export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || '';

  if (!host.startsWith('zoom.')) {
    return next();
  }

  if (url.pathname.startsWith('/zoom/')) {
    return next();
  }

  if (url.pathname === '/' || url.pathname === '') {
    return rewrite(new URL('/zoom/index.html', request.url));
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/backgrounds/')) {
    return rewrite(new URL('/zoom' + url.pathname, request.url));
  }

  return rewrite(new URL('/zoom/index.html', request.url));
}
