import { page } from './layout.mjs';

export function notFoundPage(config) {
  const body = `
      <section class="static-card static-content">
        <h1>Page not found</h1>
        <p>That page does not exist. Try a random question instead.</p>
        <p><a class="static-inline-cta" href="/">Table Topics Generator &rarr;</a></p>
        <ul>
          <li><a href="/topics/">All categories</a></li>
          <li><a href="/today/">Today&rsquo;s set</a></li>
        </ul>
      </section>`;
  return page(config, {
    title: 'Page not found – Table Topics Generator',
    description: 'This page does not exist.',
    path: '/404.html',
    body,
    noindex: true,
  });
}
