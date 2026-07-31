import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackModal from './FeedbackModal';
import {
  CLUB_PROMPT,
  loadPromptState,
  markPromptAnswered,
  markPromptDeclined,
} from '@toastmaster-timer/shared';
import { trackEvent, setUserProperties } from '../utils/posthog';

function renderModal() {
  const onClose = vi.fn();
  render(<FeedbackModal isOpen onClose={onClose} />);
  return { onClose };
}

async function sendFeedback(user, text = 'The timer is great') {
  await user.type(screen.getByPlaceholderText(/tell us what you think/i), text);
  await user.click(screen.getByRole('button', { name: /submit/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FeedbackModal', () => {
  it('sends the feedback under the feedback survey', async () => {
    const user = userEvent.setup();
    markPromptAnswered(CLUB_PROMPT); // club already known — skip the follow-up
    renderModal();

    await sendFeedback(user, 'Please add a bell sound');

    expect(trackEvent).toHaveBeenCalledWith(
      'survey sent',
      expect.objectContaining({
        $survey_response: '[feedback] Please add a bell sound',
        feedback_type: 'feedback',
      })
    );
    expect(screen.getByText(/thank you for your feedback/i)).toBeInTheDocument();
  });

  it('asks for the club after feedback when it is not known yet', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument();
    await sendFeedback(user);

    expect(screen.getByLabelText(/club name/i)).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('club_followup_shown', { after: 'feedback' });

    await user.type(screen.getByLabelText(/club name/i), 'Downtown Speakers');
    await user.type(screen.getByLabelText(/district/i), '61');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(setUserProperties).toHaveBeenCalledWith({
      toastmasters_club: 'Downtown Speakers',
      toastmasters_district: '61',
    });
    expect(trackEvent).toHaveBeenCalledWith('club_survey_submitted', {
      club_name: 'Downtown Speakers',
      district: '61',
      source: 'feedback_followup',
    });
    // Resolving it here stops the periodic prompt from ever asking.
    expect(loadPromptState().prompts[CLUB_PROMPT].resolution).toBe('answered');
  });

  it.each([
    ['answered', markPromptAnswered],
    ['declined', markPromptDeclined],
  ])('skips the follow-up when the club prompt is already %s', async (_label, resolve) => {
    const user = userEvent.setup();
    resolve(CLUB_PROMPT);
    renderModal();

    await sendFeedback(user);

    expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument();
    expect(screen.getByText(/thank you for your feedback/i)).toBeInTheDocument();
  });

  it('counts the follow-up as an ask, so the periodic prompt does not repeat it', async () => {
    const user = userEvent.setup();
    renderModal();

    await sendFeedback(user);

    expect(loadPromptState().prompts[CLUB_PROMPT].asks).toBe(1);
    expect(loadPromptState().lastPromptAt).toBeGreaterThan(0);
  });

  it('closing the thank-you is not reported as a skipped follow-up', async () => {
    const user = userEvent.setup();
    markPromptAnswered(CLUB_PROMPT); // club already known — straight to the thank-you
    const { onClose } = renderModal();

    await sendFeedback(user);
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(trackEvent).not.toHaveBeenCalledWith('club_followup_skipped', expect.anything());
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the user skip the club follow-up without losing the feedback', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await sendFeedback(user);
    await user.click(screen.getByRole('button', { name: /skip/i }));

    expect(trackEvent).toHaveBeenCalledWith('club_followup_skipped', { after: 'feedback' });
    expect(onClose).toHaveBeenCalled();
    // Skipping is not an answer, so the periodic prompt may still ask later.
    expect(loadPromptState().prompts[CLUB_PROMPT].resolution).toBeNull();
  });
});
