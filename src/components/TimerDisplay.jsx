import { formatTime, getPhaseInfo, formatPhaseText } from '../utils/timerLogic';

export default function TimerDisplay({ elapsedTime, status, rules }) {
  const phaseInfo = rules ? getPhaseInfo(elapsedTime, rules, status) : null;
  const phaseText = phaseInfo ? formatPhaseText(phaseInfo) : '';

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

  return (
    <div className={`w-full aspect-square rounded-lg ${bgColor} flex flex-col items-center justify-center shadow-lg transition-colors duration-300`}>
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
    </div>
  );
}
