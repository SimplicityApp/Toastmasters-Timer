import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(join(repoRoot, relative), 'utf8');

/**
 * Every Content-Security-Policy the app serves, wherever it is defined.
 *
 * Three files, because the policy is set in three places and they have drifted
 * before: the Cloudflare Worker serves it in production, and the two vercel.json
 * files carry their own copies.
 */
function policies() {
  const found = [];
  for (const path of ['worker/index.js', 'vercel.json', 'apps/zoom-app/vercel.json']) {
    const source = read(path);
    // Every policy is a double-quoted string — a JSON value or a JS literal —
    // and contains only single quotes inside ('self', 'unsafe-inline'), so the
    // closing double quote is where it ends. Anchored on default-src, which
    // every one of them opens with.
    for (const match of source.matchAll(/"(default-src[^"]*)"/g)) {
      found.push({ path, policy: match[1] });
    }
  }
  return found;
}

describe('the Content-Security-Policy the app ships', () => {
  it('is defined in every place that serves one', () => {
    // A guard on the test itself: a policy that moved or was renamed would
    // otherwise make every assertion below pass by finding nothing.
    const paths = new Set(policies().map((entry) => entry.path));
    expect(paths).toEqual(
      new Set(['worker/index.js', 'vercel.json', 'apps/zoom-app/vercel.json'])
    );
  });

  it('lets the page display the images the organizer uploads', () => {
    // Uploaded card artwork and the organizer's own background are held as
    // Blobs and shown through object URLs, so an img-src without blob: blocks
    // every one of them. It did, and the symptom was not obviously a CSP
    // problem: fileToCardBlob loads the upload into an Image to re-encode it,
    // the load was refused, and both uploaders reported "That file could not be
    // read as an image" — for files that were perfectly good. Stored images
    // could not be displayed or pushed to the video either, since they reach
    // both through the same object URLs.
    //
    // Not caught by anything else: the dev server sends no CSP at all, so this
    // is invisible until the app is deployed.
    for (const { path, policy } of policies()) {
      const imgSrc = policy.match(/img-src ([^;]*)/)?.[1];
      expect(imgSrc, `img-src missing from the policy in ${path}`).toBeDefined();
      expect(imgSrc, `img-src in ${path} must allow blob:`).toContain('blob:');
    }
  });
});
