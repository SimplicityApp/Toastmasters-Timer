import { useTimer } from '../context/TimerContext';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

function ColorDot({ color }) {
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    white: 'bg-gray-300',
  };

  return (
    <div className={`w-4 h-4 rounded-full ${colorClasses[color] || 'bg-gray-300'} inline-block mr-2`} />
  );
}

export default function ReportTab() {
  const { reports } = useTimer();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (reports.length === 0) {
      alert('No reports to copy');
      return;
    }

    // Format as tab-separated values
    const header = 'Name\tRole\tDuration\tStatus\tComments\n';
    const rows = reports.map(r => 
      `${r.name}\t${r.role}\t${r.duration}\t${r.color}\t${r.comments || ''}`
    ).join('\n');
    const text = header + rows;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No reports yet. Complete speeches in the LIVE tab to generate reports.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 text-xs">
                      Name
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 text-xs">
                      Role
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 text-xs">
                      Time
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 text-xs">
                      Status
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 text-xs">
                      Comments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-2 text-gray-900 text-xs">
                        {report.name}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-gray-700 text-xs">
                        {report.role}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-gray-700 font-mono text-xs">
                        {report.duration}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-gray-700">
                        <div className="flex items-center">
                          <ColorDot color={report.color} />
                          <span className="capitalize text-xs">{report.color}</span>
                        </div>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-gray-700 text-xs">
                        {report.comments || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={copyToClipboard}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Copy Report to Clipboard
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
