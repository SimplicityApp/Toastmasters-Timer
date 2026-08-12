import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../context/ToastContext';
import { TimerProvider } from '../context/TimerContext';
import LiveTab from './LiveTab';
import { applyOverlay, removeOverlay, isOverlayActive } from '../utils/zoomSdk';

// Stubbed rather than imported: the real module pulls in @zoom/appssdk, which
// hangs vitest under jsdom. Faithful to the real return shapes, since the tab
// reads fields off several of these.
vi.mock('../utils/zoomSdk', () => ({
  getVideoState: vi.fn().mockResolvedValue(null),
  setVideoState: vi.fn(),
  applyOverlay: vi.fn(),
  removeOverlay: vi.fn(),
  clearVideoPipelines: vi.fn().mockResolvedValue({ ok: true, declined: false, ungranted: [], lostBackground: false }),
  isOverlayActive: vi.fn(() => false),
  getBackgroundUrl: vi.fn((color) => `/backgrounds/${color}.png`),
  getSdkStatus: vi.fn(() => ({ initialized: true, available: false, sdkExists: false, missingApis: [], apiCount: 0 })),
  setLogCallback: vi.fn(),
  getOverlayMode: vi.fn(() => 'card'),
  setOverlayMode: vi.fn().mockResolvedValue(undefined),
  setPopoutChangeCallback: vi.fn(),
  setShareChangeCallback: vi.fn(),
  setAppShare: vi.fn(),
  setAppPopout: vi.fn(),
  isAppShareActive: vi.fn(() => false),
  isAppPoppedOut: vi.fn(() => false),
  isVideoOverlayMode: vi.fn(() => true),
  getZoomParticipants: vi.fn().mockResolvedValue({ participants: [], role: 'host', restricted: false }),
  DEFAULT_OVERLAY_MODE: 'card',
  LEGACY_OVERLAY_MODES: { popout: 'stage' },
  OVERLAY_MODE_CARD: 'card',
  OVERLAY_MODE_CAMERA: 'camera',
  OVERLAY_MODE_STAGE: 'stage',
}));
vi.mock('../utils/posthog', () => ({ trackEvent: vi.fn() }));

const REVEAL_KEY = 'toastmaster_reveal_face_when_idle';

function renderLive() {
  return render(
    <ToastProvider>
      <TimerProvider>
        <LiveTab />
      </TimerProvider>
    </ToastProvider>
  );
}

const resetButton = () => screen.getByRole('button', { name: 'RESET' });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// RESET undoes a speech, and half of what that means is on the organizer's tile
// where the whole meeting can see it. Which half is not RESET's to decide: "Show
// my own background" already says what idle looks like for this organizer, and
// pressing a button is not a change of mind about it.
describe('RESET and the "Show my own background" preference', () => {
  it('puts the blue card back when the organizer opted out of reveals', () => {
    // Off is the default, and nothing of ours is on the tile — the state after
    // the eraser, or before the first speech. resetTimer alone would leave it
    // bare, because it refuses to spend a bridge transfer on a speaker change.
    isOverlayActive.mockReturnValue(false);
    renderLive();
    // The mount push is not what is under test.
    applyOverlay.mockClear();

    fireEvent.click(resetButton());

    expect(applyOverlay).toHaveBeenCalledWith('/backgrounds/blue.png');
    expect(removeOverlay).not.toHaveBeenCalled();
  });

  it('hands the organizer their own background back when reveals are on', () => {
    localStorage.setItem(REVEAL_KEY, 'true');
    // Something of ours is up, so there is a card to take off.
    isOverlayActive.mockReturnValue(true);
    renderLive();
    applyOverlay.mockClear();

    fireEvent.click(resetButton());

    // Removal restores their own image; pushing a card here would be the exact
    // thing the preference asks the app not to do.
    expect(removeOverlay).toHaveBeenCalled();
    expect(applyOverlay).not.toHaveBeenCalled();
  });

  it('says which of the two it will do', () => {
    const { unmount } = renderLive();
    expect(resetButton()).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('put the blue timer card back on your video')
    );
    unmount();

    localStorage.setItem(REVEAL_KEY, 'true');
    renderLive();
    expect(resetButton()).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('hand your own background back')
    );
  });
});
