import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { Blob as NodeBlob } from 'node:buffer';

const KEY = 'toastmaster_custom_card_images';
const GREEN_DATA_URL = `data:image/jpeg;base64,${btoa('green-pixels')}`;
const RED_DATA_URL = `data:image/png;base64,${btoa('red-pixels')}`;

// The module holds per-session state (settings cache, object-URL cache, the
// one-shot init promise), so every test imports a fresh copy. IndexedDB and
// localStorage persist across those reloads unless a test clears them —
// exactly like a page reload in the browser.
async function loadModule() {
  vi.resetModules();
  return import('../cardImages.js');
}

beforeEach(() => {
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
  // fake-indexeddb's structured clone does not recognize jsdom's Blob (it
  // stores an empty object); Node's Blob round-trips. Browsers are fine.
  globalThis.Blob = NodeBlob;
  // jsdom has no object URLs; the module only passes them to consumers.
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

describe('CARD_COLORS / DEFAULT_CARD_SETS', () => {
  it('covers the four card phases with two complete built-in sets, classic first', async () => {
    const { CARD_COLORS, DEFAULT_CARD_SETS } = await loadModule();
    expect(CARD_COLORS).toEqual(['blue', 'green', 'yellow', 'red']);
    expect(DEFAULT_CARD_SETS.map((set) => set.id)).toEqual(['classic', 'modern']);
    for (const set of DEFAULT_CARD_SETS) {
      for (const color of CARD_COLORS) {
        expect(set.files[color]).toMatch(/^timer-.*\.png$/);
      }
    }
  });
});

describe('settings metadata', () => {
  it('defaults to the classic set when nothing is stored', async () => {
    const mod = await loadModule();
    expect(mod.getCardImageSettings()).toEqual({ selectedSetId: 'classic', customSets: [] });
  });

  it('defaults for corrupted JSON', async () => {
    localStorage.setItem(KEY, '{not json');
    const mod = await loadModule();
    expect(mod.getCardImageSettings()).toEqual({ selectedSetId: 'classic', customSets: [] });
  });

  it('persists a built-in selection and refuses unknown set ids', async () => {
    const mod = await loadModule();
    expect(mod.selectCardSet('modern')).toBe(true);
    expect(mod.selectCardSet('custom-9')).toBe(false);
    const reloaded = await loadModule();
    expect(reloaded.getCardImageSettings().selectedSetId).toBe('modern');
  });

  it('removes the storage key when back to the default with no custom sets', async () => {
    const mod = await loadModule();
    mod.selectCardSet('modern');
    mod.selectCardSet('classic');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('custom sets over IndexedDB', () => {
  it('adds a set: stores blobs, selects it, and resolves its colors', async () => {
    const mod = await loadModule();
    const id = await mod.addCustomCardSet({ green: new Blob(['g'], { type: 'image/jpeg' }) });
    expect(id).toBe('custom-1');
    expect(mod.getCardImageSettings()).toEqual({
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', colors: ['green'] }],
    });
    expect(mod.resolveCardImage('green')).toEqual({ url: expect.stringMatching(/^blob:/) });
    // A color the set has no upload for falls back to the classic file.
    expect(mod.resolveCardImage('red')).toEqual({ file: 'timer-red-background.png' });
    expect(mod.getCustomCardImage('custom-1', 'green')).toMatch(/^blob:/);
  });

  it('rejects a set with no images and non-Blob values', async () => {
    const mod = await loadModule();
    expect(await mod.addCustomCardSet({})).toBeNull();
    expect(await mod.addCustomCardSet({ green: GREEN_DATA_URL })).toBeNull();
  });

  it('reloads stored blobs on the next session', async () => {
    const first = await loadModule();
    await first.addCustomCardSet({ green: new Blob(['g'], { type: 'image/jpeg' }) });

    const second = await loadModule();
    // Before init, the custom selection resolves to the built-in fallback.
    expect(second.resolveCardImage('green')).toEqual({ file: 'timer-green-background.png' });
    await second.initCardImages();
    expect(second.resolveCardImage('green')).toEqual({ url: expect.stringMatching(/^blob:/) });
  });

  it('deletes a set, returning selection to the default and dropping its blobs', async () => {
    const first = await loadModule();
    await first.addCustomCardSet({ green: new Blob(['g'], { type: 'image/jpeg' }) });
    expect(await first.deleteCustomCardSet('custom-1')).toBe(true);
    expect(await first.deleteCustomCardSet('custom-1')).toBe(false);
    expect(first.getCardImageSettings()).toEqual({ selectedSetId: 'classic', customSets: [] });
    expect(localStorage.getItem(KEY)).toBeNull();

    const second = await loadModule();
    await second.initCardImages();
    expect(second.getCustomCardImage('custom-1', 'green')).toBeNull();
  });

  it('assigns the first free custom id', async () => {
    const mod = await loadModule();
    expect(mod.nextCustomSetId([])).toBe('custom-1');
    expect(mod.nextCustomSetId([{ id: 'custom-1' }, { id: 'custom-3' }])).toBe('custom-2');
  });

  it('sweeps orphaned blobs no set references', async () => {
    const first = await loadModule();
    await first.addCustomCardSet({ green: new Blob(['g'], { type: 'image/jpeg' }) });
    // Simulate a crash between the blob write and its metadata write.
    localStorage.removeItem(KEY);

    const second = await loadModule();
    await second.initCardImages();

    // The orphan must not resurface once the id is reused.
    const id = await second.addCustomCardSet({ red: new Blob(['r'], { type: 'image/jpeg' }) });
    expect(id).toBe('custom-1');
    const third = await loadModule();
    await third.initCardImages();
    expect(third.getCustomCardImage('custom-1', 'red')).toMatch(/^blob:/);
    expect(third.getCustomCardImage('custom-1', 'green')).toBeNull();
  });
});

describe('migration from legacy localStorage formats', () => {
  it('migrates v1 per-color overrides into one selected custom set', async () => {
    localStorage.setItem(KEY, JSON.stringify({ green: GREEN_DATA_URL, red: RED_DATA_URL, purple: GREEN_DATA_URL, yellow: 42 }));
    const mod = await loadModule();

    // Legacy data displays synchronously, before init ever runs.
    expect(mod.resolveCardImage('green')).toEqual({ url: GREEN_DATA_URL });

    await mod.initCardImages();
    const stored = JSON.parse(localStorage.getItem(KEY));
    expect(stored).toEqual({
      version: 3,
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', colors: ['green', 'red'] }],
    });
    // This session keeps serving the data URLs it already handed out.
    expect(mod.resolveCardImage('green')).toEqual({ url: GREEN_DATA_URL });

    // The next session serves the same images from IndexedDB.
    const reloaded = await loadModule();
    await reloaded.initCardImages();
    expect(reloaded.resolveCardImage('green')).toEqual({ url: expect.stringMatching(/^blob:/) });
    expect(reloaded.resolveCardImage('red')).toEqual({ url: expect.stringMatching(/^blob:/) });
  });

  it('migrates v2 sets with inline images', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        selectedSetId: 'custom-2',
        customSets: [
          { id: 'custom-1', images: { green: GREEN_DATA_URL } },
          { id: 'custom-2', images: { red: RED_DATA_URL, yellow: 'https://example.com/x.png' } },
        ],
      })
    );
    const mod = await loadModule();
    expect(mod.resolveCardImage('red')).toEqual({ url: RED_DATA_URL });

    await mod.initCardImages();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({
      version: 3,
      selectedSetId: 'custom-2',
      customSets: [
        { id: 'custom-1', colors: ['green'] },
        { id: 'custom-2', colors: ['red'] },
      ],
    });

    const reloaded = await loadModule();
    await reloaded.initCardImages();
    expect(reloaded.getCustomCardImage('custom-1', 'green')).toMatch(/^blob:/);
    expect(reloaded.getCustomCardImage('custom-2', 'red')).toMatch(/^blob:/);
  });
});

describe('resolveCardImage fallbacks', () => {
  it('resolves built-in sets to their files, unknown colors to blue', async () => {
    const mod = await loadModule();
    mod.selectCardSet('modern');
    expect(mod.resolveCardImage('green')).toEqual({ file: 'timer-green-modern.png' });
    expect(mod.resolveCardImage('chartreuse')).toEqual({ file: 'timer-blue-modern.png' });
    mod.selectCardSet('classic');
    expect(mod.resolveCardImage('chartreuse')).toEqual({ file: 'timer-blue-background.png' });
  });
});

describe('without IndexedDB', () => {
  it('still serves legacy inline images, and refuses new uploads gracefully', async () => {
    delete globalThis.indexedDB;
    localStorage.setItem(KEY, JSON.stringify({ green: GREEN_DATA_URL }));
    const mod = await loadModule();
    await mod.initCardImages();
    // No migration happened: the legacy payload stays where it works.
    expect(mod.resolveCardImage('green')).toEqual({ url: GREEN_DATA_URL });
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ green: GREEN_DATA_URL });
    expect(await mod.addCustomCardSet({ red: new Blob(['r'], { type: 'image/jpeg' }) })).toBeNull();
  });
});
