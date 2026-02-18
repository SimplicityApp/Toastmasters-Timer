import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { trackEvent } from '../utils/posthog';
import FeedbackModal, { SURVEY_ID } from './FeedbackModal';

export default function Footer() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleFeedbackClick = () => {
    trackEvent('feedback_button_clicked');
    trackEvent('survey shown', { $survey_id: SURVEY_ID });
    setShowFeedbackModal(true);
  };

  return (
    <>
      <footer className="w-full border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-center">
        <button
          id="feedback-button"
          onClick={handleFeedbackClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors duration-150"
          aria-label="Provide feedback or request features"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Send Us Feedback / Request New Features</span>
        </button>
      </footer>
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </>
  );
}
