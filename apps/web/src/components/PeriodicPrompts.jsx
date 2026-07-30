import { useEffect, useState, lazy, Suspense } from 'react';
import {
  CLUB_PROMPT,
  REVIEW_PROMPT,
  loadPromptState,
  markPromptAnswered,
  markPromptDeclined,
  markPromptShown,
  selectDuePrompt,
  subscribeToForcedPrompt,
  subscribeToPromptState,
} from '@toastmaster-timer/shared';
import { useTimerTick } from '../context/TimerContext';
import { trackEvent } from '../utils/posthog';

const ClubSurveyModal = lazy(() => import('./ClubSurveyModal'));
const ReviewPromptModal = lazy(() => import('./ReviewPromptModal'));

// Prompts this app asks. Browser users may not have the Zoom app at all, so the
// REVIEW_PROMPT modal here leads with "Add to Zoom" and offers the review link
// second.
const ENABLED_PROMPTS = [CLUB_PROMPT, REVIEW_PROMPT];

// Breathing room after "Finish" before a modal appears: the user has just
// stopped a speech and may be lining up the next speaker. If they start the
// next one within the delay the prompt stays queued and waits for the next gap.
const SHOW_DELAY_MS = 2500;

/**
 * Shows an occasional prompt (club question, Zoom review) once the user has
 * timed enough speeches. Cadence and history live in the shared prompt
 * scheduler; this component only decides when it is polite to interrupt.
 */
export default function PeriodicPrompts() {
  const { isRunning } = useTimerTick();
  // Queued: due, but waiting for a safe moment. Visible: actually on screen.
  const [queued, setQueued] = useState(null);
  const [visible, setVisible] = useState(null);

  useEffect(
    () =>
      subscribeToPromptState((state) => {
        setQueued((current) => current ?? selectDuePrompt(state, Date.now(), ENABLED_PROMPTS));
      }),
    []
  );

  // Debug panel only: straight to the screen, no cadence and no delay.
  useEffect(
    () =>
      subscribeToForcedPrompt((prompt) => {
        setQueued(null);
        setVisible(prompt);
      }),
    []
  );

  useEffect(() => {
    if (!queued || visible || isRunning) return;

    const timer = setTimeout(() => {
      // Re-check against stored state: another tab or window may have asked
      // since this prompt was queued.
      const due = selectDuePrompt(loadPromptState(), Date.now(), ENABLED_PROMPTS);
      if (!due) {
        setQueued(null);
        return;
      }
      markPromptShown(due);
      trackEvent('periodic_prompt_shown', { prompt: due });
      setVisible(due);
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [queued, visible, isRunning]);

  const close = () => {
    setVisible(null);
    setQueued(null);
  };

  // Answered and declined are both terminal in the scheduler; a plain dismissal
  // just counts as one ask and leaves the prompt eligible later.
  const handleAnswered = (prompt) => {
    markPromptAnswered(prompt);
    trackEvent('periodic_prompt_answered', { prompt });
    close();
  };

  const handleDismiss = (prompt) => {
    trackEvent('periodic_prompt_dismissed', { prompt });
    close();
  };

  const handleDecline = (prompt) => {
    markPromptDeclined(prompt);
    trackEvent('periodic_prompt_declined', { prompt });
    close();
  };

  if (!visible) return null;

  return (
    <Suspense fallback={null}>
      {visible === CLUB_PROMPT && (
        <ClubSurveyModal
          isOpen
          onAnswered={() => handleAnswered(CLUB_PROMPT)}
          onDismiss={() => handleDismiss(CLUB_PROMPT)}
          onDecline={() => handleDecline(CLUB_PROMPT)}
        />
      )}
      {visible === REVIEW_PROMPT && (
        <ReviewPromptModal
          isOpen
          onAnswered={() => handleAnswered(REVIEW_PROMPT)}
          onDismiss={() => handleDismiss(REVIEW_PROMPT)}
          onDecline={() => handleDecline(REVIEW_PROMPT)}
        />
      )}
    </Suspense>
  );
}
