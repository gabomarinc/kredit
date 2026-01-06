import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    isDanger = false
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] relative z-10 animate-fade-in-up border border-white/20">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full"
                >
                    <X size={20} />
                </button>

                <div className="flex items-start gap-5">
                    <div className={`shrink-0 p-3 rounded-2xl ${isDanger ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        <AlertTriangle size={28} />
                    </div>

                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 font-display">
                            {title}
                        </h3>
                        <p className="text-gray-500 leading-relaxed mb-8 text-sm">
                            {message}
                        </p>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-5 py-3 rounded-xl font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100 placeholder:text-sm"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`flex-1 px-5 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${isDanger
                                        ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                    }`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
