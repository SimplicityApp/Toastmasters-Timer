import { useState } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { trackEvent } from '../utils/posthog';
import FeedbackModal, { SURVEY_ID } from './FeedbackModal';

export default function Footer() {
  const ADD_TO_ZOOM_URL = import.meta.env.VITE_ZOOM_OAUTH_REDIRECT;
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleFeedbackClick = () => {
    trackEvent('survey_opened', { $survey_id: SURVEY_ID });
    setShowFeedbackModal(true);
  };

  return (
    <>
      <footer className="w-full border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-center gap-2">
        <a
          href={ADD_TO_ZOOM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Add to Zoom
        </a>
        <button
          onClick={handleFeedbackClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Send Us Feedback
        </button>
      </footer>
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </>
  );
}
