import { renderHook, act } from '@testing-library/react';
import { ToastProvider } from './ToastContext';
import { TimerProvider, useTimer } from './TimerContext';

// Stubbed rather than imported: the real module pulls in @zoom/appssdk, which
// hangs vitest under jsdom.
vi.mock('../utils/zoomSdk', () => ({
  applyOverlay: vi.fn(),
  removeOverlay: vi.fn(),
  getBackgroundUrl: vi.fn(() => '/backgrounds/blue.png'),
  isOverlayActive: vi.fn(() => false),
  getOverlayMode: vi.fn(() => 'card'),
  isVideoOverlayMode: vi.fn(() => true),
  OVERLAY_MODE_CARD: 'card',
}));
vi.mock('../utils/posthog', () => ({ trackEvent: vi.fn() }));

function wrapper({ children }) {
  return (
    <ToastProvider>
      <TimerProvider>{children}</TimerProvider>
    </ToastProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('addToAgenda', () => {
  it('can make the new speaker current in the same tick it is added', () => {
    // The old shape — add, then loadSpeakerFromAgenda(id) — read the agenda
    // from the render the callback was created in, which cannot contain the new
    // item. Nothing happened, so the speaker was on the agenda but not active.
    const { result } = renderHook(() => useTimer(), { wrapper });

    let id;
    act(() => {
      id = result.current.addToAgenda({ name: 'Priya', role: 'Standard Speech' }, { activate: true });
    });

    expect(result.current.activeSpeakerId).toBe(id);
    expect(result.current.currentSpeaker?.name).toBe('Priya');
    expect(result.current.agenda.map((item) => item.name)).toEqual(['Priya']);
  });

  it('renames that speaker in place rather than adding a second one', () => {
    // What "Enter to rename" depends on: without the activation above there is
    // no active item, so correcting the name reads as a new speaker.
    const { result } = renderHook(() => useTimer(), { wrapper });

    let id;
    act(() => {
      id = result.current.addToAgenda({ name: 'Jon', role: 'Standard Speech' }, { activate: true });
    });
    act(() => {
      result.current.renameAgendaSpeaker(id, 'Jonathan');
    });

    expect(result.current.agenda.map((item) => item.name)).toEqual(['Jonathan']);
    expect(result.current.currentSpeaker?.name).toBe('Jonathan');
  });

  it('leaves the current speaker alone without activate', () => {
    // The agenda tab adds rows without moving the timer off whoever is speaking.
    const { result } = renderHook(() => useTimer(), { wrapper });

    act(() => {
      result.current.addToAgenda({ name: 'Priya', role: 'Standard Speech' });
    });

    expect(result.current.activeSpeakerId).toBeNull();
    expect(result.current.currentSpeaker).toBeNull();
    expect(result.current.agenda).toHaveLength(1);
  });
});
