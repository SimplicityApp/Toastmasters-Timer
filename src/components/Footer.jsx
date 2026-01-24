import { useState } from 'react';
import { usePostHog } from '@posthog/react';
import { MessageSquare } from 'lucide-react';
import { useSurveys } from '../hooks/useSurveys';
import { trackEvent } from '../utils/posthog';
import { useToast } from '../context/ToastContext';

export default function Footer() {
  const posthog = usePostHog();
  const { showSurvey, isLoading } = useSurveys();
  const { showToast } = useToast();
  const [isHandlingClick, setIsHandlingClick] = useState(false);

  const handleFeedbackClick = async () => {
    if (isHandlingClick || isLoading) {
      return;
    }

    setIsHandlingClick(true);
    
    try {
      // Track that feedback button was clicked
      trackEvent('feedback_button_clicked');

      // Manually fetch and display the first available survey
      const displayed = await showSurvey();

      if (displayed) {
        trackEvent('feedback_survey_displayed');
      } else {
        // No surveys available
        showToast('Thank you for wanting to provide feedback! We\'re currently setting up feedback surveys. Please check back soon.', 'info');
        trackEvent('feedback_no_surveys_available');
      }
    } catch (error) {
      console.error('Failed to display feedback survey:', error);
      showToast('Unable to load feedback form. Please try again later.', 'error');
      trackEvent('feedback_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsHandlingClick(false);
    }
  };

  return (
    <footer className="w-full border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-center">
      <button
        id="feedback-button"
        onClick={handleFeedbackClick}
        disabled={isHandlingClick || isLoading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Provide feedback or request features"
      >
        <MessageSquare className="w-4 h-4" />
        <span>{isHandlingClick || isLoading ? 'Loading...' : 'Send Us Feedback / Request New Features'}</span>
      </button>
    </footer>
  );
}
