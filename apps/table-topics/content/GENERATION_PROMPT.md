# Table Topics question generation — contract

This file is the single source of truth for how new questions enter
`content/questions.json`. It is followed by a human in a Claude Code session
(the seed bank) and by the weekly cloud routine (`tabletopics-weekly-questions`).
Read it fully before writing a single question.

## Inputs

- `apps/table-topics/content/questions.json` — the existing bank.
- `N` — how many new questions to add **per category**. Default **3**.
- Today's date, `YYYY-MM-DD` (UTC).

## What a good Table Topics question is

A Table Topics question is an impromptu speaking prompt. A club member hears
it once and must speak for 1–2 minutes with no preparation. Every question must:

- be **open-ended** and invite a story, an opinion, or a reflection;
- be **answerable by anyone in the world** in 1–2 minutes with no special
  knowledge — no politics, religion, current events, brand names, celebrities,
  or region-specific references (holidays are fine if described generically);
- be **a single question**, 10–140 characters, ending with `?`, plain English,
  no emoji, no quotation marks around the whole prompt;
- **not** be a yes/no question, a list request ("name three…"), or a trivia
  question with a right answer;
- **not** duplicate or closely paraphrase an existing question in the bank
  (the validator flags token-set similarity ≥ 0.8 across the whole bank);
- fit the **category** it is placed in, including its stated description.

Good: `What is a small habit that changed your week more than you expected?`
Bad: `Do you like coffee?` (yes/no) · `What did you think of the election?`
(politics) · `Name three apps you use daily.` (list, no `?`) ·
`What is the capital of France?` (trivia).

## Categories are fixed, and each has a ceiling

Add questions only to categories that already exist in the bank. Never create,
rename, reorder, or delete a category; new categories arrive by a manual PR.

Every category holds **at most 80 questions** (the validator enforces it).
Before writing, count each category: if adding `N` would exceed 80, add only as
many as fit, and **skip categories that are already full**. When every category
is full, do not open a PR; finish with a summary saying the bank is at capacity.
Removing or replacing questions is never part of this routine — retirement of
weak questions is a separate, human-led task driven by usage analytics.

## Output contract

- **Append only.** Never edit, reword, or remove an existing question.
- New `id` = the category slug plus the next three-digit number after the
  current maximum in that category, e.g. `travel-places-021`.
- New `added` = today's date.
- Keep the file's existing key order (`id`, `text`, `added`) and two-space JSON
  indentation. Do not reformat untouched lines.

## Steps

1. Read the bank. For each category, count its questions (skip it at 80) and
   list the existing ones so you avoid near-duplicates, then write up to `N`
   new ones that widen the range of angles
   (time frames, senses, people, places, emotions, "why" vs "how" vs "when").
2. Append them and run, from the repo root:

   ```
   npm run validate:tabletopics
   npx vitest run --project apps/table-topics
   ```

   Fix every reported problem and rerun until both pass.
3. Create branch `content/tt-questions-YYYY-MM-DD`, commit
   `content(tabletopics): +<total> questions for YYYY-MM-DD`, push, and open a
   pull request against `master` titled the same, whose body lists the number
   added per category and three sample questions. Use `gh pr create`.
4. **Never merge.** A human reviews and merges; merging deploys the site.

If the validator cannot be made to pass, or `questions.json` is not valid JSON
when you start, stop and open an issue instead of a PR.
