import { X, Star } from 'lucide-react';
import { REVIEW_SURVEY_ID, ZOOM_MARKETPLACE_REVIEW_URL } from '@toastmaster-timer/shared';
import { trackEvent } from '../utils/posthog';
import { openExternalUrl } from '../utils/zoomSdk';
import { useToast } from '../context/ToastContext';

/**
 * Periodic prompt asking for a Zoom App Marketplace review.
 * Shown by PeriodicPrompts, never on its own.
 */
export default function ReviewPromptModal({ isOpen, onAnswered, onDismiss, onDecline }) {
  const { showToast } = useToast();

  const handleReview = async () => {
    trackEvent('review_prompt_accepted', { destination: 'zoom_marketplace' });

    // Only a hand-off that actually worked counts as answered: retiring the
    // prompt after a failed one would cost the review and the chance to ask
    // again. This is the path taken when the client refused the openUrl
    // capability, so leave the modal up and say what happened.
    if (!(await openExternalUrl(ZOOM_MARKETPLACE_REVIEW_URL))) {
      trackEvent('review_link_failed', { destination: 'zoom_marketplace' });
      showToast('Could not open the browser. Search "Toastmaster Timer" in the Zoom App Marketplace.', 'error', 6000);
      return;
    }

    if (REVIEW_SURVEY_ID) {
      trackEvent('survey sent', {
        $survey_id: REVIEW_SURVEY_ID,
        $survey_response: 'opened_zoom_marketplace_review',
        $survey_response_0: 'opened_zoom_marketplace_review',
      });
    }
    onAnswered();
  };

  const handleDismiss = () => {
    if (REVIEW_SURVEY_ID) {
      trackEvent('survey dismissed', { $survey_id: REVIEW_SURVEY_ID });
    }
    onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Enjoying Toastmasters Timer?</h3>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          A review on the Zoom App Marketplace takes a minute and helps other Toastmasters clubs
          find the timer.
        </p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors text-sm"
          >
            Maybe later
          </button>
          <button
            onClick={handleReview}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <Star className="w-4 h-4" />
            Leave a review
          </button>
        </div>

        <button
          onClick={onDecline}
          className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Don&apos;t ask me again
        </button>
      </div>
    </div>
  );
}
