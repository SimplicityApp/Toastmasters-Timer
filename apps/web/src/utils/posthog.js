import posthog from 'posthog-js';

/**
 * Initialize PostHog analytics
 * Gracefully handles failures - app will work without PostHog
 */
export function initPostHog() {
  const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  if (!posthogKey || !posthogHost) {
    return null;
  }

  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: 'always',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      // Keep surveys enabled but we'll control display manually
      disable_surveys: false,
      loaded: (posthog) => {
        // Prevent automatic survey display by intercepting it
        const originalDisplaySurvey = posthog.displaySurvey;
        let isManualDisplay = false;

        posthog.displaySurvey = function(surveyId) {
          if (isManualDisplay) {
            isManualDisplay = false;
            return originalDisplaySurvey.call(this, surveyId);
          }
          return false;
        };

        posthog._allowManualSurveyDisplay = function() {
          isManualDisplay = true;
        };
      }
    });

    return posthog;
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
    return null;
  }
}

/**
 * Track a custom event with PostHog
 * Safely handles cases where PostHog is not initialized
 *
 * @param {string} eventName - Event name in snake_case (e.g., 'timer_started')
 * @param {Object} properties - Event properties
 */
export function trackEvent(eventName, properties = {}) {
  try {
    if (posthog && posthog.__loaded) {
      posthog.capture(eventName, properties);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('PostHog tracking failed:', error);
    }
  }
}

/**
 * Identify a user
 *
 * @param {string} userId - Unique user identifier
 * @param {Object} userProperties - User properties
 */
export function identifyUser(userId, userProperties = {}) {
  try {
    if (posthog && posthog.__loaded) {
      posthog.identify(userId, userProperties);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('PostHog identify failed:', error);
    }
  }
}

/**
 * Reset user identification (for logout)
 */
export function resetUser() {
  try {
    if (posthog && posthog.__loaded) {
      posthog.reset();
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('PostHog reset failed:', error);
    }
  }
}

/**
 * Get active surveys available for the current user
 * @returns {Promise<Array>} Array of survey objects
 */
export async function getActiveSurveys() {
  try {
    if (posthog && posthog.__loaded) {
      await new Promise((resolve) => {
        if (posthog.__surveysLoaded) {
          resolve();
        } else {
          posthog.onSurveysLoaded(() => resolve());
        }
      });

      if (typeof posthog.getActiveMatchingSurveys === 'function') {
        const surveys = posthog.getActiveMatchingSurveys();
        return Array.isArray(surveys) ? surveys : [];
      }

      if (typeof posthog.getSurveys === 'function') {
        const surveys = typeof posthog.getSurveys.then === 'function'
          ? await posthog.getSurveys()
          : posthog.getSurveys();
        return Array.isArray(surveys) ? surveys : [];
      }
    }
    return [];
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error getting active surveys:', error);
    }
    return [];
  }
}

/**
 * Get a specific survey by ID
 * @param {string} surveyId - The ID of the survey to retrieve
 * @returns {Promise<Object|null>} Survey object or null if not found
 */
export async function getSurveyById(surveyId) {
  try {
    const surveys = await getActiveSurveys();
    const survey = surveys.find((s) => (s.id || s.surveyId) === surveyId);
    return survey || null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error getting survey by ID:', error);
    }
    return null;
  }
}

/**
 * Display a survey by ID manually
 * @param {string} surveyId - Optional survey ID. If not provided, displays first available survey
 * @returns {Promise<boolean>} True if survey was displayed, false otherwise
 */
export async function displaySurveyById(surveyId = null) {
  try {
    if (!posthog || !posthog.__loaded) {
      return false;
    }

    await new Promise((resolve) => {
      if (posthog.__surveysLoaded) {
        resolve();
      } else {
        posthog.onSurveysLoaded(() => resolve());
      }
    });

    if (surveyId) {
      if (typeof posthog._allowManualSurveyDisplay === 'function') {
        posthog._allowManualSurveyDisplay();
      }
      posthog.displaySurvey(surveyId);
      return true;
    } else {
      const surveys = await getActiveSurveys();
      if (surveys.length > 0) {
        const firstSurvey = surveys[0];
        const id = firstSurvey.id || firstSurvey.surveyId;
        if (id) {
          if (typeof posthog._allowManualSurveyDisplay === 'function') {
            posthog._allowManualSurveyDisplay();
          }
          posthog.displaySurvey(id);
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error displaying survey:', error);
    }
    return false;
  }
}
