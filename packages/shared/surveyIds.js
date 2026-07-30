/**
 * PostHog survey IDs.
 *
 * The in-app modals are our own UI, not PostHog's popup (automatic display is
 * blocked in utils/posthog.js). Responses reach PostHog's Surveys tab by
 * capturing a `survey sent` event carrying `$survey_id`, so each modal needs the
 * ID of a matching survey created in the PostHog dashboard.
 *
 * A null ID is safe: the modal still captures its own event (club_survey_submitted,
 * review_prompt_accepted, ...), so no answers are lost — they just don't roll up
 * under Surveys until the ID is filled in.
 *
 * See docs/POSTHOG_SURVEYS.md for how to create the surveys and where the ID is.
 */

/** Feedback / feature request — FeedbackModal, opened from the footer button. */
export const FEEDBACK_SURVEY_ID = "019be741-9e6c-0000-ac0f-7d4e14f331f2";

/** "Which club are you from?" — ClubSurveyModal, shown by PeriodicPrompts. */
export const CLUB_SURVEY_ID = "019fb2b6-6f6e-0000-3bef-87d4b8b883e4";

/** Zoom Marketplace review ask — ReviewPromptModal, shown by PeriodicPrompts. */
export const REVIEW_SURVEY_ID = "019fb2b7-50fe-0000-e4cb-d5c0cf48891c";
