import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const TOAST_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500',
    textColor: 'text-white',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-500',
    textColor: 'text-white',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
  },
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const Icon = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className="animate-slide-in-right mb-2">
      <div className={`${config.bgColor} ${config.textColor} rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[300px] max-w-md`}>
        <Icon className="h-5 w-5 flex-shrink-0" />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
