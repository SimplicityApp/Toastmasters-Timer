// Live usage stats for the landing page's social-proof strip.
//
// The browser never talks to PostHog for this: the query needs a personal API
// key, and the numbers change slowly. So the Worker runs one HogQL query,
// caches the result at the edge for six hours, and the page reads plain JSON
// from its own origin. If anything fails — key missing, PostHog down, shape
// changed — the endpoint still answers 200 with the last numbers we baked in,
// so the strip never breaks the page.

const POSTHOG_HOST = 'https://us.posthog.com';
const POSTHOG_PROJECT_ID = '295629';

// One scan over the three usage events:
//  - timer_users: people who have actually run the timer (not just visited)
//  - countries:   distinct GeoIP countries across that usage
//  - speeches_timed: every START pressed is one speech being timed
const STATS_QUERY = `
  SELECT
    uniq(person_id) AS timer_users,
    uniq(properties.$geoip_country_name) AS countries,
    countIf(event = 'timer_started') AS speeches_timed
  FROM events
  WHERE timestamp >= toDateTime('2024-01-01 00:00:00')
    AND event IN ('timer_started', 'speech_finished', 'zoom_meeting_started')
`;

// Numbers as of 2026-08-31, refreshed whenever someone looks. Serving these on
// failure beats serving zeros or an error: they are true (just stale-low), and
// the strip's copy rounds down anyway.
const FALLBACK_STATS = {
  timerUsers: 520,
  countries: 55,
  speechesTimed: 1405,
};

const CACHE_KEY = 'https://stats.internal/api/stats';
const CACHE_TTL_SECONDS = 6 * 60 * 60;
// Failures get a short TTL so a PostHog blip doesn't pin the fallback for six
// hours — the next visitor retries the real query within minutes.
const FALLBACK_TTL_SECONDS = 5 * 60;

function json(body, ttlSeconds) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    },
  });
}

export async function handleStats(request, env, ctx) {
  // caches is a Workers global; absent under vitest's node environment.
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(CACHE_KEY);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const apiKey = env.POSTHOG_QUERY_API_KEY;
  if (!apiKey) {
    return json({ ...FALLBACK_STATS, fallback: true }, FALLBACK_TTL_SECONDS);
  }

  try {
    const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: STATS_QUERY } }),
    });
    if (!res.ok) throw new Error(`PostHog query returned ${res.status}`);

    const data = await res.json();
    const row = data?.results?.[0];
    const [timerUsers, countries, speechesTimed] = Array.isArray(row) ? row : [];
    if (![timerUsers, countries, speechesTimed].every((n) => typeof n === 'number')) {
      throw new Error('PostHog query returned an unexpected shape');
    }

    const response = json({ timerUsers, countries, speechesTimed, fallback: false }, CACHE_TTL_SECONDS);
    if (cache) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    console.error('stats: falling back to baked numbers:', err.message);
    return json({ ...FALLBACK_STATS, fallback: true }, FALLBACK_TTL_SECONDS);
  }
}
