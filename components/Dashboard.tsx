import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, LayoutDashboard, FileText, Download, Filter, Calendar, CheckCircle2, X, ChevronDown, MapPin, Briefcase, Settings, Plus, Trash2, Building, Image as ImageIcon, Shield, Save, Code, Copy, ExternalLink, Loader2, User, Target, MessageCircle, ShieldCheck, TrendingUp, Eye, FileText as FileTextIcon, BedDouble, Bath, Heart, ArrowRight, Upload, Check, ChevronLeft
} from 'lucide-react';
import { getProspectsFromDB, getCompanyById, updateCompanyZones, updateCompanyLogo, Company, getPropertiesByCompany, saveProperty, updateProperty, deleteProperty, getPropertyInterestsByCompany, updateCompanyPlan, getPropertyInterestsByProspect, saveProject, getProjectsByCompany, updateProject, deleteProject } from '../utils/db';
import { Prospect, Property, PropertyInterest, PlanType, Project, ProjectModel } from '../types';
import { NotificationModal, NotificationType } from './ui/NotificationModal';
import { formatCurrency } from '../utils/calculator';
import * as XLSX from 'xlsx';

type Tab = 'dashboard' | 'prospects' | 'properties' | 'settings';

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

  // Properties State
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyInterests, setPropertyInterests] = useState<PropertyInterest[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [selectedPropertyForEdit, setSelectedPropertyForEdit] = useState<Property | null>(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showPropertySelectionModal, setShowPropertySelectionModal] = useState(false);
  const [prospectInterestedProperties, setProspectInterestedProperties] = useState<Property[]>([]);
  const [isLoadingProspectProperties, setIsLoadingProspectProperties] = useState(false);
  
  // Projects State (Promotora)
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null);
  const [showProjectSelectionModal, setShowProjectSelectionModal] = useState(false);
  
  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; message: string; title?: string }>({
    isOpen: false,
    type: 'error',
    message: ''
  });

  // Settings State - Cargar desde DB
  const [adminName, setAdminName] = useState('Admin Gerente');
  const [adminEmail, setAdminEmail] = useState('gerencia@kredit.com');
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [isPromotora, setIsPromotora] = useState<boolean>(false); // Inicializar como false para que no aparezca el cuadro


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
            setIsPromotora(company.role === 'Promotora'); // Establecer inmediatamente
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

  // Load Properties/Projects when tab changes to properties
  useEffect(() => {
    const loadData = async () => {
      if (activeTab === 'properties') {
        setIsLoadingProperties(true);
        try {
          const companyId = localStorage.getItem('companyId');
          if (companyId) {
            if (isPromotora) {
              // Cargar proyectos para Promotora
              const projs = await getProjectsByCompany(companyId);
              setProjects(projs);
            } else {
              // Cargar propiedades para Broker
              const props = await getPropertiesByCompany(companyId);
              setProperties(props);
              
              // Also load property interests
              const interests = await getPropertyInterestsByCompany(companyId);
              setPropertyInterests(interests);
            }
          }
        } catch (e) {
          console.error("Error loading data:", e);
        } finally {
          setIsLoadingProperties(false);
        }
      }
    };
    loadData();
  }, [activeTab, isPromotora]);

  // Función para importar propiedades desde Excel/CSV
  const handleImportProperties = async (file: File) => {
    const companyId = localStorage.getItem('companyId');
    if (!companyId) {
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'No se encontró el ID de la empresa. Por favor, inicia sesión nuevamente.',
        title: 'Error de sesión'
      });
      return;
    }

    try {
      setIsLoadingProperties(true);
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let importedData: any[] = [];

      if (fileExtension === 'csv') {
        // Leer CSV
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        importedData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        }).filter(row => Object.values(row).some(v => v));
      } else {
        // Leer Excel usando XLSX
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        importedData = XLSX.utils.sheet_to_json(firstSheet);
      }

      if (importedData.length === 0) {
        setNotification({
          isOpen: true,
          type: 'warning',
          message: 'El archivo no contiene datos válidos.',
          title: 'Archivo vacío'
        });
        setIsLoadingProperties(false);
        return;
      }

      // Mapear datos importados a propiedades
      let successCount = 0;
      let errorCount = 0;

      for (const row of importedData) {
        try {
          // Mapear columnas comunes (flexible)
          const propertyData = {
            companyId,
            title: row['Título'] || row['Title'] || row['Nombre'] || row['title'] || row['nombre'] || 'Propiedad sin título',
            description: row['Descripción'] || row['Description'] || row['description'] || row['descripcion'] || '',
            type: (row['Tipo'] || row['Type'] || row['type'] || 'Venta') as 'Venta' | 'Alquiler',
            price: parseFloat(row['Precio'] || row['Price'] || row['price'] || row['Precio'] || '0') || 0,
            zone: row['Zona'] || row['Zone'] || row['zone'] || availableZones[0] || '',
            bedrooms: row['Habitaciones'] || row['Bedrooms'] || row['bedrooms'] || row['Habitaciones'] ? parseInt(row['Habitaciones'] || row['Bedrooms'] || row['bedrooms']) : null,
            bathrooms: row['Baños'] || row['Bathrooms'] || row['bathrooms'] || row['Baños'] ? parseFloat(row['Baños'] || row['Bathrooms'] || row['bathrooms']) : null,
            areaM2: row['Área'] || row['Area'] || row['area'] || row['m2'] || row['Área'] ? parseFloat(row['Área'] || row['Area'] || row['area'] || row['m2']) : null,
            images: [],
            address: row['Dirección'] || row['Address'] || row['address'] || row['Dirección'] || '',
            features: [],
            status: 'Activa' as Property['status'],
            highDemand: false,
            demandVisits: 0,
            priceAdjusted: false,
            priceAdjustmentPercent: 0
          };

          if (propertyData.price > 0 && propertyData.zone) {
            await saveProperty(propertyData);
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error importando propiedad:', error);
          errorCount++;
        }
      }

      // Recargar propiedades
      const props = await getPropertiesByCompany(companyId);
      setProperties(props);

      setIsLoadingProperties(false);

      setNotification({
        isOpen: true,
        type: successCount > 0 ? 'success' : 'error',
        message: successCount > 0 
          ? `Se importaron ${successCount} propiedades exitosamente${errorCount > 0 ? `. ${errorCount} propiedades tuvieron errores.` : '.'}`
          : `No se pudieron importar las propiedades. Verifica el formato del archivo.`,
        title: successCount > 0 ? 'Importación exitosa' : 'Error en importación'
      });

    } catch (error) {
      console.error('Error importando propiedades:', error);
      setIsLoadingProperties(false);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al importar el archivo. Verifica que sea un Excel o CSV válido.',
        title: 'Error de importación'
      });
    }
  };

  // Load properties for selected prospect
  useEffect(() => {
    const loadProspectProperties = async () => {
      if (selectedProspect) {
        setIsLoadingProspectProperties(true);
        try {
          const props = await getPropertyInterestsByProspect(selectedProspect.id);
          setProspectInterestedProperties(props);
        } catch (e) {
          console.error("Error loading prospect properties:", e);
        } finally {
          setIsLoadingProspectProperties(false);
        }
      } else {
        setProspectInterestedProperties([]);
      }
    };
    loadProspectProperties();
  }, [selectedProspect]);

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
      setNotification({
        isOpen: true,
        type: 'warning',
        message: 'No hay datos para exportar con los filtros seleccionados.',
        title: 'Sin datos'
      });
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
      setNotification({
        isOpen: true,
        type: 'warning',
        message: 'No hay datos para exportar con los filtros seleccionados.',
        title: 'Sin datos'
      });
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
        <div className="flex justify-center mb-6 sm:mb-10">
          <div className="bg-white p-1 sm:p-1.5 rounded-2xl shadow-sm border border-gray-100 inline-flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${
                activeTab === 'dashboard' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard size={14} className="sm:w-4 sm:h-4" /> <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${
                activeTab === 'prospects' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users size={14} className="sm:w-4 sm:h-4" /> <span>Prospectos</span>
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${
                activeTab === 'properties' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building size={14} className="sm:w-4 sm:h-4" /> <span>{isPromotora ? 'Proyectos' : 'Propiedades'}</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${
                activeTab === 'settings' 
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Settings size={14} className="sm:w-4 sm:h-4" /> <span>Configuración</span>
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

            {/* Card 4: Top Zones (solo para Broker) */}
            {!isPromotora && (
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
            )}
          </div>
        ) : activeTab === 'properties' ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Gestión de {isPromotora ? 'Proyectos' : 'Propiedades'}</h2>
                <p className="text-gray-500 text-sm">Administra los {isPromotora ? 'proyectos' : 'propiedades'} que se mostrarán a tus prospectos</p>
              </div>
              {companyData?.plan === 'Wolf of Wallstreet' ? (
                <button
                  onClick={() => {
                    if (isPromotora) {
                      setShowProjectSelectionModal(true);
                    } else {
                      setShowPropertySelectionModal(true);
                    }
                  }}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Plus size={18} /> Agregar {isPromotora ? 'Proyecto' : 'Propiedad'}
                </button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Necesitas el plan <strong>"Wolf of Wallstreet"</strong> para gestionar {isPromotora ? 'proyectos' : 'propiedades'}
                  </p>
                </div>
              )}
            </div>

            {/* Properties List */}
            {isLoadingProperties ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-gray-500 mt-4">Cargando {isPromotora ? 'proyectos' : 'propiedades'}...</p>
              </div>
            ) : (isPromotora ? projects.length === 0 : properties.length === 0) ? (
              <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100">
                <Building size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No hay {isPromotora ? 'proyectos' : 'propiedades'} registrados</h3>
                <p className="text-gray-500 mb-6">Comienza agregando tu primer {isPromotora ? 'proyecto' : 'propiedad'} para mostrarlo a los prospectos</p>
                {companyData?.plan === 'Wolf of Wallstreet' && (
                  <button
                    onClick={() => {
                      if (isPromotora) {
                        setShowProjectSelectionModal(true);
                      } else {
                        setShowPropertySelectionModal(true);
                      }
                    }}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Agregar Primer {isPromotora ? 'Proyecto' : 'Propiedad'}
                  </button>
                )}
              </div>
            ) : isPromotora ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {project.images && project.images.length > 0 ? (
                        <img 
                          src={project.images[0]} 
                          alt={project.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                          <Building size={48} />
                        </div>
                      )}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${
                        project.status === 'Activo' ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'
                      }`}>
                        {project.status}
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-gray-900 mb-1 text-lg">{project.name}</h4>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-3">
                        <MapPin size={14} />
                        <span>{project.zone}</span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
                      )}
                      <div className="pt-3 border-t border-gray-100 mb-3">
                        <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Modelos</div>
                        <div className="text-lg font-bold text-indigo-600">{project.models?.length || 0} {project.models?.length === 1 ? 'modelo' : 'modelos'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProjectForEdit(project);
                            setShowProjectModal(true);
                          }}
                          className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-100 transition-colors text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
                              const success = await deleteProject(project.id);
                              if (success) {
                                const companyId = localStorage.getItem('companyId');
                                if (companyId) {
                                  const projs = await getProjectsByCompany(companyId);
                                  setProjects(projs);
                                  setNotification({
                                    isOpen: true,
                                    type: 'success',
                                    message: 'Proyecto eliminado exitosamente',
                                    title: 'Éxito'
                                  });
                                }
                              } else {
                                setNotification({
                                  isOpen: true,
                                  type: 'error',
                                  message: 'Error al eliminar el proyecto',
                                  title: 'Error'
                                });
                              }
                            }
                          }}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors text-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all group"
                  >
                    {/* Imagen */}
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                          <Building size={48} className="text-indigo-300" />
                        </div>
                      )}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white ${
                        property.type === 'Venta' ? 'bg-purple-600' : 'bg-green-600'
                      }`}>
                        {property.type}
                      </div>
                      <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-semibold ${
                        property.status === 'Activa' ? 'bg-green-50 text-green-700' :
                        property.status === 'Vendida' ? 'bg-gray-100 text-gray-600' :
                        property.status === 'Alquilada' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {property.status}
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="p-5">
                      <h4 className="font-bold text-gray-900 mb-2 text-lg">{property.title}</h4>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                        <MapPin size={14} />
                        <span>{property.zone}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        {property.bedrooms && (
                          <div className="flex items-center gap-1.5">
                            <BedDouble size={16} className="text-gray-400" />
                            <span>{property.bedrooms}</span>
                          </div>
                        )}
                        {property.bathrooms && (
                          <div className="flex items-center gap-1.5">
                            <Bath size={16} className="text-gray-400" />
                            <span>{property.bathrooms}</span>
                          </div>
                        )}
                        {property.areaM2 && (
                          <div className="text-gray-400">
                            {property.areaM2}m²
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                          <div className="text-xl font-bold text-gray-900">{formatCurrency(property.price)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedPropertyForEdit(property);
                              setShowPropertyModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Settings size={18} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Estás seguro de eliminar esta propiedad?')) {
                                const success = await deleteProperty(property.id);
                                if (success) {
                                  setProperties(properties.filter(p => p.id !== property.id));
                                }
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Property Interests Section */}
            {propertyInterests.length > 0 && (
              <div className="mt-12 bg-white rounded-[2rem] p-8 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Intereses de Prospectos</h3>
                <div className="space-y-4">
                  {propertyInterests.map((interest) => (
                    <div key={interest.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{interest.prospect?.name}</div>
                        <div className="text-sm text-gray-500">{interest.prospect?.email}</div>
                        <div className="text-xs text-gray-400 mt-1">Interesado en: {interest.property?.title}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-indigo-600">{formatCurrency(interest.property?.price || 0)}</div>
                        <div className="text-xs text-gray-400">{new Date(interest.createdAt || '').toLocaleDateString('es-PA')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              
              {/* Plan Selection */}
              <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ShieldCheck size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Plan de Suscripción</h3>
                    <p className="text-sm text-gray-500">Elige el plan que mejor se adapte a tus necesidades.</p>
                  </div>
                </div>

                <div className="p-8">
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        const companyId = localStorage.getItem('companyId');
                        if (companyId) {
                          const success = await updateCompanyPlan(companyId, 'Freshie');
                          if (success && companyData) {
                            setCompanyData({ ...companyData, plan: 'Freshie' });
                          }
                        }
                      }}
                      className={`p-6 rounded-2xl border-2 transition-all text-left ${
                        companyData?.plan === 'Freshie'
                          ? 'border-indigo-500 bg-indigo-50/30 shadow-lg'
                          : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/20'
                      }`}
                    >
                      <div className="font-bold text-xl text-gray-900 mb-2">Plan Freshie</div>
                      <div className="text-sm text-gray-600 mb-4">Plan gratuito con funciones básicas</div>
                      <div className="space-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-500" />
                          <span>Gestión de prospectos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-500" />
                          <span>Dashboard de análisis</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <X size={16} className="text-gray-300" />
                          <span className="text-gray-400">Gestión de propiedades</span>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="text-3xl font-bold text-gray-900">$0.00</div>
                        <div className="text-sm text-gray-500">/ mes</div>
                      </div>
                      {companyData?.plan === 'Freshie' && (
                        <div className="mt-4 text-xs font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full inline-block">
                          Plan Actual
                        </div>
                      )}
                    </button>

                    <button
                      onClick={async () => {
                        const companyId = localStorage.getItem('companyId');
                        if (companyId) {
                          const success = await updateCompanyPlan(companyId, 'Wolf of Wallstreet');
                          if (success && companyData) {
                            setCompanyData({ ...companyData, plan: 'Wolf of Wallstreet' });
                            // Recargar propiedades si cambia a premium
                            if (activeTab === 'properties') {
                              const props = await getPropertiesByCompany(companyId);
                              setProperties(props);
                            }
                          }
                        }
                      }}
                      className={`p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
                        companyData?.plan === 'Wolf of Wallstreet'
                          ? 'border-purple-500 bg-purple-50/30 shadow-lg'
                          : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50/20'
                      }`}
                    >
                      {companyData?.plan === 'Wolf of Wallstreet' && (
                        <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Premium
                        </div>
                      )}
                      <div className="font-bold text-xl text-gray-900 mb-2">Plan Wolf of Wallstreet</div>
                      <div className="text-sm text-gray-600 mb-4">Plan premium con todas las funciones</div>
                      <div className="space-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-500" />
                          <span>Todas las funciones del plan Freshie</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-purple-500" />
                          <span className="font-semibold text-purple-600">Gestión de propiedades</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-purple-500" />
                          <span className="font-semibold text-purple-600">Mostrar propiedades a prospectos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-purple-500" />
                          <span className="font-semibold text-purple-600">Seguimiento de intereses</span>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="text-3xl font-bold text-gray-900">$6.99</div>
                        <div className="text-sm text-gray-500">/ mes</div>
                      </div>
                      {companyData?.plan === 'Wolf of Wallstreet' && (
                        <div className="mt-4 text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full inline-block">
                          Plan Actual
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
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
                            setNotification({
                              isOpen: true,
                              type: 'warning',
                              message: 'El logo debe ser menor a 2MB.',
                              title: 'Archivo muy grande'
                            });
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
                                setNotification({
                                  isOpen: true,
                                  type: 'error',
                                  message: 'No se encontró el ID de la empresa. Por favor, inicia sesión nuevamente.',
                                  title: 'Error de sesión'
                                });
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
                                setNotification({
                                  isOpen: true,
                                  type: 'error',
                                  message: 'Error al actualizar el logo. Por favor intenta de nuevo.',
                                  title: 'Error al actualizar'
                                });
                              }
                              
                              setIsUpdatingLogo(false);
                            };
                            reader.onerror = () => {
                              setNotification({
                                isOpen: true,
                                type: 'error',
                                message: 'Error al leer el archivo. Verifica que sea una imagen válida.',
                                title: 'Error de archivo'
                              });
                              setIsUpdatingLogo(false);
                            };
                          } catch (error) {
                            console.error('Error actualizando logo:', error);
                            setNotification({
                              isOpen: true,
                              type: 'error',
                              message: 'Error al actualizar el logo. Por favor intenta de nuevo.',
                              title: 'Error al actualizar'
                            });
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

            {/* Table / Cards */}
            <div className="flex-1">
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
                <>
                  {/* Mobile Cards View */}
                  <div className="block md:hidden space-y-4 p-4">
                    {prospects.map((prospect) => (
                      <div
                        key={prospect.id}
                        onClick={() => setSelectedProspect(prospect)}
                        className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-base mb-1">{prospect.name}</h3>
                            <p className="text-xs text-gray-400">{prospect.email}</p>
                          </div>
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                            {formatCurrency(prospect.result?.maxPropertyPrice || 0)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Ingreso Mensual</p>
                            <p className="font-semibold text-gray-900 text-sm">{formatCurrency(prospect.income)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fecha</p>
                            <p className="font-semibold text-gray-900 text-sm">{prospect.dateDisplay || new Date(prospect.date).toLocaleDateString('es-PA')}</p>
                          </div>
                        </div>
                        
                        {prospect.zone && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-gray-400 shrink-0" />
                              <p className="text-xs text-gray-500 mb-1">Zona de Interés</p>
                            </div>
                            <p className="text-sm text-gray-700 font-medium mt-1">
                              {Array.isArray(prospect.zone) ? prospect.zone.join(', ') : (typeof prospect.zone === 'string' ? prospect.zone : 'Sin zona')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-wider">
                          <th className="px-4 sm:px-8 py-4 sm:py-6 font-semibold rounded-tl-[2rem]">Prospecto</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold">Ingreso</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold">Capacidad</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold">Zona</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {prospects.map((prospect) => (
                          <tr 
                            key={prospect.id} 
                            onClick={() => setSelectedProspect(prospect)}
                            className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                          >
                            <td className="px-4 sm:px-8 py-4 sm:py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">{prospect.name}</span>
                            <span className="text-xs text-gray-400">{prospect.email}</span>
                          </div>
                        </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5">
                              <span className="font-medium text-gray-700 text-sm">{formatCurrency(prospect.income)}</span>
                        </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 sm:px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                            {formatCurrency(prospect.result?.maxPropertyPrice || 0)}
                          </span>
                        </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5">
                          <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-600 font-medium truncate max-w-[150px]">
                                  {Array.isArray(prospect.zone) ? prospect.zone.join(', ') : (typeof prospect.zone === 'string' ? prospect.zone : 'Sin zona')}
                                </span>
                          </div>
                        </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5">
                              <span className="text-sm text-gray-500 whitespace-nowrap">{prospect.dateDisplay || new Date(prospect.date).toLocaleDateString('es-PA')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  </div>
                </>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-colors ${
                    exportFilterType === 'all'
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    exportFilterType === 'all' ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {exportFilterType === 'all' && (
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-semibold text-xs sm:text-sm ${
                    exportFilterType === 'all' ? 'text-gray-900' : 'text-gray-600'
                  }`}>Toda la base de datos</span>
                </label>
                
                <label 
                  onClick={() => setExportFilterType('dateRange')}
                  className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-colors ${
                    exportFilterType === 'dateRange'
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    exportFilterType === 'dateRange' ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {exportFilterType === 'dateRange' && (
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-medium text-xs sm:text-sm ${
                    exportFilterType === 'dateRange' ? 'text-gray-900' : 'text-gray-600'
                  }`}>Filtrar por rango de fechas</span>
                </label>
              </div>

              {/* Date Range Filter */}
              {exportFilterType === 'dateRange' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fade-in-up z-10 m-4">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-indigo-400 to-purple-400 rounded-t-[2rem] p-4 sm:p-6 pr-16 sm:pr-20 relative">
              <button 
                onClick={() => setSelectedProspect(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors z-10 hover:opacity-70"
              >
                <X size={10} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-8">
              {/* Prospect Header */}
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 flex items-center justify-center text-xl sm:text-2xl font-bold text-gray-600 shrink-0 mx-auto sm:mx-0">
                  {selectedProspect.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{selectedProspect.name}</h2>
                </div>
              </div>

              {/* Financial Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Interés en Propiedades Section */}
              {prospectInterestedProperties.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Heart size={20} className="text-pink-500" />
                    Interés en Propiedades
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {prospectInterestedProperties.map((property) => (
                      <div
                        key={property.id}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      >
                        {/* Imagen */}
                        <div className="relative h-40 bg-gray-100 overflow-hidden">
                          {property.images && property.images.length > 0 ? (
                            <img
                              src={property.images[0]}
                              alt={property.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                              <Building size={32} className="text-indigo-300" />
                            </div>
                          )}
                          <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white ${
                            property.type === 'Venta' ? 'bg-purple-600' : 'bg-green-600'
                          }`}>
                            {property.type}
                          </div>
                        </div>

                        {/* Contenido */}
                        <div className="p-4">
                          <h4 className="font-bold text-gray-900 mb-2 text-sm line-clamp-1">{property.title}</h4>
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-3">
                            <MapPin size={12} />
                            <span className="truncate">{property.zone}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
                            {property.bedrooms && (
                              <div className="flex items-center gap-1">
                                <BedDouble size={14} className="text-gray-400" />
                                <span>{property.bedrooms}</span>
                              </div>
                            )}
                            {property.bathrooms && (
                              <div className="flex items-center gap-1">
                                <Bath size={14} className="text-gray-400" />
                                <span>{property.bathrooms}</span>
                              </div>
                            )}
                            {property.areaM2 && (
                              <span className="text-gray-400">
                                {property.areaM2}m²
                              </span>
                            )}
                          </div>

                          <div className="pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                            <div className="text-lg font-bold text-indigo-600">{formatCurrency(property.price)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state for properties */}
              {isLoadingProspectProperties && (
                <div className="mb-8 text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  <p className="text-gray-500 mt-3 text-sm">Cargando propiedades de interés...</p>
                </div>
              )}

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
          <div className="bg-white rounded-[2rem] w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl relative z-10 flex flex-col m-4">
            {/* Header */}
            <div className="bg-gray-900 text-white p-4 sm:p-6 flex items-center justify-between gap-4">
              <h3 className="text-sm sm:text-lg font-bold truncate">{selectedDocument.name}</h3>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
                  className="px-3 sm:px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 flex items-center gap-2 transition-colors text-xs sm:text-sm font-semibold"
                >
                  <Download size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Descargar</span>
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

      {/* Modal de Selección: Manual o Importar (Solo para Propiedades/Broker) */}
      {showPropertySelectionModal && !isPromotora && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
            
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-60 pointer-events-none"></div>

            {/* Close Button */}
            <button
              onClick={() => setShowPropertySelectionModal(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-20"
            >
              <X size={20} className="text-gray-600" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center mb-12">
              {/* Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-200 transform rotate-3 hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl font-bold text-white tracking-tighter">ê</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Agregar Propiedades</h1>
              <p className="text-gray-500 text-lg leading-relaxed max-w-lg mx-auto font-light">
                Elige cómo deseas agregar propiedades a tu catálogo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-10">
              {/* Botón: Agregar Manualmente */}
              <button
                onClick={() => {
                  setShowPropertySelectionModal(false);
                  setTimeout(() => {
                    setSelectedPropertyForEdit(null);
                    setShowPropertyModal(true);
                  }, 300);
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 text-gray-900 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  <Plus size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Agregar Propiedad Manual</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4">
                  Crea una propiedad nueva completando el formulario paso a paso.
                </p>
                
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Comenzar ahora <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>

              {/* Botón: Importar desde Excel/CSV */}
              <button
                onClick={() => {
                  // Trigger file input
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls,.csv';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      await handleImportProperties(file);
                      setShowPropertySelectionModal(false);
                    }
                  };
                  input.click();
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-gray-50/30 hover:border-purple-500 hover:bg-purple-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-purple-200 group-hover:bg-white group-hover:text-purple-600 transition-all duration-300 group-hover:scale-110">
                  <Download size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-900 transition-colors">Importar Propiedades</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4 group-hover:text-gray-600 transition-colors">
                  Importa múltiples propiedades desde un archivo Excel o CSV.
                </p>

                <div className="flex items-center gap-2 text-purple-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Seleccionar archivo <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl -mr-16 -mb-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear/Editar Propiedad (Broker) */}
      {showPropertyModal && !isPromotora && (
        <PropertyModal
          property={selectedPropertyForEdit}
          companyId={localStorage.getItem('companyId') || ''}
          zones={availableZones}
          onClose={() => {
            setShowPropertyModal(false);
            setSelectedPropertyForEdit(null);
          }}
          onSave={async (propertyData) => {
            const companyId = localStorage.getItem('companyId');
            if (!companyId) return;

            if (selectedPropertyForEdit) {
              // Actualizar
              await updateProperty(selectedPropertyForEdit.id, propertyData);
            } else {
              // Crear
              await saveProperty({ ...propertyData, companyId });
            }
            
            // Recargar propiedades
            const props = await getPropertiesByCompany(companyId);
            setProperties(props);
            setShowPropertyModal(false);
            setSelectedPropertyForEdit(null);
          }}
        />
      )}

      {/* Modal de Selección: Manual o Importar (Proyectos) */}
      {showProjectSelectionModal && isPromotora && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-60 pointer-events-none"></div>

            {/* Close Button */}
            <button
              onClick={() => setShowProjectSelectionModal(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-20"
            >
              <X size={20} className="text-gray-600" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center mb-12">
              {/* Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-200 transform rotate-3 hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl font-bold text-white tracking-tighter">ê</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Agregar Proyectos</h1>
              <p className="text-gray-500 text-lg leading-relaxed max-w-lg mx-auto font-light">
                Elige cómo deseas agregar proyectos a tu catálogo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-10">
              {/* Botón: Agregar Manualmente */}
              <button
                onClick={() => {
                  setShowProjectSelectionModal(false);
                  setTimeout(() => {
                    setSelectedProjectForEdit(null);
                    setShowProjectModal(true);
                  }, 300);
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 text-gray-900 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  <Plus size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Agregar Proyecto Manual</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4">
                  Crea un proyecto nuevo completando el formulario paso a paso.
                </p>

                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Comenzar ahora <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>

              {/* Botón: Importar desde Excel/CSV */}
              <button
                onClick={() => {
                  // TODO: Implementar importación de proyectos
                  setNotification({
                    isOpen: true,
                    type: 'info',
                    message: 'La importación de proyectos estará disponible pronto',
                    title: 'Próximamente'
                  });
                  setShowProjectSelectionModal(false);
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-gray-50/30 hover:border-purple-500 hover:bg-purple-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-purple-200 group-hover:bg-white group-hover:text-purple-600 transition-all duration-300 group-hover:scale-110">
                  <Download size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-900 transition-colors">Importar Proyectos</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4 group-hover:text-gray-600 transition-colors">
                  Importa múltiples proyectos desde un archivo Excel o CSV.
                </p>

                <div className="flex items-center gap-2 text-purple-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Seleccionar archivo <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl -mr-16 -mb-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear/Editar Proyecto (Promotora) */}
      {showProjectModal && isPromotora && (
        <ProjectModal
          project={selectedProjectForEdit}
          companyId={localStorage.getItem('companyId') || ''}
          zones={availableZones}
          onClose={() => {
            setShowProjectModal(false);
            setSelectedProjectForEdit(null);
          }}
          onSave={async (projectData) => {
            const companyId = localStorage.getItem('companyId');
            if (!companyId) return;

            if (selectedProjectForEdit) {
              // Actualizar
              await updateProject(selectedProjectForEdit.id, projectData);
            } else {
              // Crear
              await saveProject({ ...projectData, companyId });
            }
            
            // Recargar proyectos
            const projs = await getProjectsByCompany(companyId);
            setProjects(projs);
            setShowProjectModal(false);
            setSelectedProjectForEdit(null);
          }}
        />
      )}
    </>
  );
};

// Componente Modal para Crear/Editar Propiedad
interface PropertyModalProps {
  property: Property | null;
  companyId: string;
  zones: string[];
  onClose: () => void;
  onSave: (property: Omit<Property, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => void;
}

const PropertyModal: React.FC<PropertyModalProps> = ({ property, zones, onClose, onSave }) => {
  const [title, setTitle] = useState(property?.title || '');
  const [description, setDescription] = useState(property?.description || '');
  const [type, setType] = useState<'Venta' | 'Alquiler'>(property?.type || 'Venta');
  const [price, setPrice] = useState(property?.price?.toString() || '');
  const [zone, setZone] = useState(property?.zone || zones[0] || '');
  const [bedrooms, setBedrooms] = useState(property?.bedrooms?.toString() || '');
  const [bathrooms, setBathrooms] = useState(property?.bathrooms?.toString() || '');
  const [areaM2, setAreaM2] = useState(property?.areaM2?.toString() || '');
  const [images, setImages] = useState<string[]>(property?.images || []);
  const [address, setAddress] = useState(property?.address || '');
  const [status, setStatus] = useState<'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada'>(property?.status || 'Activa');
  const [highDemand, setHighDemand] = useState(property?.highDemand || false);
  const [demandVisits, setDemandVisits] = useState(property?.demandVisits?.toString() || '0');
  const [priceAdjusted, setPriceAdjusted] = useState(property?.priceAdjusted || false);
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState(property?.priceAdjustmentPercent?.toString() || '0');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newImages.push(base64);
        if (newImages.length === files.length) {
          setImages([...images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      title,
      description,
      type,
      price: parseFloat(price) || 0,
      zone,
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseFloat(bathrooms) : null,
      areaM2: areaM2 ? parseFloat(areaM2) : null,
      images,
      address,
      features: [],
      status,
      highDemand,
      demandVisits: parseInt(demandVisits) || 0,
      priceAdjusted,
      priceAdjustmentPercent: parseFloat(priceAdjustmentPercent) || 0
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
          <h3 className="text-2xl font-bold text-gray-900">{property ? 'Editar Propiedad' : 'Nueva Propiedad'}</h3>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
              placeholder="Ej: PH Santa Maria Court"
            />
          </div>

          {/* Tipo y Precio */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'Venta' | 'Alquiler')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
              >
                <option value="Venta">Venta</option>
                <option value="Alquiler">Alquiler</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Precio *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Zona y Dirección */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Zona *</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
              >
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
                placeholder="Dirección completa"
              />
            </div>
          </div>

          {/* Habitaciones, Baños, Área */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Habitaciones</label>
              <input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
                placeholder="3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Baños</label>
              <input
                type="number"
                step="0.5"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
                placeholder="2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Área (m²)</label>
              <input
                type="number"
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
                placeholder="120"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
              placeholder="Describe la propiedad..."
            />
          </div>

          {/* Imágenes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Imágenes</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
            />
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img src={img} alt={`Imagen ${idx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estado y Opciones */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Property['status'])}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none"
              >
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
                <option value="Vendida">Vendida</option>
                <option value="Alquilada">Alquilada</option>
              </select>
            </div>
          </div>

          {/* Opciones adicionales */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={highDemand}
                onChange={(e) => setHighDemand(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600"
              />
              <span className="text-sm font-medium text-gray-700">Alta Demanda</span>
            </label>
            {highDemand && (
              <div className="ml-8">
                <label className="block text-sm text-gray-600 mb-1">Visitas esta semana</label>
                <input
                  type="number"
                  value={demandVisits}
                  onChange={(e) => setDemandVisits(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200"
                />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={priceAdjusted}
                onChange={(e) => setPriceAdjusted(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600"
              />
              <span className="text-sm font-medium text-gray-700">Precio Ajustado</span>
            </label>
            {priceAdjusted && (
              <div className="ml-8">
                <label className="block text-sm text-gray-600 mb-1">% bajo mercado</label>
                <input
                  type="number"
                  value={priceAdjustmentPercent}
                  onChange={(e) => setPriceAdjustmentPercent(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title || !price || !zone}
              className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {property ? 'Guardar Cambios' : 'Crear Propiedad'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente Modal para Crear/Editar Proyecto (Paso a Paso) - Promotora
interface ProjectModalProps {
  project?: Project | null;
  companyId: string;
  zones: string[];
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ project, zones, onClose, onSave }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [zone, setZone] = useState(project?.zone || zones[0] || '');
  const [address, setAddress] = useState(project?.address || '');
  const [projectImages, setProjectImages] = useState<string[]>(project?.images || []);
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(project?.status || 'Activo');
  const [models, setModels] = useState<ProjectModel[]>(project?.models || []);
  const [currentModel, setCurrentModel] = useState<ProjectModel>({
    name: '',
    areaM2: null,
    bedrooms: null,
    bathrooms: null,
    amenities: [],
    unitsTotal: 0,
    unitsAvailable: 0,
    price: 0,
    images: []
  });
  const [newAmenity, setNewAmenity] = useState('');

  const handleProjectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newImages.push(base64);
        if (newImages.length === files.length) {
          setProjectImages([...projectImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newImages.push(base64);
        if (newImages.length === files.length) {
          setCurrentModel({ ...currentModel, images: [...currentModel.images, ...newImages] });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addModel = () => {
    if (!currentModel.name || currentModel.unitsTotal === 0 || currentModel.price === 0) {
      return;
    }
    setModels([...models, { ...currentModel }]);
    setCurrentModel({
      name: '',
      areaM2: null,
      bedrooms: null,
      bathrooms: null,
      amenities: [],
      unitsTotal: 0,
      unitsAvailable: 0,
      price: 0,
      images: []
    });
    setNewAmenity('');
  };

  const removeModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    if (newAmenity.trim() && !currentModel.amenities?.includes(newAmenity.trim())) {
      setCurrentModel({
        ...currentModel,
        amenities: [...(currentModel.amenities || []), newAmenity.trim()]
      });
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity: string) => {
    setCurrentModel({
      ...currentModel,
      amenities: currentModel.amenities?.filter(a => a !== amenity) || []
    });
  };

  const handleSave = () => {
    if (!name || !zone || models.length === 0) {
      return;
    }
    onSave({
      companyId: '',
      name,
      description,
      zone,
      address,
      images: projectImages,
      status,
      models
    });
  };

  const totalSteps = 3;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{project ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
            <div className="flex gap-2 mt-2">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx + 1 <= step ? 'bg-indigo-600 w-8' : 'bg-gray-200 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* PASO 1: Información Básica del Proyecto */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in-up max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Información del Proyecto</h2>
                <p className="text-gray-500">Completa los datos básicos de tu proyecto</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building size={16} className="text-indigo-500" />
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                  placeholder="Ej: Edificio Residencial Los Pinos"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none resize-none"
                  rows={4}
                  placeholder="Describe el proyecto..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <MapPin size={16} className="text-indigo-500" />
                  Zona *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {zones.map(z => (
                    <button
                      key={z}
                      onClick={() => setZone(z)}
                      className={`px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 border flex items-center justify-center ${
                        zone === z
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.02]'
                          : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600'
                      }`}
                    >
                      {zone === z && <Check size={14} className="mr-2" />}
                      {z}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                  placeholder="Dirección completa"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4">Estado *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setStatus('Activo')}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      status === 'Activo'
                        ? 'border-green-500 bg-green-50 shadow-lg scale-[1.02]'
                        : 'border-gray-100 bg-white hover:border-green-200 hover:shadow-md'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                      status === 'Activo' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Activo</h4>
                    <p className="text-sm text-gray-500">Proyecto disponible</p>
                  </button>
                  <button
                    onClick={() => setStatus('Inactivo')}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      status === 'Inactivo'
                        ? 'border-gray-400 bg-gray-50 shadow-lg scale-[1.02]'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                      status === 'Inactivo' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <X size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Inactivo</h4>
                    <p className="text-sm text-gray-500">Proyecto pausado</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ImageIcon size={16} className="text-indigo-500" />
                  Imágenes del Proyecto
                </label>
                <label className="block w-full px-5 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer text-center">
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <span className="text-sm text-gray-600">Haz clic para subir imágenes</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleProjectImageUpload}
                    className="hidden"
                  />
                </label>
                {projectImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {projectImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Proyecto ${idx + 1}`} className="w-full h-24 object-cover rounded-xl" />
                        <button
                          onClick={() => setProjectImages(projectImages.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASO 2: Agregar Modelos */}
          {step === 2 && (
            <div className="space-y-8 animate-fade-in-up max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Agregar Modelos</h2>
                <p className="text-gray-500">Define los modelos disponibles en tu proyecto</p>
              </div>

              {/* Formulario de Modelo Actual */}
              <div className="bg-gray-50/50 p-8 rounded-2xl border border-gray-100 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Building size={16} className="text-indigo-500" />
                    Nombre del Modelo *
                  </label>
                  <input
                    type="text"
                    value={currentModel.name}
                    onChange={(e) => setCurrentModel({ ...currentModel, name: e.target.value })}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                    placeholder="Ej: Modelo A - 2BR"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign size={16} className="text-indigo-500" />
                    Precio *
                  </label>
                  <input
                    type="number"
                    value={currentModel.price || ''}
                    onChange={(e) => setCurrentModel({ ...currentModel, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Target size={14} className="text-gray-400" />
                      Área (m²)
                    </label>
                    <input
                      type="number"
                      value={currentModel.areaM2 || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, areaM2: parseFloat(e.target.value) || null })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <BedDouble size={14} className="text-gray-400" />
                      Habitaciones
                    </label>
                    <input
                      type="number"
                      value={currentModel.bedrooms || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, bedrooms: parseInt(e.target.value) || null })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Bath size={14} className="text-gray-400" />
                      Baños
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentModel.bathrooms || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, bathrooms: parseFloat(e.target.value) || null })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Users size={14} className="text-gray-400" />
                      Unidades *
                    </label>
                    <input
                      type="number"
                      value={currentModel.unitsTotal || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, unitsTotal: parseInt(e.target.value) || 0, unitsAvailable: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-indigo-500" />
                    Amenidades
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAmenity()}
                      className="flex-1 px-5 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white"
                      placeholder="Ej: Piscina, Gimnasio..."
                    />
                    <button
                      onClick={addAmenity}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {currentModel.amenities && currentModel.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {currentModel.amenities.map((amenity, idx) => (
                        <span
                          key={idx}
                          className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium flex items-center gap-2"
                        >
                          {amenity}
                          <button onClick={() => removeAmenity(amenity)} className="text-indigo-500 hover:text-indigo-700">
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ImageIcon size={16} className="text-indigo-500" />
                    Imágenes del Modelo
                  </label>
                  <label className="block w-full px-5 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer text-center">
                    <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-600">Haz clic para subir imágenes</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleModelImageUpload}
                      className="hidden"
                    />
                  </label>
                  {currentModel.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {currentModel.images.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt={`Modelo ${idx + 1}`} className="w-full h-24 object-cover rounded-xl" />
                          <button
                            onClick={() => setCurrentModel({ ...currentModel, images: currentModel.images.filter((_, i) => i !== idx) })}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={addModel}
                  disabled={!currentModel.name || currentModel.unitsTotal === 0 || currentModel.price === 0}
                  className="w-full px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                >
                  <Plus size={20} className="inline mr-2" />
                  Agregar Modelo
                </button>
              </div>

              {/* Lista de Modelos Agregados */}
              {models.length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-semibold text-gray-700">Modelos Agregados ({models.length})</h5>
                  {models.map((model, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{model.name}</p>
                        <p className="text-sm text-gray-500">
                          {model.areaM2 ? `${model.areaM2}m² • ` : ''}
                          {model.bedrooms ? `${model.bedrooms} BR • ` : ''}
                          {model.bathrooms ? `${model.bathrooms} BA • ` : ''}
                          {formatCurrency(model.price)} • {model.unitsAvailable}/{model.unitsTotal} disponibles
                        </p>
                      </div>
                      <button
                        onClick={() => removeModel(idx)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PASO 3: Revisar y Guardar */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in-up">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Revisar Información</h4>

              <div className="bg-gray-50 p-6 rounded-xl space-y-4">
                <div>
                  <h5 className="font-semibold text-gray-700 mb-2">Información del Proyecto</h5>
                  <p><strong>Nombre:</strong> {name}</p>
                  <p><strong>Zona:</strong> {zone}</p>
                  {address && <p><strong>Dirección:</strong> {address}</p>}
                  {description && <p><strong>Descripción:</strong> {description}</p>}
                  <p><strong>Estado:</strong> {status}</p>
                  {projectImages.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold mb-2">Imágenes ({projectImages.length})</p>
                      <div className="grid grid-cols-4 gap-2">
                        {projectImages.map((img, idx) => (
                          <img key={idx} src={img} alt={`Proyecto ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h5 className="font-semibold text-gray-700 mb-2">Modelos ({models.length})</h5>
                  {models.map((model, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg mb-2">
                      <p className="font-semibold">{model.name}</p>
                      <p className="text-sm text-gray-600">
                        {model.areaM2 ? `${model.areaM2}m² • ` : ''}
                        {model.bedrooms ? `${model.bedrooms} BR • ` : ''}
                        {model.bathrooms ? `${model.bathrooms} BA • ` : ''}
                        Precio: {formatCurrency(model.price)} • {model.unitsAvailable}/{model.unitsTotal} disponibles
                      </p>
                      {model.amenities && model.amenities.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">Amenidades: {model.amenities.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navegación */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="text-gray-400 hover:text-gray-600 font-medium flex items-center justify-center gap-2 py-3 sm:py-0 order-2 sm:order-1"
              >
                <ChevronLeft size={20} /> Atrás
              </button>
            ) : (
              <div></div>
            )}
            {step < totalSteps ? (
              <button
                onClick={() => {
                  if (step === 1 && !name) return;
                  if (step === 2 && models.length === 0) return;
                  setStep(step + 1);
                }}
                disabled={(step === 1 && !name) || (step === 2 && models.length === 0)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl order-1 sm:order-2 w-full sm:w-auto ${
                  (step === 1 && name) || (step === 2 && models.length > 0)
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                Continuar <ArrowRight size={20} className="shrink-0" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!name || !zone || models.length === 0}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl order-1 sm:order-2 w-full sm:w-auto ${
                  name && zone && models.length > 0
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                Guardar Proyecto <Check size={20} className="shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};