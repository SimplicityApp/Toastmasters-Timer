import { describe, it, expect } from 'vitest';
import { timerDeepLink, shareLink, TABLE_TOPICS_ROLE } from '../src/lib/links.js';

describe('links', () => {
  it('builds the exact timer deep link the web timer parses', () => {
    expect(TABLE_TOPICS_ROLE).toBe('Table Topics Speech');
    expect(timerDeepLink('Describe a perfect day', 'https://www.timer.toastmusters.com/app')).toBe(
      'https://www.timer.toastmusters.com/app?role=Table%20Topics%20Speech&name=Describe%20a%20perfect%20day'
    );
  });

  it('encodes punctuation in the question safely', () => {
    const url = timerDeepLink('Why do we say "yes" & mean no?', 'https://t.example/app');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('role')).toBe('Table Topics Speech');
    expect(parsed.searchParams.get('name')).toBe('Why do we say "yes" & mean no?');
  });

  it('shareLink points at the page with ?q=<id>', () => {
    expect(shareLink('https://www.tabletopics.toastmusters.com', '/topics/travel-places/', 'travel-places-003')).toBe(
      'https://www.tabletopics.toastmusters.com/topics/travel-places/?q=travel-places-003'
    );
  });
});
