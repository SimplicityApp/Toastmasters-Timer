import { ChevronDown } from 'lucide-react';

export default function SpeakerInput({ value, onChange, onRoleChange, selectedRole, roleOptions, onEditRules }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Timing Role</label>
        <div className="relative">
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full pl-3 pr-10 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Speaker Name</label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type speaker name..."
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  )
}
