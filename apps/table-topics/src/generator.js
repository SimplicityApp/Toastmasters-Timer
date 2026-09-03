// Browser behaviour for the generator card and the Today page. The build
// inlines ./lib/rng.js, ./lib/picker.js and ./lib/links.js above this code
// (imports are stripped), so this file must only use their exported names.
import { drawUnseen, flattenQuestions, todaySet, utcDateString } from './lib/picker.js';
import { timerDeepLink, shareLink } from './lib/links.js';

const TIMER_APP_URL = '__TIMER_APP_URL__';
const SEEN_KEY = 'tt_seen_v1';
const SEEN_MAX = 2000;
const LIST_VISIBLE = 40;

// Questions this browser has already been shown, so the draw cycles through
// unseen ones first. Storage can be unavailable (private mode, blocked); the
// feature simply degrades to plain random.
function loadSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveSeen(seen) {
  try {
    const arr = [...seen];
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr.slice(Math.max(0, arr.length - SEEN_MAX))));
  } catch {
    /* ignore */
  }
}

function track(name, props) {
  if (typeof window.ttTrack === 'function') window.ttTrack(name, props);
}

let bankPromise = null;
function loadBank() {
  if (!bankPromise) {
    bankPromise = fetch('/questions.json', { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`questions.json ${r.status}`))))
      .catch((err) => {
        console.warn('Table Topics: could not load questions', err);
        return null;
      });
  }
  return bankPromise;
}

function randomSeed() {
  const buf = new Uint32Array(1);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  return buf[0];
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function initGenerator(root) {
  const textEl = root.querySelector('[data-tt-text]');
  const catLink = root.querySelector('[data-tt-category-link]');
  const timeLink = root.querySelector('[data-tt-time]');
  const statusEl = root.querySelector('[data-tt-status]');
  const chips = Array.from(root.querySelectorAll('[data-tt-chip]'));
  const fixedCategory = root.dataset.ttCategory || '';
  let category = fixedCategory;
  let current = { id: root.dataset.ttInitial, text: textEl.textContent.trim() };
  let pool = [];
  let all = [];
  let statusTimer = null;
  const seen = loadSeen();
  if (current.id) {
    seen.add(current.id);
    saveSeen(seen);
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(() => (statusEl.textContent = ''), 2200);
  }

  function draw() {
    const { question, cycled } = drawUnseen(pool, randomSeed(), current.id, seen);
    if (cycled) {
      // Every question in this pool has been shown; start a new cycle.
      for (const q of pool) seen.delete(q.id);
      setStatus('You have seen every question here — starting over');
    }
    return question;
  }

  function render(q, source) {
    current = q;
    seen.add(q.id);
    saveSeen(seen);
    // Set the text synchronously (background tabs throttle rAF); the class
    // only drives a short fade.
    textEl.textContent = q.text;
    textEl.classList.add('is-changing');
    setTimeout(() => textEl.classList.remove('is-changing'), 120);
    if (catLink) {
      catLink.textContent = q.categoryName;
      catLink.href = `/topics/${q.category}/`;
    }
    timeLink.href = timerDeepLink(q.text, TIMER_APP_URL);
    const url = new URL(window.location.href);
    url.searchParams.set('q', q.id);
    history.replaceState(null, '', url);
    track('tt_question_shown', { question_id: q.id, category: q.category, source });
  }

  function rebuildPool() {
    pool = category ? all.filter((q) => q.category === category) : all;
  }

  root.querySelector('[data-tt-new]').addEventListener('click', () => {
    if (!pool.length) return setStatus('Questions are still loading…');
    render(draw(), 'random');
  });

  root.querySelector('[data-tt-copy]').addEventListener('click', async () => {
    const ok = await copyText(current.text);
    setStatus(ok ? 'Question copied' : 'Copy failed — select the text instead');
    track('tt_question_copied', { question_id: current.id, ok });
  });

  root.querySelector('[data-tt-share]').addEventListener('click', async () => {
    const link = shareLink(window.location.origin, window.location.pathname, current.id);
    const ok = await copyText(link);
    setStatus(ok ? 'Link copied' : link);
    track('tt_share_copied', { question_id: current.id, ok });
  });

  root.querySelector('[data-tt-print]').addEventListener('click', () => {
    track('tt_print_clicked', { page: window.location.pathname });
    window.print();
  });

  timeLink.addEventListener('click', () => {
    track('tt_timer_deeplink_clicked', { question_id: current.id, category: current.category || category });
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      category = chip.dataset.ttChip;
      chips.forEach((c) => {
        const active = c === chip;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      root.dataset.ttCategory = category;
      rebuildPool();
      track('tt_category_selected', { category: category || 'all' });
      if (pool.length) render(draw(), 'random');
    });
  });

  loadBank().then((bank) => {
    if (!bank) return;
    all = flattenQuestions(bank.categories);
    rebuildPool();
    const shared = new URLSearchParams(window.location.search).get('q');
    const match = shared && all.find((q) => q.id === shared);
    if (match && match.id !== current.id) {
      if (!fixedCategory || match.category === fixedCategory) render(match, 'share');
    } else {
      const initial = all.find((q) => q.id === current.id);
      if (initial) current = initial;
      track('tt_question_shown', { question_id: current.id, category: current.category || category, source: shared ? 'share' : 'initial' });
    }
  });
}

function initToday(root) {
  const builtFor = root.dataset.builtFor;
  const today = utcDateString();
  root.querySelectorAll('[data-tt-print]').forEach((b) => b.addEventListener('click', () => window.print()));
  if (builtFor === today) {
    track('tt_today_viewed', { date: today, swapped: false });
    return;
  }
  loadBank().then((bank) => {
    if (!bank) return;
    const set = todaySet(bank.categories, today, 10);
    const list = root.querySelector('[data-tt-today-list] ol');
    if (!list) return;
    list.textContent = '';
    for (const q of set) {
      const li = document.createElement('li');
      li.id = q.id;
      const text = document.createElement('span');
      text.className = 'tt-list-text';
      text.textContent = q.text;
      const actions = document.createElement('span');
      actions.className = 'tt-list-actions';
      const cat = document.createElement('a');
      cat.className = 'tt-list-cat';
      cat.href = `/topics/${q.category}/`;
      cat.textContent = q.categoryName;
      const time = document.createElement('a');
      time.className = 'tt-list-time';
      time.href = timerDeepLink(q.text, TIMER_APP_URL);
      time.rel = 'noopener';
      time.textContent = 'Time this';
      actions.append(cat, time);
      li.append(text, actions);
      list.appendChild(li);
    }
    const dateEl = root.querySelector('[data-tt-today-date]');
    if (dateEl) {
      dateEl.textContent = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      dateEl.setAttribute('datetime', today);
    }
    root.dataset.builtFor = today;
    track('tt_today_viewed', { date: today, swapped: true });
  });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-tt-list-time]');
  if (a) track('tt_timer_deeplink_clicked', { question_id: a.closest('li')?.id || null, source: 'list' });
});

// Long category lists: show the first LIST_VISIBLE, reveal the rest on demand.
// Progressive enhancement — without JavaScript the whole list is visible, and
// crawlers always get the full list in the HTML.
function initCollapsible(list) {
  const items = list.querySelectorAll('li');
  const button = document.querySelector(`[data-tt-show-all="${list.id}"]`);
  if (items.length <= LIST_VISIBLE || !button) return;
  const targetId = (window.location.hash || '').slice(1) || new URLSearchParams(window.location.search).get('q');
  const targetIndex = targetId ? [...items].findIndex((li) => li.id === targetId) : -1;
  if (targetIndex >= LIST_VISIBLE) return; // a shared link points into the hidden part
  list.classList.add('is-collapsed');
  button.hidden = false;
  button.addEventListener('click', () => {
    list.classList.remove('is-collapsed');
    button.hidden = true;
    track('tt_list_expanded', { count: items.length, page: window.location.pathname });
  });
}

document.querySelectorAll('[data-tt-generator]').forEach(initGenerator);
document.querySelectorAll('[data-tt-collapsible]').forEach(initCollapsible);
document.querySelectorAll('[data-tt-today]').forEach(initToday);
