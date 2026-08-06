import { memo, useRef, useState } from 'react';
import { Move, Plus, Minus, Eye, EyeOff } from 'lucide-react';
import { formatTime, getPhaseInfo, formatPhaseTextFor, getDisplaySeconds } from '@toastmaster-timer/shared';

export default memo(function TimerDisplay({
  elapsedTime,
  status,
  rules,
  readoutPosition,
  onReadoutPositionChange,
  readoutVisible,
  onToggleReadoutVisible,
  onAdjustReadoutScale,
}) {
  const phaseInfo = rules ? getPhaseInfo(elapsedTime, rules, status) : null;
  const phaseText = phaseInfo ? formatPhaseTextFor(phaseInfo, rules) : '';
  // Counts up for a speech, down for a break — everywhere this card shows a
  // clock, including the drag badge, which mirrors the pushed readout.
  const displayTime = formatTime(getDisplaySeconds(elapsedTime, rules));

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
        {displayTime}
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
          anything on.

          No data-tooltip anywhere in this cluster, deliberately: the tooltip
          pseudo-element repaints above the chip while it moves under pointer
          capture, which smeared black trails across the preview. */}
      {readoutPosition && (
        <div
          // The anchor is the chip alone, so its center — not the center of
          // chip plus buttons — is what the stored position means. The chip is
          // the marker for where the readout lands on the pushed frame; the
          // buttons hang off its side out of flow, shifting nothing.
          style={{
            position: 'absolute',
            left: `${readoutPosition.x * 100}%`,
            top: `${readoutPosition.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className={`flex items-center gap-1 px-2 py-1 rounded-md bg-black/35 border border-white/50 text-white text-sm font-mono font-semibold touch-none select-none ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${readoutVisible ? '' : 'opacity-50'}`}
            aria-label="Drag to place the count-up participants see on your video"
          >
            <Move className="h-3 w-3 opacity-80 flex-shrink-0" />
            {displayTime}
          </button>
          {/* Hidden while dragging: the chip is the only thing that should
              follow the pointer, and stray buttons under it catch the drop.
              Size controls sit to the chip's left and visibility to its right
              — unless the chip is near the left edge (where it starts, under
              the logo), in which case everything moves right rather than
              overflowing the card. Always out of flow, so nothing shifts the
              chip off its anchor. */}
          {!dragging && (() => {
            const nearLeftEdge = readoutPosition.x < 0.35;
            const sizeButtons = readoutVisible && (
              <>
                <button
                  type="button"
                  onClick={() => onAdjustReadoutScale?.(-1)}
                  className="flex items-center justify-center h-6 w-6 rounded bg-black/35 border border-white/50 text-white hover:bg-black/50"
                  aria-label="Make the count-up smaller"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onAdjustReadoutScale?.(1)}
                  className="flex items-center justify-center h-6 w-6 rounded bg-black/35 border border-white/50 text-white hover:bg-black/50"
                  aria-label="Make the count-up larger"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </>
            );
            const eyeButton = (
              <button
                type="button"
                onClick={() => onToggleReadoutVisible?.()}
                className="flex items-center justify-center h-6 w-6 rounded bg-black/35 border border-white/50 text-white hover:bg-black/50"
                aria-label={readoutVisible ? 'Hide the count-up from your video' : 'Show the count-up on your video'}
              >
                {readoutVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            );
            return nearLeftEdge ? (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 flex items-center gap-0.5">
                {sizeButtons}
                {eyeButton}
              </div>
            ) : (
              <>
                {readoutVisible && (
                  <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1 flex items-center gap-0.5">
                    {sizeButtons}
                  </div>
                )}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 flex items-center">
                  {eyeButton}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
});
