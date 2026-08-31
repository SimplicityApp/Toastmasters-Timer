import { describe, it, expect, beforeEach } from 'vitest';
import {
  CARD_COLORS,
  DEFAULT_CARD_SETS,
  loadCardImageSettings,
  getCardImageSettings,
  saveCardImageSettings,
  nextCustomSetId,
  resolveCardImage,
} from '../cardImages.js';

const KEY = 'toastmaster_custom_card_images';
const GREEN_DATA_URL = 'data:image/jpeg;base64,abc123';
const RED_DATA_URL = 'data:image/png;base64,def456';

// The module keeps a cache; saving is the supported way to reset it between
// tests, so each test starts from an empty, saved state.
beforeEach(() => {
  localStorage.clear();
  saveCardImageSettings({});
});

describe('CARD_COLORS', () => {
  it('covers the four card phases', () => {
    expect(CARD_COLORS).toEqual(['blue', 'green', 'yellow', 'red']);
  });
});

describe('DEFAULT_CARD_SETS', () => {
  it('ships two complete built-in sets, classic first', () => {
    expect(DEFAULT_CARD_SETS.map((set) => set.id)).toEqual(['classic', 'modern']);
    for (const set of DEFAULT_CARD_SETS) {
      for (const color of CARD_COLORS) {
        expect(set.files[color]).toMatch(/^timer-.*\.png$/);
      }
    }
  });
});

describe('loadCardImageSettings', () => {
  it('defaults to the classic set when nothing is stored', () => {
    expect(loadCardImageSettings()).toEqual({ selectedSetId: 'classic', customSets: [] });
  });

  it('returns the default for corrupted JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadCardImageSettings()).toEqual({ selectedSetId: 'classic', customSets: [] });
  });

  it('migrates the old per-color override format into one selected custom set', () => {
    localStorage.setItem(KEY, JSON.stringify({ green: GREEN_DATA_URL, red: RED_DATA_URL }));
    expect(loadCardImageSettings()).toEqual({
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', images: { green: GREEN_DATA_URL, red: RED_DATA_URL } }],
    });
  });

  it('drops invalid values while migrating the old format', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        green: GREEN_DATA_URL,
        red: 'https://example.com/not-a-data-url.png',
        purple: RED_DATA_URL,
        yellow: 42,
      })
    );
    expect(loadCardImageSettings()).toEqual({
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', images: { green: GREEN_DATA_URL } }],
    });
  });

  it('drops custom sets with no valid images and a selection that points nowhere', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        selectedSetId: 'custom-9',
        customSets: [
          { id: 'custom-2', images: { green: 'https://example.com/x.png' } },
          { id: 'not-custom', images: { red: RED_DATA_URL } },
        ],
      })
    );
    expect(loadCardImageSettings()).toEqual({ selectedSetId: 'classic', customSets: [] });
  });
});

describe('saveCardImageSettings / getCardImageSettings', () => {
  it('round-trips settings and serves them from the cache', () => {
    const settings = {
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', images: { green: GREEN_DATA_URL } }],
    };
    expect(saveCardImageSettings(settings)).toBe(true);
    expect(getCardImageSettings()).toEqual(settings);
    expect(loadCardImageSettings()).toEqual(settings);
  });

  it('persists a built-in selection without custom sets', () => {
    saveCardImageSettings({ selectedSetId: 'modern', customSets: [] });
    expect(loadCardImageSettings()).toEqual({ selectedSetId: 'modern', customSets: [] });
  });

  it('removes the storage key when back to the default with no custom sets', () => {
    saveCardImageSettings({ selectedSetId: 'modern', customSets: [] });
    saveCardImageSettings({ selectedSetId: 'classic', customSets: [] });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('drops non-data-URL images on save', () => {
    saveCardImageSettings({
      selectedSetId: 'classic',
      customSets: [{ id: 'custom-1', images: { green: 'https://example.com/x.png', red: RED_DATA_URL } }],
    });
    expect(getCardImageSettings().customSets).toEqual([
      { id: 'custom-1', images: { red: RED_DATA_URL } },
    ]);
  });
});

describe('nextCustomSetId', () => {
  it('fills the first free slot', () => {
    expect(nextCustomSetId([])).toBe('custom-1');
    expect(nextCustomSetId([{ id: 'custom-1' }, { id: 'custom-3' }])).toBe('custom-2');
  });
});

describe('resolveCardImage', () => {
  it('resolves a built-in set to its files', () => {
    saveCardImageSettings({ selectedSetId: 'modern', customSets: [] });
    expect(resolveCardImage('green')).toEqual({ file: 'timer-green-modern.png' });
  });

  it('resolves the selected custom set to its data URL', () => {
    saveCardImageSettings({
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', images: { green: GREEN_DATA_URL } }],
    });
    expect(resolveCardImage('green')).toEqual({ dataUrl: GREEN_DATA_URL });
  });

  it('falls back to the classic file for a color the custom set is missing', () => {
    saveCardImageSettings({
      selectedSetId: 'custom-1',
      customSets: [{ id: 'custom-1', images: { green: GREEN_DATA_URL } }],
    });
    expect(resolveCardImage('red')).toEqual({ file: 'timer-red-background.png' });
  });

  it('falls back to the blue card for an unknown color', () => {
    expect(resolveCardImage('chartreuse')).toEqual({ file: 'timer-blue-background.png' });
  });
});
