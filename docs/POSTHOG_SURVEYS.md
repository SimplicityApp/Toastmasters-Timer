# PostHog surveys & periodic prompts

Two prompts appear on their own once someone has actually used the timer:

| Prompt | Question | Web app | Zoom app |
| --- | --- | --- | --- |
| `club` | "Which club are you from?" (club name + optional district) | yes | yes |
| `review` | Zoom App Marketplace review | "Add to Zoom", plus a review link for those who already have it | "Leave a review" |

Both questions also have **permanent, user-initiated entry points**, so nobody has to
wait to be asked and a declined prompt is not a dead end:

- The footer carries a **Leave a Review** link in both apps. Using it resolves the
  periodic review prompt, so a self-starter is never asked again.
- **Sending feedback** ends with a one-question club follow-up ("One more thing"),
  shown only to users whose club we don't already know. Answering there resolves the
  periodic club prompt too.

Answering in any entry point counts everywhere, because all of them go through
`submitClubResponse()` in `src/utils/clubSurvey.js`. The `source` property on
`club_survey_submitted` records which one it came from (`periodic_prompt`,
`feedback_followup`).

## How the prompts are displayed

PostHog's own survey popup stays disabled — `initPostHog()` in `src/utils/posthog.js`
overrides `displaySurvey` so PostHog can never pop something up on its own. The
modals are our components, and answers reach PostHog's **Surveys** tab the same way
the existing feedback modal does: a `survey sent` event carrying `$survey_id` and
`$survey_response`.

That means each modal needs the ID of a survey created in the PostHog dashboard.

## Creating the surveys

Do this twice — once for the club question, once for the review ask.

1. PostHog → **Surveys** → **New survey**. This opens a template wizard, not a blank
   form. Take either escape hatch — **Create blank survey** / **open the full editor
   for more control** — or start from the **Open feedback** template, which is the
   single freeform-text one and is equivalent once customised. Do *not* use NPS,
   CSAT, CES (rating scales) or Announcement.
2. **Name** it something you'll recognise in the results list, e.g.
   `Which Toastmasters club?` / `Zoom Marketplace review`.
3. **Question** — the type must match the shape of what the modal sends:
   - Club: **Open text**, question "Which Toastmasters club are you from?".
     The app sends one string (`Club Name (District 61)`), so keep it to a single
     question. Adding a second question here would leave `$survey_response_1`
     permanently empty in the results.
   - Review: **Open text** as well. The app sends the fixed string
     `opened_zoom_marketplace_review`, so this survey is really a counter of who
     took the link. (A Link-type survey would make PostHog own the URL and the
     popup; we don't want that.)

   In API mode **none of this wording is ever shown to a user** — our modal supplies
   its own copy. Question text only labels the results view, and submit-button text,
   message-length validation and question branching do nothing at all. Set the
   question so the results read clearly, then ignore the rest.
4. **Presentation → API.** This is the important one — it stops PostHog rendering its
   own popup and leaves display to the app. The other options (Popover, Feedback
   button, Hosted surveys) all hand the UI back to PostHog.
5. **Display conditions** — leave everything unset (no URL match, no property
   filters, no feature flag, roll out to 100%). The app decides who is asked and
   when; a condition here would silently suppress responses.
6. **Save and launch it.** A draft survey still accepts events, but it won't show
   results, which looks exactly like a broken integration.
7. Copy the ID out of the browser URL — the UUID after `/surveys/`:
   `https://us.posthog.com/project/…/surveys/019be741-9e6c-0000-ac0f-7d4e14f331f2`
8. Paste both into [`packages/shared/surveyIds.js`](../packages/shared/surveyIds.js)
   (`CLUB_SURVEY_ID`, `REVIEW_SURVEY_ID`) and rebuild — they are compiled in, not
   read at runtime.

To confirm it worked: answer the club prompt, then open the survey in PostHog. The
response appears under its results within a minute or so. If the event arrived but
the survey shows nothing, the usual causes are a draft (not launched) survey, a
targeting condition, or an ID typo — check the raw `survey sent` event in
**Activity** and compare its `$survey_id`.

A `null` ID is safe to ship: the modal still captures its own events, so no answers
are lost. They just don't roll up under **Surveys** until the ID is filled in.

## Events captured

| Event | When |
| --- | --- |
| `periodic_prompt_shown` | A prompt was displayed (`prompt: club \| review`) |
| `periodic_prompt_answered` | Club submitted, or a review/install link opened |
| `periodic_prompt_dismissed` | Closed with "Not now" / X — may be asked again later |
| `periodic_prompt_declined` | "Don't ask me again" — never asked again |
| `club_survey_submitted` | Club name, district, and `source` (which entry point) |
| `club_followup_shown` / `club_followup_skipped` | The club question after sending feedback |
| `review_prompt_accepted` | Marketplace review link opened (`source: footer` or the prompt) |
| `zoom_install_prompt_accepted` | "Add to Zoom" clicked from the web prompt |
| `survey sent` / `survey dismissed` | Mirrors the above into PostHog Surveys, when an ID is set |

Submitting the club question also sets the `toastmasters_club` and
`toastmasters_district` **person properties**, so any other event can be broken
down by club.

## Cadence

Timing lives in [`packages/shared/promptScheduler.js`](../packages/shared/promptScheduler.js)
(`PROMPT_RULES`), with history in the `toastmaster_prompts` localStorage key.

**An answered prompt is never shown again.** `isPromptDue()` returns false as soon as
a prompt has a `resolution`, which submitting (or "Don't ask me again") sets. The
re-ask rules below apply *only* to an ask the user closed without answering.

Per prompt: how many finished speeches before the first ask, how many more speeches
*and* days before re-asking a **dismissed** prompt, and a hard cap on total asks.

Current defaults — club: first ask after 3 speeches; if dismissed, re-ask after +5
speeches and 14 days; at most 3 asks ever. Review: after 10 speeches; if dismissed,
+15 speeches and 30 days; at most 3 asks. No two prompts land within 3 days of each
other, and the club question goes first when both are due.

Delivery rules on top of the cadence:

- A prompt is queued by a **finished speech**, then waits 2.5s so it never lands on
  the "Finish" click. Starting the next speaker inside that window defers it to the
  next gap.
- Never while the timer is running.
- In the web app, never while the panel is minimized — that window may be shared
  with the meeting.
- Answering or declining is permanent. A plain dismissal only counts as one ask.

## Dev mode: skipping the waits

Waiting 14 or 30 real days to see a re-ask makes the cadence untestable, so builds
made with `VITE_ENABLE_DEBUG_PANEL=true` drop the **time** gates:

- the 3-day global cooldown between two prompts, and
- `daysBetweenAsks` before re-asking a dismissed prompt.

Everything else is unchanged — usage thresholds, `maxAsks`, and answered/declined
still apply, so a dev build can't nag either. In practice this means you can dismiss
the club prompt, finish 5 more speeches, and see it again immediately; and see the
review prompt right after the club one instead of 3 days later.

`isPromptDebugMode()` in the scheduler reads the flag. Tests pin the behaviour
explicitly with `isPromptDue(key, state, now, { ignoreTimeGates: false })` so they
don't depend on the shell environment.

**The flag is compiled in at build time** (all `VITE_` vars are), so it has to be set
when the bundle is built, not on the Worker:

```bash
VITE_ENABLE_DEBUG_PANEL=true npm run cf:deploy:dev
```

Note the two apps read env differently: `apps/web` sets `envDir` to the repo root so
it picks up the root `.env`, while `apps/zoom-app` does not — for the Zoom app the
variable has to come from the shell (as above). A shell variable works for both,
which is why the command form is the reliable one. Production is unaffected as long
as the flag is absent or `false`; anything other than the exact string `true` is off.

## Testing locally

Prompt history is one localStorage key, so QA is a console call away:

```js
localStorage.setItem('toastmaster_prompts', JSON.stringify({ speechesFinished: 99 }))
```

Reload, finish one speech, and the club prompt appears 2.5s later. Set
`speechesFinished` and clear the `prompts` object to replay any state;
`localStorage.removeItem('toastmaster_prompts')` starts over.

Two things that will look like bugs but aren't: the prompt waits 2.5s after FINISH
before appearing, and in the web app it is suppressed entirely while the panel is
minimized.
