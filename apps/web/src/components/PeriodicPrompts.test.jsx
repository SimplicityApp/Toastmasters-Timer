import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/helpers';
import PeriodicPrompts from './PeriodicPrompts';
import {
  CLUB_PROMPT,
  PROMPT_RULES,
  forcePrompt,
  loadPromptState,
  markPromptAnswered,
  markPromptDeclined,
  recordSpeechFinished,
} from '@toastmaster-timer/shared';

// Long enough to cover SHOW_DELAY_MS in PeriodicPrompts.
const PAST_DELAY_MS = 5000;

function finishSpeeches(count) {
  act(() => {
    for (let i = 0; i < count; i += 1) recordSpeechFinished();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PeriodicPrompts', () => {
  it('shows nothing before the usage threshold', () => {
    renderWithProviders(<PeriodicPrompts />);

    finishSpeeches(PROMPT_RULES[CLUB_PROMPT].firstAskAfterSpeeches - 1);
    act(() => vi.advanceTimersByTime(PAST_DELAY_MS));

    expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument();
  });

  it('shows the club prompt once enough speeches are finished', async () => {
    renderWithProviders(<PeriodicPrompts />);

    finishSpeeches(PROMPT_RULES[CLUB_PROMPT].firstAskAfterSpeeches);

    // Held back until the delay elapses, so it never lands on the "Finish" click.
    expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(PAST_DELAY_MS));
    await waitFor(() => expect(screen.getByLabelText(/club name/i)).toBeInTheDocument());

    // Displaying it counts as an ask, so the cadence starts from here.
    expect(loadPromptState().prompts[CLUB_PROMPT].asks).toBe(1);
  });

  // Deliberately asserted through a terminal resolution rather than the re-ask
  // cadence: the time gates are relaxed in dev builds, so a cadence-based
  // assertion here would pass or fail depending on the developer's local .env.
  // The cadence itself is covered in packages/shared with the mode pinned.
  it.each([
    ['answered', markPromptAnswered],
    ['declined', markPromptDeclined],
  ])('never asks again once the prompt is %s', (_label, resolve) => {
    renderWithProviders(<PeriodicPrompts />);
    resolve(CLUB_PROMPT);

    finishSpeeches(PROMPT_RULES[CLUB_PROMPT].firstAskAfterSpeeches + 50);
    act(() => vi.advanceTimersByTime(PAST_DELAY_MS));

    expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument();
  });

  it('shows a forced prompt with no usage, no delay and no recorded ask', async () => {
    renderWithProviders(<PeriodicPrompts />);

    act(() => forcePrompt(CLUB_PROMPT));

    await waitFor(() => expect(screen.getByLabelText(/club name/i)).toBeInTheDocument());
    expect(loadPromptState().prompts[CLUB_PROMPT].asks).toBe(0);
  });

  it('records the answer when the club prompt is submitted', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<PeriodicPrompts />);

    finishSpeeches(PROMPT_RULES[CLUB_PROMPT].firstAskAfterSpeeches);
    act(() => vi.advanceTimersByTime(PAST_DELAY_MS));
    await waitFor(() => expect(screen.getByLabelText(/club name/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/club name/i), 'Downtown Speakers');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Resolved immediately on submit; the modal then shows its thank-you briefly.
    expect(loadPromptState().prompts[CLUB_PROMPT].resolution).toBe('answered');

    act(() => vi.advanceTimersByTime(PAST_DELAY_MS));
    await waitFor(() =>
      expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument()
    );
  });
});
