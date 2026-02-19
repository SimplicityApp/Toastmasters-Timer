import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { useToast } from '../context/ToastContext';
import { DEFAULT_ROLE_RULES, getDefaultGraceAfterRed, DEFAULT_CUSTOM_RULES, loadTimeInputMode, saveTimeInputMode } from '@toastmaster-timer/shared';
import ConfirmModal from './ConfirmModal';
import TimeInput, { TimeInputModeToggle } from './TimeInput';
import { trackEvent } from '../utils/posthog';

const isBuiltInRole = (role) => role in DEFAULT_ROLE_RULES;

export default function EditRulesModal({ isOpen, onClose }) {
  const { roleRules, roleOptions, updateRoleRules, addRoleRules, removeRoleRules, resetAllRoleRulesToDefaults } = useTimer();
  const { showToast } = useToast();
  const [editedRules, setEditedRules] = useState({});
  const [newRoleNames, setNewRoleNames] = useState({});
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [timeInputMode, setTimeInputMode] = useState(loadTimeInputMode);
  const prevOpenRef = useRef(false);

  // Initialize edited rules only when modal opens (not when roleRules changes while open)
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setEditedRules({ ...roleRules });
      setNewRoleNames({});
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, roleRules]);

  const handleRuleChange = (role, field, value) => {
    setEditedRules(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value
      }
    }));
  };

  const handleAddRole = () => {
    const tempId = `__new_${Date.now()}`;
    setEditedRules(prev => ({
      ...prev,
      [tempId]: { ...DEFAULT_CUSTOM_RULES }
    }));
    setNewRoleNames(prev => ({ ...prev, [tempId]: 'New role' }));
  };

  const handleNewRoleNameChange = (tempId, name) => {
    setNewRoleNames(prev => ({ ...prev, [tempId]: name }));
  };

  const handleRemoveNewRole = (tempId) => {
    setEditedRules(prev => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
    setNewRoleNames(prev => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const handleRemoveRole = (role) => {
    setEditedRules(prev => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    removeRoleRules(role);
  };

  const rolesToShow = [
    ...(roleOptions ?? []),
    ...Object.keys(editedRules).filter((k) => k.startsWith('__new_'))
  ];

  const handleSave = () => {
    const seenNames = new Set();

    for (const role of rolesToShow) {
      const rules = editedRules[role];
      if (!rules || rules.green <= 0 || rules.yellow <= rules.green || rules.red <= rules.yellow) {
        const displayName = role.startsWith('__new_') ? (newRoleNames[role] || role) : role;
        showToast(`Invalid timing rules for ${displayName}. Green must be > 0, Yellow must be > Green, and Red must be > Yellow.`, 'error');
        return;
      }
      if (role.startsWith('__new_')) {
        const name = (newRoleNames[role] || '').trim();
        if (!name) {
          showToast('Please enter a name for the new role.', 'error');
          return;
        }
        if (seenNames.has(name) || roleOptions.includes(name)) {
          showToast(`A role named "${name}" already exists.`, 'error');
          return;
        }
        seenNames.add(name);
      }
    }

    for (const role of rolesToShow) {
      const rules = editedRules[role];
      if (role.startsWith('__new_')) {
        const name = (newRoleNames[role] || '').trim();
        if (name) {
          addRoleRules(name, rules);
          trackEvent('role_added', { role: name, rules });
        }
      } else {
        const oldRules = roleRules[role];
        const graceOld = oldRules?.graceAfterRed ?? getDefaultGraceAfterRed(role);
        const graceNew = rules.graceAfterRed ?? getDefaultGraceAfterRed(role);
        if (oldRules && (
          oldRules.green !== rules.green ||
          oldRules.yellow !== rules.yellow ||
          oldRules.red !== rules.red ||
          graceOld !== graceNew
        )) {
          updateRoleRules(role, rules);
          trackEvent('rules_edited', {
            role,
            new_rules: rules,
            previous_rules: oldRules
          });
        }
      }
    }

    onClose();
  };

  const handleReset = (role) => {
    const defaultRules = DEFAULT_ROLE_RULES[role];
    if (!defaultRules) return;
    setEditedRules(prev => ({
      ...prev,
      [role]: { ...defaultRules }
    }));
  };

  const handleResetAll = () => {
    setShowResetAllConfirm(true);
  };

  const handleConfirmResetAll = () => {
    resetAllRoleRulesToDefaults();
    setEditedRules(prev => ({
      ...DEFAULT_ROLE_RULES,
      ...Object.fromEntries(Object.entries(prev).filter(([k]) => !(k in DEFAULT_ROLE_RULES)))
    }));
    setShowResetAllConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Timing Rules</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Adjust the default timing rules for each speech type. These values will be used as defaults when selecting each role.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0 ml-4">
            <span>Input:</span>
            <TimeInputModeToggle mode={timeInputMode} onModeChange={(m) => { saveTimeInputMode(m); setTimeInputMode(m); }} />
          </div>
        </div>

        <div className="space-y-4">
          {rolesToShow.map((role) => {
            const isNew = role.startsWith('__new_');
            const defaultRules = DEFAULT_CUSTOM_RULES;
            const rules = editedRules[role] ?? (isNew ? { ...defaultRules } : DEFAULT_ROLE_RULES[role] ?? { ...defaultRules });
            const graceValue = rules.graceAfterRed ?? (isNew ? 30 : getDefaultGraceAfterRed(role));
            const hasError = !rules || rules.yellow <= rules.green || rules.red <= rules.yellow;
            const builtIn = !isNew && isBuiltInRole(role);

            return (
              <div key={role} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3 gap-2">
                  {isNew ? (
                    <input
                      type="text"
                      value={newRoleNames[role] || ''}
                      onChange={(e) => handleNewRoleNameChange(role, e.target.value)}
                      placeholder="Role name"
                      className="flex-1 font-semibold text-gray-900 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  ) : (
                    <h4 className="font-semibold text-gray-900">{role}</h4>
                  )}
                  <div className="flex items-center gap-2">
                    {builtIn && (
                      <button
                        onClick={() => handleReset(role)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Reset to Default
                      </button>
                    )}
                    <button
                      onClick={() => isNew ? handleRemoveNewRole(role) : handleRemoveRole(role)}
                      className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                      aria-label="Remove role"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <TimeInput label="Green" value={rules.green} onChange={(v) => handleRuleChange(role, 'green', v)} />
                  <TimeInput label="Yellow" value={rules.yellow} onChange={(v) => handleRuleChange(role, 'yellow', v)} />
                  <TimeInput label="Red" value={rules.red} onChange={(v) => handleRuleChange(role, 'red', v)} />
                  <TimeInput label="Grace" value={graceValue} onChange={(v) => handleRuleChange(role, 'graceAfterRed', v)} />
                </div>

                {hasError && (
                  <div className="text-xs text-red-600 mt-2">
                    Invalid: Yellow must be &gt; Green, Red must be &gt; Yellow
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAddRole}
          className="mt-2 flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-dashed border-gray-300"
        >
          <Plus className="h-4 w-4" />
          Add role
        </button>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleResetAll}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors text-sm"
          >
            Reset All to Defaults
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Save Changes
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetAllConfirm}
        title="Reset All Rules"
        message="Are you sure you want to reset all built-in timing rules to defaults? Custom roles will be kept."
        confirmText="Reset All"
        cancelText="Cancel"
        onConfirm={handleConfirmResetAll}
        onCancel={() => setShowResetAllConfirm(false)}
        confirmButtonClass="bg-blue-500 hover:bg-blue-600"
      />
    </div>
  );
}
