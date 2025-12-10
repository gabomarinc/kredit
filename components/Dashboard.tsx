import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, LayoutDashboard, FileText, Download, Filter, Calendar, CheckCircle2, X, ChevronDown, MapPin, Briefcase, Settings, Plus, Trash2, Building, Image as ImageIcon, Shield, Save, Code, Copy, ExternalLink, Loader2
} from 'lucide-react';
import { getProspectsFromDB, getCompanyById, updateCompanyZones, Company } from '../utils/db';
import { Prospect } from '../types';
import { formatCurrency } from '../utils/calculator';

type Tab = 'dashboard' | 'prospects' | 'settings';

interface DashboardProps {
  availableZones: string[];
  onUpdateZones: (zones: string[]) => void;
  companyName: string;
  onUpdateCompanyName: (name: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ availableZones, onUpdateZones, companyName, onUpdateCompanyName }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showExportModal, setShowExportModal] = useState(false);
  const [newZone, setNewZone] = useState('');
  const [copied, setCopied] = useState(false);

  // DB Data State
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings State - Cargar desde DB
  const [adminName, setAdminName] = useState('Admin Gerente');
  const [adminEmail, setAdminEmail] = useState('gerencia@kredit.com');
  const [companyData, setCompanyData] = useState<Company | null>(null);

  // Load Data from Neon
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Cargar prospectos
        const data = await getProspectsFromDB();
        setProspects(data);

        // Cargar datos de la empresa
        const companyId = localStorage.getItem('companyId');
        if (companyId) {
          const company = await getCompanyById(companyId);
          if (company) {
            setCompanyData(company);
            setAdminName(company.name);
            setAdminEmail(company.email);
            // Actualizar zonas si vienen de la DB
            if (company.zones.length > 0) {
              onUpdateZones(company.zones);
            }
          }
        }
      } catch (e) {
        console.error("Error loading dashboard data", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []); // Run once on mount

  // Calculate KPIs based on REAL prospects
  const totalForms = prospects.length;
  // Explicitly type accumulator as number to avoid TS arithmetic errors
  const totalIncome = prospects.reduce((acc: number, curr) => acc + (curr.income || 0), 0);
  const avgSalary = totalForms > 0 ? totalIncome / totalForms : 0;
  
  // Explicitly type accumulator as number
  const totalCapacity = prospects.reduce((acc: number, curr) => acc + (Number(curr.result?.maxPropertyPrice) || 0), 0);
  const avgCapacity = totalForms > 0 ? totalCapacity / totalForms : 0;

  // Calculate most popular zone
  const zoneCounts = prospects.reduce((acc, curr) => {
    const z = curr.zone || 'Sin zona';
    acc[z] = (acc[z] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sortedZones = Object.entries(zoneCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const topZone = sortedZones[0]?.[0] || 'Aún no tenemos datos';
  const topZoneCount = sortedZones[0]?.[1] || 0;

  const handleAddZone = async () => {
    if (newZone.trim() && !availableZones.includes(newZone.trim())) {
      const updatedZones = [...availableZones, newZone.trim()];
      onUpdateZones(updatedZones);
      setNewZone('');
      
      // Guardar en la base de datos
      const companyId = localStorage.getItem('companyId');
      if (companyId) {
        const success = await updateCompanyZones(companyId, updatedZones);
        if (success) {
          console.log('✅ Zona agregada y guardada en la base de datos');
        } else {
          console.error('❌ Error al guardar zona en la base de datos');
        }
      }
    }
  };

  const handleDeleteZone = async (zoneToDelete: string) => {
    const updatedZones = availableZones.filter(z => z !== zoneToDelete);
    onUpdateZones(updatedZones);
    
    // Guardar en la base de datos
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      const success = await updateCompanyZones(companyId, updatedZones);
      if (success) {
        console.log('✅ Zona eliminada y actualizada en la base de datos');
      } else {
        console.error('❌ Error al actualizar zonas en la base de datos');
      }
    }
  };

  // Generate Embed Code with ROUNDED CORNERS and SHADOW enforced on the iframe
  const appUrl = window.location.href.split('?')[0];
  const embedCode = `<iframe 
  src="${appUrl}?mode=embed" 
  width="100%" 
  height="750" 
  frameborder="0" 
  style="border-radius: 30px; box-shadow: 0 20px 60px -10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid rgba(0,0,0,0.05);"
></iframe>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPreview = () => {
    window.open(`${appUrl}?mode=embed`, '_blank');
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in-up">
        
        {/* Top Menu Tabs */}
        <div className="flex justify-center mb-10">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 inline-flex gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'dashboard' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard size={16} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'prospects' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users size={16} /> Prospectos
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'settings' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Settings size={16} /> Configuración
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'dashboard' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
            {/* Card 1: Total Forms */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
               <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                 <FileText size={32} strokeWidth={1.5} />
               </div>
               <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-xs mb-2">Formularios Completados</h3>
               <p className="text-5xl font-bold text-gray-900 tracking-tight">
                 {isLoading ? <Loader2 className="animate-spin" /> : totalForms}
               </p>
               <span className="mt-4 px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full">Actualizado hoy</span>
            </div>

            {/* Card 2: Average Salary */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
               <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                 <DollarSign size={32} strokeWidth={1.5} />
               </div>
               <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-xs mb-2">Promedio Salarial</h3>
               <p className="text-5xl font-bold text-gray-900 tracking-tight">
                 {isLoading ? <Loader2 className="animate-spin" /> : formatCurrency(avgSalary)}
               </p>
               <span className="mt-4 text-gray-400 text-[10px] font-medium">Basado en {totalForms} registros</span>
            </div>

            {/* Card 3: Avg Purchasing Capacity */}
             <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
               <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                 <Briefcase size={32} strokeWidth={1.5} />
               </div>
               <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-xs mb-2">Capacidad de Compra Prom.</h3>
               <p className="text-5xl font-bold text-gray-900 tracking-tight">
                 {isLoading ? <Loader2 className="animate-spin" /> : formatCurrency(avgCapacity)}
               </p>
               <span className="mt-4 text-gray-400 text-[10px] font-medium">Potencial de cierre</span>
            </div>

            {/* Card 4: Top Zone */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
               <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                 <MapPin size={32} strokeWidth={1.5} />
               </div>
               <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-xs mb-2">Zona Más Buscada</h3>
               <p className="text-3xl font-bold text-gray-900 tracking-tight px-4">
                 {isLoading ? <Loader2 className="animate-spin" /> : topZone}
               </p>
               <span className="mt-4 px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full">{topZoneCount} interesados</span>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Embed & Zones */}
            <div className="space-y-8">
              
              {/* Embed Integration Card */}
              <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="p-8 border-b border-gray-50">
                  <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center mb-4 shadow-lg shadow-gray-200">
                    <Code size={24} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Integración Web</h3>
                  <p className="text-sm text-gray-500 mt-2">Copia este código para añadir la calculadora a tu sitio web.</p>
                </div>
                
                <div className="p-6 bg-gray-50/50">
                  <div className="bg-gray-900 rounded-xl p-4 mb-4 relative group">
                    <code className="text-xs text-gray-300 font-mono break-all line-clamp-4 hover:line-clamp-none transition-all">
                      {embedCode}
                    </code>
                    <div className="absolute right-2 top-2">
                       <button 
                        onClick={copyToClipboard}
                        className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors backdrop-blur-sm"
                        title="Copiar código"
                       >
                         {copied ? <CheckCircle2 size={16} className="text-green-400"/> : <Copy size={16} />}
                       </button>
                    </div>
                  </div>
                  
                  <button 
                    onClick={openPreview}
                    className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} /> Previsualizar Formulario
                  </button>
                </div>
              </div>

              {/* Zone Management */}
              <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden flex flex-col h-fit">
                <div className="p-8 border-b border-gray-50">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                    <MapPin size={24} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Zonas de Preferencia</h3>
                  <p className="text-sm text-gray-500 mt-2">Gestiona las áreas que se muestran a los clientes potenciales.</p>
                </div>
                
                <div className="p-6 bg-gray-50/50 flex-1">
                  <div className="flex flex-wrap gap-2 mb-6">
                    {availableZones.map(zone => (
                      <div key={zone} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm group hover:border-red-200 hover:bg-red-50 transition-colors">
                        {zone}
                        <button 
                          onClick={() => handleDeleteZone(zone)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newZone}
                      onChange={(e) => setNewZone(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddZone()}
                      placeholder="Nueva Zona..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-indigo-500 outline-none bg-white"
                    />
                    <button 
                      onClick={handleAddZone}
                      disabled={!newZone.trim()}
                      className="bg-gray-900 text-white p-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile & Branding Column */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Company Profile */}
              <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Building size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Perfil de Empresa</h3>
                    <p className="text-sm text-gray-500">Personaliza la identidad visual de la plataforma.</p>
                  </div>
                </div>

                <div className="p-8 grid md:grid-cols-3 gap-8 items-center">
                   <div className="text-center md:text-left">
                     {companyData?.logoUrl ? (
                       <div className="w-32 h-32 rounded-3xl border-2 border-gray-200 overflow-hidden bg-white flex items-center justify-center mx-auto md:mx-0 shadow-sm">
                         <img 
                           src={companyData.logoUrl} 
                           alt="Logo de la empresa" 
                           className="w-full h-full object-contain p-2"
                           onError={(e) => {
                             // Si la imagen falla al cargar, mostrar placeholder
                             e.currentTarget.style.display = 'none';
                             e.currentTarget.parentElement!.innerHTML = `
                               <div class="w-32 h-32 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 mx-auto md:mx-0">
                                 <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                 </svg>
                                 <span class="text-xs font-semibold mt-2">Cambiar Logo</span>
                               </div>
                             `;
                           }}
                         />
                       </div>
                     ) : (
                       <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer mx-auto md:mx-0">
                         <ImageIcon size={32} strokeWidth={1} />
                         <span className="text-xs font-semibold mt-2">Cambiar Logo</span>
                       </div>
                     )}
                   </div>
                   <div className="md:col-span-2 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre de la Empresa</label>
                        <input 
                          type="text" 
                          value={companyName}
                          onChange={(e) => onUpdateCompanyName(e.target.value)}
                          className="w-full px-5 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-colors text-gray-900 font-medium"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button className="flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors">
                          <Save size={16} /> Guardar Cambios
                        </button>
                      </div>
                   </div>
                </div>
              </div>

              {/* User Account */}
              <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Shield size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Cuenta & Seguridad</h3>
                    <p className="text-sm text-gray-500">Administra tus credenciales de acceso.</p>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                   <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre del Administrador</label>
                        <input 
                          type="text" 
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className="w-full px-5 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-colors text-gray-900 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Correo Electrónico</label>
                        <input 
                          type="email" 
                          value={adminEmail}
                          readOnly
                          className="w-full px-5 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 font-medium cursor-not-allowed"
                          title="Este es el correo con el que te registraste"
                        />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Contraseña Actual</label>
                      <input 
                        type="password" 
                        value="••••••••••••"
                        readOnly
                        className="w-full px-5 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-gray-50 text-gray-400 font-medium"
                      />
                      <button className="text-xs text-indigo-500 font-bold mt-2 hover:text-indigo-700">Cambiar Contraseña</button>
                   </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
            
            {/* List Header */}
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Base de Prospectos</h2>
                <p className="text-gray-500 text-sm">Gestiona y analiza los datos capturados.</p>
              </div>
              
              <button 
                onClick={() => setShowExportModal(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg shadow-gray-200"
              >
                <Download size={16} /> Exportar Data
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <p className="text-sm font-medium">Cargando base de datos...</p>
                  </div>
                </div>
              ) : prospects.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                   <p>Aún no hay prospectos registrados.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="px-8 py-6 font-semibold rounded-tl-[2rem]">Prospecto</th>
                      <th className="px-6 py-6 font-semibold">Ingreso Mensual</th>
                      <th className="px-6 py-6 font-semibold">Capacidad Compra</th>
                      <th className="px-6 py-6 font-semibold">Zona de Interés</th>
                      <th className="px-6 py-6 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {prospects.map((prospect) => (
                      <tr key={prospect.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">{prospect.name}</span>
                            <span className="text-xs text-gray-400">{prospect.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-medium text-gray-700">{formatCurrency(prospect.income)}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-xs">
                            {formatCurrency(prospect.result?.maxPropertyPrice || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600 font-medium">{prospect.zone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-gray-500">{prospect.date}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowExportModal(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-fade-in-up z-10">
            <button 
              onClick={() => setShowExportModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Filter size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Exportar Datos</h3>
              <p className="text-gray-500 text-sm mt-1">Selecciona los filtros para tu reporte.</p>
            </div>

            <div className="space-y-6">
              {/* Filter: Range Type */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border border-indigo-100 bg-indigo-50/30 rounded-xl cursor-pointer transition-colors hover:border-indigo-300">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">Toda la base de datos</span>
                </label>
                
                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors opacity-60">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                  <span className="font-medium text-gray-600 text-sm">Filtrar por rango de fechas</span>
                </label>
              </div>

              {/* Filter: Salary Range */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rango Salarial (Opcional)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 text-gray-400" size={18} />
                  <select className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 appearance-none cursor-pointer hover:bg-white transition-colors text-gray-700 font-medium">
                    <option value="">Cualquier Salario</option>
                    <option value="0-3000">Menos de $3,000</option>
                    <option value="3000-5000">$3,000 - $5,000</option>
                    <option value="5000-8000">$5,000 - $8,000</option>
                    <option value="8000-12000">$8,000 - $12,000</option>
                    <option value="12000+">Más de $12,000</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              <button 
                onClick={() => {
                  alert("Descargando reporte CSV...");
                  setShowExportModal(false);
                }}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex justify-center items-center gap-2"
              >
                <Download size={18} /> Descargar Reporte
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};