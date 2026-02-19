import { loadTimeInputMode } from '@toastmaster-timer/shared';

export function TimeInputModeToggle({ mode, onModeChange }) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
      <button
        type="button"
        onClick={() => onModeChange('minsec')}
        className={`px-2 py-1 text-xs ${mode === 'minsec' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
      >
        min:sec
      </button>
      <button
        type="button"
        onClick={() => onModeChange('seconds')}
        className={`px-2 py-1 text-xs ${mode === 'seconds' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
      >
        seconds
      </button>
    </div>
  );
}

export default function TimeInput({ value, onChange, label, layout = 'stacked' }) {
  const mode = loadTimeInputMode();

  if (layout === 'inline') {
    if (mode === 'seconds') {
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600 w-12 shrink-0">{label}</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-16 px-1 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
            />
            <span className="text-xs text-gray-500 shrink-0">sec</span>
          </div>
        </div>
      );
    }

    const mins = Math.floor(value / 60);
    const secs = value % 60;

    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-600 w-12 shrink-0">{label}</span>
        <div className="flex items-center">
          <input
            type="number"
            min="0"
            value={mins}
            onChange={(e) => {
              const newMins = Math.max(0, parseInt(e.target.value, 10) || 0);
              onChange(newMins * 60 + secs);
            }}
            className="w-16 px-1 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
          />
          <span className="text-gray-400 font-bold mx-1">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={secs}
            onChange={(e) => {
              const newSecs = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
              onChange(mins * 60 + newSecs);
            }}
            className="w-16 px-1 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
          />
          <span className="text-xs text-gray-400 ml-2 shrink-0">min:sec</span>
        </div>
      </div>
    );
  }

  // Stacked layout (default, used in EditRulesModal grid)
  if (mode === 'seconds') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-14 px-1 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
          />
          <span className="text-xs text-gray-500">sec</span>
        </div>
      </div>
    );
  }

  const mins = Math.floor(value / 60);
  const secs = value % 60;

  const handleMinsChange = (e) => {
    const newMins = Math.max(0, parseInt(e.target.value, 10) || 0);
    onChange(newMins * 60 + secs);
  };

  const handleSecsChange = (e) => {
    const newSecs = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
    onChange(mins * 60 + newSecs);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center">
        <input
          type="number"
          min="0"
          value={mins}
          onChange={handleMinsChange}
          className="w-12 px-1 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
        />
        <span className="text-gray-400 font-bold mx-0.5">:</span>
        <input
          type="number"
          min="0"
          max="59"
          value={secs}
          onChange={handleSecsChange}
          className="w-12 px-1 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
        />
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">min : sec</div>
    </div>
  );
}
