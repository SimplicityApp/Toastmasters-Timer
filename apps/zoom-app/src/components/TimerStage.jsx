import { memo } from 'react';
import { Play, Square, RotateCcw, X } from 'lucide-react';
import { formatTime, getPhaseInfo, formatPhaseText } from '@toastmaster-timer/shared';
import { getBackgroundUrl } from '../utils/zoomSdk';

// Shown underneath the branded PNG, so the color signal is already correct while
// the image loads and stays correct if it fails to load at all.
const STATUS_COLORS = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

/**
 * Full-panel timer display for the stage modes (share and popout).
 *
 * Unlike card and camera mode, nothing here is pushed through the video
 * pipeline: this *is* what the audience sees, either because the app is being
 * screen-shared or because it has been popped out onto a second monitor. The
 * whole panel is covered on purpose — in share mode every pixel of the app is
 * broadcast, so leaving the agenda or the debug panel visible would put them in
 * front of the meeting. For the same reason the controls live in here rather
 * than underneath: the organizer has to be able to run the timer without
 * exposing anything else.
 */
export default memo(function TimerStage({
  status,
  elapsedTime,
  rules,
  speakerName,
  role,
  isRunning,
  onStart,
  onContinue,
  onStop,
  onReset,
  onFinish,
  onExit,
  exitLabel,
}) {
  const phaseInfo = rules ? getPhaseInfo(elapsedTime, rules, status) : null;
  const phaseText = phaseInfo ? formatPhaseText(phaseInfo) : '';
  const bgColor = STATUS_COLORS[status] || STATUS_COLORS.blue;

  const textShadow = { textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)' };

  // The same branded PNGs card and camera mode push into the video pipeline. The
  // stage renders them as DOM instead, so a club sees one consistent visual
  // whichever mode it settles on. 'contain' keeps the wordmark intact in the tall
  // sidebar, where 'cover' would crop it away.
  const stageBackground = {
    backgroundImage: `url("${getBackgroundUrl(status)}")`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${bgColor} flex flex-col transition-colors duration-300`}
      style={stageBackground}
      data-testid="timer-stage"
    >
      <div className="flex items-start justify-between p-4">
        <div className="min-w-0">
          {speakerName && (
            <div className="text-white text-lg font-semibold truncate" style={textShadow}>
              {speakerName}
            </div>
          )}
          {role && (
            <div className="text-white/80 text-sm truncate" style={textShadow}>
              {role}
            </div>
          )}
        </div>
        <button
          onClick={onExit}
          className="p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors flex-shrink-0"
          data-tooltip={exitLabel}
          data-tooltip-direction="down-left"
          aria-label={exitLabel}
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        <div
          className="text-white font-mono font-bold leading-none text-[clamp(3.5rem,22vw,12rem)]"
          style={textShadow}
        >
          {formatTime(elapsedTime)}
        </div>
        {phaseText && (
          <div className="text-white text-lg sm:text-xl font-medium mt-4 text-center" style={textShadow}>
            {phaseText}
          </div>
        )}
      </div>

      {/* Controls sit on a translucent scrim so they stay legible against yellow. */}
      <div className="p-4 space-y-2 bg-black/10">
        {isRunning ? (
          <div className="flex gap-2">
            <button
              onClick={onStop}
              className="flex-1 bg-white/90 hover:bg-white text-gray-900 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Square className="h-5 w-5" />
              STOP
            </button>
            <button
              onClick={onFinish}
              className="flex-1 bg-black/30 hover:bg-black/40 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              FINISH
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={elapsedTime === 0 ? onStart : onContinue}
              className="flex-1 bg-white/90 hover:bg-white text-gray-900 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="h-5 w-5" />
              {elapsedTime === 0 ? 'START' : 'CONTINUE'}
            </button>
            <button
              onClick={onReset}
              className="bg-black/30 hover:bg-black/40 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
              aria-label="Reset"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            {elapsedTime > 0 && (
              <button
                onClick={onFinish}
                className="flex-1 bg-black/30 hover:bg-black/40 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                FINISH
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
