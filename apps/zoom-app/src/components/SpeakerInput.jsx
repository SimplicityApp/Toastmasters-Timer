import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { getZoomParticipants } from '../utils/zoomSdk';
import { ChevronDown } from 'lucide-react';

export default memo(function SpeakerInput({ value, onChange, onRoleChange, selectedRole, roleOptions, onEditRules, agendaItems, onSelectSuggestion }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [participants, setParticipants] = useState([]);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    getZoomParticipants().then(setParticipants);
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

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
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
    <div className="space-y-3">
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

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Speaker Name
        </label>
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
          placeholder="Type speaker name..."
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {showSuggestions && (suggestions.length > 0 || isCustomName) && (
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
            {isCustomName && (
              <li className="px-3 py-2 text-sm text-gray-500 border-t border-gray-100">
                New Speaker: "{value.trim()}"
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
});
