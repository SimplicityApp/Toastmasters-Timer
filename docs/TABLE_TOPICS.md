# Table Topics Generator (`apps/table-topics`)

Random Table Topics questions for Toastmasters meetings, served at
**https://www.tabletopics.toastmusters.com** by its own Cloudflare Worker
(`toastmusters-tabletopics`). First sibling of the timer in the Toastmusters
suite: one subdomain per tool, cross-linked through `TOOLS` in
`packages/shared/appLinks.js`.

## How it works

- **Content is data.** `content/questions.json` is the whole bank: 20 fixed
  categories (`content/CATEGORIES.md`), each with `{ id, text, added }`
  questions. `scripts/validate-questions.mjs` enforces the rules in
  `content/GENERATION_PROMPT.md` (shape, ids, length, `?`, exact and fuzzy
  duplicates across the bank, ≥15 per category). The build refuses an invalid bank.
- **Static first, no framework.** `scripts/build.mjs` renders every page from
  the bank with the shared `packages/ui/content-pages.css` look, inlines
  `src/lib/{rng,picker,links}.js` into one `generator.js` (imports stripped, no
  bundler), substitutes the PostHog key/host and the timer URL, content-hashes
  the four assets, and writes `dist/`. `renderSite()` is pure and unit-tested.
- **Deterministic randomness.** `src/lib/rng.js` (FNV-1a + mulberry32) drives
  both the server-rendered initial question (seeded by page + build date) and
  the browser draw. **Today's set** = `todaySet(bank, 'YYYY-MM-DD', 10)`: the
  page is rendered for the build date and `generator.js` recomputes it for the
  visitor's UTC date, so the page changes daily with zero generation.
- **Worker.** `worker/index.js`: apex→www 301 (https-guarded for `wrangler
  dev`), assets, `/404.html` with a real 404, CSP without `unsafe-inline` for
  scripts, HSTS, `X-Robots-Tag: noindex` on `-dev.` hosts, immutable caching for
  `/assets/*`, one hour for `/questions.json`.
- **Analytics.** `src/analytics.js` loads posthog-js from the proxy
  `e.simple-tech.app` (same key as the timer, read from the repo-root `.env` or
  `VITE_PUBLIC_POSTHOG_*`). Events: `tt_question_shown {question_id, category,
  source: initial|random|share}`, `tt_category_selected`, `tt_question_copied`,
  `tt_share_copied`, `tt_timer_deeplink_clicked`, `tt_print_clicked`,
  `tt_today_viewed {date, swapped}`.

## URL map

| Path | Page | JSON-LD |
| --- | --- | --- |
| `/` | generator, all categories, FAQ | WebApplication, FAQPage, BreadcrumbList |
| `/topics/` | category index | CollectionPage, BreadcrumbList, ItemList |
| `/topics/<slug>/` | generator scoped to one category + full question list (the indexable pages) | Article, BreadcrumbList, ItemList |
| `/today/` | ten questions for today | WebPage, BreadcrumbList |
| `/questions.json` | the bank | — |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/404.html` | | |

Every page also carries the `Organization` (`https://www.toastmusters.com/#organization`)
and `WebSite` nodes.

## Timer deep link

"Time this" opens `https://www.timer.toastmusters.com/app?role=Table%20Topics%20Speech&name=<question>`.
The web timer (`apps/web/src/utils/speakerDeepLink.js`, used by `LiveTab.jsx`)
reads `role` and `name` on first mount when no speaker is set, selects the
role, fills the name, and strips the params. The role must be the exact rules
key; a persisted speaker wins over the URL.

## Commands (repo root)

```
npm run install:tabletopics        # once; links packages/shared
npm run validate:tabletopics       # content check
npm run build:tabletopics          # -> apps/table-topics/dist
npm run dev:tabletopics            # build + wrangler dev on :8789 (launch.json: tabletopics-worker)
npx vitest run --project toastmusters-table-topics
npm run cf:deploy:tabletopics:dev  # www.tabletopics-dev.toastmusters.com (noindex)
npm run cf:deploy:tabletopics:prod
```

Env for the build: `SITE_ORIGIN` (default prod), `BUILD_DATE`, `QUESTIONS_FILE`,
`VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST`.

## Automation

- **Weekly content routine** (Claude Code cloud, `tabletopics-weekly-questions`,
  Mondays 13:00 UTC): clones the repo, follows
  `content/GENERATION_PROMPT.md` (append 3 questions per category, validate,
  test), and opens a PR against `master`. It never merges. Manage it at
  https://claude.ai/code/routines.
- **Deploy on merge**: `.github/workflows/deploy-tabletopics.yml` runs on push
  to `master` when `apps/table-topics/**`, `packages/shared/appLinks.js` or
  `packages/ui/**` change: validate → test → build → `wrangler deploy` →
  smoke test. Secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit, Account
  Settings:Read, Zone DNS:Edit + Workers Routes:Edit on `toastmusters.com`) and
  `CLOUDFLARE_ACCOUNT_ID`; variables `VITE_PUBLIC_POSTHOG_KEY/HOST`. The timer
  Worker is never deployed by CI.

## Known trade-offs

- The generator's URL is hardcoded in `apps/web/index.html` and
  `apps/web/public/table-topics-timer.html` (static files); everything else
  reads `TOOLS`.
- Footer legal links point at the timer's `/privacy`, `/terms-of-use`,
  `/support` until the suite root owns them.
- `/today/` without JavaScript shows the build-date set; the sitemap does not
  claim daily change for it.
- `og-cover.png` is the timer's cover image as a placeholder; `logo.png` is the
  timer logo. Replace both when the suite has its own brand assets.
- `content-pages.css` lives in `packages/ui/` and is copied into
  `apps/web/public/` by the web app's `predev`/`prebuild` hooks (gitignored there).
