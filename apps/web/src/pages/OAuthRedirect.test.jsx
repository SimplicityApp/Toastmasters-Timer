import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { trackEvent } from '../utils/posthog';
import OAuthRedirect from './OAuthRedirect';

describe('OAuthRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires zoom_app_installed event on mount', () => {
    render(
      <MemoryRouter initialEntries={['/oauth/redirect']}>
        <OAuthRedirect />
      </MemoryRouter>
    );

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('zoom_app_installed', {
      source: 'oauth_redirect',
    });
  });

  it('includes URL query params in the event properties', () => {
    render(
      <MemoryRouter initialEntries={['/oauth/redirect?code=abc123&state=xyz']}>
        <OAuthRedirect />
      </MemoryRouter>
    );

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('zoom_app_installed', {
      source: 'oauth_redirect',
      code: 'abc123',
      state: 'xyz',
    });
  });

  it('renders the success page content', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/oauth/redirect']}>
        <OAuthRedirect />
      </MemoryRouter>
    );

    expect(getByText('Zoom app installed successfully')).toBeInTheDocument();
  });
});
