import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewPromptModal from './ReviewPromptModal';
import { ToastProvider } from '../context/ToastContext';
import { ZOOM_MARKETPLACE_REVIEW_URL } from '@toastmaster-timer/shared';
import { openExternalUrl } from '../utils/zoomSdk';
import { trackEvent } from '../utils/posthog';

// Stubbed rather than imported: the real module pulls in @zoom/appssdk, which
// hangs vitest under jsdom.
vi.mock('../utils/zoomSdk', () => ({ openExternalUrl: vi.fn() }));
vi.mock('../utils/posthog', () => ({ trackEvent: vi.fn() }));

function renderModal() {
  const props = { isOpen: true, onAnswered: vi.fn(), onDismiss: vi.fn(), onDecline: vi.fn() };
  render(
    <ToastProvider>
      <ReviewPromptModal {...props} />
    </ToastProvider>
  );
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReviewPromptModal', () => {
  it('sends the user to the Marketplace listing and settles the prompt', async () => {
    const user = userEvent.setup();
    openExternalUrl.mockResolvedValue(true);
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: /leave a review/i }));

    expect(openExternalUrl).toHaveBeenCalledWith(ZOOM_MARKETPLACE_REVIEW_URL);
    await waitFor(() => expect(props.onAnswered).toHaveBeenCalled());
    expect(trackEvent).toHaveBeenCalledWith(
      'survey sent',
      expect.objectContaining({ $survey_response: 'opened_zoom_marketplace_review' })
    );
  });

  // The client refuses openUrl until the capability is live on the published
  // Marketplace version; retiring the prompt here would lose the review entirely.
  it('keeps the prompt askable when the link cannot be opened', async () => {
    const user = userEvent.setup();
    openExternalUrl.mockResolvedValue(false);
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: /leave a review/i }));

    await waitFor(() =>
      expect(screen.getByText(/could not open the browser/i)).toBeInTheDocument()
    );
    expect(props.onAnswered).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('review_link_failed', {
      destination: 'zoom_marketplace',
    });
    // Still on screen, so the user can retry or dismiss it themselves.
    expect(screen.getByRole('button', { name: /leave a review/i })).toBeInTheDocument();
  });
});
