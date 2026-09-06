import { page, esc, attr } from './layout.mjs';
import { collectionPage, breadcrumb, itemList } from './seo.mjs';

export function topicsPage(config, bank) {
  const path = '/topics/';
  const total = bank.categories.reduce((n, c) => n + c.questions.length, 0);
  const title = `Table Topics Categories – ${bank.categories.length} Themes, ${total} Questions`;
  const description = `Browse ${total} Toastmasters Table Topics questions by theme: icebreakers, travel, leadership, hypotheticals, would-you-rather, contest-style prompts and more.`;
  const body = `
      <section class="static-card static-content">
        <h1>Table Topics categories</h1>
        <p class="tt-lede">${bank.categories.length} themes, ${total} questions. Every category page lists its questions in full and lets you draw one at random.</p>
        <div class="tt-grid">
          ${bank.categories
            .map(
              (c) => `<a class="tt-card" href="/topics/${attr(c.slug)}/">
            <strong>${esc(c.name)}</strong>
            <span>${esc(c.description)}</span>
            <em>${c.questions.length} questions</em>
          </a>`
            )
            .join('\n          ')}
        </div>
      </section>`;
  const crumbs = [
    { name: 'Table Topics Generator', path: '/' },
    { name: 'Categories', path },
  ];
  return page(config, {
    title,
    description,
    path,
    body,
    breadcrumbs: crumbs,
    jsonLd: [
      collectionPage(config, { name: 'Table Topics categories', description, path }),
      breadcrumb(config, crumbs),
      {
        '@type': 'ItemList',
        numberOfItems: bank.categories.length,
        itemListElement: bank.categories.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          url: `${config.siteOrigin}/topics/${c.slug}/`,
        })),
      },
    ],
  });
}
