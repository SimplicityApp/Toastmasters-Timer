import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

const EXPECTED_ADD_TO_ZOOM_URL =
  'https://zoom.us/oauth/authorize?response_type=code&client_id=DsFHK5sNQs2_VFyeQky2sg&redirect_uri=https://www.timer.simple-tech.app/oauth/redirect';

describe('Landing', () => {
  it('"Add to Zoom" links to the exact OAuth authorize URL', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /add to zoom/i });
    expect(link).toHaveAttribute('href', EXPECTED_ADD_TO_ZOOM_URL);
  });
});
