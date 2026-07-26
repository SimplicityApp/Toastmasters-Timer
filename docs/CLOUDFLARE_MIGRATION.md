# Migration: Vercel → Cloudflare Workers

Moves the site from Vercel to a single **Cloudflare Worker with Static Assets**.
The Worker serves the combined `dist/` build and handles the few dynamic
concerns (Zoom webhook, host-based routing, security headers). No Cloudflare
Pages — one Worker does everything.

## Feature mapping

| Vercel feature | Where it lived | Cloudflare equivalent |
| --- | --- | --- |
| Static hosting (`outputDirectory: dist`) | `vercel.json` | `assets.directory: ./dist` in `wrangler.jsonc` |
| Clean URLs (`/privacy` → `privacy.html`, ~20 rewrites) | `vercel.json` `rewrites` | `assets.html_handling: auto-trailing-slash` (automatic) |
| SPA fallback — web at `/` | `rewrites` `/(.*)` → `/index.html` | `worker/index.js` `routeAssets()` |
| SPA fallback — zoom at `/zoom/*` | `rewrites` `/zoom/:path*` → `/zoom/index.html` | `worker/index.js` `routeAssets()` |
| Redirect `/web` → `/app` | `redirects` | `worker/index.js` `Response.redirect(...302)` |
| Security headers + per-path CSP | `headers` | `worker/index.js` `withSecurityHeaders()` |
| Immutable cache for backgrounds | `headers` `/zoom/backgrounds/*` | `worker/index.js` `withSecurityHeaders()` |
| Host-based routing (`zoom.` subdomain) | `middleware.js` (`@vercel/functions`) | `worker/index.js` `routeAssets()` |
| Serverless fn: Zoom webhook | `api/zoom/webhook.js` (`req`/`res`) | `worker/zoom-webhook.js` (`Request`/`Response`) |
| Signature verification | `api/_lib/zoom-verify.js` | `worker/zoom-verify.js` |
| `process.env.*` secrets | Vercel env vars | `wrangler secret put` / `.dev.vars` (via `env`) |

## What changed in the code

- **CSP is decided in the Worker** rather than by static header rules. This
  avoids Cloudflare's `_headers` duplicate-header behaviour and, as a bonus,
  fixes a latent Vercel issue: the Zoom app now gets the Zoom CSP even when
  served at the **subdomain root** (`zoom.<domain>/`), not just under `/zoom/`.
- **`html_handling` replaces the clean-URL rewrite list.** Requesting `/support`,
  `/zoom/privacy`, `/toastmasters-timer-role-guide`, etc. auto-resolves to the
  matching `.html` file. The explicit rewrite table is no longer needed.
- **Two SPAs, one Worker.** `not_found_handling` is set to `none` so a missing
  asset surfaces as a 404 to the Worker, which then serves `/index.html` or
  `/zoom/index.html` depending on the path. (`single-page-application` handling
  only supports one root, so it can't be used here.)
- **`run_worker_first: true`** so the Worker can intercept the subdomain root
  (`/` on `zoom.<domain>`) before Static Assets would serve `index.html`.
- **Fire-and-forget uses `ctx.waitUntil`.** On Vercel the compliance call could
  linger after the response; Workers cancel unawaited promises, so it's now
  explicitly kept alive.
- **Webhook reads the body once** via `request.text()` and reuses that raw
  string for both JSON parsing and HMAC verification (no `req.body` ambiguity).

## New / changed files

- `wrangler.jsonc` — Worker + Static Assets config
- `worker/index.js` — entry: routing, SPA fallback, security headers
- `worker/zoom-webhook.js` — ported webhook handler
- `worker/zoom-verify.js` — ported signature verification
- `worker/zoom-webhook.test.js`, `worker/vitest.config.js` — tests
- `.dev.vars.example` — local secret template
- `package.json` — `cf:dev`, `cf:deploy` scripts; `wrangler` devDependency
- `vitest.config.js` — added the `worker` project
- `.gitignore` — `.dev.vars`, `.wrangler/`

The old `vercel.json`, `middleware.js`, and `api/` are **left in place** so
Vercel keeps working until you cut over. Remove them after DNS flips (below).

## One-time setup

```sh
npm install                      # pulls in wrangler
npx wrangler login               # authenticate to your Cloudflare account

# Production secrets (values from the current Vercel project settings):
npx wrangler secret put ZOOM_WEBHOOK_SECRET_TOKEN
npx wrangler secret put ZOOM_CLIENT_ID
npx wrangler secret put ZOOM_CLIENT_SECRET
npx wrangler secret put POSTHOG_API_KEY
```

For local dev, `cp .dev.vars.example .dev.vars` and fill it in.

## Local run

```sh
npm run cf:dev      # builds dist/, then serves via wrangler dev
```

Smoke-test:
- `/` → web app; `/app` → timer; `/web` → 302 to `/app`
- `/zoom` and `/zoom/live` → Zoom app
- `/support`, `/zoom/privacy`, `/toastmasters-timer-role-guide` → HTML pages
- `POST /api/zoom/webhook` with an `endpoint.url_validation` body → CRC response
- Check `Content-Security-Policy` differs on `/` vs `/zoom/`

## Deploy

```sh
npm run cf:deploy   # build + wrangler deploy
```

## Cut over (DNS)

1. Add the custom domain(s) to the Worker (Cloudflare dashboard → Workers →
   your Worker → **Settings → Domains & Routes**), including the **`zoom.`
   subdomain** so host-based routing works.
2. Point DNS for the apex/`www`/`zoom` hostnames at Cloudflare.
3. Update the **Zoom Marketplace webhook URL** if the host changes
   (`https://<host>/api/zoom/webhook`) and re-run its CRC validation.
4. Verify the smoke-test list above against the live domain.
5. Once stable, delete `vercel.json`, `middleware.js`, `api/`, and the
   `@vercel/functions` dependency; decommission the Vercel project.

## Notes / follow-ups

- **`compatibility_date`** in `wrangler.jsonc` is `2025-09-01`; bump it when you
  want newer runtime defaults, then re-test.
- **`nodejs_compat`** is required — the webhook uses `node:crypto`
  (`createHmac`, `timingSafeEqual`) and `Buffer`.
- The `dist/` build is unchanged; the existing `npm run build` output is what
  the Worker serves, so the two apps' base paths (`/` and `/zoom/`) stay as-is.
