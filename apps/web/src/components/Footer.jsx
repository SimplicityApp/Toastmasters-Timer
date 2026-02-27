import { useState } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { trackEvent } from '../utils/posthog';
import FeedbackModal, { SURVEY_ID } from './FeedbackModal';

const ZOOM_MARKETPLACE_URL = 'https://zoom.us/oauth/authorize?response_type=code&client_id=DsFHK5sNQs2_VFyeQky2sg&redirect_uri=https://www.timer.simple-tech.app/oauth/redirect';

export default function Footer() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleFeedbackClick = () => {
    trackEvent('survey_opened', { $survey_id: SURVEY_ID });
    setShowFeedbackModal(true);
  };

  return (
    <>
      <footer className="w-full border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-center gap-2">
        <a
          href={ZOOM_MARKETPLACE_URL}
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
