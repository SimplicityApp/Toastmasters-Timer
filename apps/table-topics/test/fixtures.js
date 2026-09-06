const STEMS = ['Which', 'Why did one', 'How has a', 'When did a', 'Where would a', 'Who taught you a', 'Describe how a', 'Tell us about a', 'Imagine a', 'Compare two', 'Recall a', 'Explain why a', 'Picture a', 'Share a', 'Choose a', 'Defend a'];
const TAILS = ['memory surprised you', 'habit changed your week', 'lesson arrived late', 'choice felt brave', 'mistake taught patience', 'stranger helped you', 'plan fell apart happily', 'tradition still matters', 'skill took years', 'gift meant more than expected', 'morning went perfectly', 'risk paid off', 'promise was hard to keep', 'friendship began oddly', 'place felt like home', 'rule deserved breaking'];

export function fixtureBank(nCats = 3, nQ = 16) {
  const names = ['Icebreakers', 'Travel & Places', 'Leadership', 'Humor', 'Food & Drink'];
  const slugs = ['icebreakers', 'travel-places', 'leadership', 'humor', 'food-drink'];
  return {
    version: 1,
    categories: Array.from({ length: nCats }, (_, c) => ({
      slug: slugs[c],
      name: names[c],
      description: `Prompts about ${names[c].toLowerCase()} for a one to two minute speech.`,
      questions: Array.from({ length: nQ }, (_, i) => ({
        id: `${slugs[c]}-${String(i + 1).padStart(3, '0')}`,
        text: i === 0 && c === 0
          ? `${names[c]} prompt: which "quoted" & <topic a> moment stays with you?`
          : `${STEMS[(i + c) % STEMS.length]} ${names[c].toLowerCase()} ${TAILS[(i + 2 * c) % TAILS.length]}?`,
        added: i < 8 ? '2026-08-01' : '2026-09-02',
      })),
    })),
  };
}

export const fixtureConfig = {
  siteOrigin: 'https://www.tabletopics.toastmusters.com',
  rootOrigin: 'https://www.toastmusters.com',
  timerAppUrl: 'https://www.timer.toastmusters.com/app',
  timerOrigin: 'https://www.timer.toastmusters.com',
  tools: [
    { slug: 'timer', name: 'Toastmusters Timer', url: 'https://www.timer.toastmusters.com', tagline: 't' },
    { slug: 'table-topics', name: 'Table Topics Generator', url: 'https://www.tabletopics.toastmusters.com', tagline: 'g' },
  ],
  posthogKey: '',
  posthogHost: 'https://e.simple-tech.app',
  buildDate: '2026-09-02',
  buildDateLong: 'September 2, 2026',
  assets: {
    'generator.js': '/assets/generator.deadbeef.js',
    'analytics.js': '/assets/analytics.deadbeef.js',
    'tabletopics.css': '/assets/tabletopics.deadbeef.css',
    'content-pages.css': '/assets/content-pages.deadbeef.css',
  },
};
