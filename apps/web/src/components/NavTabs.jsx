export default function NavTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'live', label: 'LIVE' },
    { id: 'agenda', label: 'AGENDA' },
    { id: 'report', label: 'REPORT' },
  ];

  return (
    <div className="w-full border-b border-gray-200">
      <nav className="flex" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-colors duration-150 ${
              activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
