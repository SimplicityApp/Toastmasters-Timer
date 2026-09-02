# Migration: `timer.simple-tech.app` → `timer.toastmusters.com`

Moves the site and the Zoom app to a new root domain. `toastmusters.com` will
host a suite of tools, **one subdomain per tool** (`timer.`, `tabletopics.`, …),
so the timer keeps its old host shape under the new root. Companion to
[CLOUDFLARE_MIGRATION.md](CLOUDFLARE_MIGRATION.md), which moved hosting; this
one moves the *domain*.

Working assumption: the new domain is **`toastmusters.com`** (whois showed it
unregistered on 2026-09-02; `toastmuster.com` has been taken since 2007). If a
different name is bought, substitute it everywhere below. Hosts used:

| Role | Old | New |
| --- | --- | --- |
| Canonical web host | `www.timer.simple-tech.app` | `www.timer.toastmusters.com` |
| Apex (301 → www) | `timer.simple-tech.app` | `timer.toastmusters.com` |
| Zoom app home | `zoom.timer.simple-tech.app` | `zoom.timer.toastmusters.com` |
| Dev mirror | `*.timer-dev.simple-tech.app` | `*.timer-dev.toastmusters.com` |
| Suite root | — | `toastmusters.com` / `www.toastmusters.com` (parked on this Worker until the suite landing exists) |
| PostHog proxy | `e.simple-tech.app` | unchanged |

`www` stays the canonical form so the apex→www logic in the Worker is reused
unchanged in shape. Every other tool follows the same shape
(`tabletopics.`, `www.tabletopics.`, `tabletopics-dev.`, …) in its own Worker.

Trade-off accepted 2026-09-02: subdomains pool search authority less well than
paths, so each tool earns links on its own and the root landing must
cross-link every tool prominently.

## The principle: dual-host, never cut over

The old and new hosts are served by the **same Worker** for the whole
migration. The Zoom Marketplace review happens while the old host still works,
redirects are turned on only after the new Zoom home URL is live and verified,
and the old Zoom host keeps *serving* (not redirecting) for ~90 days so user
data can be carried across. There is no moment where a flip can strand users.

## Why the Zoom app makes this hard

1. **Zoom controls the entry point.** The Zoom client opens whatever home URL is
   in the Marketplace *production* config. Changing it requires Zoom review,
   and it cannot be reverted quickly either. [TEMPORARY_ROUTING.md](TEMPORARY_ROUTING.md)
   records how long the last home-URL change took. We cannot redirect Zoom
   users ourselves.
2. **All organizer state is origin-scoped browser storage.** There is no server
   store. A new origin starts empty for every organizer. Redirects do not carry
   storage. Keys in play (`localStorage`):
   `toastmaster_agenda`, `toastmaster_role_rules`, `toastmaster_role_order`,
   `toastmaster_hidden_builtin_roles`, `toastmaster_reports`,
   `toastmaster_prompts`, `toastmaster_own_background`,
   `toastmaster_zoom_camera_resolution`, and the background bookkeeping keys
   `toastmaster_zoom_virtual_background_applied`,
   `toastmaster_zoom_video_filter_applied`,
   `toastmaster_zoom_virtual_foreground_applied`,
   `toastmaster_zoom_previous_background` (losing these can leave orphaned
   backgrounds in the organizer's Zoom client). Custom card images live in
   IndexedDB `toastmaster-timer` / store `card-images`
   (`packages/shared/cardImages.js`).
3. **Four Marketplace settings are bound to the old host** and all go through
   the same review: home URL, OAuth redirect URL, webhook endpoint, domain
   allow list.

## Phase 0 — Buy and prepare (no deploys)

- [x] Register `toastmusters.com` (and `.app` if free; it is HTTPS-only and
      blocks squatting). Point nameservers at Cloudflare; add the zone.
- [ ] Decide and record the trademark stance. The domain is the most exposed
      use of a mark one letter off Toastmasters International's, and domain
      disputes (UDRP) are cheap for a mark holder. Proceeding is a business
      decision; note it here with the date.
- [ ] Add the new domain property (`sc-domain:toastmusters.com`) in Search
      Console now so it accrues history before the redirects.

## Phase 1 — Dual-serve (nothing user-visible changes)

Code:

- [x] `wrangler.jsonc`: add `timer.toastmusters.com`,
      `www.timer.toastmusters.com`, `zoom.timer.toastmusters.com` as
      additional `custom_domain` routes on the **production** Worker, plus the
      parked root pair. Keep the three old routes. Mirror in `env.dev` with
      `timer-dev.toastmusters.com`, `www.timer-dev.toastmusters.com`,
      `zoom.timer-dev.toastmusters.com`.
- [x] `worker/index.js`: generalize `APEX_HOST_PATTERN` so both apexes
      canonicalize to their own `www.`:
      `/^(timer(-dev)?\.simple-tech\.app|(dev\.)?toastmusters\.com)$/`.
      The `zoom.` routing and the CSP selection match on the `zoom.` *prefix*
      and need no change. Keep `https://e.simple-tech.app` in both CSPs (the
      PostHog proxy does not move).
- [x] `worker/routing.test.js`, `worker/stats.test.js`: add the new hosts to
      the apex/www/zoom cases.
- [x] **Do not add redirects, and do not touch canonicals yet.** Serving the
      same content on two hosts for a few weeks is fine while canonicals still
      point at the old host; Google consolidates on the canonical.

Deploy dev first (`npm run cf:deploy:dev`), then prod (`npm run cf:deploy:prod`).
Adding routes attaches the new domains; the old ones keep working.

> Done 2026-09-02: both envs deployed with the new routes (first as
> `*.toastmusters.com`, then re-shaped the same day to `*.timer.toastmusters.com`
> once the per-tool-subdomain plan was settled). Certificates for
> multi-level hosts (`www.timer.`, `zoom.timer-dev.`) took ~1–3 minutes to issue; until
> then the host answers with a TLS handshake alert. If your machine cached the
> NXDOMAIN from before the records existed, test with
> `curl --resolve <host>:443:<cloudflare-ip>` rather than waiting for the cache.

Verify on the new hosts (both envs):

- [ ] `/` landing, `/app` timer, `/web` → 302 `/app`, `/support`, `/privacy`,
      `/toastmasters-timing-chart`, unknown path → 404 page.
- [ ] `https://timer.toastmusters.com/x?y=1` → 301 `https://www.timer.toastmusters.com/x?y=1`.
- [ ] `zoom.timer.toastmusters.com/` serves the Zoom shell with the Zoom CSP;
      `/robots.txt` there is `Disallow: /`; `/backgrounds/*` immutable-cached.
- [ ] `POST https://www.timer.toastmusters.com/api/zoom/webhook` with an
      `endpoint.url_validation` body returns the CRC response.

Verify the Zoom app itself from the new origin **using the app's development
credentials** (their home URL, allow list and redirect URL are editable without
review): set dev home URL to `https://zoom.timer-dev.toastmusters.com`, add both new
domains to the dev allow list, run the full
[ZOOM_TEST_PLAN.md](ZOOM_TEST_PLAN.md) including background push, virtual
foreground count-up, popout, and share-app.

## Phase 2 — Storage bridge (carry organizer data across origins)

Ship this **before** the Marketplace submission so it is live on both hosts
when Zoom flips the home URL.

Design (one-time, idempotent):

1. On the new zoom origin, if `localStorage.toastmaster_migrated_from_old_origin`
   is unset **and** the app has no existing data (`toastmaster_agenda`,
   `toastmaster_role_rules`, `toastmaster_reports` all empty), mount a hidden
   `<iframe src="https://zoom.timer.simple-tech.app/zoom/bridge.html">`.
2. `bridge.html` (a tiny static page shipped under `/zoom/`) reads every
   `toastmaster_*` localStorage key plus all IndexedDB `card-images` entries
   (as blobs → ArrayBuffers), and `postMessage`s them to the parent, checking
   `event.origin` is exactly `https://zoom.timer.toastmusters.com` (or the dev host).
3. Parent validates `event.origin === 'https://zoom.timer.simple-tech.app'`,
   writes the keys and images, sets the migrated flag, removes the iframe, and
   reloads state. Failure or a 5 s timeout also sets the flag so the app never
   blocks on the bridge; the user simply starts fresh.

Enabling it in the Worker (`withSecurityHeaders`):

- [ ] On the **old** zoom host only, for `/zoom/bridge.html`, replace
      `frame-ancestors 'self'` in the Zoom CSP with
      `frame-ancestors https://zoom.timer.toastmusters.com https://zoom.timer-dev.toastmusters.com`.
      Everything else keeps `'self'`.
- [ ] The old domain must stay in Zoom's **domain allow list** (Phase 3) or
      the webview will refuse the iframe.
- [ ] Add a PostHog event `storage_bridge_result` with `{ outcome, keys,
      images }` so the 90-day window can be judged on data.

The alternative is a server-side store keyed by the Zoom `uid` from the
identity work. It is the right long-term answer (and would make future origin
changes free) but is a larger build; the bridge is enough for this move.

## Phase 3 — One Marketplace submission

Submit a **single** production update so there is one review, not four.
Everything below is in the app's production configuration on
marketplace.zoom.us:

- [ ] Home URL → `https://zoom.timer.toastmusters.com`
- [ ] Domain allow list: **add** `timer.toastmusters.com`,
      `www.timer.toastmusters.com`, `zoom.timer.toastmusters.com`; **keep** all `*.timer.simple-tech.app` entries
      (bridge) and `e.simple-tech.app` (PostHog).
- [ ] OAuth redirect URL: **add** `https://www.timer.toastmusters.com/oauth/redirect`,
      **keep** the old one listed.
- [ ] Event notification endpoint → `https://www.timer.toastmusters.com/api/zoom/webhook`.
      Zoom re-runs CRC validation on save; same Worker, same
      `ZOOM_WEBHOOK_SECRET_TOKEN`, so it passes with no code change.
- [ ] Homepage / privacy / support URLs → new www host.
- [ ] Update the repo copy `apps/zoom-app/public/manifest.json` to match, and
      the URL in `docs/ZOOM_TEST_PLAN.md`. Mention the domain change in the
      release notes for the reviewer.

During review, production still opens the old host, which still works.

## Phase 4 — After Zoom approves

Verify before touching redirects:

- [ ] Open the app in a real meeting; confirm the URL bar / PostHog
      `$current_url` shows `zoom.timer.toastmusters.com`.
- [ ] `storage_bridge_result` events arriving with `outcome=success`.
- [ ] Worker logs (observability is on) show no 4xx/5xx spike on the new host.
- [ ] Webhook events (`meeting.started`) arriving at the new endpoint.

Then, in one deploy:

- [ ] `worker/index.js`: 301 `timer.simple-tech.app` and
      `www.timer.simple-tech.app` → `https://www.timer.toastmusters.com` +
      same path + query. **Exclude** `zoom.timer.simple-tech.app` (bridge) and
      `/api/zoom/webhook` (Zoom may still POST to the old URL briefly; a 301
      drops the body — keep answering it on both hosts).
- [ ] `apps/zoom-app/src/utils/zoomSdk.js`: `PRODUCTION_BASE_URL` → new www
      host. It is a fallback only (runtime uses `window.location.origin`), but
      it must not name a host that is not yet in Zoom's domain allow list, so it
      moves here with the other references and not in Phase 1.
- [ ] Swap the old host for the new in every static file. Full list of files
      referencing the old host (from `grep -rl timer.simple-tech.app`, excluding
      build output): `apps/web/index.html`, the 12 pages in
      `apps/web/public/*.html`, `apps/web/public/llms.txt`,
      `apps/web/public/robots.txt` (header comment + `Sitemap:` line),
      `apps/zoom-app/index.html`, `apps/zoom-app/public/{documentation,privacy,
      support,terms-of-use}.html`, `scripts/generate-sitemap.mjs` (regenerates
      `sitemap.xml`), plus the docs `test_plan.md`,
      `video-production-guide.md`, `video-script-zoom-app.md`.
      Canonicals, `og:url`, `og:image`, JSON-LD `url`/`@id` all move together
      with the redirects — never before them.
- [ ] Search Console: **Change of Address** from the old property to the new (`sc-domain:toastmusters.com` covers all subdomains),
      submit the new sitemap, request indexing on the top pages
      (`/`, `/toastmasters-timing-chart`, `/toastmasters-timer-role-guide`).
- [ ] Re-run the Phase 1 verification list against the *old* hosts to confirm
      each 301 lands on the equivalent new URL.

Expect a few weeks of ranking wobble; the old property had ~22 clicks per
quarter at the time of writing, so the downside is small.

## Phase 5 — Cleanup (~90 days after Phase 4)

- [ ] Check `storage_bridge_result` volume has gone to ~0.
- [ ] Remove the bridge (iframe code, `bridge.html`, CSP exception).
- [ ] 301 `zoom.timer.simple-tech.app/*` → `https://zoom.timer.toastmusters.com/*`
      and remove the old `zoom.` allow-list entry and old OAuth redirect URL in
      the next regular Marketplace release.
- [ ] Keep `simple-tech.app` registered and the three old routes on the Worker
      indefinitely; redirects are cheap and old links live forever.
- [ ] Update `docs/outreach/README.md` and any links already placed in club
      channels or directories.
- [ ] Update `wrangler.jsonc` comments, `README.md`, and the memory note for
      the dev server / Search Console property.

## Rollback

| When | Rollback |
| --- | --- |
| Phase 1–2 | Nothing user-visible changed. Remove the new routes or stop. |
| Phase 3 (in review) | Withdraw the submission. Old host still live. |
| Phase 4+ | The home URL cannot be reverted without another review, but both hosts are one Worker: any breakage is fixed by a deploy, never by a Marketplace round trip. The failure to design against is the new zoom host being broken when Zoom flips — Phase 1's dev-credentials test exists to rule that out. |

## Things that do *not* need to change

- PostHog: Zoom users are identified by the decrypted app-context `uid`, which
  survives the origin change. Anonymous web-visitor IDs reset; accept it.
- Worker secrets: same Worker, same secrets.
- The Vite `base: '/zoom/'` build layout and `combine:dist` step.
- The PostHog reverse proxy `e.simple-tech.app` and its CSP entries.
