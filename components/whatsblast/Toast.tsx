import React, { useEffect } from 'react';
import { Notification } from './types';

interface ToastContainerProps {
    notifications: Notification[];
    removeNotification: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, removeNotification }) => {
    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
            {notifications.map((n) => (
                <Toast key={n.id} notification={n} onDismiss={() => removeNotification(n.id)} />
            ))}
        </div>
    );
};

const Toast: React.FC<{ notification: Notification; onDismiss: () => void }> = ({ notification, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const bgColors = {
        success: 'bg-white border-l-4 border-success-500 text-calm-800',
        info: 'bg-white border-l-4 border-primary-500 text-calm-800',
        error: 'bg-white border-l-4 border-red-500 text-calm-800',
    };

    return (
        <div className={`pointer-events-auto shadow-xl rounded-lg p-4 flex items-center gap-3 min-w-[300px] animate-slide-up ${bgColors[notification.type]}`}>
            <span className="text-xl">
                {notification.type === 'success' && '✨'}
                {notification.type === 'info' && '💡'}
                {notification.type === 'error' && '🔧'}
            </span>
            <p className="font-medium text-sm">{notification.message}</p>
        </div>
    );
};
