import { render, screen } from '@testing-library/react';
import Footer from './Footer';

const EXPECTED_ADD_TO_ZOOM_URL =
  'https://zoom.us/oauth/authorize?response_type=code&client_id=DsFHK5sNQs2_VFyeQky2sg&redirect_uri=https://www.timer.simple-tech.app/oauth/redirect';

describe('Footer', () => {
  it('"Add to Zoom" links to the exact OAuth authorize URL', () => {
    render(<Footer />);

    const link = screen.getByRole('link', { name: /add to zoom/i });
    expect(link).toHaveAttribute('href', EXPECTED_ADD_TO_ZOOM_URL);
  });
});
