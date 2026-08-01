import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check, CornerDownLeft, Users } from 'lucide-react';
import useZoomParticipants, { participantsNotOnAgenda } from '../hooks/useZoomParticipants';

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
 * The two lists it picks from are the panel's, though: the agenda and everyone
 * in the meeting. A club that runs Table Topics off no agenda at all was
 * otherwise left typing names by hand on the one screen where typing is hardest,
 * while Zoom already knew every one of them.
 *
 * Deliberately not full width: it sits over the timer color, so it takes the
 * space it needs and leaves the rest of the stage to the signal.
 */
export default memo(function StageSpeakerPicker({
  value,
  onChange,
  role,
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
  const { participants, restricted: participantsRestricted } = useZoomParticipants();

  const upNext = (agendaItems || []).filter((item) => !item.completed || item.id === activeSpeakerId);
  const activeItem = (agendaItems || []).find((item) => item.id === activeSpeakerId);
  const typed = (value || '').trim();

  // The other half of the list, and the reason this is a dropdown at all when
  // nothing was imported: a club that never pastes an agenda in still has
  // everyone's name sitting in the meeting. Same two groups the panel field
  // offers, so the two places a speaker gets named agree on who is available.
  const guests = participantsNotOnAgenda(participants, upNext);

  // Worth a dropdown as soon as there is anywhere to go: another agenda entry,
  // or anyone in the meeting who is not on it yet.
  const hasChoices = upNext.length > 1 || guests.length > 0;

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

  /**
   * Picking someone who is in the meeting but not on the agenda. Adding them is
   * what Enter already does with a name typed by hand, and it is the only outcome
   * that leaves the meeting on a running order: merely copying the name into the
   * field would record nothing, so finishing could not advance and the speech
   * would never reach the report.
   */
  const pickGuest = (person) => {
    setOpen(false);
    onAddSpeaker(person.name);
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
        {hasChoices && (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            className="px-1.5 text-white/70 hover:text-white transition-colors flex-shrink-0"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Choose a speaker from the agenda or the meeting"
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
          {/* Labelled whenever the group has anyone in it, even when it is the
              only group: picking from the agenda moves the timer along a running
              order, picking from the meeting puts someone on it. Same two labels
              as the panel field, so neither list has to be learned twice. */}
          {upNext.length > 0 && (
            <li className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50" role="presentation">
              Agenda
            </li>
          )}
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

          {guests.length > 0 && (
            <li className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50" role="presentation">
              Zoom Participants
            </li>
          )}
          {guests.map((person) => (
            <li key={`guest-${person.id || person.name}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pickGuest(person)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{person.name}</span>
                  {/* The role they will be added under, which is the one the
                      panel currently has selected — worth saying, since it is
                      the one thing picking a participant decides for them. */}
                  {role && <span className="block truncate text-xs text-gray-500">Add as {role}</span>}
                </span>
              </button>
            </li>
          ))}

          {/* Only where the organizer can act on it, and only at the foot of a
              list they opened themselves. A host never sees it. */}
          {participantsRestricted && (
            <li className="flex items-start gap-1.5 px-3 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
              <Users className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Ask to be made host or co-host to pick speakers from the participant list.</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
});
