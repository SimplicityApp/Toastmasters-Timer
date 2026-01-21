import { useState, useEffect } from 'react';
import { Combobox } from '@headlessui/react';
import { getZoomParticipants } from '../utils/zoomSdk';
import { Check, ChevronDown } from 'lucide-react';

export default function SpeakerInput({ value, onChange, onRoleChange, selectedRole, roleOptions, onEditRules }) {
  const [query, setQuery] = useState('');
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    // Load Zoom participants
    getZoomParticipants().then(setParticipants);
  }, []);

  // Filter participants based on query
  const filteredParticipants = query === ''
    ? participants
    : participants.filter((person) =>
        person.name.toLowerCase().includes(query.toLowerCase())
      );

  // Check if query matches a custom name (not in participants list)
  const isCustomName = query && !participants.some(p => 
    p.name.toLowerCase() === query.toLowerCase()
  );

  const handleSelect = (person) => {
    if (person && person.name) {
      onChange(person.name);
      setQuery('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      // Create custom entry
      onChange(query.trim());
      setQuery('');
    }
  };

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
            if (onEditRules) {
              onEditRules();
            }
          }}
          className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
        >
          Edit timing rules
        </a>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Speaker Name
        </label>
        <Combobox value={value} onChange={handleSelect}>
          <div className="relative">
            <Combobox.Input
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              displayValue={(name) => name || query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Select participant or type name..."
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </Combobox.Button>

            {query.length > 0 && (
              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {filteredParticipants.length === 0 && !isCustomName ? (
                  <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                    No participants found.
                  </div>
                ) : (
                  <>
                    {filteredParticipants.map((person) => (
                      <Combobox.Option
                        key={person.id}
                        value={person}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-blue-600 text-white' : 'text-gray-900'
                          }`
                        }
                      >
                        {({ selected, active }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? 'font-medium' : 'font-normal'
                              }`}
                            >
                              {person.name}
                            </span>
                            {selected ? (
                              <span
                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active ? 'text-white' : 'text-blue-600'
                                }`}
                              >
                                <Check className="h-5 w-5" aria-hidden="true" />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Combobox.Option>
                    ))}
                    {isCustomName && (
                      <Combobox.Option
                        value={{ id: 'custom', name: query }}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-blue-600 text-white' : 'text-gray-900'
                          }`
                        }
                      >
                        {({ active }) => (
                          <span className="block truncate font-normal">
                            Create "{query}" (Press Enter)
                          </span>
                        )}
                      </Combobox.Option>
                    )}
                  </>
                )}
              </Combobox.Options>
            )}
          </div>
        </Combobox>
      </div>
    </div>
  );
}
