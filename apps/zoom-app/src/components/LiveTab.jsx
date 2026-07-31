import { useState, useEffect, useRef, useMemo, memo, lazy, Suspense } from 'react';
import { useTimer, useTimerTick } from '../context/TimerContext';
import { useToast } from '../context/ToastContext';
import { Play, Square, RotateCcw, Eye, EyeOff, Video, Monitor, Camera, ScreenShare, PictureInPicture2 } from 'lucide-react';
import SpeakerInput from './SpeakerInput';
import TimerDisplay from './TimerDisplay';
import TimerStage from './TimerStage';
const EditRulesModal = lazy(() => import('./EditRulesModal'));
import TimeInput, { TimeInputModeToggle } from './TimeInput';
import { DEFAULT_ROLE_RULES, DEFAULT_CUSTOM_RULES, loadTimeInputMode, saveTimeInputMode } from '@toastmaster-timer/shared';
import { getVideoState, setVideoState, applyOverlay, removeOverlay, getBackgroundUrl, getSdkStatus, setLogCallback, setOverlayMode, getOverlayMode, setPopoutChangeCallback, isVideoOverlayMode, OVERLAY_MODE_CARD, OVERLAY_MODE_CAMERA, OVERLAY_MODE_SHARE, OVERLAY_MODE_POPOUT } from '../utils/zoomSdk';
import { saveOverlayMode, loadOverlayMode } from '@toastmaster-timer/shared';
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

// Mode toggle, in the order they appear in the segmented control. Card and
// camera drive the video pipeline; share and popout put the app's own stage view
// on screen instead. See isVideoOverlayMode in utils/zoomSdk.
const OVERLAY_MODES = [
  { mode: OVERLAY_MODE_CARD, Icon: Monitor, label: 'Timer Card' },
  { mode: OVERLAY_MODE_CAMERA, Icon: Camera, label: 'Timer + Camera' },
  { mode: OVERLAY_MODE_SHARE, Icon: ScreenShare, label: 'Share Timer' },
  { mode: OVERLAY_MODE_POPOUT, Icon: PictureInPicture2, label: 'Timer Window' },
];

const MODE_LABELS = Object.fromEntries(OVERLAY_MODES.map(({ mode, label }) => [mode, label]));

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
  } = useTimer();
  const { showToast } = useToast();

  const [speakerName, setSpeakerName] = useState(currentSpeaker?.name || '');
  const [selectedRole, setSelectedRole] = useState(currentSpeaker?.role || 'Standard Speech');
  const [customRules, setCustomRules] = useState({ ...DEFAULT_CUSTOM_RULES });
  const [timeInputMode, setTimeInputMode] = useState(loadTimeInputMode);
  const [showEditRulesModal, setShowEditRulesModal] = useState(false);

  // State for "Reveal Face" toggle and video control
  const [isHidden, setIsHidden] = useState(true);
  const [videoState, setVideoStateLocal] = useState(null); // null = unknown, true = on, false = off
  const [isEnablingVideo, setIsEnablingVideo] = useState(false);
  const [previewColor, setPreviewColor] = useState(null);
  // Stage modes are session-only: a stored 'share' would otherwise come back as a
  // covered panel with no share behind it.
  const [overlayMode, setOverlayModeLocal] = useState(() => {
    const persisted = loadOverlayMode();
    return persisted && isVideoOverlayMode(persisted) ? persisted : OVERLAY_MODE_CARD;
  });

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

  // Sync persisted overlay mode to zoomSdk module on mount.
  // The stage modes are deliberately not restored: re-entering them would start a
  // screen share or pop a window open before the user has asked for anything.
  useEffect(() => {
    const persisted = loadOverlayMode();
    if (persisted && isVideoOverlayMode(persisted) && persisted !== getOverlayMode()) {
      setOverlayMode(persisted, null);
    }
  }, []);

  // Popping the app back in from Zoom's own ellipsis menu is the same intent as
  // pressing our exit button, so leave popout mode when the client reports a dock.
  // The window is already docked by then, so setOverlayMode only has to bring the
  // card overlay back.
  useEffect(() => {
    setPopoutChangeCallback((poppedOut) => {
      if (poppedOut || overlayMode !== OVERLAY_MODE_POPOUT) return;
      setOverlayModeLocal(OVERLAY_MODE_CARD);
      saveOverlayMode(OVERLAY_MODE_CARD);
      setOverlayMode(OVERLAY_MODE_CARD, isHidden ? getBackgroundUrl(currentStatus) : null);
    });
    return () => setPopoutChangeCallback(null);
  }, [overlayMode, isHidden, currentStatus]);

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

  // Handle overlay removal based on isHidden state
  // TimerContext handles applying overlays, we only need to remove them when isHidden is false
  // Skip in camera mode — face is always visible — and in the stage modes, where
  // removeOverlay would tear down the share or the popped-out window itself.
  useEffect(() => {
    if (overlayMode === OVERLAY_MODE_CAMERA || !isVideoOverlayMode(overlayMode)) return;
    if (!isHidden) {
      addDebugLog('Removing overlay (reveal face mode)', 'info');
      removeOverlay();
    } else {
      if (currentStatus) {
        const imageUrl = getBackgroundUrl(currentStatus);
        addDebugLog(`Applying overlay (hidden mode): ${currentStatus} -> ${imageUrl}`, 'info');
        applyOverlay(imageUrl);
      }
    }
  }, [isHidden, overlayMode]);

  // Watch for status changes and remove overlay if not hidden (card mode only)
  useEffect(() => {
    if (overlayMode === OVERLAY_MODE_CAMERA || !isVideoOverlayMode(overlayMode)) return;
    if (!isHidden) {
      addDebugLog('Status changed but in reveal mode - removing overlay', 'info');
      removeOverlay();
    }
  }, [currentStatus, isHidden, overlayMode]);

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
    const rules = item.role === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({ name: item.name, role: item.role, ...(rules && { rules }) });
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

  const handlePreviewColor = async (color) => {
    if (color === previewColor) {
      setPreviewColor(null);
    } else {
      setPreviewColor(color);
      applyOverlay(getBackgroundUrl(color));
    }
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

  const handleReset = () => {
    const previousElapsedTime = elapsedTime;
    const previousStatus = currentStatus;
    resetTimer();
    setSpeakerName('');
    // Track timer reset
    (window.requestIdleCallback || setTimeout)(() => trackEvent('timer_reset', {
      previous_elapsed_time: previousElapsedTime,
      previous_status: previousStatus
    }));
  };

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
    } else {
      setSpeakerName('');
    }
  };

  const handleToggleRevealFace = () => {
    const newIsHidden = !isHidden;
    setIsHidden(newIsHidden);
    // Track background toggle
    (window.requestIdleCallback || setTimeout)(() => trackEvent('background_toggled', {
      status: newIsHidden ? 'hidden' : 'revealed',
      current_timer_status: currentStatus
    }));
  };

  const handleModeSwitch = async (newMode) => {
    if (newMode === overlayMode) return;
    setOverlayModeLocal(newMode);
    // Only the video modes are remembered; see the initial state above.
    if (isVideoOverlayMode(newMode)) saveOverlayMode(newMode);
    const imageUrl = getBackgroundUrl(previewColor || currentStatus);
    const accepted = await setOverlayMode(newMode, isHidden ? imageUrl : null);
    if (newMode === OVERLAY_MODE_CAMERA) setIsHidden(true);

    // A refused stage mode would otherwise leave the panel covered by a stage
    // that nobody can see. Only real clients are rolled back: outside Zoom the
    // request always "fails", and the stage still needs to render for dev work.
    if (accepted === false && sdkStatus?.available) {
      showToast(
        newMode === OVERLAY_MODE_POPOUT
          ? 'This Zoom client cannot open the timer in its own window.'
          : 'Zoom would not start the timer share. Another share may be in progress.',
        'error'
      );
      setOverlayModeLocal(OVERLAY_MODE_CARD);
      saveOverlayMode(OVERLAY_MODE_CARD);
      await setOverlayMode(OVERLAY_MODE_CARD, isHidden ? imageUrl : null);
      return;
    }

    (window.requestIdleCallback || setTimeout)(() => trackEvent('overlay_mode_switched', { new_mode: newMode }));
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
          exitLabel={overlayMode === OVERLAY_MODE_SHARE ? 'Stop sharing' : 'Back to the main window'}
        />
      )}

      {/* Reveal Face + Overlay mode toggle in top right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {/* Reveal Face button — only in Timer Card mode */}
        {overlayMode === OVERLAY_MODE_CARD && (
          <button
            onClick={handleToggleRevealFace}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            data-tooltip={isHidden ? 'Reveal Face' : 'Hide Face'}
            data-tooltip-direction="down"
          >
            {isHidden ? (
              <EyeOff className="h-5 w-5 text-gray-700" />
            ) : (
              <Eye className="h-5 w-5 text-gray-700" />
            )}
          </button>
        )}
        {/* Segmented mode toggle: Timer Card | Timer + Camera | Share | Window */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {OVERLAY_MODES.map(({ mode, Icon, label }, index) => (
            <button
              key={mode}
              onClick={() => handleModeSwitch(mode)}
              className={`p-1.5 rounded-md transition-all ${
                overlayMode === mode
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-tooltip={label}
              data-tooltip-direction={index === OVERLAY_MODES.length - 1 ? 'down-left' : 'down'}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
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
                <div className="grid grid-cols-2 gap-2">
                  <div className={`px-2 py-1 rounded ${sdkStatus.initialized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    Initialized: {sdkStatus.initialized ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    Available: {sdkStatus.available ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.sdkExists ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    SDK Exists: {sdkStatus.sdkExists ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasSetVideoFilter ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    setVideoFilter: {sdkStatus.hasSetVideoFilter ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasDeleteVideoFilter ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    deleteVideoFilter: {sdkStatus.hasDeleteVideoFilter ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasGetUserContext ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    getUserContext: {sdkStatus.hasGetUserContext ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasGetVideoState ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    getVideoState: {sdkStatus.hasGetVideoState ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasSetVideoState ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    setVideoState: {sdkStatus.hasSetVideoState ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasSetVirtualBackground ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    setVirtualBg: {sdkStatus.hasSetVirtualBackground ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasRemoveVirtualBackground ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    removeVirtualBg: {sdkStatus.hasRemoveVirtualBackground ? 'Yes' : 'No'}
                  </div>
                </div>

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
                <div>Is Hidden: {isHidden ? 'Yes' : 'No'}</div>
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
                  data-tooltip="Reset the timer to 00:00 and clear the current speaker"
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
                  data-tooltip="Reset the timer to 00:00 and clear the current speaker"
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
