import { formatTime, getPhaseInfo, formatPhaseText } from '../utils/timerLogic';

export default function TimerDisplay({ elapsedTime, status, rules }) {
  const phaseInfo = rules ? getPhaseInfo(elapsedTime, rules, status) : null;
  const phaseText = phaseInfo ? formatPhaseText(phaseInfo) : '';

  // Background color based on status
  const statusColors = {
    white: 'bg-white',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const bgColor = statusColors[status] || 'bg-white';

  return (
    <div className={`w-full aspect-square rounded-lg ${bgColor} flex flex-col items-center justify-center shadow-lg transition-colors duration-300`}>
      <div className="text-white text-5xl sm:text-6xl font-mono font-bold mb-4 drop-shadow-lg">
        {formatTime(elapsedTime)}
      </div>
      {phaseText && (
        <div className="text-white text-base sm:text-lg font-medium drop-shadow px-2 text-center">
          {phaseText}
        </div>
      )}
    </div>
  );
}
