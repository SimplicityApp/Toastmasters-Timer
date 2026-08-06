import { memo, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import { formatTime, getPhaseInfo, formatPhaseText } from '@toastmaster-timer/shared';

export default memo(function TimerDisplay({ elapsedTime, status, rules, readoutPosition, onReadoutPositionChange }) {
  const phaseInfo = rules ? getPhaseInfo(elapsedTime, rules, status) : null;
  const phaseText = phaseInfo ? formatPhaseText(phaseInfo) : '';

  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Background color based on status
  const statusColors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const bgColor = statusColors[status] || 'bg-blue-500';

  // Text color and shadow based on status
  // All colored backgrounds use white text with shadow
  const textColor = 'text-white';

  // Enhanced shadow styles for better contrast
  const timerTextStyle = {
    textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
  };

  const phaseTextStyle = {
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  };

  // This box stands in for the organizer's video tile: dragging the badge
  // within it places the count-up on the pushed background by the same
  // fraction of the frame. Normalized coordinates make the square preview and
  // the 16:9 frame agree about what "top left" means.
  const positionFromEvent = (event) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    onReadoutPositionChange?.(positionFromEvent(event), { commit: false });
  };

  // Pushing the repositioned frame to Zoom costs a multi-MB bridge transfer,
  // so it happens once, on release — the badge itself follows every move.
  const handlePointerEnd = (event) => {
    if (!dragging) return;
    setDragging(false);
    onReadoutPositionChange?.(positionFromEvent(event), { commit: true });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-square rounded-lg ${bgColor} flex flex-col items-center justify-center shadow-lg transition-colors duration-300`}
    >
      <div
        className={`${textColor} text-5xl sm:text-6xl font-mono font-bold mb-4`}
        style={timerTextStyle}
      >
        {formatTime(elapsedTime)}
      </div>
      {phaseText && (
        <div
          className={`${textColor} text-base sm:text-lg font-medium px-2 text-center`}
          style={phaseTextStyle}
        >
          {phaseText}
        </div>
      )}

      {/* Where the count-up sits on the video other participants see. Only the
          video modes show it: the full-screen timer pushes no frame to drag
          anything on. */}
      {readoutPosition && (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={`flex items-center gap-1 px-2 py-1 rounded-md bg-black/35 border border-white/50 text-white text-sm font-mono font-semibold touch-none select-none ${
            dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'
          }`}
          style={{
            // Inline because the [data-tooltip] rule in index.css sets
            // position: relative and outranks the Tailwind utility.
            position: 'absolute',
            left: `${readoutPosition.x * 100}%`,
            top: `${readoutPosition.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
          aria-label="Drag to place the count-up participants see on your video"
          data-tooltip="Participants see the count-up here — drag to move it"
        >
          <Move className="h-3 w-3 opacity-80 flex-shrink-0" />
          {formatTime(elapsedTime)}
        </button>
      )}
    </div>
  );
});
