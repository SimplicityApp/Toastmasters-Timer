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
  
  // Text color and shadow based on status
  // For white background, use dark text with strong shadow
  // For colored backgrounds, use white text with shadow
  const isWhiteBackground = status === 'white';
  const textColor = isWhiteBackground ? 'text-gray-900' : 'text-white';
  
  // Enhanced shadow styles for better contrast
  const timerTextStyle = isWhiteBackground
    ? {
        textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.15), 0 0 20px rgba(255,255,255,0.8)',
      }
    : {
        textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
      };
  
  const phaseTextStyle = isWhiteBackground
    ? {
        textShadow: '0 1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
      }
    : {
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
