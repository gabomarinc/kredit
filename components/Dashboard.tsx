import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, LayoutDashboard, FileText, Download, Filter, Calendar, CheckCircle2, X, ChevronDown, MapPin, Briefcase, Settings, Plus, Trash2, Building, Image as ImageIcon, Shield, Save, Code, Copy, ExternalLink, Loader2, User, Target, MessageCircle, ShieldCheck, TrendingUp, Eye, FileText as FileTextIcon
} from 'lucide-react';
import { getProspectsFromDB, getCompanyById, updateCompanyZones, updateCompanyLogo, Company } from '../utils/db';
import { Prospect } from '../types';
import { formatCurrency } from '../utils/calculator';
import * as XLSX from 'xlsx';

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
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; url: string; name: string } | null>(null);
  const [newZone, setNewZone] = useState('');
  const [copied, setCopied] = useState(false);

  // Export Modal State
  const [exportFilterType, setExportFilterType] = useState<'all' | 'dateRange'>('all');
  const [exportSalaryRange, setExportSalaryRange] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // DB Data State
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings State - Cargar desde DB
  const [adminName, setAdminName] = useState('Admin Gerente');
  const [adminEmail, setAdminEmail] = useState('gerencia@kredit.com');
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);

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
            console.log('📋 Datos de empresa cargados:', {
              id: company.id,
              name: company.name,
              email: company.email,
              hasLogo: !!company.logoUrl,
              logoUrlType: company.logoUrl ? (company.logoUrl.startsWith('data:') ? 'base64' : company.logoUrl.startsWith('blob:') ? 'blob' : 'url') : 'none',
              logoUrlPreview: company.logoUrl ? company.logoUrl.substring(0, 50) + '...' : 'none'
            });
            setCompanyData(company);
            setAdminName(company.name);
            setAdminEmail(company.email);
            setLogoError(false); // Reset logo error cuando se carga nueva empresa
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
  // Calcular conteo de zonas (soporta arrays y strings)
  const zoneCounts = prospects.reduce((acc, curr) => {
    if (Array.isArray(curr.zone)) {
      curr.zone.forEach(z => {
        const zoneName = z || 'Sin zona';
        acc[zoneName] = (acc[zoneName] || 0) + 1;
      });
    } else {
      const z = curr.zone || 'Sin zona';
      acc[z] = (acc[z] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const sortedZones = Object.entries(zoneCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const topZone = sortedZones[0]?.[0] || 'Aún no tenemos datos';
  const topZoneCount = sortedZones[0]?.[1] || 0;
  
  // Preparar las primeras 2 zonas para mostrar
  const topTwoZones = sortedZones.slice(0, 2).map(([zone]) => zone);
  const hasMoreZones = sortedZones.length > 2;
  const totalZones = sortedZones.length;

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

  // Funciones de exportación
  const filterProspectsForExport = (): Prospect[] => {
    let filtered = [...prospects];

    // Filtrar por rango de fechas si está seleccionado
    if (exportFilterType === 'dateRange' && dateRangeStart && dateRangeEnd) {
      const startDate = new Date(dateRangeStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRangeEnd);
      endDate.setHours(23, 59, 59, 999); // Incluir todo el día final
      
      filtered = filtered.filter(p => {
        const prospectDate = new Date(p.date);
        return prospectDate >= startDate && prospectDate <= endDate;
      });
    }

    // Filtrar por rango salarial
    if (exportSalaryRange) {
      filtered = filtered.filter(p => {
        const income = p.income;
        switch (exportSalaryRange) {
          case '0-3000':
            return income < 3000;
          case '3000-5000':
            return income >= 3000 && income < 5000;
          case '5000-8000':
            return income >= 5000 && income < 8000;
          case '8000-12000':
            return income >= 8000 && income < 12000;
          case '12000+':
            return income >= 12000;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const exportToCSV = () => {
    const filteredData = filterProspectsForExport();
    
    if (filteredData.length === 0) {
      alert('No hay datos para exportar con los filtros seleccionados.');
      return;
    }

    // Preparar datos para CSV
    const headers = [
      'ID',
      'Nombre Completo',
      'Email',
      'Teléfono',
      'Ingreso Mensual',
      'Tipo de Propiedad',
      'Habitaciones',
      'Baños',
      'Zonas de Interés',
      'Precio Máximo',
      'Pago Mensual',
      'Enganche (%)',
      'Enganche ($)',
      'Estado',
      'Fecha de Registro'
    ];

    const rows = filteredData.map(p => [
      p.id,
      p.name || 'N/A',
      p.email || 'N/A',
      p.phone || 'N/A',
      p.income.toFixed(2), // Sin formato de moneda para CSV (mejor para Excel)
      p.propertyType || 'N/A',
      p.bedrooms?.toString() || 'N/A',
      p.bathrooms?.toString() || 'N/A',
      Array.isArray(p.zone) ? p.zone.join(', ') : (typeof p.zone === 'string' ? p.zone : 'N/A'),
      (p.result?.maxPropertyPrice || 0).toFixed(2),
      (p.result?.monthlyPayment || 0).toFixed(2),
      `${p.result?.downPaymentPercent || 0}%`,
      (p.result?.downPaymentAmount || 0).toFixed(2),
      p.status || 'Nuevo',
      p.dateDisplay || new Date(p.date).toLocaleDateString('es-PA')
    ]);

    // Crear contenido CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Crear BOM para Excel (UTF-8)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospectos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
  };

  const exportToExcel = () => {
    const filteredData = filterProspectsForExport();
    
    if (filteredData.length === 0) {
      alert('No hay datos para exportar con los filtros seleccionados.');
      return;
    }

    // Preparar datos para Excel
    const worksheetData = filteredData.map(p => ({
      'ID': p.id,
      'Nombre Completo': p.name || 'N/A',
      'Email': p.email || 'N/A',
      'Teléfono': p.phone || 'N/A',
      'Ingreso Mensual': p.income,
      'Tipo de Propiedad': p.propertyType || 'N/A',
      'Habitaciones': p.bedrooms ?? 'N/A',
      'Baños': p.bathrooms ?? 'N/A',
      'Zonas de Interés': Array.isArray(p.zone) ? p.zone.join(', ') : (typeof p.zone === 'string' ? p.zone : 'N/A'),
      'Precio Máximo': p.result?.maxPropertyPrice || 0,
      'Pago Mensual': p.result?.monthlyPayment || 0,
      'Enganche (%)': p.result?.downPaymentPercent || 0,
      'Enganche ($)': p.result?.downPaymentAmount || 0,
      'Estado': p.status || 'Nuevo',
      'Fecha de Registro': p.dateDisplay || new Date(p.date).toLocaleDateString('es-PA')
    }));

    // Crear workbook y worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prospectos');

    // Ajustar ancho de columnas
    const columnWidths = [
      { wch: 10 }, // ID
      { wch: 25 }, // Nombre
      { wch: 30 }, // Email
      { wch: 15 }, // Teléfono
      { wch: 15 }, // Ingreso
      { wch: 18 }, // Tipo Propiedad
      { wch: 12 }, // Habitaciones
      { wch: 10 }, // Baños
      { wch: 30 }, // Zonas
      { wch: 15 }, // Precio Máximo
      { wch: 15 }, // Pago Mensual
      { wch: 12 }, // Enganche %
      { wch: 15 }, // Enganche $
      { wch: 15 }, // Estado
      { wch: 18 }  // Fecha
    ];
    worksheet['!cols'] = columnWidths;

    // Descargar archivo
    XLSX.writeFile(workbook, `prospectos_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    setShowExportModal(false);
  };

  const handleExport = () => {
    if (exportFormat === 'csv') {
      exportToCSV();
    } else {
      exportToExcel();
    }
  };

  // Generate Embed Code with ROUNDED CORNERS and SHADOW enforced on the iframe
  const appUrl = window.location.href.split('?')[0];
  const companyId = localStorage.getItem('companyId');
  const embedUrl = companyId 
    ? `${appUrl}?mode=embed&company_id=${companyId}`
    : `${appUrl}?mode=embed`;
  
  const embedCode = `<iframe 
  src="${embedUrl}" 
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
    const companyId = localStorage.getItem('companyId');
    const previewUrl = companyId 
      ? `${appUrl}?mode=embed&company_id=${companyId}`
      : `${appUrl}?mode=embed`;
    window.open(previewUrl, '_blank');
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

            {/* Card 4: Top Zones */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500 cursor-pointer" onClick={() => hasMoreZones && setShowZonesModal(true)}>
               <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                 <MapPin size={32} strokeWidth={1.5} />
               </div>
               <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-xs mb-2">Zonas Más Buscadas</h3>
               <p className="text-2xl font-bold text-gray-900 tracking-tight px-4 leading-tight">
                 {isLoading ? (
                   <Loader2 className="animate-spin mx-auto" />
                 ) : sortedZones.length === 0 ? (
                   'Aún no tenemos datos'
                 ) : (
                   <>
                     {topTwoZones.join(', ')}
                     {hasMoreZones && (
                       <span 
                         className="text-orange-600 hover:text-orange-700 cursor-pointer ml-1"
                         onClick={(e) => {
                           e.stopPropagation();
                           setShowZonesModal(true);
                         }}
                       >
                         y ...
                       </span>
                     )}
                   </>
                 )}
               </p>
               <span className="mt-4 px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full">
                 {totalZones > 0 ? `${totalZones} ${totalZones === 1 ? 'zona' : 'zonas'}` : '0 zonas'}
               </span>
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
                  <div className="bg-gray-900 rounded-xl p-4 mb-4 relative">
                    <code className="text-xs text-gray-300 font-mono whitespace-pre-wrap block overflow-visible">
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
                     <label className="cursor-pointer">
                       {(() => {
                         const hasLogo = companyData?.logoUrl && companyData.logoUrl.trim() !== '' && companyData.logoUrl !== 'null' && companyData.logoUrl !== 'undefined';
                         const shouldShow = hasLogo && !logoError;
                         
                         if (companyData) {
                           console.log('🔍 Verificando logo:', {
                             hasCompanyData: true,
                             hasLogoUrl: !!companyData.logoUrl,
                             logoUrlPreview: companyData.logoUrl ? companyData.logoUrl.substring(0, 80) + '...' : 'none',
                             logoUrlType: companyData.logoUrl ? (companyData.logoUrl.startsWith('data:') ? 'base64' : companyData.logoUrl.startsWith('blob:') ? 'blob' : 'url') : 'none',
                             logoError,
                             shouldShow
                           });
                         }
                         
                         return shouldShow;
                       })() ? (
                         <div className="w-32 h-32 rounded-3xl border-2 border-gray-200 overflow-hidden bg-white flex items-center justify-center mx-auto md:mx-0 shadow-sm relative group">
                           <img 
                             src={companyData.logoUrl} 
                             alt="Logo de la empresa" 
                             className="w-full h-full object-contain p-2"
                             onLoad={() => {
                               console.log('✅ Logo cargado exitosamente');
                             }}
                             onError={(e) => {
                               // Si la imagen falla al cargar, mostrar placeholder
                               console.error('❌ Error cargando logo:', {
                                 src: companyData.logoUrl,
                                 srcType: companyData.logoUrl.startsWith('data:') ? 'base64' : companyData.logoUrl.startsWith('blob:') ? 'blob' : 'url',
                                 error: e
                               });
                               setLogoError(true);
                             }}
                           />
                           {isUpdatingLogo ? (
                             <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-3xl">
                               <Loader2 className="animate-spin text-indigo-600" size={24} />
                             </div>
                           ) : (
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                               <span className="text-white text-xs font-semibold">Cambiar</span>
                             </div>
                           )}
                         </div>
                       ) : (
                         <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all mx-auto md:mx-0">
                           {isUpdatingLogo ? (
                             <Loader2 className="animate-spin text-indigo-600" size={32} />
                           ) : (
                             <>
                               <ImageIcon size={32} strokeWidth={1} />
                               <span className="text-xs font-semibold mt-2">Cambiar Logo</span>
                             </>
                           )}
                         </div>
                       )}
                       <input 
                         type="file" 
                         accept="image/*"
                         className="hidden"
                         onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (!file) return;

                           // Validar tamaño (máx 2MB)
                           if (file.size > 2 * 1024 * 1024) {
                             alert('El logo debe ser menor a 2MB');
                             return;
                           }

                           setIsUpdatingLogo(true);
                           setLogoError(false);

                           try {
                             // Convertir a base64
                             const reader = new FileReader();
                             reader.readAsDataURL(file);
                             reader.onload = async () => {
                               const base64 = reader.result as string;
                               
                               const companyId = localStorage.getItem('companyId');
                               if (!companyId) {
                                 alert('Error: No se encontró el ID de la empresa');
                                 setIsUpdatingLogo(false);
                                 return;
                               }

                               // Actualizar en la base de datos
                               const success = await updateCompanyLogo(companyId, base64);
                               
                               if (success) {
                                 // Actualizar el estado local
                                 if (companyData) {
                                   setCompanyData({ ...companyData, logoUrl: base64 });
                                 }
                                 console.log('✅ Logo actualizado exitosamente');
                               } else {
                                 alert('Error al actualizar el logo. Por favor intenta de nuevo.');
                               }
                               
                               setIsUpdatingLogo(false);
                             };
                             reader.onerror = () => {
                               alert('Error al leer el archivo');
                               setIsUpdatingLogo(false);
                             };
                           } catch (error) {
                             console.error('Error actualizando logo:', error);
                             alert('Error al actualizar el logo');
                             setIsUpdatingLogo(false);
                           }
                         }}
                       />
                     </label>
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
                      <tr 
                        key={prospect.id} 
                        onClick={() => setSelectedProspect(prospect)}
                        className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                      >
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
                            <span className="text-sm text-gray-600 font-medium">
                              {Array.isArray(prospect.zone) ? prospect.zone.join(', ') : (typeof prospect.zone === 'string' ? prospect.zone : 'Sin zona')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-gray-500">{prospect.dateDisplay || new Date(prospect.date).toLocaleDateString('es-PA')}</span>
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
              {/* Format Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Formato de Exportación</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={`p-4 rounded-xl border-2 transition-all font-semibold text-sm ${
                      exportFormat === 'excel'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`p-4 rounded-xl border-2 transition-all font-semibold text-sm ${
                      exportFormat === 'csv'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* Filter: Range Type */}
              <div className="space-y-3">
                <label 
                  onClick={() => setExportFilterType('all')}
                  className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                    exportFilterType === 'all'
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    exportFilterType === 'all' ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {exportFilterType === 'all' && (
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-semibold text-sm ${
                    exportFilterType === 'all' ? 'text-gray-900' : 'text-gray-600'
                  }`}>Toda la base de datos</span>
                </label>
                
                <label 
                  onClick={() => setExportFilterType('dateRange')}
                  className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                    exportFilterType === 'dateRange'
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    exportFilterType === 'dateRange' ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {exportFilterType === 'dateRange' && (
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-medium text-sm ${
                    exportFilterType === 'dateRange' ? 'text-gray-900' : 'text-gray-600'
                  }`}>Filtrar por rango de fechas</span>
                </label>
              </div>

              {/* Date Range Filter */}
              {exportFilterType === 'dateRange' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha Inicio</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 text-gray-400" size={16} />
                      <input
                        type="date"
                        value={dateRangeStart}
                        onChange={(e) => setDateRangeStart(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha Fin</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 text-gray-400" size={16} />
                      <input
                        type="date"
                        value={dateRangeEnd}
                        onChange={(e) => setDateRangeEnd(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Filter: Salary Range */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rango Salarial (Opcional)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 text-gray-400" size={18} />
                  <select 
                    value={exportSalaryRange}
                    onChange={(e) => setExportSalaryRange(e.target.value)}
                    className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 appearance-none cursor-pointer hover:bg-white transition-colors text-gray-700 font-medium"
                  >
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
                onClick={handleExport}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex justify-center items-center gap-2"
              >
                <Download size={18} /> Descargar Reporte {exportFormat === 'excel' ? 'Excel' : 'CSV'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Zones Analysis Modal */}
      {showZonesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowZonesModal(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl relative animate-fade-in-up z-10 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowZonesModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <MapPin size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Análisis de Cobertura</h3>
              <p className="text-gray-500 text-sm mt-1">Distribución geográfica de tu cartera.</p>
            </div>

            <div className="space-y-4">
              {sortedZones.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Aún no hay datos de zonas</p>
                  <p className="text-sm mt-1">Los prospectos aparecerán aquí cuando completen el formulario.</p>
                </div>
              ) : (
                sortedZones.map(([zoneName, count], index) => {
                  const maxCount = sortedZones[0]?.[1] as number || 1;
                  const percentage = ((count as number) / maxCount) * 100;
                  
                  // Colores alternados para las barras
                  const colors = [
                    { bg: 'bg-emerald-500', text: 'text-emerald-600' },
                    { bg: 'bg-purple-500', text: 'text-purple-600' },
                    { bg: 'bg-blue-500', text: 'text-blue-600' },
                    { bg: 'bg-orange-500', text: 'text-orange-600' },
                    { bg: 'bg-gray-400', text: 'text-gray-500' }
                  ];
                  const color = colors[index % colors.length];
                  
                  return (
                    <div key={zoneName} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{zoneName}</span>
                        <span className="text-sm text-gray-500">
                          {count} {count === 1 ? 'interesado' : 'interesados'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full ${color.bg} rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={() => setShowZonesModal(false)}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all flex justify-center items-center gap-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prospect Detail Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedProspect(null)}
          ></div>
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fade-in-up z-10">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-indigo-400 to-purple-400 rounded-t-[2rem] p-6 pr-20 relative">
              <button 
                onClick={() => setSelectedProspect(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors z-10 hover:opacity-70"
              >
                <X size={10} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Prospect Header */}
              <div className="flex items-start gap-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-600 shrink-0">
                  {selectedProspect.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-gray-900">{selectedProspect.name}</h2>
                </div>
              </div>

              {/* Financial Cards */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={18} className="text-indigo-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Ingresos</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(selectedProspect.income)}/mes
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={18} className="text-indigo-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Busca</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedProspect.propertyType || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase size={18} className="text-indigo-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Presupuesto</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    ~{formatCurrency(selectedProspect.result?.maxPropertyPrice || 0)}
                  </p>
                </div>
              </div>

              {/* Zone of Interest */}
              <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <h3 className="text-sm font-bold text-gray-700 mb-3">INTERESADO EN</h3>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {(() => {
                      const zones = Array.isArray(selectedProspect.zone) 
                        ? selectedProspect.zone 
                        : (typeof selectedProspect.zone === 'string' ? [selectedProspect.zone] : []);
                      
                      if (zones.length === 0) {
                        return (
                          <>
                            <p className="text-xl font-bold text-gray-900 mb-1">Sin zona</p>
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin size={14} />
                              <span>Panamá, Ciudad de Panamá</span>
                            </div>
                          </>
                        );
                      }
                      
                      return (
                        <>
                          <p className="text-xl font-bold text-gray-900 mb-1">
                            {zones.join(', ')}
                          </p>
                          <div className="flex items-center gap-1 text-gray-500 text-sm">
                            <MapPin size={14} />
                            <span>Panamá, Ciudad de Panamá</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Documents Section - MUY IMPORTANTE */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileTextIcon size={20} className="text-indigo-600" />
                  Documentación
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Foto de Cédula */}
                  {selectedProspect.idFileBase64 && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Foto de Cédula / ID</h4>
                      <div 
                        onClick={() => setSelectedDocument({ 
                          type: selectedProspect.idFileBase64!.startsWith('data:image/') ? 'image' : 'pdf',
                          url: selectedProspect.idFileBase64!,
                          name: 'Foto de Cédula / ID'
                        })}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {selectedProspect.idFileBase64.startsWith('data:image/') ? (
                          <img 
                            src={selectedProspect.idFileBase64} 
                            alt="Cédula" 
                            className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                          />
                        ) : (
                          <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <FileTextIcon size={32} className="text-indigo-600 mx-auto mb-2" />
                            <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ficha de Seguro Social */}
                  {selectedProspect.fichaFileBase64 && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Ficha de Seguro Social</h4>
                      <div 
                        onClick={() => setSelectedDocument({ 
                          type: selectedProspect.fichaFileBase64!.startsWith('data:image/') ? 'image' : 'pdf',
                          url: selectedProspect.fichaFileBase64!,
                          name: 'Ficha de Seguro Social'
                        })}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {selectedProspect.fichaFileBase64.startsWith('data:image/') ? (
                          <img 
                            src={selectedProspect.fichaFileBase64} 
                            alt="Ficha Seguro Social" 
                            className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                          />
                        ) : (
                          <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <FileTextIcon size={32} className="text-indigo-600 mx-auto mb-2" />
                            <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Talonario de Pago */}
                  {selectedProspect.talonarioFileBase64 && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Talonario de Pago</h4>
                      <div 
                        onClick={() => setSelectedDocument({ 
                          type: selectedProspect.talonarioFileBase64!.startsWith('data:image/') ? 'image' : 'pdf',
                          url: selectedProspect.talonarioFileBase64!,
                          name: 'Talonario de Pago'
                        })}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {selectedProspect.talonarioFileBase64.startsWith('data:image/') ? (
                          <img 
                            src={selectedProspect.talonarioFileBase64} 
                            alt="Talonario" 
                            className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                          />
                        ) : (
                          <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <FileTextIcon size={32} className="text-indigo-600 mx-auto mb-2" />
                            <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* APC Firmada */}
                  {selectedProspect.signedAcpFileBase64 && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">APC Firmada</h4>
                      <div 
                        onClick={() => setSelectedDocument({ 
                          type: selectedProspect.signedAcpFileBase64!.startsWith('data:image/') ? 'image' : 'pdf',
                          url: selectedProspect.signedAcpFileBase64!,
                          name: 'APC Firmada'
                        })}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {selectedProspect.signedAcpFileBase64.startsWith('data:image/') ? (
                          <img 
                            src={selectedProspect.signedAcpFileBase64} 
                            alt="APC Firmada" 
                            className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                          />
                        ) : (
                          <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <FileTextIcon size={32} className="text-indigo-600 mx-auto mb-2" />
                            <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mensaje si no hay documentos */}
                  {!selectedProspect.idFileBase64 && !selectedProspect.fichaFileBase64 && 
                   !selectedProspect.talonarioFileBase64 && !selectedProspect.signedAcpFileBase64 && (
                    <div className="col-span-2 text-center py-8 text-gray-400">
                      <FileTextIcon size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay documentos subidos</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDocument(null)}
          ></div>
          <div className="bg-white rounded-[2rem] w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl relative z-10 flex flex-col">
            {/* Header */}
            <div className="bg-gray-900 text-white p-6 flex items-center justify-between">
              <h3 className="text-lg font-bold">{selectedDocument.name}</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    // Función para descargar
                    const link = document.createElement('a');
                    link.href = selectedDocument.url;
                    
                    // Determinar extensión y nombre del archivo
                    let extension = '';
                    let mimeType = '';
                    
                    if (selectedDocument.type === 'image') {
                      // Extraer el tipo MIME de la data URL
                      const mimeMatch = selectedDocument.url.match(/data:([^;]+);/);
                      mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                      
                      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
                        extension = '.jpg';
                      } else if (mimeType.includes('png')) {
                        extension = '.png';
                      } else if (mimeType.includes('gif')) {
                        extension = '.gif';
                      } else {
                        extension = '.png';
                      }
                    } else {
                      // PDF
                      extension = '.pdf';
                      mimeType = 'application/pdf';
                    }
                    
                    // Crear nombre de archivo
                    const fileName = `${selectedDocument.name.replace(/\s+/g, '_')}${extension}`;
                    
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 flex items-center gap-2 transition-colors text-sm font-semibold"
                >
                  <Download size={16} className="text-white" />
                  <span>Descargar</span>
                </button>
                <button 
                  onClick={() => setSelectedDocument(null)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gray-50">
              {selectedDocument.type === 'image' ? (
                <img 
                  src={selectedDocument.url} 
                  alt={selectedDocument.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <iframe 
                  src={selectedDocument.url}
                  className="w-full h-[70vh] rounded-lg border border-gray-200 shadow-lg bg-white"
                  title={selectedDocument.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};