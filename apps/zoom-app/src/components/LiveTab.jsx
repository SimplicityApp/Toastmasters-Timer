import { useState, useEffect, useRef, useMemo, memo, lazy, Suspense } from 'react';
import { useTimer, useTimerTick } from '../context/TimerContext';
import { useToast } from '../context/ToastContext';
import { Play, Square, RotateCcw, Eraser, Video } from 'lucide-react';
import SpeakerInput from './SpeakerInput';
import TimerDisplay from './TimerDisplay';
import TimerStage from './TimerStage';
import OverlayModeMenu, { MODE_LABELS } from './OverlayModeMenu';
const EditRulesModal = lazy(() => import('./EditRulesModal'));
import TimeInput, { TimeInputModeToggle } from './TimeInput';
import { DEFAULT_ROLE_RULES, DEFAULT_CUSTOM_RULES, loadTimeInputMode, saveTimeInputMode } from '@toastmaster-timer/shared';
import { getVideoState, setVideoState, applyOverlay, removeOverlay, clearVideoPipelines, isOverlayActive, getBackgroundUrl, getSdkStatus, setLogCallback, setOverlayMode, setPopoutChangeCallback, setShareChangeCallback, setAppShare, setAppPopout, isAppShareActive, isAppPoppedOut, isVideoOverlayMode, DEFAULT_OVERLAY_MODE, LEGACY_OVERLAY_MODES, OVERLAY_MODE_CARD, OVERLAY_MODE_CAMERA, OVERLAY_MODE_STAGE } from '../utils/zoomSdk';
import { saveOverlayMode, loadOverlayMode, saveStageClockHidden, loadStageClockHidden, saveRevealFaceWhenIdle, loadRevealFaceWhenIdle } from '@toastmaster-timer/shared';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { trackEvent } from '../utils/posthog';

// Always on when running the dev server; in a build it takes an explicit
// VITE_ENABLE_DEBUG_PANEL=true. Fail-closed on purpose: the old `!== 'false'`
// test meant an unset variable shipped the panel to production. Resolved at
// module scope so a production build drops the debug chunk entirely.
const DEBUG_PANEL_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true';

const PromptDebugControls = DEBUG_PANEL_ENABLED
  ? lazy(() => import('./PromptDebugControls'))
  : null;

/**
 * The mode to open in: the organizer's saved choice, or Timer Card.
 *
 * An older build saved 'popout' and 'share' as modes of their own. 'popout' maps
 * to the stage, which is where that timer now lives; 'share' is dropped, because
 * starting a screen share is an outward-facing act and nobody should have one
 * begin on its own because of a preference set last week. Restoring the stage is
 * safe by contrast — on its own it shows nobody anything.
 */
function resolveInitialMode() {
  const persisted = loadOverlayMode();
  const migrated = LEGACY_OVERLAY_MODES[persisted] || persisted;
  const known = [OVERLAY_MODE_STAGE, OVERLAY_MODE_CARD, OVERLAY_MODE_CAMERA];
  return known.includes(migrated) ? migrated : DEFAULT_OVERLAY_MODE;
}

const PREVIEW_COLORS = [
  { color: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-300', label: 'Blue' },
  { color: 'green', bg: 'bg-green-500', ring: 'ring-green-300', label: 'Green' },
  { color: 'yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-300', label: 'Yellow' },
  { color: 'red', bg: 'bg-red-500', ring: 'ring-red-300', label: 'Red' },
];

export default memo(function LiveTab() {
  const { isRunning, elapsedTime, currentStatus } = useTimerTick();
  const {
    currentSpeaker,
    startTimer,
    stopTimer,
    resetTimer,
    setCurrentSpeaker,
    updateSpeakerName,
    finishCurrentSpeech,
    roleRules,
    roleOptions,
    agenda,
    activeSpeakerId,
    loadSpeakerFromAgenda,
    addToAgenda,
    renameAgendaSpeaker,
  } = useTimer();
  const { showToast } = useToast();

  const [speakerName, setSpeakerName] = useState(currentSpeaker?.name || '');
  const [selectedRole, setSelectedRole] = useState(currentSpeaker?.role || 'Standard Speech');
  const [customRules, setCustomRules] = useState({ ...DEFAULT_CUSTOM_RULES });
  const [timeInputMode, setTimeInputMode] = useState(loadTimeInputMode);
  const [showEditRulesModal, setShowEditRulesModal] = useState(false);

  const [videoState, setVideoStateLocal] = useState(null); // null = unknown, true = on, false = off
  const [isClearingVideo, setIsClearingVideo] = useState(false);
  // Bumped by the clear button. Guarantees the overlay effect re-runs exactly
  // once afterwards, which is the run it skips — see handleClearVideo.
  const [clearGeneration, setClearGeneration] = useState(0);

  // What the app itself is doing, mirrored from the SDK so Zoom's own controls
  // move these too. Seeded from the module because it outlives this component:
  // switching tabs unmounts the Live tab without ending a share.
  const [isSharing, setIsSharing] = useState(isAppShareActive);
  const [isPoppedOut, setIsPoppedOut] = useState(isAppPoppedOut);
  const [isEnablingVideo, setIsEnablingVideo] = useState(false);
  const [previewColor, setPreviewColor] = useState(null);
  // Unlike the mode itself, this preference is remembered: it is a club's stance
  // on whether a ticking clock helps or distracts their speakers.
  const [stageClockHidden, setStageClockHidden] = useState(loadStageClockHidden);

  // Whether the video modes hand the organizer their face back between speeches.
  // On by default; off restores the older always-on behavior for clubs that want
  // the color up for the whole meeting.
  const [revealFaceWhenIdle, setRevealFaceWhenIdle] = useState(loadRevealFaceWhenIdle);

  const [overlayMode, setOverlayModeLocal] = useState(resolveInitialMode);

  // A speech is under way. A pause counts as active — the speech is on hold, not
  // over — which is why this tracks elapsedTime rather than isRunning alone.
  const speechActive = isRunning || elapsedTime > 0;

  // Whether a color belongs on the organizer's tile right now. The video modes
  // run only while a speech is being timed: nothing before START, nothing once it
  // is finished or reset, so the organizer gets their normal video back between
  // speakers rather than a card sitting on them for the whole meeting. Clubs that
  // prefer the old always-on behavior turn the reveal-when-idle option off.
  //
  // A held preview swatch counts too, or the preview buttons would do nothing
  // while the timer sits idle.
  const wantsColorNow = speechActive || Boolean(previewColor) || !revealFaceWhenIdle;

  // The color that belongs on the tile: a held preview swatch wins over the
  // timer's own status, which is the point of previewing.
  const desiredStatus = previewColor || currentStatus || 'blue';

  // Debug panel state - collapsed by default, remember user preference in localStorage
  const [debugPanelExpanded, setDebugPanelExpanded] = useState(() => {
    const saved = localStorage.getItem('debugPanelExpanded');
    return saved ? saved === 'true' : false; // Default to collapsed
  });
  const [sdkStatus, setSdkStatus] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const initializedRef = useRef(false);
  const isLocalNameEdit = useRef(false);
  const lastClearGenerationRef = useRef(0);

  // Desktop only. Outside Zoom nothing is granted, so offer it anyway rather than
  // hiding a button the whole stage layout is being developed around.
  const canPopout =
    !sdkStatus?.available || !sdkStatus?.missingApis?.some((api) => api.name === 'appPopout');

  // Nothing to report: connected, and this client offers every API we call.
  const sdkHealthy =
    sdkStatus?.initialized &&
    sdkStatus?.available &&
    sdkStatus?.sdkExists &&
    sdkStatus?.missingApis?.length === 0;

  // Save expanded state to localStorage
  const toggleDebugPanel = () => {
    const newState = !debugPanelExpanded;
    setDebugPanelExpanded(newState);
    localStorage.setItem('debugPanelExpanded', String(newState));
  };

  // Add log entry
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setDebugLogs(prev => {
      const newLogs = [...prev, logEntry];
      // Keep only last 100 logs to prevent memory issues
      return newLogs.slice(-100);
    });
  };


  // Initialize currentSpeaker on mount if it's null
  useEffect(() => {
    if (!initializedRef.current && !currentSpeaker && selectedRole && roleRules && Object.keys(roleRules).length > 0) {
      // Initialize with default role (Standard Speech)
      // setCurrentSpeaker will automatically add rules from roleRules
      setCurrentSpeaker({
        name: '',
        role: selectedRole,
      });
      initializedRef.current = true;
    }
  }, [roleRules, selectedRole, currentSpeaker, setCurrentSpeaker]); // Include all dependencies

  // Update local state when currentSpeaker changes (but preserve custom rules if Custom role)
  useEffect(() => {
    if (currentSpeaker) {
      if (!isLocalNameEdit.current) {
        setSpeakerName(currentSpeaker.name || '');
      }
      isLocalNameEdit.current = false;
      setSelectedRole(currentSpeaker.role);
      // If custom role and has custom rules, update local state (merge so missing graceAfterRed is filled)
      if (currentSpeaker.role === 'Custom' && currentSpeaker.rules) {
        setCustomRules({ ...DEFAULT_CUSTOM_RULES, ...currentSpeaker.rules });
      }
      // If switching to Custom role but no rules yet, keep current customRules (don't reset)
    } else {
      setSpeakerName('');
      setSelectedRole('Standard Speech');
      // Don't reset custom rules here - they should persist until explicitly changed
    }
  }, [currentSpeaker]);

  // When switching to Custom role for the first time, use the default from roleRules (merge for graceAfterRed)
  useEffect(() => {
    if (selectedRole === 'Custom' && roleRules['Custom']) {
      setCustomRules({ ...DEFAULT_CUSTOM_RULES, ...roleRules['Custom'] });
    }
  }, [selectedRole, roleRules]);

  // Set up log callback for zoomSdk
  useEffect(() => {
    setLogCallback(addDebugLog);
    addDebugLog('Debug panel initialized', 'info');
    return () => setLogCallback(null);
  }, []);

  // Follow Zoom's own controls. The organizer can pop the app out from the
  // ellipsis menu or stop a share from the sharing toolbar, neither of which goes
  // near our buttons — so the stage reads these rather than what it last asked
  // for. Both are just state now: docking no longer means leaving the stage, any
  // more than stopping a share does.
  useEffect(() => {
    setPopoutChangeCallback(setIsPoppedOut);
    setShareChangeCallback(setIsSharing);
    return () => {
      setPopoutChangeCallback(null);
      setShareChangeCallback(null);
    };
  }, []);

  // Check SDK status on mount and periodically
  useEffect(() => {
    const updateSdkStatus = () => {
      try {
        const status = getSdkStatus();
        setSdkStatus(status);

        // Set error if SDK is not available or key functions are missing
        if (status.lastError) {
          setLastError(status.lastError);
        } else if (!status.initialized) {
          setLastError('Zoom SDK not initialized');
        } else if (!status.available) {
          setLastError('Zoom SDK not available - Make sure you are running inside Zoom client');
        } else if (!status.hasSetVideoFilter) {
          setLastError('setVideoFilter is not available. Available methods: ' + (status.availableMethods?.join(', ') || 'none'));
        } else {
          setLastError(null);
        }
      } catch (error) {
        console.error('Failed to get SDK status:', error);
        setLastError('Failed to get SDK status: ' + error.message);
      }
    };

    // Check immediately
    updateSdkStatus();

    // Update periodically every 2 seconds
    const interval = setInterval(updateSdkStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  // Check video state on mount and periodically
  useEffect(() => {
    const checkVideoState = async () => {
      try {
        const videoStateResult = await getVideoState();
        // Only update if we got a definitive answer (true or false)
        // null means we can't determine, so don't update the state
        if (videoStateResult !== null) {
          setVideoStateLocal(videoStateResult);
        }
      } catch (error) {
        console.error('Failed to check video state:', error);
        setLastError('Failed to check video state: ' + error.message);
        // Don't update state on error - keep current state
      }
    };

    // Check immediately
    checkVideoState();

    // Check periodically every 2-3 seconds
    const interval = setInterval(checkVideoState, 2500);

    return () => clearInterval(interval);
  }, []);

  // Owns what the video modes have on screen. Stage modes are excluded: they push
  // no pixels, and removeOverlay there would tear down the share or the
  // popped-out window itself.
  useEffect(() => {
    // The run triggered by the clear button itself: leave the video as it was
    // just cleared to. Bumping the generation is what makes this run happen at
    // all, so the skip is always consumed and never swallows a later push.
    if (lastClearGenerationRef.current !== clearGeneration) {
      lastClearGenerationRef.current = clearGeneration;
      return;
    }
    if (!isVideoOverlayMode(overlayMode)) return;
    if (wantsColorNow) {
      const imageUrl = getBackgroundUrl(desiredStatus);
      addDebugLog(`Applying overlay: ${desiredStatus} -> ${imageUrl}`, 'info');
      // Usually redundant with TimerContext's own push on status change; the
      // already-showing guard in applyOverlay makes the duplicate free.
      applyOverlay(imageUrl);
      // Idle, so the organizer gets their video back: whichever pipeline holds
      // the card comes off, and neither is touched when nothing of ours is up.
      // Not on mount, not on a speaker change, not on arriving in a mode with
      // nothing showing — each of those would otherwise cost a confirmation
      // dialog in camera mode, or delete the user's own video filter in card.
    } else if (isOverlayActive()) {
      addDebugLog('Removing overlay (no speech in progress)', 'info');
      removeOverlay();
    }
  }, [overlayMode, wantsColorNow, desiredStatus, clearGeneration]);

  // Log when status changes
  useEffect(() => {
    if (currentStatus) {
      addDebugLog(`Timer status changed to: ${currentStatus}`, 'info');
    }
  }, [currentStatus]);

  // Clear preview when the timer starts running
  useEffect(() => {
    if (isRunning) setPreviewColor(null);
  }, [isRunning]);

  // Log when timer starts/stops
  useEffect(() => {
    if (isRunning) {
      addDebugLog('Timer started', 'info');
    } else if (isRunning === false && elapsedTime === 0) {
      addDebugLog('Timer stopped/reset', 'info');
    }
  }, [isRunning]);

  const handleSpeakerChange = (name) => {
    setSpeakerName(name || '');
    isLocalNameEdit.current = true;
    updateSpeakerName(name || '');
  };

  const handleSelectSuggestion = (item) => {
    setSpeakerName(item.name);
    setSelectedRole(item.role);
    // Picking someone off the agenda has to make them the *active* agenda
    // speaker, not just copy their name across. Without that link the timer has
    // no idea where in the running order it is: finishing cannot advance to the
    // next speaker, and the item is never ticked off as done.
    if (item.id && agenda.some((entry) => entry.id === item.id)) {
      loadSpeakerFromAgenda(item.id);
      return;
    }
    const rules = item.role === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({ name: item.name, role: item.role, ...(rules && { rules }) });
  };

  /**
   * Add a typed speaker to the agenda and make them current.
   *
   * Typing a name used to change only the label above the timer — nothing was
   * recorded, and the organizer had no way to tell. Adding them puts the meeting
   * back on a running order, so finishing can advance to whoever is next.
   *
   * Shared by the stage picker and the panel field, which is the point: the two
   * places you can type a name should not disagree about what typing one means.
   */
  const handleAddSpeaker = (name) => {
    addToAgenda({ name, role: selectedRole }, { activate: true });
    setSpeakerName(name);
    showToast(`Added ${name} to the agenda`, 'success');
    (window.requestIdleCallback || setTimeout)(() => trackEvent('stage_speaker_added', {
      role: selectedRole,
      overlay_mode: overlayMode,
    }));
  };

  /** Fix a name on the agenda without losing the speaker's place in it. */
  const handleRenameSpeaker = (id, name) => {
    renameAgendaSpeaker(id, name);
    setSpeakerName(name);
    showToast(`Renamed to ${name}`, 'success');
  };

  const handleRoleChange = (role) => {
    const previousRole = selectedRole;
    setSelectedRole(role);
    // Always update current speaker, even if name is empty
    const rules = role === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({
      name: speakerName || '',
      role,
      ...(rules && { rules }),
    });
    // Track role change
    if (previousRole !== role) {
      (window.requestIdleCallback || setTimeout)(() => trackEvent('speaker_role_changed', {
        previous_role: previousRole,
        new_role: role,
        speaker_name: speakerName || 'Unnamed'
      }));
    }
  };

  const handleCustomRuleChange = (field, value) => {
    const newRules = { ...customRules, [field]: value };
    setCustomRules(newRules);

    // If Custom is selected, update immediately (name is optional)
    if (selectedRole === 'Custom') {
      setCurrentSpeaker({
        name: speakerName || '',
        role: 'Custom',
        rules: newRules,
      });
    }
  };

  // Helper to format seconds as readable time
  const formatTimeReadable = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    }
    if (secs === 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    }
    return `${mins} min ${secs} sec`;
  };

  const roleExplanation = useMemo(() => {
    const rules = roleRules[selectedRole] || DEFAULT_ROLE_RULES[selectedRole] || DEFAULT_ROLE_RULES['Standard Speech'];
    return `Green: ${formatTimeReadable(rules.green)}, Yellow: ${formatTimeReadable(rules.yellow)}, Red: ${formatTimeReadable(rules.red)}`;
  }, [selectedRole, roleRules]);

  // Just the state: the overlay effect pushes the swatch and, when it is toggled
  // back off, takes it down again. Pushing from here as well used to fight that
  // effect, which reapplied the timer's own status a render later.
  const handlePreviewColor = (color) => {
    setPreviewColor((held) => (held === color ? null : color));
  };

  const handleStart = () => {
    // Speaker name is optional, but validate custom rules if Custom role is selected
    if (selectedRole === 'Custom') {
      // Validate custom rules
      if (customRules.green <= 0 || customRules.yellow <= customRules.green || customRules.red <= customRules.yellow) {
        showToast('Invalid timing rules. Green must be > 0, Yellow must be > Green, and Red must be > Yellow.', 'error');
        return;
      }
    }
    // Ensure current speaker is set with correct rules
    // Get rules from roleRules if not Custom, or use customRules if Custom
    const rules = selectedRole === 'Custom' ? customRules : roleRules[selectedRole];
    if (!rules) {
      showToast('Please set timing rules first', 'warning');
      return;
    }

    // Always set current speaker before starting timer
    setCurrentSpeaker({
      name: speakerName || '',
      role: selectedRole,
      ...(selectedRole === 'Custom' && { rules }),
    });

    startTimer();

    // Track timer started event
    (window.requestIdleCallback || setTimeout)(() => trackEvent('timer_started', {
      speaker_name: speakerName || 'Unnamed',
      role: selectedRole,
      timing_rules: {
        green: rules.green,
        yellow: rules.yellow,
        red: rules.red
      }
    }));
  };

  const handleContinue = () => {
    // Continue is the same as start - it resumes the timer
    startTimer();
    // Track timer continued (resumed)
    (window.requestIdleCallback || setTimeout)(() => trackEvent('timer_continued', {
      elapsed_time: elapsedTime
    }));
  };

  const handleStop = () => {
    stopTimer();
    // Track timer stopped
    (window.requestIdleCallback || setTimeout)(() => trackEvent('timer_stopped', {
      elapsed_time: elapsedTime,
      final_status: currentStatus,
      speaker_name: currentSpeaker?.name || 'Unnamed',
      role: currentSpeaker?.role || 'Unknown'
    }));
  };

  /**
   * Put the timer back to zero, and put the tile back to whatever this organizer
   * has said idle should look like.
   *
   * Which of the two that is belongs to "Show my own background", not to RESET.
   * An organizer who asked to be handed their face back between speeches means it
   * here most of all — a reset speech is the most idle the meeting gets — while
   * one who turned it off wants the color up for the whole meeting, so the tile
   * returns to the blue card rather than going bare. Pressing RESET is not a
   * decision about that preference; it is one more moment governed by it.
   *
   * resetTimer applies the preference itself, since the speaker and role changes
   * that also run through it owe the organizer the same thing. The push below
   * covers the one case it deliberately skips: with the preference off and
   * nothing of ours on the tile — after the eraser, or before the first speech of
   * the meeting — it will not spend a multi-MB bridge transfer on an overlay
   * nobody asked for. A button press is that ask, and "the timer is off my video
   * even though I opted out of that" is the state this is here to end.
   */
  const handleReset = () => {
    const previousElapsedTime = elapsedTime;
    const previousStatus = currentStatus;
    // A held swatch outranks the timer's own status everywhere the color is
    // decided, so a preview left up would paint straight back over the blue card
    // below. RESET is a return to the starting state; a swatch does not survive it.
    setPreviewColor(null);
    resetTimer();
    setSpeakerName('');
    if (!revealFaceWhenIdle && isVideoOverlayMode(overlayMode)) {
      addDebugLog('Reset with reveal-when-idle off: returning the tile to blue', 'info');
      applyOverlay(getBackgroundUrl('blue'));
    }
    // Track timer reset
    (window.requestIdleCallback || setTimeout)(() => trackEvent('timer_reset', {
      previous_elapsed_time: previousElapsedTime,
      previous_status: previousStatus,
      reveal_face_when_idle: revealFaceWhenIdle
    }));
  };

  // Says what RESET will do to the video, because that half of it now depends on
  // a preference set two clicks away in the mode menu — and the two outcomes are
  // opposites. Stage modes leave the camera alone entirely, so they get neither
  // promise.
  const resetTooltip = isVideoOverlayMode(overlayMode)
    ? `Reset the timer to 00:00, clear the current speaker, and ${
        revealFaceWhenIdle ? 'hand your own background back' : 'put the blue timer card back on your video'
      }`
    : 'Reset the timer to 00:00 and clear the current speaker';

  const handleFinish = () => {
    const currentAgendaId = activeSpeakerId;
    finishCurrentSpeech();

    // Auto-load next uncompleted speaker from agenda
    if (currentAgendaId) {
      const currentIndex = agenda.findIndex(item => item.id === currentAgendaId);
      const nextSpeaker = agenda.slice(currentIndex + 1).find(item => !item.completed);
      if (nextSpeaker) {
        loadSpeakerFromAgenda(nextSpeaker.id);
        setSpeakerName(nextSpeaker.name || '');
        setSelectedRole(nextSpeaker.role);
        return;
      }
    }
    // Nobody queued up next — off the agenda entirely, or that was the last one
    // on it. Clear the field rather than leaving the speaker who just finished
    // sitting there, which reads as though nothing happened. On the stage this is
    // all the organizer sees, so a stale name is the whole display being wrong.
    setSpeakerName('');
  };

  /**
   * Strip everything the app has put on the organizer's video — the timer card
   * and any virtual background of ours — and leave the camera as Zoom found it.
   *
   * The escape hatch for the state nobody can talk their way out of: a color
   * stuck on your tile, usually because a previous session ended without
   * unwinding, or because a removal was refused. Always available, whatever the
   * mode.
   *
   * A one-shot affair. Any preview swatch is dropped, and the overlay effect is
   * told to sit out the render this causes, so the color it would otherwise push
   * straight back does not undo the clear. It stays off until the next thing that
   * legitimately wants a color on the tile — starting a speech, a status change,
   * a mode switch. Notably it does not touch the display preference: pressing
   * clear is a one-time act, not a decision to reveal after every speech.
   */
  const handleClearVideo = async () => {
    setIsClearingVideo(true);
    setPreviewColor(null);
    setClearGeneration((n) => n + 1);
    try {
      addDebugLog('Clearing all filters and backgrounds', 'info');
      const { ok, declined, ungranted, lostBackground } = await clearVideoPipelines();
      if (!sdkStatus?.available) {
        // Outside Zoom every SDK call is a no-op, so there is nothing to report.
      } else if (ungranted?.length) {
        // No retry will ever work: this Zoom client never granted the removal
        // API, so the only way out is Zoom's own panel. Saying "check your
        // settings" for this used to read as "you configured something wrong".
        showToast(
          `This Zoom client won't let the app remove your ${ungranted.join(' or ')}. Clear it from Zoom's Background & Effects panel.`,
          'error',
          8000
        );
      } else if (declined) {
        showToast('Zoom needs your confirmation to remove the background — nothing was changed.', 'info', 5000);
      } else if (!ok) {
        showToast('Zoom would not clear your video. Check Zoom\'s own background and filter settings.', 'error', 6000);
      } else if (lostBackground) {
        // Zoom offers no way to put a saved background back, so say so rather
        // than leaving them to notice their own image is gone.
        showToast('Cleared the timer. Zoom can\'t restore your own background — pick it again in Background & Effects.', 'info', 7000);
      } else {
        showToast('Cleared the timer from your video.', 'success');
      }
    } finally {
      setIsClearingVideo(false);
    }
    (window.requestIdleCallback || setTimeout)(() => trackEvent('video_cleared', {
      overlay_mode: overlayMode,
      current_timer_status: currentStatus,
    }));
  };

  // Switching modes can no longer be refused: opening the stage asks the client
  // for nothing, so there is no failure to roll back from. Sharing and popping
  // out can still be refused, and they say so at the point they are pressed.
  const handleModeSwitch = async (newMode) => {
    if (newMode === overlayMode) return;
    setOverlayModeLocal(newMode);
    saveOverlayMode(newMode);
    // Carry the color into the new mode only if something should be showing:
    // mid-speech, or while a preview swatch is held up. Passing it
    // unconditionally is what used to paint an idle organizer blue on arrival.
    await setOverlayMode(newMode, wantsColorNow ? getBackgroundUrl(desiredStatus) : null);
    // Leaving the stage stops its share and docks its window; reflect that.
    if (newMode !== OVERLAY_MODE_STAGE) {
      setIsSharing(false);
      setIsPoppedOut(false);
    }
    (window.requestIdleCallback || setTimeout)(() => trackEvent('overlay_mode_switched', { new_mode: newMode }));
  };

  /**
   * Share the stage into the meeting, or stop. The one control here the whole
   * meeting can see, so it is always a deliberate press — never a consequence of
   * choosing a mode, and never restored from a saved preference.
   */
  const handleToggleShare = async () => {
    const next = !isSharing;
    setIsSharing(next);
    const accepted = await setAppShare(next);
    if (!accepted && sdkStatus?.available) {
      setIsSharing(isAppShareActive());
      showToast(
        next
          ? 'Zoom would not start the share. Someone else may be sharing already.'
          : 'Zoom would not stop the share. Try the Stop Share button in Zoom.',
        'error',
        6000
      );
      return;
    }
    (window.requestIdleCallback || setTimeout)(() => trackEvent('stage_share_toggled', { sharing: next }));
  };

  /**
   * Undock the stage into its own window, or merge it back. Local to the
   * organizer's machine either way: the meeting sees no difference.
   */
  const handleTogglePopout = async () => {
    const next = !isPoppedOut;
    setIsPoppedOut(next);
    const accepted = await setAppPopout(next);
    if (!accepted && sdkStatus?.available) {
      setIsPoppedOut(isAppPoppedOut());
      showToast('This Zoom client cannot open the timer in its own window.', 'error');
      return;
    }
    (window.requestIdleCallback || setTimeout)(() => trackEvent('stage_popout_toggled', { poppedOut: next }));
  };

  const handleToggleRevealFaceWhenIdle = () => {
    const reveal = !revealFaceWhenIdle;
    setRevealFaceWhenIdle(reveal);
    saveRevealFaceWhenIdle(reveal);
    (window.requestIdleCallback || setTimeout)(() => trackEvent('reveal_face_when_idle_toggled', { reveal }));
  };

  const handleToggleStageClock = () => {
    const hidden = !stageClockHidden;
    setStageClockHidden(hidden);
    saveStageClockHidden(hidden);
    (window.requestIdleCallback || setTimeout)(() => trackEvent('stage_clock_toggled', { hidden }));
  };

  const handleTurnVideoOn = async () => {
    setIsEnablingVideo(true);
    try {
      await setVideoState(true);
      // Wait a moment for the state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      // Re-check video state
      const isVideoOn = await getVideoState();
      setVideoStateLocal(isVideoOn);
      if (!isVideoOn) {
        showToast('Failed to turn video on. Please turn on video manually in Zoom.', 'error');
      }
    } catch (error) {
      console.error('Failed to turn video on:', error);
      showToast('Failed to turn video on. Please turn on video manually in Zoom.', 'error');
    } finally {
      setIsEnablingVideo(false);
    }
  };

  return (
    <div className="p-4 space-y-4 relative">
      {/* Stage modes cover the whole panel: in share mode every pixel of the app
          is broadcast, so nothing else may stay on screen. */}
      {!isVideoOverlayMode(overlayMode) && (
        <TimerStage
          status={previewColor || currentStatus}
          elapsedTime={elapsedTime}
          rules={currentSpeaker?.rules}
          speakerName={speakerName}
          role={selectedRole}
          isRunning={isRunning}
          onStart={handleStart}
          onContinue={handleContinue}
          onStop={handleStop}
          onReset={handleReset}
          onFinish={handleFinish}
          onExit={() => handleModeSwitch(OVERLAY_MODE_CARD)}
          clockHidden={stageClockHidden}
          onToggleClock={handleToggleStageClock}
          isSharing={isSharing}
          onToggleShare={handleToggleShare}
          isPoppedOut={isPoppedOut}
          onTogglePopout={handleTogglePopout}
          canPopout={canPopout}
          onSpeakerNameChange={handleSpeakerChange}
          agendaItems={agenda}
          activeSpeakerId={activeSpeakerId}
          onSelectSpeaker={loadSpeakerFromAgenda}
          onAddSpeaker={handleAddSpeaker}
          onRenameSpeaker={handleRenameSpeaker}
        />
      )}

      {/* Clear-video escape hatch + overlay mode menu.
          In the flow rather than floating: these carry their labels now, and two
          labelled buttons pinned over the top-right corner sit on whatever the
          panel is showing underneath. Invisible in the stage modes regardless,
          since TimerStage is fixed inset-0 above this. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Always available, in every mode: the point of it is to work when
            something of ours is stuck, which is exactly when the mode-specific
            paths have already failed.

            Labelled rather than left to a tooltip. An eraser icon says an
            action is destructive but not what it destroys, and someone whose
            video is stuck is looking for a way out, not hovering to find one. */}
        <button
          onClick={handleClearVideo}
          disabled={isClearingVideo}
          className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium transition-colors"
          aria-label="Clear the timer from my video"
        >
          <Eraser className="h-4 w-4 flex-shrink-0" />
          {isClearingVideo ? 'Clearing…' : 'Clear video'}
        </button>
        <OverlayModeMenu
          value={overlayMode}
          onChange={handleModeSwitch}
          revealFaceWhenIdle={revealFaceWhenIdle}
          onToggleRevealFaceWhenIdle={handleToggleRevealFaceWhenIdle}
        />
      </div>

      {/* Video off warning banner - Always visible when video is off */}
      {videoState === false && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800 font-medium">
              Your video is turned off. Please turn on your video to use the Timer Card.
            </p>
          </div>
          <button
            onClick={handleTurnVideoOn}
            disabled={isEnablingVideo}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0"
          >
            {isEnablingVideo ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Turning On...</span>
              </>
            ) : (
              <>
                <Video className="h-4 w-4" />
                <span>Turn Video On</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Debug Panel - Only show if enabled via feature flag */}
      {DEBUG_PANEL_ENABLED && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={toggleDebugPanel}
            className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${lastError ? 'text-red-500' : 'text-green-500'}`} />
              <span className="text-sm font-semibold text-gray-700">Debug Panel</span>
              {lastError && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Error</span>
              )}
            </div>
            {debugPanelExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {debugPanelExpanded && (
          <div className="p-3 space-y-2 text-xs">
            {lastError && (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <div className="font-semibold text-red-800 mb-1">Error:</div>
                <div className="text-red-700">{lastError}</div>
              </div>
            )}

            {sdkStatus && (
              <div className="space-y-1">
                <div className="font-semibold text-gray-700 mb-2">SDK Status:</div>
                {/* Only what is wrong. A wall of green "Yes" rows takes the eye
                    the same effort to scan as one problem hiding among them. */}
                {sdkHealthy ? (
                  <div className="px-2 py-1 rounded bg-green-100 text-green-800">
                    SDK ready — all {sdkStatus.apiCount} APIs available
                  </div>
                ) : (
                  <div className="space-y-1">
                    {!sdkStatus.sdkExists && (
                      <div className="px-2 py-1 rounded bg-red-100 text-red-800">
                        SDK Exists: No — not running inside a Zoom client
                      </div>
                    )}
                    {sdkStatus.sdkExists && !sdkStatus.initialized && (
                      <div className="px-2 py-1 rounded bg-red-100 text-red-800">Initialized: No</div>
                    )}
                    {sdkStatus.sdkExists && !sdkStatus.available && (
                      <div className="px-2 py-1 rounded bg-red-100 text-red-800">
                        Available: No — config() was refused
                      </div>
                    )}
                    {sdkStatus.missingApis?.length > 0 && (
                      <>
                        <div className="text-gray-600">
                          {sdkStatus.apiCount - sdkStatus.missingApis.length}/{sdkStatus.apiCount} APIs
                          available. Missing:
                        </div>
                        {sdkStatus.missingApis.map((api) => (
                          <div
                            key={api.name}
                            className={`px-2 py-1 rounded ${api.required ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}
                          >
                            {api.name} — {api.purpose}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {sdkStatus.availableMethods && sdkStatus.availableMethods.length > 0 && (
                  <div className="mt-2">
                    <div className="font-semibold text-gray-700 mb-1">Available Methods:</div>
                    <div className="text-gray-600 font-mono text-xs bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                      {sdkStatus.availableMethods.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-gray-200">
              <div className="text-gray-600 mb-2">
                <div>Video State: {videoState === null ? 'Unknown' : videoState ? 'ON' : 'OFF'}</div>
                <div>Current Status: {currentStatus || 'None'}</div>
                <div>Color On Tile: {wantsColorNow ? `Yes (${desiredStatus})` : 'No'}</div>
                <div>Overlay Mode: {MODE_LABELS[overlayMode] || overlayMode}</div>
                <div>App Shared: {sdkStatus?.appShareActive ? 'Yes' : 'No'}</div>
                <div>Popped Out: {sdkStatus?.appPoppedOut ? 'Yes' : 'No'}</div>
              </div>

              {/* Lazy so the prompt scheduler UI never ships inside the main
                  chunk of a production build with the panel disabled. */}
              <Suspense fallback={null}>
                <PromptDebugControls />
              </Suspense>

              {/* Debug Logs */}
              <div className="mt-3">
                <div className="font-semibold text-gray-700 mb-2">Debug Logs ({debugLogs.length}):</div>
                <div className="bg-gray-900 text-gray-100 p-2 rounded font-mono text-xs max-h-48 overflow-y-auto">
                  {debugLogs.length === 0 ? (
                    <div className="text-gray-500">No logs yet...</div>
                  ) : (
                    <>
                      {debugLogs.map((log, index) => (
                        <div
                          key={index}
                          className={`mb-1 ${
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'warn' ? 'text-yellow-400' :
                            'text-gray-300'
                          }`}
                        >
                          <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {debugLogs.length > 0 && (
                  <button
                    onClick={() => setDebugLogs([])}
                    className="mt-2 text-xs text-gray-600 hover:text-gray-800 underline"
                  >
                    Clear Logs
                  </button>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      <SpeakerInput
        value={speakerName}
        onChange={handleSpeakerChange}
        onRoleChange={handleRoleChange}
        selectedRole={selectedRole}
        roleOptions={roleOptions}
        onEditRules={() => setShowEditRulesModal(true)}
        agendaItems={agenda}
        onSelectSuggestion={handleSelectSuggestion}
        activeSpeakerId={activeSpeakerId}
        onAddSpeaker={handleAddSpeaker}
        onRenameSpeaker={handleRenameSpeaker}
      />

      {selectedRole !== 'Custom' && (
        <p className="text-xs text-gray-500 mt-1">
          Timing rules: {roleExplanation}
        </p>
      )}

      {selectedRole === 'Custom' && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Custom Timing Rules</h3>
            <TimeInputModeToggle mode={timeInputMode} onModeChange={(m) => { saveTimeInputMode(m); setTimeInputMode(m); }} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <TimeInput layout="inline" label="Green" value={customRules.green} onChange={(v) => handleCustomRuleChange('green', v)} />
            <TimeInput layout="inline" label="Yellow" value={customRules.yellow} onChange={(v) => handleCustomRuleChange('yellow', v)} />
            <TimeInput layout="inline" label="Red" value={customRules.red} onChange={(v) => handleCustomRuleChange('red', v)} />
            <TimeInput layout="inline" label="Grace" value={customRules.graceAfterRed ?? DEFAULT_CUSTOM_RULES.graceAfterRed} onChange={(v) => handleCustomRuleChange('graceAfterRed', v)} />
          </div>
          {customRules.yellow <= customRules.green && (
            <div className="text-xs text-red-600 mt-2">
              Yellow must be greater than Green
            </div>
          )}
          {customRules.red <= customRules.yellow && (
            <div className="text-xs text-red-600 mt-2">
              Red must be greater than Yellow
            </div>
          )}
        </div>
      )}

      <TimerDisplay
        elapsedTime={elapsedTime}
        status={previewColor || currentStatus}
        rules={currentSpeaker?.rules}
      />

      {!isRunning && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-xs text-gray-500">Preview:</span>
          {PREVIEW_COLORS.map(({ color, bg, ring, label }) => (
            <button
              key={color}
              onClick={() => handlePreviewColor(color)}
              disabled={videoState === false}
              className={`w-8 h-8 rounded-full ${bg} transition-all ${
                previewColor === color ? `ring-2 ${ring} scale-110` : 'opacity-70 hover:opacity-100'
              } ${videoState === false ? 'cursor-not-allowed opacity-30' : ''}`}
              data-tooltip={`Preview ${label}`}
            />
          ))}
        </div>
      )}

      <div className="space-y-2 pb-20">
        {/* When timer is running, show STOP button */}
        {isRunning ? (
          <div className="flex gap-2">
            <button
              onClick={handleStop}
              data-tooltip="Pause the timer (can be resumed later)"
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Square className="h-5 w-5" />
              STOP
            </button>
            <button
              onClick={handleFinish}
              data-tooltip="Complete the current speech and save it to reports"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              FINISH
            </button>
          </div>
        ) : (
          /* When timer is not running */
          elapsedTime === 0 ? (
            /* Start state: no timing started at all - only START and RESET */
            <>
              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  disabled={videoState === false}
                  data-tooltip="Start the timer for the current speaker"
                  className={`flex-1 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    videoState === false
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <Play className="h-5 w-5" />
                  START
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  data-tooltip={resetTooltip}
                  data-tooltip-direction="down"
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  RESET
                </button>
              </div>
            </>
          ) : (
            /* Continue state: timing started and then stopped - CONTINUE, RESET, and FINISH */
            <>
              <div className="flex gap-2">
                <button
                  onClick={handleContinue}
                  disabled={videoState === false}
                  data-tooltip="Resume the timer from where it was stopped"
                  className={`flex-1 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    videoState === false
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <Play className="h-5 w-5" />
                  CONTINUE
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  data-tooltip={resetTooltip}
                  data-tooltip-direction="down"
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  RESET
                </button>
                <button
                  onClick={handleFinish}
                  data-tooltip="Complete the current speech and save it to reports"
                  data-tooltip-direction="down"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  FINISH
                </button>
              </div>
            </>
          )
        )}
      </div>

      {showEditRulesModal && (
        <Suspense fallback={null}>
          <EditRulesModal
            isOpen={showEditRulesModal}
            onClose={() => setShowEditRulesModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
});
