import { useState, useEffect } from 'react';
import { useTimer } from '../context/TimerContext';
import { Play, Square, RotateCcw, Eye, EyeOff, Video } from 'lucide-react';
import SpeakerInput from './SpeakerInput';
import TimerDisplay from './TimerDisplay';
import EditRulesModal from './EditRulesModal';
import { ROLE_OPTIONS } from '../constants/timingRules';
import { getVideoState, setVideoState, applyOverlay, removeVideoFilter, getBackgroundUrl, getSdkStatus } from '../utils/zoomSdk';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export default function LiveTab() {
  const {
    isRunning,
    elapsedTime,
    currentStatus,
    currentSpeaker,
    startTimer,
    stopTimer,
    resetTimer,
    setCurrentSpeaker,
    finishCurrentSpeech,
    roleRules,
  } = useTimer();

  const [speakerName, setSpeakerName] = useState(currentSpeaker?.name || '');
  const [selectedRole, setSelectedRole] = useState(currentSpeaker?.role || 'Standard Speech');
  const [customRules, setCustomRules] = useState({
    green: 300, // 5 minutes in seconds
    yellow: 360, // 6 minutes in seconds
    red: 420, // 7 minutes in seconds
  });
  const [showEditRulesModal, setShowEditRulesModal] = useState(false);
  
  // State for "Reveal Face" toggle and video control
  const [isHidden, setIsHidden] = useState(true);
  const [videoState, setVideoStateLocal] = useState(null); // null = unknown, true = on, false = off
  const [isEnablingVideo, setIsEnablingVideo] = useState(false);
  
  // Debug panel feature flag - can be disabled via environment variable for production
  // Set VITE_ENABLE_DEBUG_PANEL=false in production to hide the panel completely
  const DEBUG_PANEL_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL !== 'false';
  console.log('DEBUG_PANEL_ENABLED', DEBUG_PANEL_ENABLED);
  
  // Debug panel state - collapsed by default, remember user preference in localStorage
  const [debugPanelExpanded, setDebugPanelExpanded] = useState(() => {
    const saved = localStorage.getItem('debugPanelExpanded');
    return saved ? saved === 'true' : false; // Default to collapsed
  });
  const [sdkStatus, setSdkStatus] = useState(null);
  const [lastError, setLastError] = useState(null);
  
  // Save expanded state to localStorage
  const toggleDebugPanel = () => {
    const newState = !debugPanelExpanded;
    setDebugPanelExpanded(newState);
    localStorage.setItem('debugPanelExpanded', String(newState));
  };

  // Update local state when currentSpeaker changes (but preserve custom rules if Custom role)
  useEffect(() => {
    if (currentSpeaker) {
      setSpeakerName(currentSpeaker.name || '');
      setSelectedRole(currentSpeaker.role);
      // If custom role and has custom rules, update local state
      if (currentSpeaker.role === 'Custom' && currentSpeaker.rules) {
        setCustomRules(currentSpeaker.rules);
      }
      // If switching to Custom role but no rules yet, keep current customRules (don't reset)
    } else {
      setSpeakerName('');
      setSelectedRole('Standard Speech');
      // Don't reset custom rules here - they should persist until explicitly changed
    }
  }, [currentSpeaker]);

  // When switching to Custom role for the first time, use the default from roleRules
  useEffect(() => {
    if (selectedRole === 'Custom' && roleRules['Custom'] && !currentSpeaker) {
      setCustomRules(roleRules['Custom']);
    }
  }, [selectedRole]);

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
        } else if (!status.hasSetVideoFilter && !status.hasSetVirtualBackground) {
          setLastError('setVideoFilter and setVirtualBackground are not available. Available methods: ' + (status.availableMethods?.join(', ') || 'none'));
        } else if (!status.hasSetVideoFilter) {
          setLastError('setVideoFilter is not a function. Using setVirtualBackground as fallback.');
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
  useEffect(() => {
    if (!isHidden) {
      // Remove filter to show face (override any overlays from TimerContext)
      removeVideoFilter();
    } else {
      // When toggling back to hidden, reapply current overlay
      // TimerContext will handle future status changes
      if (currentStatus) {
        applyOverlay(getBackgroundUrl(currentStatus));
      }
    }
  }, [isHidden]); // Only depend on isHidden, not currentStatus

  // Watch for status changes and remove filter if not hidden
  // This ensures TimerContext overlays are immediately removed when isHidden is false
  useEffect(() => {
    if (!isHidden) {
      // Remove filter whenever status changes if we're in reveal mode
      removeVideoFilter();
    }
  }, [currentStatus, isHidden]);

  const handleSpeakerChange = (name) => {
    setSpeakerName(name || '');
    // Always update current speaker, even if name is empty (optional)
    const rules = selectedRole === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({
      name: name || '',
      role: selectedRole,
      ...(rules && { rules }),
    });
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    // Always update current speaker, even if name is empty
    const rules = role === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({
      name: speakerName || '',
      role,
      ...(rules && { rules }),
    });
  };

  const handleCustomRuleChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    const newRules = { ...customRules, [field]: numValue };
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

  // Helper to format seconds as MM:SS for display
  const formatTimeForInput = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleStart = () => {
    // Speaker name is optional, but validate custom rules if Custom role is selected
    if (selectedRole === 'Custom') {
      // Validate custom rules
      if (customRules.green <= 0 || customRules.yellow <= customRules.green || customRules.red <= customRules.yellow) {
        alert('Invalid timing rules. Green must be > 0, Yellow must be > Green, and Red must be > Yellow.');
        return;
      }
    }
    // Ensure current speaker is set with correct rules
    if (!currentSpeaker || (selectedRole === 'Custom' && !currentSpeaker.rules)) {
      const rules = selectedRole === 'Custom' ? customRules : undefined;
      setCurrentSpeaker({
        name: speakerName || '',
        role: selectedRole,
        ...(rules && { rules }),
      });
    }
    startTimer();
  };

  const handleStop = () => {
    stopTimer();
  };

  const handleReset = () => {
    resetTimer();
    setSpeakerName('');
    setSelectedRole('Standard Speech');
  };

  const handleFinish = () => {
    finishCurrentSpeech();
    setSpeakerName('');
    setSelectedRole('Standard Speech');
  };

  const handleToggleRevealFace = () => {
    setIsHidden(!isHidden);
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
        alert('Failed to turn video on. Please turn on video manually in Zoom.');
      }
    } catch (error) {
      console.error('Failed to turn video on:', error);
      alert('Failed to turn video on. Please turn on video manually in Zoom.');
    } finally {
      setIsEnablingVideo(false);
    }
  };

  return (
    <div className="p-4 space-y-4 relative">
      {/* "Reveal Face" toggle button in top right */}
      <button
        onClick={handleToggleRevealFace}
        className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors z-10"
        title={isHidden ? 'Reveal Face' : 'Hide Face'}
      >
        {isHidden ? (
          <EyeOff className="h-5 w-5 text-gray-700" />
        ) : (
          <Eye className="h-5 w-5 text-gray-700" />
        )}
      </button>

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
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasRemoveVideoFilter ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    removeVideoFilter: {sdkStatus.hasRemoveVideoFilter ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasSetVirtualBackground ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    setVirtualBackground: {sdkStatus.hasSetVirtualBackground ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasGetUserContext ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    getUserContext: {sdkStatus.hasGetUserContext ? 'Yes' : 'No'}
                  </div>
                  <div className={`px-2 py-1 rounded ${sdkStatus.hasSetVideoState ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    setVideoState: {sdkStatus.hasSetVideoState ? 'Yes' : 'No'}
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
              <div className="text-gray-600">
                <div>Video State: {videoState === null ? 'Unknown' : videoState ? 'ON' : 'OFF'}</div>
                <div>Current Status: {currentStatus || 'None'}</div>
                <div>Is Hidden: {isHidden ? 'Yes' : 'No'}</div>
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
        roleOptions={ROLE_OPTIONS}
        onEditRules={() => setShowEditRulesModal(true)}
      />

      {selectedRole === 'Custom' && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Timing Rules</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Green (seconds)
              </label>
              <input
                type="number"
                min="1"
                value={customRules.green}
                onChange={(e) => handleCustomRuleChange('green', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="300"
              />
              <div className="text-xs text-gray-500 mt-1">
                {formatTimeForInput(customRules.green)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Yellow (seconds)
              </label>
              <input
                type="number"
                min={customRules.green + 1}
                value={customRules.yellow}
                onChange={(e) => handleCustomRuleChange('yellow', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="360"
              />
              <div className="text-xs text-gray-500 mt-1">
                {formatTimeForInput(customRules.yellow)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Red (seconds)
              </label>
              <input
                type="number"
                min={customRules.yellow + 1}
                value={customRules.red}
                onChange={(e) => handleCustomRuleChange('red', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="420"
              />
              <div className="text-xs text-gray-500 mt-1">
                {formatTimeForInput(customRules.red)}
              </div>
            </div>
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
        status={currentStatus}
        rules={currentSpeaker?.rules}
      />

      <div className="space-y-2">
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={videoState === false}
              className={`flex-1 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                videoState === false
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Play className="h-5 w-5" />
              START
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Square className="h-5 w-5" />
              STOP
            </button>
          )}
        </div>

        {/* Video state warning and button */}
        {videoState === false && (
          <div className="space-y-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                Turn on video to enable Timer Card
              </p>
            </div>
            <button
              onClick={handleTurnVideoOn}
              disabled={isEnablingVideo}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isEnablingVideo ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Turning Video On...</span>
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

        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            RESET
          </button>
          {isRunning && (
            <button
              onClick={handleFinish}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              FINISH
            </button>
          )}
        </div>
      </div>

      <EditRulesModal
        isOpen={showEditRulesModal}
        onClose={() => setShowEditRulesModal(false)}
      />
    </div>
  );
}
