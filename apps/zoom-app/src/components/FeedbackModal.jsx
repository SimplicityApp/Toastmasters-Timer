import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { CLUB_PROMPT, FEEDBACK_SURVEY_ID, markPromptShown } from '@toastmaster-timer/shared';
import { trackEvent } from '../utils/posthog';
import { isClubKnown, submitClubResponse } from '../utils/clubSurvey';

const FEEDBACK_TYPES = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
];

// Steps: the form, the club follow-up (only for users whose club we don't know),
// then the thank-you.
const STEP_FORM = 'form';
const STEP_CLUB = 'club';
const STEP_DONE = 'done';

export default function FeedbackModal({ isOpen, onClose }) {
  const [feedbackType, setFeedbackType] = useState('feedback');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(STEP_FORM);
  const [club, setClub] = useState('');
  const [district, setDistrict] = useState('');

  const finishAfterThanks = () => {
    setStep(STEP_DONE);
    setTimeout(handleClose, 1500);
  };

  const handleSubmit = () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = `[${feedbackType}] ${message.trim()}`;
      trackEvent('survey sent', {
        $survey_id: FEEDBACK_SURVEY_ID,
        $survey_response: response,
        $survey_response_0: response,
        feedback_type: feedbackType,
      });

      // Someone who just took the trouble to write feedback is the best moment to
      // ask — but only once, and never if they already told us or opted out.
      if (isClubKnown()) {
        finishAfterThanks();
      } else {
        // Counts as an ask in the scheduler, so PeriodicPrompts does not put the
        // same question back on screen after the next speech.
        markPromptShown(CLUB_PROMPT);
        trackEvent('club_followup_shown', { after: feedbackType });
        setStep(STEP_CLUB);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClubSubmit = () => {
    if (!submitClubResponse({ club, district, source: 'feedback_followup' })) return;
    finishAfterThanks();
  };

  const handleClubSkip = () => {
    trackEvent('club_followup_skipped', { after: feedbackType });
    handleClose();
  };

  const handleDismiss = () => {
    trackEvent('survey dismissed', { $survey_id: FEEDBACK_SURVEY_ID });
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  // The X means something different per step: abandoning the form, skipping the
  // club question, or just closing the thank-you early.
  const closeButtonHandlers = {
    [STEP_FORM]: handleDismiss,
    [STEP_CLUB]: handleClubSkip,
    [STEP_DONE]: handleClose,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {step === STEP_CLUB ? 'One more thing' : 'Send Us Feedback'}
          </h3>
          <button
            onClick={closeButtonHandlers[step]}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === STEP_DONE ? (
          <p className="text-green-600 font-medium py-4 text-center">
            Thank you for your feedback!
          </p>
        ) : step === STEP_CLUB ? (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Thanks — that&apos;s been sent. Which Toastmasters club are you from? Knowing
              which clubs use the timer helps us prioritise what to build next.
            </p>

            <div className="mb-3">
              <label htmlFor="feedback-club-name" className="block text-sm font-medium text-gray-700 mb-1">
                Club name
              </label>
              <input
                id="feedback-club-name"
                type="text"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleClubSubmit()}
                placeholder="e.g. Downtown Speakers"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="feedback-club-district" className="block text-sm font-medium text-gray-700 mb-1">
                District <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="feedback-club-district"
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleClubSubmit()}
                placeholder="e.g. 61"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClubSkip}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors text-sm"
              >
                Skip
              </button>
              <button
                onClick={handleClubSubmit}
                disabled={!club.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                <Send className="w-4 h-4" />
                Submit
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="flex gap-2">
                {FEEDBACK_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFeedbackType(type.value)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      feedbackType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                <Send className="w-4 h-4" />
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
