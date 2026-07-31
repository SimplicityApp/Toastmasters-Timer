import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check, CornerDownLeft } from 'lucide-react';

/**
 * The speaker control on the timer stage.
 *
 * Its own component rather than a variant of SpeakerInput, because what the
 * stage needs and what the panel needs have stopped being the same thing. Here
 * the organizer is mid-meeting, looking at a screen that may be shared, and
 * wants three things within reach: jump to whoever is actually speaking next,
 * add someone who was never on the agenda, and fix a name that came in wrong.
 * The panel's field does none of those — it names the current speaker and offers
 * suggestions, which is right for setting up before the meeting starts.
 *
 * Deliberately not full width: it sits over the timer color, so it takes the
 * space it needs and leaves the rest of the stage to the signal.
 */
export default memo(function StageSpeakerPicker({
  value,
  onChange,
  agendaItems,
  activeSpeakerId,
  onSelectSpeaker,
  onAddSpeaker,
  onRenameSpeaker,
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const upNext = (agendaItems || []).filter((item) => !item.completed || item.id === activeSpeakerId);
  const activeItem = (agendaItems || []).find((item) => item.id === activeSpeakerId);
  const typed = (value || '').trim();

  // What Enter will do, which is also what the hint promises. Renaming wins when
  // an agenda speaker is up: correcting "Jon" to "John" mid-speech should fix the
  // agenda, not add a second person.
  const pendingRename = Boolean(activeItem) && typed && typed !== (activeItem.name || '').trim();
  const pendingAdd = !activeItem && typed && !upNext.some(
    (item) => (item.name || '').trim().toLowerCase() === typed.toLowerCase()
  );

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (pendingRename) onRenameSpeaker(activeItem.id, typed);
    else if (pendingAdd) onAddSpeaker(typed);
    inputRef.current?.blur();
  };

  const pick = (item) => {
    setOpen(false);
    onSelectSpeaker(item.id);
  };

  return (
    <div className="relative w-56 max-w-full">
      <div className="flex items-stretch rounded-md border border-white/30 bg-black/25 focus-within:ring-2 focus-within:ring-white/60">
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Speaker name"
          aria-label="Speaker name"
          className="min-w-0 flex-1 bg-transparent py-1.5 px-2.5 text-lg font-semibold text-white placeholder-white/50 focus:outline-none"
        />
        {/* Only worth a dropdown when there is a running order to move around in. */}
        {upNext.length > 1 && (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            className="px-1.5 text-white/70 hover:text-white transition-colors flex-shrink-0"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Choose a speaker from the agenda"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Says what Enter does before it is pressed, so typing a name is not a
          guess about whether anything was recorded. */}
      {(pendingAdd || pendingRename) && (
        <div className="absolute left-0 top-full mt-1 flex items-center gap-1 text-xs text-white/85 bg-black/45 rounded px-1.5 py-0.5 pointer-events-none">
          <CornerDownLeft className="h-3 w-3 flex-shrink-0" />
          {pendingAdd ? 'Enter to add to agenda' : 'Enter to rename'}
        </div>
      )}

      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto"
        >
          {upNext.map((item) => {
            const isActive = item.id === activeSpeakerId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => pick(item)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                      {item.name || 'Unnamed'}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{item.role}</span>
                  </span>
                  {isActive && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
