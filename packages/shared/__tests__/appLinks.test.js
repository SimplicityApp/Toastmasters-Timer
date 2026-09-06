import { TOOLS, TIMER_APP_URL, ZOOM_MARKETPLACE_REVIEW_URL } from '../appLinks.js';

describe('TOOLS registry', () => {
  it('lists at least the timer and the Table Topics generator', () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(slugs).toContain('timer');
    expect(slugs).toContain('table-topics');
  });

  it('has a unique slug per tool', () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every tool a name, a tagline and an https URL without a trailing slash', () => {
    for (const tool of TOOLS) {
      expect(tool.name, tool.slug).toBeTruthy();
      expect(tool.tagline, tool.slug).toBeTruthy();
      expect(tool.url, tool.slug).toMatch(/^https:\/\//);
      expect(tool.url, tool.slug).not.toMatch(/\/$/);
    }
  });
});

describe('TIMER_APP_URL', () => {
  it('lives under the timer tool URL', () => {
    const timer = TOOLS.find((tool) => tool.slug === 'timer');
    expect(TIMER_APP_URL.startsWith(`${timer.url}/`)).toBe(true);
  });
});

describe('ZOOM_MARKETPLACE_REVIEW_URL', () => {
  it('is still exported', () => {
    expect(ZOOM_MARKETPLACE_REVIEW_URL).toMatch(/^https:\/\/marketplace\.zoom\.us\//);
  });
});
