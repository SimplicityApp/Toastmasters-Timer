import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClubSurveyModal from './ClubSurveyModal';
import { CLUB_SURVEY_ID } from '@toastmaster-timer/shared';
import { trackEvent, setUserProperties } from '../utils/posthog';

function renderModal(overrides = {}) {
  const props = {
    isOpen: true,
    onAnswered: vi.fn(),
    onDismiss: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
  render(<ClubSurveyModal {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ClubSurveyModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByLabelText(/club name/i)).not.toBeInTheDocument();
  });

  it('cannot submit an empty club name', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('reports the club as an event and a person property', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.type(screen.getByLabelText(/club name/i), '  Downtown Speakers  ');
    await user.type(screen.getByLabelText(/district/i), '61');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(setUserProperties).toHaveBeenCalledWith({
      toastmasters_club: 'Downtown Speakers',
      toastmasters_district: '61',
    });
    expect(trackEvent).toHaveBeenCalledWith('club_survey_submitted', {
      club_name: 'Downtown Speakers',
      district: '61',
      source: 'periodic_prompt',
    });
    // Rolls up under the PostHog survey too, now that CLUB_SURVEY_ID is set.
    expect(trackEvent).toHaveBeenCalledWith('survey sent', {
      $survey_id: CLUB_SURVEY_ID,
      $survey_response: 'Downtown Speakers (District 61)',
      $survey_response_0: 'Downtown Speakers (District 61)',
    });
    // Thank-you state first; the parent is told once it has been seen.
    expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    expect(props.onAnswered).not.toHaveBeenCalled();
  });

  it('omits the district when left blank', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/club name/i), 'Downtown Speakers');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(setUserProperties).toHaveBeenCalledWith({ toastmasters_club: 'Downtown Speakers' });
    expect(trackEvent).toHaveBeenCalledWith('club_survey_submitted', {
      club_name: 'Downtown Speakers',
      district: null,
      source: 'periodic_prompt',
    });
  });

  it('dismissing and declining are separate outcomes', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: /not now/i }));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
    expect(props.onDecline).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /don't ask me again/i }));
    expect(props.onDecline).toHaveBeenCalledTimes(1);
  });
});
