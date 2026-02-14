/**
 * Vercel Edge Middleware
 * Location: project root (same level as package.json).
 * Runs at the edge before the request is handled.
 * Use for host-based routing: zoom.* subdomain → serve /zoom app at path /.
 *
 * @see https://vercel.com/docs/functions/edge-middleware
 */

export const config = {
  matcher: [
    '/((?!_next/|api/|.*\\.(?:ico|png|jpg|jpeg|gif|svg|css|js|woff2?|webp)$).*)',
  ],
};

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  const pathname = new URL(request.url).pathname;

  // Zoom subdomain: serve Zoom app (from /zoom) at root of this host
  if (host.startsWith('zoom.')) {
    // Already serving from /zoom — no rewrite (e.g. static assets)
    if (pathname.startsWith('/zoom/')) {
      return Response.next();
    }
    const rewriteUrl = new URL(request.url);
    if (pathname === '/' || pathname === '') {
      rewriteUrl.pathname = '/zoom/index.html';
    } else if (pathname.startsWith('/assets/') || pathname.startsWith('/backgrounds/')) {
      rewriteUrl.pathname = '/zoom' + pathname;
    } else {
      rewriteUrl.pathname = '/zoom/index.html';
    }
    return Response.rewrite(rewriteUrl);
  }

  return Response.next();
}
