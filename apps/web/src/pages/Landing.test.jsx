import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

const TEST_ZOOM_URL = 'https://zoom.us/oauth/authorize?test=true';

beforeEach(() => {
  import.meta.env.VITE_ZOOM_OAUTH_REDIRECT = TEST_ZOOM_URL;
});

describe('Landing', () => {
  it('"Add to Zoom" links to the VITE_ZOOM_OAUTH_REDIRECT env var', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /add to zoom/i });
    expect(link).toHaveAttribute('href', TEST_ZOOM_URL);
  });
});
