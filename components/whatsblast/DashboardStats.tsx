import React from 'react';

interface DashboardStatsProps {
    total: number;
    pending: number;
    sentSession: number;
    contactedTotal: number;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
    total,
    pending,
    sentSession,
    contactedTotal
}) => {

    const progress = total > 0 ? Math.round((contactedTotal / total) * 100) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">

            {/* Card 1: Total & Progress */}
            <div className="bg-white p-8 rounded-3xl border border-secondary-100 shadow-xl shadow-secondary-100/30 flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-black text-secondary-400 uppercase tracking-widest mb-1">Base Total</p>
                        <h3 className="text-4xl font-black text-secondary-800 tracking-tight">{total}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-secondary-50 flex items-center justify-center text-2xl text-secondary-400">
                        📂
                    </div>
                </div>

                <div className="mt-8">
                    <div className="flex justify-between text-xs mb-2 text-secondary-500 font-bold">
                        <span>Progreso de campaña</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-secondary-100 rounded-full h-3 overflow-hidden p-0.5">
                        <div
                            className="bg-primary-500 h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Card 2: Pending Action */}
            <div className="bg-white p-8 rounded-3xl border border-secondary-100 shadow-xl shadow-secondary-100/30 flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-black text-secondary-400 uppercase tracking-widest mb-1">Por Contactar</p>
                        <h3 className="text-4xl font-black text-secondary-800 tracking-tight">{pending}</h3>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-colors ${pending > 0 ? 'bg-orange-50 text-orange-500' : 'bg-primary-50 text-primary-500'}`}>
                        {pending > 0 ? '⏳' : '✨'}
                    </div>
                </div>

                <div className="mt-8">
                    {pending === 0 && total > 0 ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-black">
                            <span>Misión cumplida</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                    ) : (
                        <p className="text-xs text-secondary-400 font-medium">
                            Personas esperando saber de ti.
                        </p>
                    )}
                </div>
            </div>

            {/* Card 3: Session Impact */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-8 rounded-3xl shadow-xl shadow-primary-200 flex flex-col justify-between text-white relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">

                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary-900/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-primary-100 uppercase tracking-widest mb-1">Impacto Hoy</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-4xl font-black tracking-tight">{sentSession}</h3>
                                <span className="text-sm font-bold text-primary-200">mensajes</span>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                            🚀
                        </div>
                    </div>
                </div>

                <div className="mt-8 relative z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg w-fit backdrop-blur-md border border-white/10">
                        <div className={`w-2 h-2 rounded-full ${sentSession > 0 ? 'bg-white animate-pulse' : 'bg-primary-300'}`}></div>
                        <p className="text-xs font-bold text-primary-50">
                            {sentSession > 0 ? 'Flujo activo' : 'Listo para iniciar'}
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};
