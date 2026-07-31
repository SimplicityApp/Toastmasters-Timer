import {
  CLUB_PROMPT,
  CLUB_SURVEY_ID,
  loadPromptState,
  markPromptAnswered,
} from '@toastmaster-timer/shared';
import { trackEvent, setUserProperties } from './posthog';

/**
 * Whether the club question is already settled — answered, or declined via
 * "Don't ask me again". Either way we stop asking, including in the follow-up
 * after someone sends feedback.
 *
 * @returns {boolean}
 */
export function isClubKnown() {
  return loadPromptState().prompts[CLUB_PROMPT]?.resolution != null;
}

/**
 * Record a club answer, wherever it was collected. Kept in one place so the
 * periodic prompt and the post-feedback follow-up report identically.
 *
 * Also resolves the periodic club prompt, so answering in one place stops the
 * other from ever asking.
 *
 * @param {Object} params
 * @param {string} params.club - Club name
 * @param {string} [params.district] - Optional district
 * @param {string} params.source - Where it was collected ('periodic_prompt', 'feedback_followup')
 * @returns {boolean} False if the club name was blank
 */
export function submitClubResponse({ club, district = '', source }) {
  const clubName = club.trim();
  if (!clubName) return false;
  const districtName = district.trim();

  // As a person property the club also segments every other event this user sends.
  setUserProperties({
    toastmasters_club: clubName,
    ...(districtName ? { toastmasters_district: districtName } : {}),
  });
  trackEvent('club_survey_submitted', {
    club_name: clubName,
    district: districtName || null,
    source,
  });

  if (CLUB_SURVEY_ID) {
    const response = districtName ? `${clubName} (District ${districtName})` : clubName;
    trackEvent('survey sent', {
      $survey_id: CLUB_SURVEY_ID,
      $survey_response: response,
      $survey_response_0: response,
    });
  }

  markPromptAnswered(CLUB_PROMPT);
  return true;
}
