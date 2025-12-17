import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { DashboardStats } from './DashboardStats';
import { FilterBar } from './FilterBar';
import { ProspectCard } from './ProspectCard';
import { TemplateEditor } from './TemplateEditor';
import { ToastContainer } from './Toast';
import { Prospect, Notification } from './types';
import { DEFAULT_TEMPLATE } from './constants';
import {
    saveWhatsBlastCampaign,
    getWhatsBlastCampaigns,
    getCampaignProspects,
    updateWhatsBlastProspectStatus,
    WhatsBlastCampaign
} from '../../utils/db';
import { Loader2, Database, FileSpreadsheet, History, ChevronDown, Check } from 'lucide-react';

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

    // State for template and sent IDs (persisted locally for Kredit, DB for Campaigns)
    const [template, setTemplate] = useState<string>(() => {
        return localStorage.getItem('wb_template') || DEFAULT_TEMPLATE;
    });

    const [sentIds, setSentIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('wb_sent_ids');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // State for Data Source & Campaigns
    const [companyId] = useState(() => localStorage.getItem('companyId'));
    const [campaigns, setCampaigns] = useState<WhatsBlastCampaign[]>([]);
    const [activeSource, setActiveSource] = useState<string>('kredit'); // 'kredit' or campaign UUID
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [displayedProspects, setDisplayedProspects] = useState<Prospect[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Load Campaigns on Mount
    useEffect(() => {
        if (companyId) {
            loadCampaigns();
        }
    }, [companyId]);

    const loadCampaigns = async () => {
        if (!companyId) return;
        const data = await getWhatsBlastCampaigns(companyId);
        setCampaigns(data);
    };

    // Transform Kredit prospects to WhatsBlast format (Memoized)
    const dbProspects = useMemo(() => {
        return sourceProspects.map(p => ({
            id: p.id,
            nombre: p.name.split(' ')[0],
            apellido: p.name.split(' ').slice(1).join(' ') || '',
            "Nombre Completo": p.name,
            "Teléfono": p.phone?.replace(/\D/g, '') || '',
            email: p.email || '',
            telefono: p.phone?.replace(/\D/g, '') || '',
            empresa: '',
            estado: 'Nuevo',
            zone: Array.isArray(p.zone) ? p.zone.join(', ') : (p.zone || ''),
            income: p.income ? `$${p.income}` : ''
        } as Prospect));
    }, [sourceProspects]);

    // Handle Source Change (Load Data)
    useEffect(() => {
        const loadSourceData = async () => {
            setIsLoadingData(true);
            try {
                if (activeSource === 'kredit') {
                    setDisplayedProspects(dbProspects);
                    // Sent IDs for Kredit are local only for now (session based)
                    // or we could persist if we add a table, but user kept it simple for Kredit base.
                } else {
                    // Load Campaign from DB
                    const campaignData = await getCampaignProspects(activeSource);

                    // Map DB data to Prospect interface
                    const mapped = campaignData.map((row: any) => ({
                        ...row, // properties from 'data' column merged
                        id: row.id, // Use DB UUID
                        dbStatus: row.dbStatus, // 'pending', 'sent'
                        // Ensure required fields
                        nombre: row.name || row.nombre || 'Prospecto',
                        telefono: row.phone || row.telefono || '',
                        "Nombre Completo": row.name || row["Nombre Completo"] || '',
                        "Teléfono": row.phone || row["Teléfono"] || ''
                    }));

                    setDisplayedProspects(mapped);

                    // Sync Sent IDs from DB status
                    const sentInDb = new Set<string>();
                    mapped.forEach((p: any) => {
                        if (p.dbStatus === 'sent') sentInDb.add(p.id);
                    });
                    setSentIds(sentInDb);
                }
            } catch (e) {
                console.error("Error loading source data", e);
                addNotification("Error al cargar datos de la campaña", "error");
            } finally {
                setIsLoadingData(false);
            }
        };

        loadSourceData();
    }, [activeSource, dbProspects]); // If dbProspects updates, and we are on 'kredit', update.

    // Active Prospects for Filters
    const activeProspects = displayedProspects;

    // Only persist sentIds locally if using Kredit Base (Campaigns use DB)
    useEffect(() => {
        if (activeSource === 'kredit') {
            localStorage.setItem('wb_sent_ids', JSON.stringify(Array.from(sentIds)));
        }
    }, [sentIds, activeSource]);

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

        // Update DB Status if in Campaign Mode
        if (activeSource !== 'kredit') {
            updateWhatsBlastProspectStatus(prospect.id, 'sent').catch(err => {
                console.error("Failed to update status in DB", err);
            });
        }

        // Open WhatsApp
        window.open(url, 'WhatsBlastWindow');
        addNotification(`Abriendo WhatsApp para ${prospect.nombre}...`, "info");
    };

    // Helper: Find best matching column key
    const findColumnMatch = (keys: string[], candidates: string[]): string | undefined => {
        const normalizedKeys = keys.map(k => ({ key: k, norm: k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }));

        for (const candidate of candidates) {
            const match = normalizedKeys.find(nk => nk.norm === candidate || nk.norm.includes(candidate));
            if (match) return match.key;
        }
        return undefined;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyId) {
            if (!companyId) addNotification("Error de sesión: No se detectó companyId", "error");
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[] = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    addNotification("El archivo parece estar vacío", "error");
                    return;
                }

                // Smart Mapping
                const headers = Object.keys(data[0]);

                // 1. Detect Names
                const nameKey = findColumnMatch(headers, ['nombre', 'name', 'nombres', 'cliente', 'prospecto', 'contacto', 'full']);
                // 2. Detect Phones
                const phoneKey = findColumnMatch(headers, ['telefono', 'phone', 'celular', 'tel', 'cel', 'movil', 'mobile', 'whatsapp', 'numero']);
                // 3. Detect Company
                const companyKey = findColumnMatch(headers, ['empresa', 'company', 'organizacion']);
                // 4. Detect Email
                const emailKey = findColumnMatch(headers, ['email', 'correo', 'mail']);

                console.log('📊 Column Mapping Detected:', { nameKey, phoneKey, companyKey, emailKey });

                if (!nameKey && !phoneKey) {
                    addNotification("⚠️ No pudimos detectar columnas de Nombre o Teléfono automáticamente.", "info");
                }

                const mapped = data.map((row: any, idx) => {
                    // Fallback: If no name key, try to take the first string column that looks like a name
                    const nameVal = nameKey ? row[nameKey] : (row['Nombre'] || row['Name'] || Object.values(row).find(v => typeof v === 'string' && (v as string).length > 2) || 'Sin Nombre');

                    const nombre = String(nameVal).split(' ')[0];
                    const apellido = String(nameVal).split(' ').slice(1).join(' ');
                    const phoneVal = phoneKey ? String(row[phoneKey]).replace(/\D/g, '') : '';

                    return {
                        nombre: nombre,
                        apellido: apellido,
                        "Nombre Completo": String(nameVal), // Title Case Key
                        "Teléfono": phoneVal,
                        telefono: phoneVal, // internal key for sending
                        email: emailKey ? row[emailKey] : '',
                        empresa: companyKey ? row[companyKey] : '',
                        estado: 'Nuevo',
                        ...row // Keep all original data
                    } as any;
                });

                // --- SAVE TO DB ---
                const campaignName = `Campaña ${file.name.split('.')[0]} - ${new Date().toLocaleDateString('es-PA')}`;
                addNotification("Guardando campaña en la base de datos...", "info");

                const newCampaignId = await saveWhatsBlastCampaign(companyId, campaignName, mapped);

                if (newCampaignId) {
                    await loadCampaigns(); // Refresh list
                    setActiveSource(newCampaignId); // Switch to new campaign
                    addNotification("✅ Campaña creada y cargada exitosamente");
                } else {
                    addNotification("Error al guardar la campaña en BD", "error");
                }

            } catch (err) {
                console.error(err);
                addNotification("Error al leer el archivo Excel", "error");
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    // Filter Logic
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProspects = useMemo(() => {
        let result = activeProspects;

        // 1. Search Filter (Global)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                (p.nombre?.toLowerCase() || '').includes(term) ||
                (typeof p["Nombre Completo"] === 'string' && p["Nombre Completo"].toLowerCase().includes(term)) ||
                (p.email?.toLowerCase() || '').includes(term) ||
                (p.telefono?.toLowerCase() || '').includes(term) ||
                (typeof p["Teléfono"] === 'string' && p["Teléfono"].includes(term))
            );
        }

        // 2. Column Filters
        if (Object.keys(activeFilters).length > 0) {
            result = result.filter(p => {
                return Object.entries(activeFilters).every(([col, val]) => {
                    if (!val) return true;
                    return String(p[col]) === val;
                });
            });
        }

        // 3. View Filter (Sent vs Pending)
        return result.filter(p => {
            const isSent = sentIds.has(p.id);
            return viewFilter === 'active' ? !isSent : isSent;
        });
    }, [activeProspects, activeFilters, viewFilter, sentIds, searchTerm]);

    // Statistics
    const stats = useMemo(() => {
        const total = activeProspects.length;
        const sessionSentCount = sentIds.size;
        const pending = total - sessionSentCount; // Simple logic: total - sent
        // We don't track "contacted" from DB in this lite version, so we assume sent = contacted
        return {
            total,
            pending,
            sessionSentCount,
            contactedTotal: sessionSentCount
        };
    }, [activeProspects, sentIds]);

    // Columns for FilterBar - dynamic based on source but simplified
    const filterableColumns = useMemo(() => {
        // User requested ONLY these specific columns with Title Case
        return ['Nombre Completo', 'Teléfono'];
    }, []);

    // Template variables - combine base variables with filterable columns
    const templateVariables = useMemo(() => {
        return ['nombre', 'apellido', 'empresa', 'telefono', ...filterableColumns];
    }, [filterableColumns]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilters, viewFilter, activeSource]);

    const paginatedProspects = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProspects.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredProspects, currentPage]);

    const totalPages = Math.ceil(filteredProspects.length / ITEMS_PER_PAGE);

    return (
        <div className="min-h-screen bg-white pb-20 font-sans text-secondary-800 animate-fade-in rounded-[3rem] shadow-2xl shadow-indigo-100/50 border border-white/50">
            {/* Note: Header is handled by Dashboard.tsx, we just render the content */}

            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* ... (Header & Stats & Tabs - kept same) ... */}
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
                    {/* Source Selector */}
                    <div className="relative z-20 group w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-secondary-400">
                            {activeSource === 'kredit' ? <Database size={18} /> : <FileSpreadsheet size={18} />}
                        </div>
                        <select
                            value={activeSource}
                            onChange={(e) => setActiveSource(e.target.value)}
                            className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-secondary-200 text-secondary-700 font-bold focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer hover:border-indigo-300 transition-all shadow-sm"
                            disabled={isUploading || isLoadingData}
                        >
                            <option value="kredit" className="font-bold">🏦 Base de Datos Kredit</option>
                            <optgroup label="Campañas Subidas">
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>📊 {c.name} ({c.total})</option>
                                ))}
                            </optgroup>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-secondary-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>

                    <div className="bg-secondary-50 p-1.5 rounded-2xl flex w-full md:w-auto shadow-inner border border-secondary-100">
                        <button onClick={() => setActiveTab('list')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-black/5' : 'text-secondary-500 hover:text-secondary-700'}`}>
                            <span>📋</span> Lista
                        </button>
                        <button onClick={() => setActiveTab('template')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'template' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-black/5' : 'text-secondary-500 hover:text-secondary-700'}`}>
                            <span>💬</span> Mensaje
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 ${isUploading ? 'opacity-70 cursor-wait' : ''}`}>
                            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                            <span>{isUploading ? 'Subiendo...' : 'Nueva Campaña'}</span>
                            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        </label>
                    </div>
                </div>

                    {isLoadingData ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                            <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                            <p className="text-secondary-400 font-medium">Cargando prospectos...</p>
                        </div>
                    ) : activeTab === 'list' && (
                        <>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 rounded-[2rem] border border-secondary-100 shadow-sm">
                                {/* SEARCH & FILTERS CONTAINER - kept same */}
                                <div className="flex flex-col md:flex-row w-full gap-4">
                                    <div className="relative flex-1">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-secondary-400">🔍</span>
                                        <input type="text" placeholder="Buscar por nombre, email o teléfono..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full py-3 px-12 rounded-xl bg-secondary-50 border border-secondary-100 text-sm font-medium focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all placeholder:text-secondary-400" />
                                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 flex items-center pr-4 text-secondary-400 hover:text-red-500">✕</button>}
                                    </div>
                                    <div className="flex bg-secondary-50 p-1.5 rounded-xl border border-secondary-100 shrink-0">
                                        <button onClick={() => setViewFilter('active')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${viewFilter === 'active' ? 'bg-white text-primary-700 shadow-sm' : 'text-secondary-400 hover:text-secondary-600'}`}>Pendientes</button>
                                        <button onClick={() => setViewFilter('sent')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${viewFilter === 'sent' ? 'bg-white text-secondary-700 shadow-sm' : 'text-secondary-400 hover:text-secondary-600'}`}>Historial</button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4 flex justify-between items-center px-2">
                                <span className="text-xs font-bold text-secondary-400 bg-secondary-50 px-3 py-1.5 rounded-lg border border-secondary-100">
                                    {filteredProspects.length} registros • Página {currentPage} de {Math.max(1, totalPages)}
                                </span>
                            </div>

                            <FilterBar
                                columns={filterableColumns}
                                prospects={activeProspects}
                                activeFilters={activeFilters}
                                onFilterChange={(col, val) => setActiveFilters(prev => ({ ...prev, [col]: val }))}
                                onClearFilters={() => setActiveFilters({})}
                            />

                            {filteredProspects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-secondary-200">
                                    {/* ... (Empty State - kept same) ... */}
                                    <div className="w-16 h-16 bg-secondary-50 rounded-full flex items-center justify-center text-3xl mb-4 text-secondary-300">{viewFilter === 'active' ? '🎉' : '📭'}</div>
                                    <p className="font-black text-xl text-secondary-600">{viewFilter === 'active' ? '¡Todo limpio!' : 'Nada por aquí aún'}</p>
                                    <p className="text-sm text-secondary-400 mt-2 font-medium max-w-xs text-center">{viewFilter === 'active' ? 'Has gestionado todos los prospectos pendientes bajo estos filtros.' : 'Tu historial de mensajes enviados aparecerá aquí.'}</p>
                                    {Object.keys(activeFilters).length > 0 && <button onClick={() => setActiveFilters({})} className="mt-6 text-primary-600 text-sm font-bold hover:underline">Limpiar filtros activos</button>}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {paginatedProspects.map(p => (
                                            <ProspectCard
                                                key={p.id}
                                                prospect={p}
                                                onSend={handleSendMessage}
                                                isSentInSession={sentIds.has(p.id)}
                                                visibleColumns={filterableColumns.slice(0, 3)}
                                            />
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex justify-center items-center gap-4 mt-12 mb-8">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="px-4 py-2 rounded-xl bg-white border border-secondary-200 text-secondary-600 font-bold text-sm hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                ← Anterior
                                            </button>

                                            <div className="flex items-center gap-2">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    // Simple logic to show a window of pages or just first 5 for now 
                                                    // Better: show current range. But let's keep it simple: 
                                                    // If many pages, show current, prev, next.
                                                    let pNum = i + 1;
                                                    if (totalPages > 5) {
                                                        if (currentPage > 3) pNum = currentPage - 2 + i;
                                                        if (pNum > totalPages) return null;
                                                    }

                                                    return (
                                                        <button
                                                            key={pNum}
                                                            onClick={() => setCurrentPage(pNum)}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${currentPage === pNum
                                                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-200'
                                                                : 'bg-white border border-secondary-100 text-secondary-500 hover:bg-secondary-50'
                                                                }`}
                                                        >
                                                            {pNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-4 py-2 rounded-xl bg-white border border-secondary-200 text-secondary-600 font-bold text-sm hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Siguiente →
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {activeTab === 'template' && (
                        <div className="max-w-5xl mx-auto pt-4">
                            <TemplateEditor
                                initialTemplate={template}
                                onSave={handleSaveTemplate}
                                variables={templateVariables}
                                sampleProspect={activeProspects[0]}
                            />
                        </div>
                    )}
                    <ToastContainer notifications={notifications} removeNotification={removeNotification} />
                </div>
            </div>
    );
};
