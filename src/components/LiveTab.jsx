import { useState, useEffect } from 'react';
import { useTimer } from '../context/TimerContext';
import { Play, Square, RotateCcw, Eye, EyeOff, Video } from 'lucide-react';
import SpeakerInput from './SpeakerInput';
import TimerDisplay from './TimerDisplay';
import EditRulesModal from './EditRulesModal';
import { ROLE_OPTIONS } from '../constants/timingRules';
import { getVideoState, setVideoState, applyOverlay, removeVideoFilter, getBackgroundUrl } from '../utils/zoomSdk';

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
        className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        title={isHidden ? 'Reveal Face' : 'Hide Face'}
      >
        {isHidden ? (
          <EyeOff className="h-5 w-5 text-gray-700" />
        ) : (
          <Eye className="h-5 w-5 text-gray-700" />
        )}
      </button>

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
