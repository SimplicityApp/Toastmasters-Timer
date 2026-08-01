import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { getZoomParticipants } from '../utils/zoomSdk';
import { ChevronDown, CornerDownLeft, Users } from 'lucide-react';

/**
 * @param {'panel'|'stage'} [variant] - 'stage' is the compact form the timer
 *   stage uses: the name field alone, styled for a colored backdrop. The role
 *   picker and the rules link stay behind on the panel, where there is room for
 *   them and where changing a role is not something to do mid-speech in front of
 *   the meeting. The suggestion list is shared, so picking a speaker off the
 *   agenda works the same in both.
 * @param {string|null} [activeSpeakerId] - Agenda item the timer is currently on,
 *   which is what makes Enter a rename rather than an add.
 * @param {(name: string) => void} [onAddSpeaker] - Put a typed name on the agenda.
 * @param {(id: string, name: string) => void} [onRenameSpeaker] - Fix the active
 *   speaker's name without losing their place in the running order.
 */
export default memo(function SpeakerInput({ value, onChange, onRoleChange, selectedRole, roleOptions, onEditRules, agendaItems, onSelectSuggestion, activeSpeakerId, onAddSpeaker, onRenameSpeaker, variant = 'panel' }) {
  const isStage = variant === 'stage';
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [participants, setParticipants] = useState([]);
  // True only when the participant list was withheld because the organizer is
  // not host or co-host — the one cause they can actually do something about.
  const [participantsRestricted, setParticipantsRestricted] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getZoomParticipants().then((result) => {
      if (cancelled) return;
      setParticipants(result?.participants || []);
      setParticipantsRestricted(Boolean(result?.restricted));
    });
    return () => { cancelled = true; };
  }, []);

  // Filter agenda items (non-completed, with names, not already in participants)
  const filteredAgendaItems = useMemo(() => (agendaItems || []).filter(item =>
    !item.completed && item.name &&
    item.name.toLowerCase().includes((value || '').toLowerCase()) &&
    !participants.some(p => p.name.toLowerCase() === item.name.toLowerCase())
  ), [agendaItems, value, participants]);

  // Filter participants based on current value
  const filteredParticipants = useMemo(() => (value || '') === ''
    ? participants
    : participants.filter((person) =>
        person.name.toLowerCase().includes(value.toLowerCase())
      ), [participants, value]);

  const suggestions = useMemo(() => [
    ...filteredAgendaItems.map(item => ({ ...item, _fromAgenda: true })),
    ...filteredParticipants.map(person => ({ ...person, _fromAgenda: false })),
  ], [filteredAgendaItems, filteredParticipants]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  const handleSelect = (item) => {
    if (item._fromAgenda && onSelectSuggestion) {
      onSelectSuggestion(item);
    } else {
      onChange(item.name);
    }
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // What Enter does with a name that matches nothing in the list. Same two
  // outcomes as the stage picker, and for the same reason: typing a name used to
  // change only the label above the timer, so nothing was recorded and the
  // organizer had no way to tell. Renaming wins when an agenda speaker is up —
  // correcting "Jon" to "John" should fix the agenda, not add a second person.
  const typed = (value || '').trim();
  const activeItem = (agendaItems || []).find((item) => item.id === activeSpeakerId);
  // Completed items are excluded so the same name can be added again later in the
  // meeting — someone who already spoke may be back on as an evaluator.
  const upNext = (agendaItems || []).filter((item) => !item.completed || item.id === activeSpeakerId);
  const pendingRename = Boolean(onRenameSpeaker) && Boolean(activeItem) && Boolean(typed) &&
    typed !== (activeItem.name || '').trim();
  const pendingAdd = Boolean(onAddSpeaker) && !activeItem && Boolean(typed) && !upNext.some(
    (item) => (item.name || '').trim().toLowerCase() === typed.toLowerCase()
  );

  const commitTypedName = () => {
    if (pendingRename) onRenameSpeaker(activeItem.id, typed);
    else if (pendingAdd) onAddSpeaker(typed);
    else return;
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // A highlighted suggestion is an explicit choice and outranks the typed
      // text, which is only a partial match for it.
      if (showSuggestions && highlightIndex >= 0 && suggestions.length > 0) {
        e.preventDefault();
        handleSelect(suggestions[highlightIndex]);
      } else if (pendingRename || pendingAdd) {
        e.preventDefault();
        commitTypedName();
      }
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const isCustomName = value && value.trim() && !suggestions.some(item =>
    item.name.toLowerCase() === value.trim().toLowerCase()
  );

  // Check if we need section headers (both agenda and participants have items)
  const hasAgenda = filteredAgendaItems.length > 0;
  const hasParticipants = filteredParticipants.length > 0;
  const showHeaders = hasAgenda && hasParticipants;

  return (
    <div className={isStage ? '' : 'space-y-3'}>
      {!isStage && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Timing Role
        </label>
        <div className="relative">
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full pl-3 pr-10 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onEditRules) onEditRules();
          }}
          className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
        >
          Edit timing rules
        </a>
      </div>
      )}

      <div className="relative">
        {!isStage && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Speaker Name
          </label>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={isStage ? 'Speaker name' : 'Type speaker name...'}
          aria-label={isStage ? 'Speaker name' : undefined}
          className={
            isStage
              ? 'w-full rounded-md border border-white/30 bg-black/25 py-1.5 px-2.5 text-lg font-semibold text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-transparent'
              : 'w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          }
        />
        {showSuggestions && (suggestions.length > 0 || isCustomName || pendingRename || participantsRestricted) && (
          <ul
            ref={suggestionsRef}
            className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {hasAgenda && (
              <>
                {showHeaders && (
                  <li className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50">
                    Agenda
                  </li>
                )}
                {filteredAgendaItems.map((item, i) => {
                  const index = i;
                  return (
                    <li
                      key={`agenda-${item.id}`}
                      onMouseDown={() => handleSelect({ ...item, _fromAgenda: true })}
                      onMouseEnter={() => setHighlightIndex(index)}
                      className={`px-3 py-2 cursor-pointer text-sm ${
                        index === highlightIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-500 ml-2 text-xs">{item.role}</span>
                    </li>
                  );
                })}
              </>
            )}
            {hasParticipants && (
              <>
                {showHeaders && (
                  <li className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50">
                    Zoom Participants
                  </li>
                )}
                {filteredParticipants.map((person, i) => {
                  const index = filteredAgendaItems.length + i;
                  return (
                    <li
                      key={person.id}
                      onMouseDown={() => handleSelect({ ...person, _fromAgenda: false })}
                      onMouseEnter={() => setHighlightIndex(index)}
                      className={`px-3 py-2 cursor-pointer text-sm ${
                        index === highlightIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium">{person.name}</span>
                    </li>
                  );
                })}
              </>
            )}
            {/* Says what Enter does before it is pressed, so typing a name is
                not a guess about whether anything was recorded. Clickable too,
                since the row is already under the pointer for anyone reaching
                for the list rather than the keyboard. */}
            {(pendingAdd || pendingRename) ? (
              <li
                onMouseDown={commitTypedName}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-700 border-t border-gray-100 cursor-pointer hover:bg-blue-50"
              >
                <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {pendingAdd ? `Enter to add "${typed}" to the agenda` : `Enter to rename to "${typed}"`}
                </span>
              </li>
            ) : isCustomName && (
              <li className="px-3 py-2 text-sm text-gray-500 border-t border-gray-100">
                New Speaker: "{value.trim()}"
              </li>
            )}
            {/* Only when the list was withheld for a reason the organizer can
                act on, and only at the foot of a list they already opened —
                nothing pops up, nothing blocks typing, and a host never sees it
                at all. Names are still typed by hand meanwhile. */}
            {participantsRestricted && (
              <li className="flex items-start gap-1.5 px-3 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
                <Users className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>Ask to be made host or co-host to pick speakers from the participant list.</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
});
