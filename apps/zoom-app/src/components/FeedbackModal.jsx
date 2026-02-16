import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { trackEvent } from '../utils/posthog';

const FEEDBACK_TYPES = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
];

export default function FeedbackModal({ isOpen, onClose }) {
  const [feedbackType, setFeedbackType] = useState('feedback');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = `[${feedbackType}] ${message.trim()}`;
      trackEvent('survey sent', {
        $survey_id: '019be741-9e6c-0000-ac0f-7d4e14f331f2',
        $survey_response: response,
        $survey_response_0: response,
        feedback_type: feedbackType,
      });
      setSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setFeedbackType('feedback');
    setSubmitted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Send Us Feedback</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <p className="text-green-600 font-medium py-4 text-center">
            Thank you for your feedback!
          </p>
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
                onClick={handleClose}
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
