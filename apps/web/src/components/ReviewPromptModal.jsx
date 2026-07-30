import { X, ExternalLink, Star } from 'lucide-react';
import { REVIEW_SURVEY_ID, ZOOM_MARKETPLACE_REVIEW_URL } from '@toastmaster-timer/shared';
import { trackEvent } from '../utils/posthog';

/**
 * Periodic prompt for browser users: suggest installing the Zoom app, and give
 * those who already have it a way to review it.
 * Shown by PeriodicPrompts, never on its own.
 */
export default function ReviewPromptModal({ isOpen, onAnswered, onDismiss, onDecline }) {
  const addToZoomUrl = import.meta.env.VITE_ZOOM_OAUTH_REDIRECT;

  const handleInstall = () => {
    trackEvent('zoom_install_prompt_accepted', { source: 'periodic_prompt' });
    onAnswered();
  };

  const handleReview = () => {
    trackEvent('review_prompt_accepted', { destination: 'zoom_marketplace' });
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
          <h3 className="text-lg font-semibold">Do you meet on Zoom?</h3>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          The Zoom app changes your virtual background to green, yellow and red automatically, so
          speakers see the timing without watching a second screen.
        </p>

        <div className="flex flex-col gap-2">
          {/* Without the install URL configured the link would go nowhere while
              still counting as an answer, so drop it rather than show a dead CTA. */}
          {addToZoomUrl && (
            <a
              href={addToZoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstall}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm no-underline"
            >
              <ExternalLink className="w-4 h-4" />
              Add to Zoom
            </a>
          )}
          <a
            href={ZOOM_MARKETPLACE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReview}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors text-sm no-underline"
          >
            <Star className="w-4 h-4" />
            Already installed? Leave a review
          </a>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
          >
            Not now
          </button>
        </div>

        <button
          onClick={onDecline}
          className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Don&apos;t ask me again
        </button>
      </div>
    </div>
  );
}
