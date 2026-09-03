/**
 * External links that more than one component needs.
 */

/**
 * The Zoom App Marketplace listing page, where the "Reviews" section lives.
 * Not the /zoomapp/<id>/context/... deeplink, which launches the app in a meeting.
 */
export const ZOOM_MARKETPLACE_REVIEW_URL =
  'https://marketplace.zoom.us/apps/sWHvcm4YShyr6SXQQI8DFw';

/** Canonical entry point of the web timer (the "Time this" deep-link target). */
export const TIMER_APP_URL = 'https://www.timer.toastmusters.com/app';

/**
 * Every tool in the Toastmusters suite, one subdomain each. Footers and nav
 * render from this list so a new tool is one entry here. URLs have no
 * trailing slash.
 */
export const TOOLS = [
  {
    slug: 'timer',
    name: 'Toastmusters Timer',
    url: 'https://www.timer.toastmusters.com',
    tagline: 'Green, yellow and red timing signals for every speech, in the browser or as a Zoom app.',
  },
  {
    slug: 'table-topics',
    name: 'Table Topics Generator',
    url: 'https://www.tabletopics.toastmusters.com',
    tagline: 'Fresh Table Topics questions for every meeting, with a one-click timer.',
  },
];
