import { useCallback, useState, useEffect } from 'react';
import { usePostHog } from '@posthog/react';
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
  // Note: Even with disable_surveys: true, we can still fetch and display surveys manually
  useEffect(() => {
    if (!posthog) return;

    const initializeSurveys = async () => {
      try {
        // Wait a bit for PostHog to initialize with timeout
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

        // Try to access all surveys directly from posthog instance
        // This works even when disable_surveys: true
        if (posthog.surveys && Array.isArray(posthog.surveys) && posthog.surveys.length > 0) {
          const surveys = posthog.surveys;
          setAllSurveys(surveys);
          // Cache first survey ID
          const firstSurvey = surveys[0];
          const id = firstSurvey.id || firstSurvey.surveyId;
          if (id && !cachedSurveyId) {
            setCachedSurveyId(id);
          }
        } else {
          // Fallback: try getActiveMatchingSurveys (may not work with disable_surveys: true)
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
              // getActiveMatchingSurveys might not work with disable_surveys: true
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
      
      // Wait for surveys to be loaded with timeout
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
          // Fallback: wait a bit for surveys to load
          setTimeout(() => {
            clearTimeout(timeout);
            resolve();
          }, 1000);
        }
      });

      // Try to access all surveys directly (bypasses targeting conditions)
      // Check if posthog has a surveys property with all surveys
      if (posthog.surveys && Array.isArray(posthog.surveys)) {
        const allSurveysArray = posthog.surveys;
        // Cache all surveys for manual display
        if (allSurveysArray.length > 0) {
          setAllSurveys(allSurveysArray);
          // Cache first survey ID if not already cached
          if (!cachedSurveyId) {
            const firstSurvey = allSurveysArray[0];
            const id = firstSurvey.id || firstSurvey.surveyId;
            if (id) {
              setCachedSurveyId(id);
            }
          }
        }
        // Return all surveys (not just matching ones)
        return allSurveysArray;
      }

      // Get surveys - PostHog web SDK uses getActiveMatchingSurveys() with callback
      if (typeof posthog.getActiveMatchingSurveys === 'function') {
        const surveys = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve([]);
          }, 5000);
          try {
            posthog.getActiveMatchingSurveys((surveys, context) => {
              clearTimeout(timeout);
              // Try to access all surveys from context or internal state
              if (posthog.surveys && Array.isArray(posthog.surveys)) {
                setAllSurveys(posthog.surveys);
              }
              if (context?.error) {
                console.error('Error getting surveys:', context.error);
                resolve([]);
              } else {
                const surveyArray = Array.isArray(surveys) ? surveys : [];
                // Cache the first survey ID for manual display (bypasses dismissed filter)
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
            resolve([]); // Resolve with empty array instead of rejecting
          }
        });
        return surveys;
      }
      
      // Fallback: try getSurveys if available
      if (typeof posthog.getSurveys === 'function') {
        const surveys = typeof posthog.getSurveys.then === 'function' 
          ? await posthog.getSurveys() 
          : posthog.getSurveys();
        const surveyArray = Array.isArray(surveys) ? surveys : [];
        // Cache survey ID if found
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
   * @param {string|null} surveyId - Optional survey ID. If not provided, displays first available survey.
   *                                 If provided, will attempt to display even if not in matching surveys.
   */
  const showSurvey = useCallback(async (surveyId = null) => {
    if (!posthog) {
      return false;
    }

    try {
      // If specific survey ID provided, display it directly
      if (surveyId) {
        trackEvent('survey_shown', { surveyId });
        
        if (typeof posthog.displaySurvey === 'function') {
          // Mark as manual display to allow it
          if (typeof posthog._allowManualSurveyDisplay === 'function') {
            posthog._allowManualSurveyDisplay();
          }
          posthog.displaySurvey(surveyId);
          return true;
        }
        return false;
      }

      // Check cached data FIRST before fetching
      // This prevents infinite loading in production when onSurveysLoaded never fires
      let surveyIdToDisplay = null;
      let surveyName = 'Unknown';
      let fromCache = false;

      // Priority 1: Use cached survey ID if available
      if (cachedSurveyId) {
        surveyIdToDisplay = cachedSurveyId;
        fromCache = true;
      }
      // Priority 2: Use allSurveys cache if available
      else if (allSurveys.length > 0) {
        const survey = allSurveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
        fromCache = true;
      }
      // Priority 3: Try to access surveys directly from posthog instance
      else if (posthog.surveys && Array.isArray(posthog.surveys) && posthog.surveys.length > 0) {
        const directSurveys = posthog.surveys;
        const survey = directSurveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
        setAllSurveys(directSurveys);
        setCachedSurveyId(surveyIdToDisplay);
        fromCache = true;
      }

      // If we have cached data, use it immediately without fetching
      if (surveyIdToDisplay) {
        trackEvent('survey_shown', { 
          surveyId: surveyIdToDisplay,
          surveyName: surveyName,
          fromCache: fromCache
        });
        
        if (typeof posthog.displaySurvey === 'function') {
          // Mark as manual display to allow it
          if (typeof posthog._allowManualSurveyDisplay === 'function') {
            posthog._allowManualSurveyDisplay();
          }
          posthog.displaySurvey(surveyIdToDisplay);
          return true;
        }
        return false;
      }

      // Only fetch if we don't have cached data
      // fetchActiveSurveys manages its own loading state
      const surveys = await fetchActiveSurveys();
      
      // After fetching, try to find a survey to display
      if (surveys.length > 0) {
        const survey = surveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
        // Update cache if needed
        if (surveyIdToDisplay && surveyIdToDisplay !== cachedSurveyId) {
          setCachedSurveyId(surveyIdToDisplay);
        }
      } else if (allSurveys.length > 0) {
        // Use cached allSurveys if fetch returned nothing
        const survey = allSurveys[0];
        surveyIdToDisplay = survey.id || survey.surveyId;
        surveyName = survey.name || 'Unknown';
      } else if (cachedSurveyId) {
        // Use cached ID as last resort
        surveyIdToDisplay = cachedSurveyId;
      }
      
      if (surveyIdToDisplay) {
        trackEvent('survey_shown', { 
          surveyId: surveyIdToDisplay,
          surveyName: surveyName,
          fromCache: surveys.length === 0
        });
        
        if (typeof posthog.displaySurvey === 'function') {
          // Mark as manual display to allow it
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
