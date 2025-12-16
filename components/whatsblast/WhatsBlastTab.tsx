import React, { useState, useMemo, useEffect } from 'react';
import { DashboardStats } from './DashboardStats';
import { FilterBar } from './FilterBar';
import { ProspectCard } from './ProspectCard';
import { TemplateEditor } from './TemplateEditor';
import { ToastContainer } from './Toast';
import { Prospect, Notification } from './types';
import { DEFAULT_TEMPLATE } from './constants';

interface KreditProspect {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    zone?: string | string[];
    income?: number;
    [key: string]: any;
}

interface WhatsBlastTabProps {
    prospects: KreditProspect[];
}

export const WhatsBlastTab: React.FC<WhatsBlastTabProps> = ({ prospects: sourceProspects }) => {
    const [activeTab, setActiveTab] = useState<'list' | 'template'>('list');
    const [viewFilter, setViewFilter] = useState<'active' | 'sent'>('active');
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // State for template and sent IDs (persisted in localStorage)
    const [template, setTemplate] = useState<string>(() => {
        return localStorage.getItem('wb_template') || DEFAULT_TEMPLATE;
    });

    const [sentIds, setSentIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('wb_sent_ids');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // Transform Kredit prospects to WhatsBlast format
    const wbProspects = useMemo(() => {
        return sourceProspects.map(p => ({
            id: p.id,
            nombre: p.name.split(' ')[0],
            apellido: p.name.split(' ').slice(1).join(' ') || '',
            telefono: p.phone?.replace(/\D/g, '') || '',
            email: p.email || '',
            empresa: '',
            estado: 'Nuevo',
            // Helpers for template engine
            zone: Array.isArray(p.zone) ? p.zone.join(', ') : (p.zone || ''),
            income: p.income ? `$${p.income}` : ''
        } as Prospect));
    }, [sourceProspects]);

    // Save sentIds when changed
    useEffect(() => {
        localStorage.setItem('wb_sent_ids', JSON.stringify(Array.from(sentIds)));
    }, [sentIds]);

    const addNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, message, type }]);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleSaveTemplate = (content: string) => {
        setTemplate(content);
        localStorage.setItem('wb_template', content);
        addNotification("Mensaje actualizado ✍️");
    };

    const handleSendMessage = (prospect: Prospect) => {
        if (!prospect.telefono) {
            addNotification("Este prospecto no tiene teléfono", "error");
            return;
        }

        let msg = template;
        msg = msg.replace(/{{(.*?)}}/g, (match, p1) => {
            const key = p1.trim();
            // @ts-ignore
            const value = prospect[key];
            return value ? String(value) : match;
        });

        const encodedMsg = encodeURIComponent(msg);
        const url = `https://wa.me/${prospect.telefono}?text=${encodedMsg}`;

        setSentIds(prev => new Set(prev).add(prospect.id));

        // Open WhatsApp
        window.open(url, 'WhatsBlastWindow');
        addNotification(`Abriendo WhatsApp para ${prospect.nombre}...`, "info");
    };

    // Filter Logic
    const filteredProspects = useMemo(() => {
        // 1. Column Filters
        let result = wbProspects;
        if (Object.keys(activeFilters).length > 0) {
            result = result.filter(p => {
                return Object.entries(activeFilters).every(([col, val]) => {
                    if (!val) return true;
                    return String(p[col]) === val;
                });
            });
        }

        // 2. View Filter (Sent vs Pending)
        return result.filter(p => {
            const isSent = sentIds.has(p.id);
            return viewFilter === 'active' ? !isSent : isSent;
        });
    }, [wbProspects, activeFilters, viewFilter, sentIds]);

    // Statistics
    const stats = useMemo(() => {
        const total = wbProspects.length;
        const sessionSentCount = sentIds.size;
        const pending = total - sessionSentCount; // Simple logic: total - sent
        // We don't track "contacted" from DB in this lite version, so we assume sent = contacted
        return {
            total,
            pending,
            sessionSentCount,
            contactedTotal: sessionSentCount
        };
    }, [wbProspects, sentIds]);

    // Columns for FilterBar
    const filterableColumns = ['zone']; // Only zone makes sense to filter for now in Kredit context

    return (
        <div className="min-h-screen bg-white pb-20 font-sans text-secondary-800 animate-fade-in">
            {/* Note: Header is handled by Dashboard.tsx, we just render the content */}

            <div className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-12">
                    <h1 className="text-4xl font-black text-secondary-900 tracking-tight mb-2">Campañas 🚀</h1>
                    <p className="text-lg text-secondary-500 font-medium max-w-2xl">
                        Conecta con tu base de datos usando el poder de WhatsApp.
                    </p>
                </div>

                <DashboardStats
                    total={stats.total}
                    pending={stats.pending}
                    sentSession={stats.sessionSentCount}
                    contactedTotal={stats.contactedTotal}
                />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 mt-12">
                    <div className="bg-secondary-50 p-1.5 rounded-2xl flex w-full md:w-auto shadow-inner border border-secondary-100">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'list'
                                    ? 'bg-white text-primary-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-secondary-500 hover:text-secondary-700'
                                }`}
                        >
                            <span>📋</span> Lista de Contactos
                        </button>
                        <button
                            onClick={() => setActiveTab('template')}
                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'template'
                                    ? 'bg-white text-primary-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-secondary-500 hover:text-secondary-700'
                                }`}
                        >
                            <span>💬</span> Personalizar Mensaje
                        </button>
                    </div>
                </div>

                {activeTab === 'list' && (
                    <>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-secondary-100 shadow-sm">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setViewFilter('active')}
                                    className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewFilter === 'active'
                                            ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100'
                                            : 'text-secondary-400 hover:bg-secondary-50'
                                        }`}
                                >
                                    Pendientes
                                </button>
                                <button
                                    onClick={() => setViewFilter('sent')}
                                    className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewFilter === 'sent'
                                            ? 'bg-secondary-50 text-secondary-700 ring-1 ring-secondary-200'
                                            : 'text-secondary-400 hover:bg-secondary-50'
                                        }`}
                                >
                                    Historial
                                </button>
                            </div>

                            <span className="text-xs font-bold text-secondary-400 bg-secondary-50 px-3 py-1.5 rounded-lg border border-secondary-100">
                                {filteredProspects.length} registros visibles
                            </span>
                        </div>

                        <FilterBar
                            columns={filterableColumns}
                            prospects={wbProspects}
                            activeFilters={activeFilters}
                            onFilterChange={(col, val) => setActiveFilters(prev => ({ ...prev, [col]: val }))}
                            onClearFilters={() => setActiveFilters({})}
                        />

                        {filteredProspects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-secondary-200">
                                <div className="w-16 h-16 bg-secondary-50 rounded-full flex items-center justify-center text-3xl mb-4 text-secondary-300">
                                    {viewFilter === 'active' ? '🎉' : '📭'}
                                </div>
                                <p className="font-black text-xl text-secondary-600">
                                    {viewFilter === 'active' ? '¡Todo limpio!' : 'Nada por aquí aún'}
                                </p>
                                <p className="text-sm text-secondary-400 mt-2 font-medium max-w-xs text-center">
                                    {viewFilter === 'active'
                                        ? 'Has gestionado todos los prospectos pendientes bajo estos filtros.'
                                        : 'Tu historial de mensajes enviados aparecerá aquí.'}
                                </p>
                                {Object.keys(activeFilters).length > 0 && (
                                    <button onClick={() => setActiveFilters({})} className="mt-6 text-primary-600 text-sm font-bold hover:underline">
                                        Limpiar filtros activos
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProspects.map(p => (
                                    <ProspectCard
                                        key={p.id}
                                        prospect={p}
                                        onSend={handleSendMessage}
                                        isSentInSession={sentIds.has(p.id)}
                                        visibleColumns={['zone', 'income']}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'template' && (
                    <div className="max-w-5xl mx-auto pt-4">
                        <TemplateEditor
                            initialTemplate={template}
                            onSave={handleSaveTemplate}
                            variables={['nombre', 'apellido', 'zone', 'income', 'email']}
                            sampleProspect={wbProspects[0]}
                        />
                    </div>
                )}

                <ToastContainer notifications={notifications} removeNotification={removeNotification} />
            </div>
        </div>
    );
};
