import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { ROLE_OPTIONS, DEFAULT_ROLE_RULES } from '../constants/timingRules';

// Helper to format seconds as MM:SS for display
const formatTimeForInput = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function EditRulesModal({ isOpen, onClose }) {
  const { roleRules, updateRoleRules } = useTimer();
  const [editedRules, setEditedRules] = useState({});

  // Initialize edited rules from current roleRules
  useEffect(() => {
    if (isOpen) {
      setEditedRules({ ...roleRules });
    }
  }, [isOpen, roleRules]);

  const handleRuleChange = (role, field, value) => {
    const numValue = parseInt(value) || 0;
    setEditedRules(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: numValue
      }
    }));
  };

  const handleSave = () => {
    // Validate all rules
    for (const role of ROLE_OPTIONS) {
      const rules = editedRules[role];
      if (!rules || rules.green <= 0 || rules.yellow <= rules.green || rules.red <= rules.yellow) {
        alert(`Invalid timing rules for ${role}. Green must be > 0, Yellow must be > Green, and Red must be > Yellow.`);
        return;
      }
    }

    // Save all rules
    Object.keys(editedRules).forEach(role => {
      updateRoleRules(role, editedRules[role]);
    });

    onClose();
  };

  const handleReset = (role) => {
    const defaultRules = DEFAULT_ROLE_RULES[role];
    setEditedRules(prev => ({
      ...prev,
      [role]: { ...defaultRules }
    }));
  };

  const handleResetAll = () => {
    if (window.confirm('Are you sure you want to reset all timing rules to defaults?')) {
      setEditedRules({ ...DEFAULT_ROLE_RULES });
    }
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

        <p className="text-sm text-gray-600 mb-4">
          Adjust the default timing rules for each speech type. These values will be used as defaults when selecting each role.
        </p>

        <div className="space-y-4">
          {ROLE_OPTIONS.map((role) => {
            const rules = editedRules[role] || DEFAULT_ROLE_RULES[role];
            const hasError = rules.yellow <= rules.green || rules.red <= rules.yellow;

            return (
              <div key={role} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900">{role}</h4>
                  <button
                    onClick={() => handleReset(role)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Reset to Default
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Green (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={rules.green}
                      onChange={(e) => handleRuleChange(role, 'green', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimeForInput(rules.green)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Yellow (seconds)
                    </label>
                    <input
                      type="number"
                      min={rules.green + 1}
                      value={rules.yellow}
                      onChange={(e) => handleRuleChange(role, 'yellow', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimeForInput(rules.yellow)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Red (seconds)
                    </label>
                    <input
                      type="number"
                      min={rules.yellow + 1}
                      value={rules.red}
                      onChange={(e) => handleRuleChange(role, 'red', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimeForInput(rules.red)}
                    </div>
                  </div>
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
    </div>
  );
}
