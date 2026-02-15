import { useState, useEffect, useRef } from 'react';
import { useTimer } from '../context/TimerContext';
import { useToast } from '../context/ToastContext';
import { Play, Square, RotateCcw } from 'lucide-react';
import SpeakerInput from './SpeakerInput';
import TimerDisplay from './TimerDisplay';
import EditRulesModal from './EditRulesModal';
import { DEFAULT_ROLE_RULES, DEFAULT_CUSTOM_RULES } from '@toastmaster-timer/shared';
import { setPageBackgroundFromStatus } from '../utils/pageBackground';

export default function LiveTab({ onTimerStart }) {
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
    roleOptions,
    agenda,
    activeSpeakerId,
    loadSpeakerFromAgenda,
  } = useTimer();
  const { showToast } = useToast();

  const [speakerName, setSpeakerName] = useState(currentSpeaker?.name || '');
  const [selectedRole, setSelectedRole] = useState(currentSpeaker?.role || 'Standard Speech');
  const [customRules, setCustomRules] = useState({ ...DEFAULT_CUSTOM_RULES });
  const [showEditRulesModal, setShowEditRulesModal] = useState(false);
  const [previewColor, setPreviewColor] = useState(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && !currentSpeaker && selectedRole && roleRules && Object.keys(roleRules).length > 0) {
      setCurrentSpeaker({ name: '', role: selectedRole });
      initializedRef.current = true;
    }
  }, [roleRules, selectedRole, currentSpeaker, setCurrentSpeaker]);

  useEffect(() => {
    if (currentSpeaker) {
      setSpeakerName(currentSpeaker.name || '');
      setSelectedRole(currentSpeaker.role);
      if (currentSpeaker.role === 'Custom' && currentSpeaker.rules) {
        setCustomRules({ ...DEFAULT_CUSTOM_RULES, ...currentSpeaker.rules });
      }
    } else {
      setSpeakerName('');
      setSelectedRole('Standard Speech');
    }
  }, [currentSpeaker]);

  useEffect(() => {
    if (selectedRole === 'Custom' && roleRules['Custom'] && !currentSpeaker) {
      setCustomRules({ ...DEFAULT_CUSTOM_RULES, ...roleRules['Custom'] });
    }
  }, [selectedRole, roleRules]);

  useEffect(() => {
    if (isRunning) setPreviewColor(null);
  }, [isRunning]);

  const handleSpeakerChange = (name) => {
    setSpeakerName(name || '');
    const rules = selectedRole === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({ name: name || '', role: selectedRole, ...(rules && { rules }) });
  };

  const handleSelectSuggestion = (item) => {
    setSpeakerName(item.name);
    setSelectedRole(item.role);
    const rules = item.role === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({ name: item.name, role: item.role, ...(rules && { rules }) });
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    const rules = role === 'Custom' ? customRules : undefined;
    setCurrentSpeaker({ name: speakerName || '', role, ...(rules && { rules }) });
  };

  const handleCustomRuleChange = (field, value) => {
    const numValue = field === 'graceAfterRed' ? Math.max(0, parseInt(value, 10) || 0) : (parseInt(value, 10) || 0);
    const newRules = { ...customRules, [field]: numValue };
    setCustomRules(newRules);
    if (selectedRole === 'Custom') {
      setCurrentSpeaker({ name: speakerName || '', role: 'Custom', rules: newRules });
    }
  };

  const formatTimeForInput = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };
  const formatTimeReadable = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} second${secs !== 1 ? 's' : ''}`;
    if (secs === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    return `${mins} min ${secs} sec`;
  };
  const getRoleExplanation = (role) => {
    const rules = roleRules[role] || DEFAULT_ROLE_RULES[role] || DEFAULT_ROLE_RULES['Standard Speech'];
    return `Green: ${formatTimeReadable(rules.green)}, Yellow: ${formatTimeReadable(rules.yellow)}, Red: ${formatTimeReadable(rules.red)}`;
  };

  const handlePreviewColor = (color) => {
    if (color === previewColor) {
      setPreviewColor(null);
      setPageBackgroundFromStatus('blue');
    } else {
      setPreviewColor(color);
      setPageBackgroundFromStatus(color);
    }
  };

  const handleStart = () => {
    if (selectedRole === 'Custom') {
      if (customRules.green <= 0 || customRules.yellow <= customRules.green || customRules.red <= customRules.yellow) {
        showToast('Invalid timing rules. Green must be > 0, Yellow must be > Green, and Red must be > Yellow.', 'error');
        return;
      }
    }
    const rules = selectedRole === 'Custom' ? customRules : roleRules[selectedRole];
    if (!rules) {
      showToast('Please set timing rules first', 'warning');
      return;
    }
    setCurrentSpeaker({ name: speakerName || '', role: selectedRole, ...(selectedRole === 'Custom' && { rules }) });
    startTimer();
    onTimerStart?.();
  };

  const handleContinue = () => startTimer();
  const handleStop = () => stopTimer();
  const handleReset = () => {
    resetTimer();
    setSpeakerName('');
  };
  const handleFinish = () => {
    const currentAgendaId = activeSpeakerId;
    finishCurrentSpeech();
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
    setSpeakerName('');
  };

  return (
    <div className="p-4 space-y-4 relative">
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
        <p className="text-xs text-gray-500 mt-1">Timing rules: {getRoleExplanation(selectedRole)}</p>
      )}
      {selectedRole === 'Custom' && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Timing Rules</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Green (sec)</label>
              <input type="number" min="1" value={customRules.green} onChange={(e) => handleCustomRuleChange('green', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <div className="text-xs text-gray-500 mt-1">{formatTimeForInput(customRules.green)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Yellow (sec)</label>
              <input type="number" min={customRules.green + 1} value={customRules.yellow} onChange={(e) => handleCustomRuleChange('yellow', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <div className="text-xs text-gray-500 mt-1">{formatTimeForInput(customRules.yellow)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Red (sec)</label>
              <input type="number" min={customRules.yellow + 1} value={customRules.red} onChange={(e) => handleCustomRuleChange('red', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <div className="text-xs text-gray-500 mt-1">{formatTimeForInput(customRules.red)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grace (sec)</label>
              <input type="number" min="0" value={customRules.graceAfterRed ?? DEFAULT_CUSTOM_RULES.graceAfterRed} onChange={(e) => handleCustomRuleChange('graceAfterRed', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>
          {(customRules.yellow <= customRules.green || customRules.red <= customRules.yellow) && (
            <div className="text-xs text-red-600">Yellow &gt; Green, Red &gt; Yellow</div>
          )}
        </div>
      )}

      <TimerDisplay elapsedTime={elapsedTime} status={previewColor || currentStatus} rules={currentSpeaker?.rules} />

      {!isRunning && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-xs text-gray-500">Preview:</span>
          {[
            { color: 'blue', hex: '#1e3a5f' },
            { color: 'green', hex: '#22c55e' },
            { color: 'yellow', hex: '#eab308' },
            { color: 'red', hex: '#dc2626' },
          ].map(({ color, hex }) => (
            <button
              key={color}
              onClick={() => handlePreviewColor(color)}
              className={`w-8 h-8 rounded-full transition-all ${previewColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      )}

      <div className="space-y-2 pb-20">
        {isRunning ? (
          <div className="flex gap-2">
            <button onClick={handleStop} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
              <Square className="h-5 w-5" /> STOP
            </button>
            <button onClick={handleFinish} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg">
              FINISH
            </button>
          </div>
        ) : elapsedTime === 0 ? (
          <>
            <div className="flex gap-2">
              <button onClick={handleStart} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                <Play className="h-5 w-5" /> START
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" /> RESET
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <button onClick={handleContinue} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                <Play className="h-5 w-5" /> CONTINUE
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" /> RESET
              </button>
              <button onClick={handleFinish} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">
                FINISH
              </button>
            </div>
          </>
        )}
      </div>

      <EditRulesModal isOpen={showEditRulesModal} onClose={() => setShowEditRulesModal(false)} />
    </div>
  );
}
