import { X } from 'lucide-react';
import OwnBackgroundPicker from './OwnBackgroundPicker';

/**
 * The mode menu's way into the own-background setting. The same picker also
 * sits inside the Card Images modal; this wrapper exists so the setting can be
 * reached from beside the "Show my own background" toggle it serves, without
 * making the organizer go looking through the card artwork to find it.
 */
export default function OwnBackgroundModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-semibold">My Background</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Where your video lands when a speech ends, and whenever you clear the timer.
        </p>

        <OwnBackgroundPicker />

        <p className="text-xs text-gray-500 mt-4">
          Stored only in this browser. Please upload only images you have the right to use.
        </p>
      </div>
    </div>
  );
}
