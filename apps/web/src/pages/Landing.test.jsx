import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

const TEST_ZOOM_URL = 'https://zoom.us/oauth/authorize?test=true';

beforeEach(() => {
  import.meta.env.VITE_ZOOM_OAUTH_REDIRECT = TEST_ZOOM_URL;
});

describe('Landing', () => {
  it('every "Add to Zoom" button links to the VITE_ZOOM_OAUTH_REDIRECT env var', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // The header, the hero and the closing band each carry one; they must all
    // point at the same OAuth URL.
    const links = screen.getAllByRole('link', { name: /add to zoom/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', TEST_ZOOM_URL));
  });

  it('shows the clubs in the "Trusted by" strip, with the loop copy hidden from screen readers', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // The marquee renders the list several times for the seamless loop; only
    // one copy may be exposed to assistive tech.
    const chips = screen.getAllByText('Jacaranda Chinese English Toastmasters');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    const exposed = chips.filter((chip) => !chip.closest('[aria-hidden="true"]'));
    expect(exposed).toHaveLength(1);

    expect(screen.getAllByText('Women LEAD Toastmasters')).not.toHaveLength(0);
    expect(screen.getAllByText('Sapphire City Toastmasters')).not.toHaveLength(0);
    expect(screen.getAllByText('Malabar Toastmasters')).not.toHaveLength(0);
  });

  it('introduces John Christensen as Founding Ambassador', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'John Christensen' })).toBeInTheDocument();
    expect(screen.getByText(/Founding Ambassador\s*·\s*Toastmasters Area Director/)).toBeInTheDocument();
  });
});
