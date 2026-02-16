import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSurveys } from '../hooks/useSurveys';
import { trackEvent } from '../utils/posthog';
import FeedbackModal from './FeedbackModal';

export default function Footer() {
  const { showSurvey } = useSurveys();
  const [isHandlingClick, setIsHandlingClick] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleFeedbackClick = async () => {
    if (isHandlingClick) return;

    setIsHandlingClick(true);

    try {
      trackEvent('feedback_button_clicked');

      // Try PostHog's survey widget first (works in browser)
      const displayed = await showSurvey();

      if (displayed) {
        trackEvent('feedback_survey_displayed');
      } else {
        // PostHog survey unavailable (e.g. inside Zoom) — show inline form
        setShowFeedbackModal(true);
        trackEvent('feedback_fallback_modal');
      }
    } catch {
      // On any error, fall back to inline form
      setShowFeedbackModal(true);
      trackEvent('feedback_fallback_modal');
    } finally {
      setIsHandlingClick(false);
    }
  };

  return (
    <>
      <footer className="w-full border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-center">
        <button
          id="feedback-button"
          onClick={handleFeedbackClick}
          disabled={isHandlingClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Provide feedback or request features"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{isHandlingClick ? 'Loading...' : 'Send Us Feedback / Request New Features'}</span>
        </button>
      </footer>
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </>
  );
}
