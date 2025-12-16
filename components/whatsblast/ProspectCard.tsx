import React from 'react';
import { Prospect } from './types';
import { Button } from './Button';

interface ProspectCardProps {
    prospect: Prospect;
    onSend: (prospect: Prospect) => void;
    isSentInSession?: boolean;
    visibleColumns?: string[]; // New prop for dynamic columns
}

export const ProspectCard: React.FC<ProspectCardProps> = ({
    prospect,
    onSend,
    isSentInSession = false,
    visibleColumns = []
}) => {

    // Determine status color based on standard keywords or user data
    const status = (prospect.estado || prospect['Estado'] || prospect['status'] || 'nuevo').toLowerCase();

    let statusColor = 'bg-secondary-50 text-secondary-500';

    if (isSentInSession) {
        statusColor = 'bg-primary-50 text-primary-600';
    } else if (status.includes('contactado')) {
        statusColor = 'bg-blue-50 text-blue-600';
    } else if (status.includes('pendiente')) {
        statusColor = 'bg-orange-50 text-orange-600';
    } else if (status.includes('éxito') || status.includes('cliente') || status.includes('ganado')) {
        statusColor = 'bg-primary-50 text-primary-600';
    } else if (status.includes('perdido') || status.includes('no')) {
        statusColor = 'bg-red-50 text-red-500';
    }

    const isDone = isSentInSession || status.includes('contactado') || status.includes('éxito');

    return (
        <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-all duration-300 flex flex-col justify-between group h-full ${isDone ? 'border-primary-100 opacity-80' : 'border-secondary-100 hover:shadow-lg hover:shadow-secondary-100/50 hover:border-primary-200'}`}>
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl transition-colors shrink-0 ${isDone ? 'bg-primary-50 text-primary-600' : 'bg-gradient-to-tr from-primary-100 to-primary-50 text-primary-600'}`}>
                        {isDone ? '✓' : prospect.nombre.charAt(0)}
                    </div>

                    {/* Default Status Badge */}
                    <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full transition-colors max-w-[50%] truncate ${statusColor}`}>
                        {isSentInSession ? 'Enviado' : status}
                    </span>
                </div>

                <h3 className={`font-black text-xl transition-colors mb-1 tracking-tight ${isDone ? 'text-secondary-400 line-through decoration-secondary-200' : 'text-secondary-800'}`}>
                    {prospect.nombre} {prospect.apellido || ''}
                </h3>

                <p className="text-xs text-secondary-500 font-mono tracking-wide mb-4 font-bold">
                    {prospect.telefono}
                </p>

                {/* Dynamic Extra Columns */}
                {visibleColumns.length > 0 && (
                    <div className="space-y-3 mt-4 pt-4 border-t border-secondary-50">
                        {visibleColumns.map(col => {
                            const val = prospect[col];
                            if (!val) return null;

                            return (
                                <div key={col} className="flex flex-col">
                                    <span className="text-[9px] text-secondary-400 font-black uppercase tracking-widest">{col}</span>
                                    <span className="text-sm text-secondary-700 font-medium">{val}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-secondary-50">
                <Button
                    variant={isDone ? "ghost" : "outline"}
                    onClick={() => onSend(prospect)}
                    className={`w-full !py-2.5 !text-xs !font-bold transition-all ${isDone ? 'bg-secondary-50 text-secondary-400 hover:bg-secondary-100 cursor-default' : 'group-hover:bg-primary-500 group-hover:text-white group-hover:border-transparent group-hover:shadow-lg group-hover:shadow-primary-200'}`}
                >
                    <span className="flex items-center gap-2">
                        {isDone ? (
                            <>
                                <span>Reenviar Mensaje</span>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            </>
                        ) : (
                            <>
                                <span>Enviar Mensaje</span>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </>
                        )}
                    </span>
                </Button>
            </div>
        </div>
    );
};
