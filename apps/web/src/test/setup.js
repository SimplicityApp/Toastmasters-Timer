import '@testing-library/jest-dom';

vi.mock('../utils/posthog', () => ({
  initPostHog: vi.fn(),
  trackEvent: vi.fn(),
  identifyUser: vi.fn(),
  resetUser: vi.fn(),
  getActiveSurveys: vi.fn().mockResolvedValue([]),
  getSurveyById: vi.fn().mockResolvedValue(null),
  displaySurveyById: vi.fn().mockResolvedValue(false),
}));

vi.mock('../utils/pageBackground', () => ({
  setPageBackgroundFromStatus: vi.fn(),
  resetPageBackground: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
});
