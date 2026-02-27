import { render, screen } from '@testing-library/react';
import Footer from './Footer';

const TEST_ZOOM_URL = 'https://zoom.us/oauth/authorize?test=true';

beforeEach(() => {
  import.meta.env.VITE_ZOOM_OAUTH_REDIRECT = TEST_ZOOM_URL;
});

describe('Footer', () => {
  it('"Add to Zoom" links to the VITE_ZOOM_OAUTH_REDIRECT env var', () => {
    render(<Footer />);

    const link = screen.getByRole('link', { name: /add to zoom/i });
    expect(link).toHaveAttribute('href', TEST_ZOOM_URL);
  });
});
