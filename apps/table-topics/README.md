# Table Topics Generator

Static site + Cloudflare Worker. Full documentation: [`docs/TABLE_TOPICS.md`](../../docs/TABLE_TOPICS.md).

- Add or review questions: `content/questions.json`, rules in `content/GENERATION_PROMPT.md`,
  categories in `content/CATEGORIES.md`. Check with `npm run validate:tabletopics` (repo root).
- Build: `npm run build:tabletopics` → `dist/`. Local: `npm run dev:tabletopics` (http://localhost:8789).
- Tests: `npx vitest run --root apps/table-topics`.
- Deploy: merged PRs to `master` deploy automatically (`.github/workflows/deploy-tabletopics.yml`);
  manual: `npm run cf:deploy:tabletopics:dev` / `:prod`.
