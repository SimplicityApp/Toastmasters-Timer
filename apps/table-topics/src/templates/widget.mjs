import { esc, attr } from './layout.mjs';
import { timerDeepLink } from '../lib/links.js';

/**
 * The interactive generator card. Rendered with a real question so the page
 * has content before JavaScript runs; src/generator.js takes over from there.
 * `categorySlug` is '' for "all categories".
 */
export function widget(config, { categories, categorySlug, initial, showChips }) {
  const chips = showChips
    ? `
        <div class="tt-chips" role="group" aria-label="Choose a category">
          <button type="button" class="tt-chip${categorySlug ? '' : ' is-active'}" data-tt-chip="" aria-pressed="${categorySlug ? 'false' : 'true'}">All</button>
          ${categories
            .map(
              (c) =>
                `<button type="button" class="tt-chip${c.slug === categorySlug ? ' is-active' : ''}" data-tt-chip="${attr(c.slug)}" aria-pressed="${c.slug === categorySlug ? 'true' : 'false'}">${esc(c.name)}</button>`
            )
            .join('\n          ')}
        </div>`
    : '';
  return `
      <section class="static-card tt-generator" data-tt-generator data-tt-category="${attr(categorySlug)}" data-tt-initial="${attr(initial.id)}" aria-labelledby="tt-your-question">
        ${chips}
        <p class="tt-kicker" id="tt-your-question">Your question</p>
        <blockquote class="tt-question" data-tt-text>${esc(initial.text)}</blockquote>
        <p class="tt-meta"><a href="/topics/${attr(initial.category)}/" data-tt-category-link>${esc(initial.categoryName)}</a></p>
        <div class="tt-actions">
          <button type="button" class="static-cta-primary tt-btn" data-tt-new>New question</button>
          <a class="static-cta-secondary tt-btn" data-tt-time href="${attr(timerDeepLink(initial.text, config.timerAppUrl))}" rel="noopener">Time this (1–2 min)</a>
          <button type="button" class="tt-btn tt-btn-ghost" data-tt-copy>Copy</button>
          <button type="button" class="tt-btn tt-btn-ghost" data-tt-share>Copy link</button>
          <button type="button" class="tt-btn tt-btn-ghost" data-tt-print>Print</button>
        </div>
        <p class="tt-status" data-tt-status role="status" aria-live="polite"></p>
        <noscript><p class="static-note">Enable JavaScript for random questions, or scroll down: every question is listed on its category page.</p></noscript>
      </section>`;
}

export const LIST_VISIBLE = 40;

export function questionList(config, path, questions, { numbered = true, collapsible = false, id = 'tt-list' } = {}) {
  const tag = numbered ? 'ol' : 'ul';
  const extra = collapsible ? ` id="${attr(id)}" data-tt-collapsible` : '';
  return `
        <${tag} class="tt-list"${extra}>
          ${questions
            .map(
              (q) => `<li id="${attr(q.id)}">
            <span class="tt-list-text">${esc(q.text)}</span>
            <span class="tt-list-actions">
              ${q.categoryName && !path.startsWith('/topics/') ? `<a class="tt-list-cat" href="/topics/${attr(q.category)}/">${esc(q.categoryName)}</a>` : ''}
              <a class="tt-list-time" href="${attr(timerDeepLink(q.text, config.timerAppUrl))}" rel="noopener" data-tt-list-time>Time this</a>
            </span>
          </li>`
            )
            .join('\n          ')}
        </${tag}>`;
}
