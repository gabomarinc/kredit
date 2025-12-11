import React from 'react';
import { CheckCircle2, X, AlertCircle, Info, XCircle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number; // Auto-close after milliseconds (0 = no auto-close)
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  duration = 3000
}) => {
  // Auto-close after duration
  React.useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const config = {
    success: {
      icon: CheckCircle2,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      defaultTitle: '¡Éxito!'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      buttonColor: 'bg-red-600 hover:bg-red-700',
      defaultTitle: 'Error'
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
      defaultTitle: 'Advertencia'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      defaultTitle: 'Información'
    }
  };

  const style = config[type];
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity pointer-events-auto"
        onClick={onClose}
      ></div>
      <div className={`${style.bgColor} ${style.borderColor} border-2 rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative z-10 pointer-events-auto animate-fade-in-up`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className={`${style.iconColor} shrink-0`}>
            <Icon size={32} className="mt-1" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className={`${style.titleColor} font-bold text-lg mb-2`}>
              {title || style.defaultTitle}
            </h3>
            <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
              {message}
            </p>
            
            <button
              onClick={onClose}
              className={`${style.buttonColor} text-white px-6 py-2.5 rounded-xl font-semibold text-sm mt-4 transition-colors shadow-lg`}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


