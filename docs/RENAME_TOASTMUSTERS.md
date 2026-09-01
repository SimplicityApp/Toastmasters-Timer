# Rename: "Toastmasters Timer" → "Toastmusters Timer"

Staged rename of the product name. **Stage 1 (brand marks) is done.** Everything below
is deliberately deferred — each item breaks something if changed in isolation.

## Stage 1 — done

Renamed only the brand marks, i.e. the places where the string names *our product*:

- Header logo text + logo `alt` on all 13 static pages, `apps/web/index.html`,
  `Landing.jsx`, and `OAuthRedirect.jsx`
- Footer copyright line (`© 2026 Toastmusters Timer.`) on the same pages
- `<title>` / `og:title` / `twitter:title` where the title *is* the product name:
  `apps/web/index.html`, `404.html`, `toastmasters-timer-demo.html`,
  `toastmasters-timer-zoom-demo.html`, `apps/zoom-app/index.html`, and the four
  `apps/zoom-app/public/` pages (documentation, privacy, support, terms-of-use)
- PWA display name in `apps/web/public/site.webmanifest`

Deliberately **not** touched: every standalone "Toastmasters" that refers to the
*organization* (Toastmasters International, Toastmasters clubs, Toastmasters
meetings, the Timer role in Toastmasters). Those are correct as-is, including the
"Not affiliated with Toastmasters International" disclaimer.

## Blocked on a Zoom Marketplace change

The Zoom listing is published as **"Toastmaster Timer"**. These must stay in sync
with the listing, so they change only when the Marketplace submission changes:

| Location | What |
| --- | --- |
| `apps/zoom-app/public/manifest.json:3` | `"app_name": "Toastmaster Timer"` — the listing name |
| `apps/zoom-app/src/components/Footer.jsx:38` | Toast: `Search "Toastmaster Timer" in the Zoom App Marketplace` |
| `apps/zoom-app/src/components/ReviewPromptModal.jsx:23` | Same toast string |
| `apps/zoom-app/public/documentation.html` | Install/uninstall steps that tell users the name to search for and click in Zoom (lines ~145–415) |
| `apps/zoom-app/public/support.html` | Install FAQ + body copy (lines ~107–227) |
| `apps/zoom-app/public/privacy.html`, `terms-of-use.html` | Legal body copy names the entity as "Toastmaster Timer" |

Note the legal pages now have a renamed `<title>` but original body copy — resolve
both together when the Marketplace change lands.

## Deferred: SEO body copy

~200 occurrences of "Toastmasters Timer" remain in body copy across the landing page
and the 13 SEO article pages (H1s, meta descriptions, JSON-LD `name`/`description`,
FAQ answers). The product name is also the site's primary ranking keyword, so
renaming these will cost rankings for "toastmasters timer". Decide as an SEO call,
not a consistency one.

## Deferred: identifiers (each is a breaking change)

| Kind | Where | Why deferred |
| --- | --- | --- |
| URL slugs + filenames | `/toastmasters-timer-role-guide` etc., the 13 `apps/web/public/*.html` files, `vercel.json` rewrites, `wrangler.jsonc`, `scripts/generate-sitemap.mjs`, `sitemap.xml` | Breaks every indexed URL and inbound link; needs 301s |
| localStorage keys | `packages/shared/storage.js` (`toastmaster_agenda`, `toastmaster_reports`, `toastmaster_role_rules`, …) | Every existing user silently loses saved agenda, rules, and settings without a migration |
| IndexedDB | `packages/shared/cardImages.js:28` (`toastmaster-timer`), `:25` (`toastmaster_custom_card_images`) | Same — users lose custom card images |
| npm workspace | `@toastmaster-timer/shared`, `package.json` names | Internal only, but touches every import site |
| Cloudflare Worker | `wrangler.jsonc:5` (`toastmaster-timer`) | Renaming creates a *new* Worker; needs route/DNS rewiring |
| Image assets | `/Toastmasters-Timer-logo.jpg`, `/Toastmasters-Timer-cover-page.png` | Referenced by og:image URLs already shared/cached externally |
| PostHog properties | `toastmasters_club`, `toastmasters_district` in `clubSurvey.js` | These name the *organization*, not the product — leave permanently |
