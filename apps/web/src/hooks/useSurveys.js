import { useCallback, useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { trackEvent } from '../utils/posthog';

/**
 * Hook to manage PostHog Surveys for manual triggering
 * Provides simple functions to get surveys and manage survey display state
 */
export function useSurveys() {
  const posthog = usePostHog();
  const [isLoading, setIsLoading] = useState(false);
  // Cache survey ID for manual display (bypasses dismissed filter)
  const [cachedSurveyId, setCachedSurveyId] = useState(null);
  // Cache all surveys (bypasses targeting conditions)
  const [allSurveys, setAllSurveys] = useState([]);

  // Initialize: Try to get all surveys on mount (bypasses targeting)
  useEffect(() => {
    if (!posthog) return;

    const initializeSurveys = async () => {
      try {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 3000);

          if (posthog.__loaded) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(() => {
              clearTimeout(timeout);
              resolve();
            }, 2000);
          }
        });

        if (posthog.surveys && Array.isArray(posthog.surveys) && posthog.surveys.length > 0) {
          const surveys = posthog.surveys;
          setAllSurveys(surveys);
          const firstSurvey = surveys[0];
          const id = firstSurvey.id || firstSurvey.surveyId;
          if (id && !cachedSurveyId) {
            setCachedSurveyId(id);
          }
        } else {
          if (typeof posthog.getActiveMatchingSurveys === 'function') {
            try {
              posthog.getActiveMatchingSurveys((surveys) => {
                if (surveys && surveys.length > 0) {
                  setAllSurveys(surveys);
                  const firstSurvey = surveys[0];
                  const id = firstSurvey.id || firstSurvey.surveyId;
                  if (id && !cachedSurveyId) {
                    setCachedSurveyId(id);
                  }
                }
              });
            } catch (error) {
              // getActiveMatchingSurveys might not work in all cases
            }
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error initializing surveys:', error);
        }
      }
    };

    initializeSurveys();
  }, [posthog, cachedSurveyId]);

  /**
   * Get active surveys available for the current user
   */
  const fetchActiveSurveys = useCallback(async () => {
    if (!posthog) {
      return [];
    }

    try {
      setIsLoading(true);

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 3000);

        if (posthog.__surveysLoaded) {
          clearTimeout(timeout);
          resolve();
        } else if (typeof posthog.onSurveysLoaded === 'function') {
          posthog.onSurveysLoaded(() => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          setTimeout(() => {
            clearTimeout(timeout);
            resolve();
          }, 1000);
        }
      });

      if (posthog.surveys && Array.isArray(posthog.surveys)) {
        const allSurveysArray = posthog.surveys;
        if (allSurveysArray.length > 0) {
          setAllSurveys(allSurveysArray);
          if (!cachedSurveyId) {
            const firstSurvey = allSurveysArray[0];
            const id = firstSurvey.id || firstSurvey.surveyId;
            if (id) {
              setCachedSurveyId(id);
            }
          }
        }
        return allSurveysArray;
      }

      if (typeof posthog.getActiveMatchingSurveys === 'function') {
        const surveys = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve([]);
          }, 5000);
          try {
            posthog.getActiveMatchingSurveys((surveys, context) => {
              clearTimeout(timeout);
              if (posthog.surveys && Array.isArray(posthog.surveys)) {
                setAllSurveys(posthog.surveys);
              }
              if (context?.error) {
                console.error('Error getting surveys:', context.error);
                resolve([]);
              } else {
                const surveyArray = Array.isArray(surveys) ? surveys : [];
                if (surveyArray.length > 0 && !cachedSurveyId) {
                  const firstSurvey = surveyArray[0];
                  const id = firstSurvey.id || firstSurvey.surveyId;
                  if (id) {
                    setCachedSurveyId(id);
                  }
                }
                resolve(surveyArray);
              }
            });
          } catch (error) {
            clearTimeout(timeout);
            console.error('Error calling getActiveMatchingSurveys:', error);
            resolve([]);
          }
        });
        return surveys;
      }

      if (typeof posthog.getSurveys === 'function') {
        const surveys = typeof posthog.getSurveys.then === 'function'
          ? await posthog.getSurveys()
          : posthog.getSurveys();
        const surveyArray = Array.isArray(surveys) ? surveys : [];
        if (surveyArray.length > 0 && !cachedSurveyId) {
          const firstSurvey = surveyArray[0];
          const id = firstSurvey.id || firstSurvey.surveyId;
          if (id) {
            setCachedSurveyId(id);
          }
        }
        return surveyArray;
      }

      return [];
    } catch (error) {
      console.error('Error getting active surveys:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [posthog, cachedSurveyId]);

  /**
   * Get a specific survey by ID
   */
  const fetchSurveyById = useCallback(async (surveyId) => {
    try {
      setIsLoading(true);
      const surveys = await fetchActiveSurveys();
      const survey = surveys.find((s) => (s.id || s.surveyId) === surveyId);
      return survey || null;
    } catch (error) {
      console.error('Error getting survey by ID:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchActiveSurveys]);

  /**
   * Show a specific survey by ID
   * Returns true if survey was displayed, false otherwise
   */
  const showSurvey = useCallback(async (surveyId = null) => {
    if (!posthog) {
      return false;
    }

    try {
      if (surveyId) {
        trackEvent('survey_shown', { surveyId });

        if (typeof posthog.displaySurvey === 'function') {
          if (typeof posthog._allowManualSurveyDisplay === 'function') {
            posthog._allowManualSurveyDisplay();
          }
          posthog.displaySurvey(surveyId);
          return true;
        }
        return false;
      }

      let surveyIdToDisplay = null;
      let surveyName = 'Unknown';
      let fromCache = false;

      if (cachedSurveyId) {
        surveyIdToDisplay = cachedSurveyId;
        fromCache = true;
      } else if (allSurveys.length > 0) {
        const survey = allSurveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
        fromCache = true;
      } else if (posthog.surveys && Array.isArray(posthog.surveys) && posthog.surveys.length > 0) {
        const directSurveys = posthog.surveys;
        const survey = directSurveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
        setAllSurveys(directSurveys);
        setCachedSurveyId(surveyIdToDisplay);
        fromCache = true;
      }

      if (surveyIdToDisplay) {
        trackEvent('survey_shown', {
          surveyId: surveyIdToDisplay,
          surveyName: surveyName,
          fromCache: fromCache
        });

        if (typeof posthog.displaySurvey === 'function') {
          if (typeof posthog._allowManualSurveyDisplay === 'function') {
            posthog._allowManualSurveyDisplay();
          }
          posthog.displaySurvey(surveyIdToDisplay);
          return true;
        }
        return false;
      }

      const surveys = await fetchActiveSurveys();

      if (surveys.length > 0) {
        const survey = surveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
        if (surveyIdToDisplay && surveyIdToDisplay !== cachedSurveyId) {
          setCachedSurveyId(surveyIdToDisplay);
        }
      } else if (allSurveys.length > 0) {
        const survey = allSurveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
      } else if (cachedSurveyId) {
        surveyIdToDisplay = cachedSurveyId;
      }

      if (surveyIdToDisplay) {
        trackEvent('survey_shown', {
          surveyId: surveyIdToDisplay,
          surveyName: surveyName,
          fromCache: surveys.length === 0
        });

        if (typeof posthog.displaySurvey === 'function') {
          if (typeof posthog._allowManualSurveyDisplay === 'function') {
            posthog._allowManualSurveyDisplay();
          }
          posthog.displaySurvey(surveyIdToDisplay);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error showing survey:', error);
      trackEvent('survey_display_failed', {
        surveyId,
        error: error.message
      });
      return false;
    }
  }, [posthog, fetchActiveSurveys, cachedSurveyId, allSurveys]);

  return {
    fetchActiveSurveys,
    fetchSurveyById,
    showSurvey,
    isLoading,
  };
}
