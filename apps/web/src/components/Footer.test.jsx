import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from './Footer';
import {
  REVIEW_PROMPT,
  ZOOM_MARKETPLACE_REVIEW_URL,
  loadPromptState,
} from '@toastmaster-timer/shared';
import { trackEvent } from '../utils/posthog';

const TEST_ZOOM_URL = 'https://zoom.us/oauth/authorize?test=true';

beforeEach(() => {
  import.meta.env.VITE_ZOOM_OAUTH_REDIRECT = TEST_ZOOM_URL;
  vi.clearAllMocks();
});

describe('Footer', () => {
  it('"Add to Zoom" links to the VITE_ZOOM_OAUTH_REDIRECT env var', () => {
    render(<Footer />);

    const link = screen.getByRole('link', { name: /add to zoom/i });
    expect(link).toHaveAttribute('href', TEST_ZOOM_URL);
  });

  it('"Leave a Review" points at the Marketplace listing', () => {
    render(<Footer />);

    const link = screen.getByRole('link', { name: /leave a review/i });
    expect(link).toHaveAttribute('href', ZOOM_MARKETPLACE_REVIEW_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('reviewing from the footer stops the periodic review prompt', async () => {
    const user = userEvent.setup();
    render(<Footer />);

    await user.click(screen.getByRole('link', { name: /leave a review/i }));

    expect(trackEvent).toHaveBeenCalledWith('review_prompt_accepted', {
      destination: 'zoom_marketplace',
      source: 'footer',
    });
    expect(loadPromptState().prompts[REVIEW_PROMPT].resolution).toBe('answered');
  });
});
