import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PropertyType, UserPreferences, FinancialData, PersonalData, CalculationResult } from '../types';
import { calculateAffordability, formatCurrency } from '../utils/calculator';
import { saveProspectToDB, getCompanyById, getAvailablePropertiesForProspect, savePropertyInterest, getCompanyById as getCompany, saveProspectInitial, updateProspectToDB, getAvailableProjectsForProspect, saveProjectModelInterest } from '../utils/db';
import { Property, PlanType, Project, ProjectModel } from '../types';
import { 
  Home, Building2, MapPin, User, Upload, FileCheck, ArrowRight, CheckCircle2, Download, HeartHandshake, ChevronLeft, Check, BedDouble, Bath, Star, TrendingDown, X, Loader2, Heart
} from 'lucide-react';
import { NotificationModal, NotificationType } from './ui/NotificationModal';
import SignatureCanvas from 'react-signature-canvas';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb } from 'pdf-lib';

// Configurar worker de pdf.js para react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface ProspectFlowProps {
  availableZones: string[];
  companyName?: string;
  isEmbed?: boolean;
}

// Reusable Progress Dots Component
const ProgressDots = ({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) => {
  return (
    <div className="flex gap-3 mb-8 justify-center">
      {Array.from({ length: totalSteps }).map((_, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum <= currentStep;
        const isCurrent = stepNum === currentStep;
        
        return (
          <div 
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isActive ? 'bg-indigo-500' : 'bg-gray-200'
            } ${isCurrent ? 'w-8' : 'w-4'}`}
          />
        );
      })}
    </div>
  );
};

// Reusable File Upload Component with new style
const FileUpload = ({ label, file, setFile }: { label: string, file: File | null, setFile: (f: File | null) => void }) => (
  <div className="border border-dashed border-gray-300 rounded-2xl p-4 flex items-center hover:bg-indigo-50/30 transition-colors group cursor-pointer relative overflow-hidden bg-gray-50/50">
    <input 
      type="file" 
      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
      className="absolute inset-0 opacity-0 cursor-pointer z-10"
      accept="image/*,.pdf"
    />
    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-3 transition-colors ${file ? 'bg-green-100 text-green-600' : 'bg-white text-indigo-400 shadow-sm'}`}>
      {file ? <CheckCircle2 size={20} /> : <Upload size={20} />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-700 truncate">{label}</p>
      <p className="text-xs text-gray-400 truncate pr-2">
        {file ? file.name : 'Click para subir documento'}
      </p>
    </div>
  </div>
);

interface ApcSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullName: string;
  onSigned: (file: File) => void;
}

const ApcSignatureModal: React.FC<ApcSignatureModalProps> = ({ isOpen, onClose, fullName, onSigned }) => {
  const [name, setName] = useState(fullName || '');
  const [idNumber, setIdNumber] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const sigPadRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(fullName || '');
    }
  }, [isOpen, fullName]);

  const handleClear = () => {
    sigPadRef.current?.clear();
  };

  const handleConfirm = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      alert('Por favor firma en el recuadro antes de continuar.');
      return;
    }

    try {
      setIsSigning(true);

      // 1. Cargar PDF base de APC
      const existingPdfBytes = await fetch('/apc.pdf').then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // 2. Escribir nombre y cédula en una zona baja del PDF (coordenadas aproximadas)
      const textX = 120;
      let textY = 130;
      const fontSize = 10;

      if (name.trim()) {
        firstPage.drawText(name.trim(), {
          x: textX,
          y: textY,
          size: fontSize,
          color: rgb(0, 0, 0)
        });
        textY -= 14;
      }

      if (idNumber.trim()) {
        firstPage.drawText(idNumber.trim(), {
          x: textX,
          y: textY,
          size: fontSize,
          color: rgb(0, 0, 0)
        });
      }

      // 3. Insertar imagen de la firma
      const signatureDataUrl = sigPadRef.current.toDataURL('image/png');
      const base64 = signatureDataUrl.split(',')[1];
      const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const sigImage = await pdfDoc.embedPng(sigBytes);

      const sigWidth = 180;
      const sigHeight = 60;
      const sigX = textX;
      const sigY = 70;

      firstPage.drawImage(sigImage, {
        x: sigX,
        y: sigY,
        width: sigWidth,
        height: sigHeight
      });

      // 4. Guardar nuevo PDF como File
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'APC_Firmada.pdf', { type: 'application/pdf' });

      onSigned(file);
      onClose();
    } catch (error) {
      console.error('❌ Error generando PDF firmado:', error);
      alert('Ocurrió un error al generar el PDF firmado. Intenta nuevamente.');
    } finally {
      setIsSigning(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden z-10 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Firmar Autorización APC</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 grid md:grid-cols-[2fr,1.5fr] gap-4 p-6 overflow-y-auto">
          {/* Visor del PDF */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-3 flex items-center justify-center">
            <div className="w-full max-h-[70vh] overflow-auto flex justify-center">
              <Document file="/apc.pdf" loading={<div className="text-sm text-gray-500">Cargando PDF...</div>}>
                <Page pageNumber={1} width={500} />
              </Document>
            </div>
          </div>

          {/* Datos y firma */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Datos del titular</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Cédula / ID</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Ej: 8-888-888"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Firma del cliente</h3>
              <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-3">
                <SignatureCanvas
                  ref={sigPadRef}
                  penColor="#111827"
                  canvasProps={{
                    className: 'w-full h-32 bg-white rounded-xl'
                  }}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-[11px] text-gray-400">Firma dentro del recuadro</p>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-semibold text-gray-500 hover:text-indigo-600"
                  >
                    Borrar firma
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSigning}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSigning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generando PDF...
                  </>
                ) : (
                  <>
                    Firmar y adjuntar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ProspectFlow: React.FC<ProspectFlowProps> = ({ availableZones, companyName = "Krêdit", isEmbed = false }) => {
  const [step, setStep] = useState<number>(1);
  const [preferences, setPreferences] = useState<UserPreferences>({
    propertyType: PropertyType.Apartment,
    bedrooms: 2,
    bathrooms: 2,
    zone: [] // Initialized as empty array
  });
  const [financial, setFinancial] = useState<FinancialData>({ familyIncome: 0 });
  const [personal, setPersonal] = useState<PersonalData>({
    fullName: '',
    email: '',
    phone: '',
    idFile: null,
    fichaFile: null,
    talonarioFile: null,
    signedAcpFile: null
  });
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [zones, setZones] = useState<string[]>(availableZones);
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [availableProperties, setAvailableProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [companyPlan, setCompanyPlan] = useState<PlanType>('Freshie');
  const [companyRole, setCompanyRole] = useState<'Promotora' | 'Broker'>('Broker');
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [wantsValidation, setWantsValidation] = useState<boolean | null>(null); // null = no decidido, true = quiere validar, false = no quiere
  const [showApcModal, setShowApcModal] = useState(false);
  const [requestedDocuments, setRequestedDocuments] = useState<{
    idFile: boolean;
    fichaFile: boolean;
    talonarioFile: boolean;
    signedAcpFile: boolean;
  }>({
    idFile: true,
    fichaFile: true,
    talonarioFile: true,
    signedAcpFile: true
  });
  const [apcDocumentDriveId, setApcDocumentDriveId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; message: string; title?: string }>({
    isOpen: false,
    type: 'success',
    message: ''
  });
  const [hasSavedFinalData, setHasSavedFinalData] = useState(false); // Para rastrear si ya se guardaron los datos finales
  const isSavingRef = useRef(false); // Ref para evitar guardados simultáneos

  // Cargar logo y zonas de la empresa si hay company_id en la URL o localStorage
  useEffect(() => {
    const loadCompanyData = async () => {
      // Buscar company_id en la URL (para embed)
      const urlParams = new URLSearchParams(window.location.search);
      const companyIdFromUrl = urlParams.get('company_id');
      
      console.log('🔍 Buscando company_id:', {
        fromUrl: companyIdFromUrl,
        fromLocalStorage: localStorage.getItem('companyId'),
        isEmbed
      });
      
      // O usar el de localStorage (si está en modo embed desde el mismo dominio)
      const companyId = companyIdFromUrl || localStorage.getItem('companyId');
      
      if (companyId) {
        console.log('🔄 Cargando datos de empresa con ID:', companyId);
        try {
          const company = await getCompanyById(companyId);
          console.log('📋 Datos de empresa obtenidos:', {
            hasCompany: !!company,
            hasLogo: !!company?.logoUrl,
            hasZones: !!company?.zones,
            zonesCount: company?.zones?.length || 0,
            zones: company?.zones,
            logoUrlType: company?.logoUrl ? (company.logoUrl.startsWith('data:') ? 'base64' : company.logoUrl.startsWith('blob:') ? 'blob' : 'url') : 'none',
            logoUrlPreview: company?.logoUrl ? company.logoUrl.substring(0, 80) + '...' : 'none'
          });
          
          // Cargar logo
          if (company && company.logoUrl && company.logoUrl.trim() !== '' && company.logoUrl !== 'null') {
            setCompanyLogo(company.logoUrl);
            console.log('✅ Logo de empresa cargado y establecido');
          } else {
            console.warn('⚠️ Empresa encontrada pero sin logo válido');
          }

          // Cargar zonas
          if (company && company.zones && company.zones.length > 0) {
            setZones(company.zones);
            console.log('✅ Zonas de empresa cargadas:', company.zones);
          } else {
            console.warn('⚠️ Empresa encontrada pero sin zonas, usando zonas por defecto');
            setZones(availableZones);
          }

          // Cargar configuración de documentos solicitados
          if (company && company.requestedDocuments) {
            setRequestedDocuments({
              idFile: company.requestedDocuments.idFile !== false,
              fichaFile: company.requestedDocuments.fichaFile !== false,
              talonarioFile: company.requestedDocuments.talonarioFile !== false,
              signedAcpFile: company.requestedDocuments.signedAcpFile !== false
            });
            console.log('✅ Configuración de documentos solicitados cargada:', company.requestedDocuments);
          } else {
            console.warn('⚠️ No hay configuración de documentos solicitados, usando valores por defecto');
          }

          // Cargar ID del documento APC personalizado si existe
          if (company && company.apcDocumentDriveId) {
            setApcDocumentDriveId(company.apcDocumentDriveId);
            console.log('✅ Documento APC personalizado encontrado:', company.apcDocumentDriveId);
          }
        } catch (error) {
          console.error('❌ Error cargando datos de la empresa:', error);
          // En caso de error, usar las zonas por defecto
          setZones(availableZones);
        }
      } else {
        console.warn('⚠️ No se encontró company_id en URL ni localStorage, usando zonas por defecto');
        setZones(availableZones);
      }
    };
    
    loadCompanyData();
  }, [isEmbed, availableZones]);

  // Smooth scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Guardar automáticamente los datos cuando se llega al paso 6 (BACKUP - por si handleFinalSubmit no guardó)
  useEffect(() => {
    const saveFinalDataAutomatically = async () => {
      // Solo ejecutar si:
      // 1. Estamos en el paso 6
      // 2. Hay datos para guardar
      // 3. Aún no se han guardado
      // 4. No hay un guardado en progreso
      if (step === 6 && result && !hasSavedFinalData && !isSavingRef.current) {
        console.log('🔄 [BACKUP] Paso 6 detectado - Guardando datos automáticamente como respaldo...');
        
        // Verificar que tenemos prospectId
        if (!prospectId) {
          console.error('❌ [BACKUP] No hay prospectId disponible. No se pueden guardar los datos finales.');
          return;
        }

        // Marcar que estamos guardando para evitar guardados simultáneos
        isSavingRef.current = true;
        setIsSaving(true);
        const urlParams = new URLSearchParams(window.location.search);
        const companyId = urlParams.get('company_id') || localStorage.getItem('companyId');

        try {
          console.log('🔄 [BACKUP] Guardando datos finales automáticamente...', {
            prospectId,
            hasIdFile: !!personal.idFile,
            hasFichaFile: !!personal.fichaFile,
            hasTalonarioFile: !!personal.talonarioFile,
            hasSignedAcpFile: !!personal.signedAcpFile,
            hasResult: !!result
          });

          // Actualizar prospecto existente (solo archivos y calculation_result)
          const success = await updateProspectToDB(
            prospectId,
            personal,
            result
          );
          
          if (success) {
            console.log('✅ [BACKUP] Datos finales guardados automáticamente en la base de datos');
            setHasSavedFinalData(true);
            
            // Cargar propiedades/proyectos disponibles si la empresa tiene plan Premium
            if (companyId) {
              try {
                const company = await getCompanyById(companyId);
                if (company && company.plan === 'Wolf of Wallstreet') {
                  setCompanyPlan('Wolf of Wallstreet');
                  setCompanyRole(company.role || 'Broker');
                  setIsLoadingProperties(true);
                  
                  if (company.role === 'Promotora') {
                    // Cargar proyectos para Promotora
                    const projects = await getAvailableProjectsForProspect(
                      companyId,
                      result.maxPropertyPrice,
                      Array.isArray(preferences.zone) ? preferences.zone : [preferences.zone]
                    );
                    setAvailableProjects(projects);
                    console.log('✅ Proyectos cargados:', projects.length);
                  } else {
                    // Cargar propiedades para Broker
                    const props = await getAvailablePropertiesForProspect(
                      companyId,
                      result.maxPropertyPrice,
                      Array.isArray(preferences.zone) ? preferences.zone : [preferences.zone]
                    );
                    setAvailableProperties(props);
                    console.log('✅ Propiedades cargadas:', props.length);
                  }
                  
                  setIsLoadingProperties(false);
                }
              } catch (e) {
                console.error("Error cargando propiedades/proyectos:", e);
                setIsLoadingProperties(false);
              }
            }
          } else {
            console.error('❌ [BACKUP] Error al guardar datos finales automáticamente');
          }
        } catch (e) {
          console.error("❌ [BACKUP] Error crítico al guardar datos finales automáticamente:", e);
          console.error("Stack trace:", e instanceof Error ? e.stack : 'No stack available');
        } finally {
          setIsSaving(false);
          isSavingRef.current = false;
        }
      }
    };

    saveFinalDataAutomatically();
  }, [step, result, prospectId, hasSavedFinalData]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => {
    // Si estamos en el paso 6 y volvemos atrás, resetear el flag de guardado
    if (step === 6) {
      setHasSavedFinalData(false);
    }
    setStep(prev => prev - 1);
  };

  const toggleZone = (zone: string) => {
    setPreferences(prev => {
      const exists = prev.zone.includes(zone);
      if (exists) {
        return { ...prev, zone: prev.zone.filter(z => z !== zone) };
      } else {
        return { ...prev, zone: [...prev.zone, zone] };
      }
    });
  };

  // Calcular capacidad (sin guardar aún)
  const handleCalculateCapacity = () => {
    const res = calculateAffordability(financial.familyIncome);
    setResult(res);
    handleNext(); // Ir al step 3 (datos básicos)
  };

  // El usuario debe validar para ver los resultados completos
  const handleValidation = () => {
    setWantsValidation(true);
    handleNext(); // Ir a documentación (step 5)
  };

  // Guardar datos finales y avanzar a resultados
  const handleFinalSubmit = async (hasDocuments: boolean = true) => {
    if (!result) {
      console.error('❌ No hay resultado de cálculo disponible');
      return;
    }
    
    if (!prospectId) {
      console.error('❌ No hay prospectId disponible. Guardando prospecto inicial primero...');
      // Si no hay prospectId, intentar guardar prospecto inicial primero
      // Debe incluir: nombre, correo, teléfono, monthly_income, property_type, bedrooms, bathrooms, interested_zones
      if (personal.fullName && personal.email && personal.phone && result) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const companyId = urlParams.get('company_id') || localStorage.getItem('companyId');
          const savedId = await saveProspectInitial(
            {
              fullName: personal.fullName,
              email: personal.email,
              phone: personal.phone
            },
            financial,
            preferences,
            companyId
          );
          if (savedId) {
            setProspectId(savedId);
            console.log('✅ Prospecto inicial guardado:', savedId);
          } else {
            console.error('❌ No se pudo guardar el prospecto inicial');
            return;
          }
        } catch (e) {
          console.error('❌ Error guardando prospecto inicial:', e);
          return;
        }
      } else {
        console.error('❌ Faltan datos básicos del prospecto o resultado de cálculo');
        return;
      }
    }
    
    // GUARDAR INMEDIATAMENTE antes de avanzar al paso 6
    isSavingRef.current = true;
    setIsSaving(true);
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('company_id') || localStorage.getItem('companyId');

    try {
      console.log('🔄 [PRINCIPAL] Guardando datos finales ANTES de mostrar resultados...', {
        prospectId,
        hasIdFile: !!personal.idFile,
        hasFichaFile: !!personal.fichaFile,
        hasTalonarioFile: !!personal.talonarioFile,
        hasSignedAcpFile: !!personal.signedAcpFile,
        hasResult: !!result
      });

      // Actualizar prospecto existente (solo archivos y calculation_result)
      const success = await updateProspectToDB(
        prospectId,
        personal,
        result
      );
      
      if (success) {
        console.log('✅ [PRINCIPAL] Datos finales guardados exitosamente ANTES de mostrar resultados');
        setHasSavedFinalData(true);
        
        // Cargar propiedades/proyectos disponibles si la empresa tiene plan Premium
        if (companyId) {
          try {
            const company = await getCompanyById(companyId);
            if (company && company.plan === 'Wolf of Wallstreet') {
              setCompanyPlan('Wolf of Wallstreet');
              setCompanyRole(company.role || 'Broker');
              setIsLoadingProperties(true);
              
              if (company.role === 'Promotora') {
                // Cargar proyectos para Promotora con filtros adicionales
                const projects = await getAvailableProjectsForProspect(
                  companyId,
                  result.maxPropertyPrice,
                  Array.isArray(preferences.zone) ? preferences.zone : [preferences.zone],
                  preferences.bedrooms,
                  preferences.bathrooms,
                  preferences.propertyType === 'Apartamento' ? 'Apartamento' : preferences.propertyType === 'Casa' ? 'Casa' : null
                );
                setAvailableProjects(projects);
                console.log('✅ Proyectos cargados:', projects.length, 'con filtros:', { bedrooms: preferences.bedrooms, bathrooms: preferences.bathrooms });
              } else {
                // Cargar propiedades para Broker
                const props = await getAvailablePropertiesForProspect(
                  companyId,
                  result.maxPropertyPrice,
                  Array.isArray(preferences.zone) ? preferences.zone : [preferences.zone]
                );
                setAvailableProperties(props);
                console.log('✅ Propiedades cargadas:', props.length);
              }
              
              setIsLoadingProperties(false);
            }
          } catch (e) {
            console.error("Error cargando propiedades/proyectos:", e);
            setIsLoadingProperties(false);
          }
        }
      } else {
        console.error('❌ Error al guardar datos finales - la función retornó false');
      }
    } catch (e) {
      console.error("❌ [PRINCIPAL] Error crítico al guardar datos finales:", e);
      console.error("Stack trace:", e instanceof Error ? e.stack : 'No stack available');
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
    
    // Avanzar al paso 6 después de guardar
    handleNext(); // Ir a resultados finales (step 6)
  };

  return (
    <div className={`min-h-[90vh] flex flex-col items-center justify-center p-4 md:p-8 ${isEmbed ? 'bg-transparent' : ''}`}>
      
      {/* Main Container - "Emotional Design" Card */}
      {/* If isEmbed, we still use the white card look, but we might adjust margins if needed */}
      <div className={`bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative`}>
        
        {/* Branding for Embed */}
        {isEmbed && (
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
              {companyName}
            </span>
          </div>
        )}

        {/* Progress Dots */}
        {step < 6 && <ProgressDots currentStep={step} totalSteps={5} />}

        {/* STEP 1: PREFERENCES */}
        {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-10">
                {companyLogo ? (
                  <div className="mb-6 flex justify-center">
                    <img 
                      src={companyLogo} 
                      alt={`Logo de ${companyName}`}
                      className="h-16 w-auto object-contain max-w-xs"
                      onLoad={() => {
                        console.log('✅ Logo cargado y mostrado exitosamente');
                      }}
                      onError={(e) => {
                        console.error('❌ Error cargando logo:', {
                          src: companyLogo.substring(0, 80),
                          srcType: companyLogo.startsWith('data:') ? 'base64' : companyLogo.startsWith('blob:') ? 'blob' : 'url',
                          error: e
                        });
                        setCompanyLogo(null);
                      }}
                    />
                  </div>
                ) : null}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Calcula tu hogar ideal</h1>
                <p className="text-gray-500 text-lg font-light">Descubre qué propiedad puedes adquirir según tu capacidad de pago.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-10">
                <button
                  onClick={() => setPreferences({ ...preferences, propertyType: PropertyType.Apartment })}
                  className={`group text-left p-6 md:p-8 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden ${
                    preferences.propertyType === PropertyType.Apartment
                      ? 'border-indigo-100 bg-indigo-50/30 shadow-lg scale-[1.02]'
                      : 'border-gray-100 bg-white hover:border-indigo-50 hover:shadow-md'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                    preferences.propertyType === PropertyType.Apartment ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                  }`}>
                    <Building2 size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Apartamento</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Ideal para vida urbana, amenidades compartidas y seguridad.
                  </p>
                  {preferences.propertyType === PropertyType.Apartment && (
                    <div className="absolute top-6 right-6 w-4 h-4 bg-indigo-500 rounded-full animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => setPreferences({ ...preferences, propertyType: PropertyType.House })}
                  className={`group text-left p-6 md:p-8 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden ${
                    preferences.propertyType === PropertyType.House
                      ? 'border-indigo-100 bg-indigo-50/30 shadow-lg scale-[1.02]'
                      : 'border-gray-100 bg-white hover:border-indigo-50 hover:shadow-md'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                    preferences.propertyType === PropertyType.House ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                  }`}>
                    <Home size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Casa</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Más espacio, privacidad y áreas verdes para la familia.
                  </p>
                  {preferences.propertyType === PropertyType.House && (
                    <div className="absolute top-6 right-6 w-4 h-4 bg-indigo-500 rounded-full animate-pulse" />
                  )}
                </button>
              </div>

              <div className="space-y-8 max-w-3xl mx-auto">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4 pl-1 flex items-center gap-2">
                    <MapPin size={16} className="text-indigo-500"/>
                    Zonas de Preferencia 
                    <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full">Selección múltiple</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {zones.map(zone => {
                      const isSelected = preferences.zone.includes(zone);
                      return (
                         <button
                          key={zone}
                          onClick={() => toggleZone(zone)}
                          className={`
                            relative px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-200 border flex items-center justify-center gap-2 text-center h-full
                            ${isSelected 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.02]' 
                              : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600'
                            }
                          `}
                        >
                          {isSelected && <Check size={14} className="animate-fade-in absolute left-2 top-1/2 -translate-y-1/2" />}
                          <span className={isSelected ? 'pl-4' : ''}>{zone}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-6">
                  {/* Habitaciones */}
                  <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 hover:border-indigo-100 transition-colors">
                    <label className="flex items-center gap-3 mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                        <BedDouble size={24} strokeWidth={2} />
                      </div>
                      <span className="text-xl font-bold text-gray-800">Habitaciones</span>
                    </label>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => setPreferences({...preferences, bedrooms: num})}
                          className={`flex-1 h-14 rounded-2xl flex items-center justify-center transition-all font-bold text-lg ${
                            preferences.bedrooms === num 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 transform scale-105' 
                            : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 border border-gray-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Baños */}
                  <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 hover:border-indigo-100 transition-colors">
                    <label className="flex items-center gap-3 mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                        <Bath size={24} strokeWidth={2} />
                      </div>
                      <span className="text-xl font-bold text-gray-800">Baños</span>
                    </label>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => setPreferences({...preferences, bathrooms: num})}
                          className={`flex-1 h-14 rounded-2xl flex items-center justify-center transition-all font-bold text-lg ${
                            preferences.bathrooms === num 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 transform scale-105' 
                            : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 border border-gray-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-center">
                <button
                  onClick={handleNext}
                  disabled={preferences.zone.length === 0}
                  className={`flex items-center gap-2 px-10 py-4 rounded-full font-semibold transition-all duration-500 ${
                    preferences.zone.length > 0
                      ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200 hover:shadow-xl translate-y-0 opacity-100'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed translate-y-2 opacity-50'
                  }`}
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </div>
        )}

        {/* STEP 2: INCOME */}
        {step === 2 && (
            <div className="animate-fade-in-up max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Tu Capacidad</h1>
                <p className="text-gray-500 text-lg font-light">Para darte el mejor estimado, necesitamos saber tu ingreso familiar mensual.</p>
              </div>

              <div className="bg-gray-50/50 p-10 rounded-[2rem] border border-gray-100 text-center mb-8">
                <label className="block text-sm font-semibold text-gray-500 mb-8 uppercase tracking-wider">Ingreso Familiar Mensual</label>
                
                <div className="flex items-center justify-center text-6xl font-light text-gray-900 mb-10 tracking-tighter">
                  <span className="text-4xl mr-2 text-gray-400 font-normal">$</span>
                  <input
                    type="number"
                    value={financial.familyIncome}
                    onChange={(e) => setFinancial({ familyIncome: parseInt(e.target.value) || 0 })}
                    className="w-56 text-center border-b-2 border-indigo-100 focus:border-indigo-500 outline-none bg-transparent transition-colors placeholder-gray-200"
                    placeholder="0"
                    step={100}
                  />
                </div>

                <input
                  type="range"
                  min="1000"
                  max="15000"
                  step="100"
                  value={financial.familyIncome}
                  onChange={(e) => setFinancial({ familyIncome: parseInt(e.target.value) })}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-600 transition-all"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-4 px-1 font-medium">
                  <span>$1,000</span>
                  <span>$15,000+</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 px-4">
                <button 
                  onClick={handleBack} 
                  className="text-gray-400 hover:text-gray-600 font-medium flex items-center justify-center gap-2 py-3 sm:py-0 order-2 sm:order-1 transition-colors"
                >
                  <ChevronLeft size={20} /> Atrás
                </button>
                <button
                  onClick={handleCalculateCapacity}
                  disabled={financial.familyIncome < 800 || financial.familyIncome === 0}
                   className={`flex items-center justify-center gap-2 px-6 sm:px-8 py-4 sm:py-3 rounded-full font-semibold text-base sm:text-base transition-all duration-300 order-1 sm:order-2 flex-1 sm:flex-initial ${
                    financial.familyIncome >= 800 && financial.familyIncome > 0
                      ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-md'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  Continuar <ArrowRight size={18} className="shrink-0" />
                </button>
              </div>
            </div>
        )}

        {/* STEP 3: DATOS BÁSICOS (Nombre, Email, Teléfono) */}
        {step === 3 && (
            <div className="animate-fade-in-up max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Datos de Contacto</h1>
                <p className="text-gray-500 text-lg font-light">Necesitamos tus datos para continuar.</p>
              </div>

              <div className="bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100 space-y-6 mb-8">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg mb-6">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><User size={16} /></div>
                  Información Personal
                </h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Nombre Completo"
                    value={personal.fullName}
                    onChange={(e) => setPersonal({...personal, fullName: e.target.value})}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                  />
                  <input
                    type="email"
                    placeholder="Correo Electrónico"
                    value={personal.email}
                    onChange={(e) => setPersonal({...personal, email: e.target.value})}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono de Contacto"
                    value={personal.phone}
                    onChange={(e) => setPersonal({...personal, phone: e.target.value})}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 px-4">
                <button 
                  onClick={handleBack} 
                  className="text-gray-400 hover:text-gray-600 font-medium flex items-center justify-center gap-2 py-3 sm:py-0 order-2 sm:order-1"
                >
                  <ChevronLeft size={20} /> Atrás
                </button>
                <button
                  onClick={async () => {
                    // Guardar prospecto inicial cuando se completan los datos básicos
                    // Debe incluir: nombre, correo, teléfono, monthly_income, property_type, bedrooms, bathrooms, interested_zones
                    if (personal.fullName && personal.email && personal.phone && result) {
                      setIsSaving(true);
                      try {
                        const urlParams = new URLSearchParams(window.location.search);
                        const companyId = urlParams.get('company_id') || localStorage.getItem('companyId');
                        
                        const savedId = await saveProspectInitial(
                          {
                            fullName: personal.fullName,
                            email: personal.email,
                            phone: personal.phone
                          },
                          financial,
                          preferences,
                          companyId
                        );
                        
                        if (savedId) {
                          setProspectId(savedId);
                          console.log('✅ Prospecto inicial guardado con todos los datos:', savedId);
                        }
                      } catch (e) {
                        console.error('Error guardando prospecto inicial:', e);
                      } finally {
                        setIsSaving(false);
                        handleNext(); // Continuar al siguiente paso
                      }
                    }
                  }}
                  disabled={!personal.fullName || !personal.email || !personal.phone || !result || isSaving}
                  className={`flex items-center justify-center gap-2 px-6 sm:px-8 py-4 sm:py-3 rounded-full font-semibold text-base transition-all duration-300 order-1 sm:order-2 flex-1 sm:flex-initial ${
                    !personal.fullName || !personal.email || !personal.phone || isSaving
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin shrink-0" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      Continuar <ArrowRight size={18} className="shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </div>
        )}

        {/* STEP 4: VALIDACIÓN PROMPT (Mostrar monto + botón validar) */}
        {step === 4 && result && (
            <div className="animate-fade-in-up text-center max-w-3xl mx-auto">
              <div className="mb-10">
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm transform -rotate-3">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">¡Excelente, {personal.fullName.split(' ')[0]}!</h2>
                <p className="text-gray-500 text-lg mb-8">Basado en tu capacidad, puedes aplicar a:</p>

                {/* Monto destacado */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-[2rem] border-2 border-indigo-200 mb-8">
                  <p className="text-indigo-400 text-sm uppercase tracking-bold font-bold mb-2">Monto Total al que Puedes Aplicar</p>
                  <p className="text-5xl md:text-6xl font-bold text-indigo-900 mb-2">{formatCurrency(result.maxPropertyPrice)}</p>
                  <p className="text-gray-500 text-sm">Letra mensual estimada: {formatCurrency(result.monthlyPayment)}</p>
                </div>

                {/* Prompt de Validación */}
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-lg mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">¿Quieres validar tu pre-aprobación bancaria?</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Para obtener una pre-aprobación oficial, necesitamos validar tu información con documentos adicionales.
                  </p>
                  <button
                    onClick={handleValidation}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-12 py-5 rounded-full font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-xl shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300 transform hover:scale-105 animate-pulse hover:animate-none"
                  >
                    Validar Pre-Aprobación
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* STEP 5: DOCUMENTACIÓN (Solo si quiere validar) */}
        {step === 5 && wantsValidation && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Validación Bancaria</h1>
                <p className="text-gray-500 text-lg font-light">Sube los documentos necesarios para validar tu pre-aprobación.</p>
              </div>

              <div className={`grid gap-6 max-w-4xl mx-auto ${requestedDocuments.signedAcpFile ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><FileCheck size={16} /></div>
                    Documentación
                  </h3>
                  {requestedDocuments.idFile && (
                    <FileUpload label="Foto de Cédula / ID" file={personal.idFile} setFile={(f) => setPersonal({...personal, idFile: f})} />
                  )}
                  {requestedDocuments.fichaFile && (
                    <FileUpload label="Ficha de Seguro Social" file={personal.fichaFile} setFile={(f) => setPersonal({...personal, fichaFile: f})} />
                  )}
                  {requestedDocuments.talonarioFile && (
                    <FileUpload label="Talonario de Pago" file={personal.talonarioFile} setFile={(f) => setPersonal({...personal, talonarioFile: f})} />
                  )}
                </div>

                {requestedDocuments.signedAcpFile && (
                  <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-indigo-900 flex items-center gap-2 text-sm">
                        Autorización APC
                      </h3>
                      <a 
                        href="/apc.pdf"
                        download="apc.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                      >
                        <Download size={12} /> Descargar PDF
                      </a>
                    </div>
                    <FileUpload label="Subir APC Firmada" file={personal.signedAcpFile} setFile={(f) => setPersonal({...personal, signedAcpFile: f})} />
                    <button
                      type="button"
                      onClick={() => setShowApcModal(true)}
                      className="mt-3 w-full text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100 border border-dashed border-indigo-200 rounded-xl py-2.5 transition-colors flex items-center justify-center gap-2"
                    >
                      <FileCheck size={14} />
                      Firmar APC en línea
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-10 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 px-4 max-w-4xl mx-auto">
                <button 
                  onClick={handleBack} 
                  className="text-gray-400 hover:text-gray-600 font-medium flex items-center justify-center gap-2 py-3 sm:py-0 order-2 sm:order-1"
                >
                  <ChevronLeft size={20} /> Atrás
                </button>
                <button
                  onClick={() => handleFinalSubmit(true)}
                  disabled={
                    (requestedDocuments.idFile && !personal.idFile) ||
                    (requestedDocuments.fichaFile && !personal.fichaFile) ||
                    (requestedDocuments.talonarioFile && !personal.talonarioFile) ||
                    (requestedDocuments.signedAcpFile && !personal.signedAcpFile) ||
                    isSaving
                  }
                  className={`flex items-center justify-center gap-3 px-6 sm:px-10 py-4 rounded-full font-bold text-base sm:text-lg transition-all duration-300 shadow-xl order-1 sm:order-2 flex-1 sm:flex-initial ${
                    (requestedDocuments.idFile && !personal.idFile) ||
                    (requestedDocuments.fichaFile && !personal.fichaFile) ||
                    (requestedDocuments.talonarioFile && !personal.talonarioFile) ||
                    (requestedDocuments.signedAcpFile && !personal.signedAcpFile) ||
                    isSaving
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={20} className="animate-spin shrink-0" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Enviar Validación <ArrowRight size={20} className="shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </div>
        )}

        {/* Modal de firma APC */}
        {requestedDocuments.signedAcpFile && (
          <ApcSignatureModal
            isOpen={showApcModal}
            onClose={() => setShowApcModal(false)}
            fullName={personal.fullName}
            onSigned={(file) => setPersonal(prev => ({ ...prev, signedAcpFile: file }))}
          />
        )}

        {/* STEP 6: RESULTADOS FINALES */}
        {step === 6 && result && (
            <div className="animate-fade-in-up text-center max-w-3xl mx-auto" style={{ position: 'relative', zIndex: 1 }}>
              {/* Check if not eligible */}
              {result.maxPropertyPrice === 0 ? (
                <div className="py-8">
                  <div className="w-20 h-20 bg-orange-50 text-orange-400 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                     <HeartHandshake size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Gracias, {personal.fullName.split(' ')[0]}</h2>
                  
                  <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-100 mb-8">
                      <p className="text-gray-600 leading-relaxed mb-6 text-lg">
                          Basado en la información proporcionada, <strong>actualmente no contamos con una pre-aprobación automática</strong>.
                      </p>
                      <div className="h-px bg-gray-200 w-full my-6"></div>
                      <p className="text-gray-500 text-sm">
                          Un asesor senior de <span className="font-bold">{companyName}</span> revisará tu caso manualmente para explorar alternativas personalizadas. Te contactaremos al <strong>{personal.phone}</strong>.
                      </p>
                  </div>

                  <button 
                    onClick={() => window.location.reload()}
                    className="text-gray-400 font-medium hover:text-indigo-600 transition-colors"
                  >
                    Volver al inicio
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm transform -rotate-3">
                     <CheckCircle2 size={40} />
                  </div>
                  <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">¡Felicidades, {personal.fullName.split(' ')[0]}!</h2>
                  <p className="text-gray-500 mb-10 text-lg">Estas son tus posibilidades reales.</p>

                  <div className="grid md:grid-cols-3 gap-4 mb-10">
                    {/* Card 1: Max Price */}
                    <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
                       <p className="text-indigo-400 text-xs uppercase tracking-bold font-bold mb-2">Precio Máximo</p>
                       <p className="text-2xl font-bold text-indigo-900">{formatCurrency(result.maxPropertyPrice)}</p>
                    </div>

                    {/* Card 2: Monthly */}
                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                       <p className="text-gray-400 text-xs uppercase tracking-bold font-bold mb-2">Letra Mensual</p>
                       <p className="text-2xl font-bold text-gray-900">{formatCurrency(result.monthlyPayment)}</p>
                    </div>

                    {/* Card 3: Down Payment */}
                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                       <p className="text-gray-400 text-xs uppercase tracking-bold font-bold mb-2">Abono ({result.downPaymentPercent * 100}%)</p>
                       <p className="text-2xl font-bold text-gray-900">{formatCurrency(result.downPaymentAmount)}</p>
                    </div>
                  </div>

                  <div className="bg-gray-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden mb-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="relative z-10">
                      <h4 className="text-xl font-bold mb-2">Próximos Pasos</h4>
                      <p className="text-gray-300 leading-relaxed mb-6 font-light text-sm">
                        Un agente especializado de <span className="text-white font-medium">{companyName}</span> en <span className="text-white font-medium">{preferences.zone.length > 0 ? preferences.zone[0] : 'tu zona'}</span> ya está analizando opciones para ti.
                      </p>
                    </div>
                  </div>

                  {/* Tarjeta de Zonas más buscadas - Solo para Broker */}
                  {(() => {
                    const shouldShow = companyRole === 'Broker' && preferences.zone.length > 0;
                    console.log('🔍 [DEBUG] Condiciones para tarjeta de zonas:', {
                      companyRole,
                      isBroker: companyRole === 'Broker',
                      zonesLength: preferences.zone.length,
                      zones: preferences.zone,
                      shouldShow,
                      showZonesModal
                    });
                    return shouldShow ? (
                      <div 
                        className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all mb-10 max-w-md mx-auto relative z-50"
                        style={{ position: 'relative' }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🖱️ CLICK en botón de tarjeta de zonas!', { 
                              showZonesModal, 
                              companyRole,
                              zones: preferences.zone 
                            });
                            const newValue = true;
                            console.log('🔄 Llamando setShowZonesModal con:', newValue);
                            setShowZonesModal(newValue);
                            setTimeout(() => {
                              console.log('⏱️ Después de 100ms, showZonesModal debería ser:', newValue);
                            }, 100);
                          }}
                          className="w-full text-left cursor-pointer hover:opacity-90"
                          style={{ background: 'transparent', border: 'none', padding: 0, outline: 'none' }}
                        >
                          <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
                              <MapPin size={24} className="text-orange-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 uppercase font-semibold text-center mb-2">ZONAS MÁS BUSCADAS</p>
                          <p className="text-xl font-bold text-gray-900 text-center mb-3">
                            {preferences.zone.slice(0, 2).join(', ')}
                            {preferences.zone.length > 2 && ' y ...'}
                          </p>
                          <div className="flex justify-center">
                            <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold">
                              {preferences.zone.length} {preferences.zone.length === 1 ? 'zona' : 'zonas'}
                            </span>
                          </div>
                        </button>
                      </div>
                    ) : null;
                  })()}

                  {/* Propiedades/Proyectos Disponibles - Solo si hay plan Premium */}
                  {companyPlan === 'Wolf of Wallstreet' && (
                    <div className="mb-10">
                      {isLoadingProperties ? (
                        <div className="text-center py-8">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                          <p className="text-gray-500 mt-4 text-sm">
                            {companyRole === 'Promotora' ? 'Buscando proyectos disponibles...' : 'Buscando propiedades disponibles...'}
                          </p>
                        </div>
                      ) : companyRole === 'Promotora' && availableProjects.length > 0 ? (
                        <>
                          {(() => {
                            // Crear lista plana de todos los modelos que cumplen criterios
                            const allModels: Array<{ model: ProjectModel, project: Project }> = [];
                            availableProjects.forEach(project => {
                              if (project.models && project.models.length > 0) {
                                project.models.forEach(model => {
                                  allModels.push({ model, project });
                                });
                              }
                            });

                            return allModels.length > 0 ? (
                              <>
                                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Modelos que te pueden interesar</h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                                  {allModels.map(({ model, project }) => (
                                    <div
                                      key={model.id}
                                      onClick={() => setSelectedModel({ model, project })}
                                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                                    >
                                      {/* Imagen del modelo */}
                                      <div className="relative h-48 bg-gray-100 overflow-hidden">
                                        {(model.images && model.images.length > 0) ? (
                                          <img
                                            src={model.images[0]}
                                            alt={model.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                        ) : (project.images && project.images.length > 0) ? (
                                          <img
                                            src={project.images[0]}
                                            alt={project.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                                            <Building2 size={48} className="text-indigo-300" />
                                          </div>
                                        )}
                                        
                                        {/* Badge de precio */}
                                        <div className="absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600">
                                          {formatCurrency(model.price)}
                                        </div>
                                      </div>

                                      {/* Contenido */}
                                      <div className="p-5">
                                        <h4 className="font-bold text-gray-900 mb-1 text-lg">{model.name}</h4>
                                        <p className="text-xs text-gray-500 mb-3">{project.name}</p>
                                        <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                                          <MapPin size={14} />
                                          <span>{project.zone || 'Zona no especificada'}</span>
                                        </div>
                                        
                                        {/* Características */}
                                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                                          {model.bedrooms && (
                                            <div className="flex items-center gap-1">
                                              <BedDouble size={16} className="text-gray-400" />
                                              <span>{model.bedrooms}</span>
                                            </div>
                                          )}
                                          {model.bathrooms && (
                                            <div className="flex items-center gap-1">
                                              <Bath size={16} className="text-gray-400" />
                                              <span>{model.bathrooms}</span>
                                            </div>
                                          )}
                                          {model.areaM2 && (
                                            <div className="flex items-center gap-1">
                                              <span className="text-gray-400">📐</span>
                                              <span>{model.areaM2}m²</span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="pt-4 border-t border-gray-100">
                                          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Disponibilidad</div>
                                          <div className="text-sm font-semibold text-green-600">
                                            {model.unitsAvailable} {model.unitsAvailable === 1 ? 'unidad disponible' : 'unidades disponibles'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {allModels.length > 6 && (
                                  <p className="text-center text-gray-500 text-sm mt-4">
                                    Mostrando {allModels.length} modelos disponibles
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="text-center py-8 text-gray-400">
                                <Building2 size={48} className="mx-auto mb-3 opacity-50" />
                                <p className="text-sm">No hay modelos disponibles que cumplan tus criterios</p>
                              </div>
                            );
                          })()}
                        </>
                      ) : companyRole === 'Broker' && availableProperties.length > 0 ? (
                        <>
                          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Propiedades que te pueden interesar</h3>
                          <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                            {availableProperties.slice(0, 4).map((property) => (
                              <div
                                key={property.id}
                                onClick={() => setSelectedProperty(property)}
                                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                              >
                                {/* Imagen de la propiedad */}
                                <div className="relative h-48 bg-gray-100 overflow-hidden">
                                  {property.images && property.images.length > 0 ? (
                                    <img
                                      src={property.images[0]}
                                      alt={property.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                                      <Home size={48} className="text-indigo-300" />
                                    </div>
                                  )}
                                  
                                  {/* Badge de tipo */}
                                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white ${
                                    property.type === 'Venta' ? 'bg-purple-600' : 'bg-green-600'
                                  }`}>
                                    {property.type}
                                  </div>

                                  {/* Overlays informativos */}
                                  {property.highDemand && (
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                                      <Star size={12} className="fill-purple-700 text-purple-700" />
                                      Alta Demanda: {property.demandVisits || 0} visitas
                                    </div>
                                  )}
                                  {property.priceAdjusted && (
                                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-green-700">
                                      <TrendingDown size={12} />
                                      {property.priceAdjustmentPercent}% bajo mercado
                                    </div>
                                  )}
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

                                  <div className="pt-4 border-t border-gray-100">
                                    <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(property.price)}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {availableProperties.length > 4 && (
                            <p className="text-center text-gray-500 text-sm mt-4">
                              Y {availableProperties.length - 4} propiedades más disponibles
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <Home size={48} className="mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No hay propiedades disponibles en este momento</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-center">
                    <button 
                      onClick={() => window.location.reload()}
                      className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                      Finalizar
                    </button>
                  </div>
                </div>
              )}
            </div>
        )}
      </div>
      
      {!isEmbed && (
        <p className="mt-8 text-xs text-gray-400 font-medium">
          Powered by Kônsul AI • Seguro & Encriptado
        </p>
      )}

      {/* Modal de Detalle de Propiedad */}
      {selectedProperty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fade-in-up">
            {/* Header con botón cerrar */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <h3 className="text-2xl font-bold text-gray-900">{selectedProperty.title}</h3>
              <button
                onClick={() => setSelectedProperty(null)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Imágenes */}
            {selectedProperty.images && selectedProperty.images.length > 0 && (
              <div className="relative h-64 bg-gray-100">
                <img
                  src={selectedProperty.images[0]}
                  alt={selectedProperty.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-4 py-1.5 rounded-lg text-sm font-bold text-white ${
                  selectedProperty.type === 'Venta' ? 'bg-purple-600' : 'bg-green-600'
                }`}>
                  {selectedProperty.type}
                </span>
                {selectedProperty.highDemand && (
                  <span className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-purple-50 text-purple-700 flex items-center gap-1.5">
                    <Star size={14} className="fill-purple-700 text-purple-700" />
                    Alta Demanda
                  </span>
                )}
                {selectedProperty.priceAdjusted && (
                  <span className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-green-50 text-green-700 flex items-center gap-1.5">
                    <TrendingDown size={14} />
                    {selectedProperty.priceAdjustmentPercent}% bajo mercado
                  </span>
                )}
              </div>

              {/* Ubicación */}
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={18} className="text-indigo-500" />
                <span className="font-medium">{selectedProperty.zone}</span>
                {selectedProperty.address && (
                  <span className="text-gray-400">• {selectedProperty.address}</span>
                )}
              </div>

              {/* Especificaciones */}
              <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-100">
                {selectedProperty.bedrooms && (
                  <div className="text-center">
                    <BedDouble size={24} className="text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-500">Habitaciones</div>
                    <div className="text-lg font-bold text-gray-900">{selectedProperty.bedrooms}</div>
                  </div>
                )}
                {selectedProperty.bathrooms && (
                  <div className="text-center">
                    <Bath size={24} className="text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-500">Baños</div>
                    <div className="text-lg font-bold text-gray-900">{selectedProperty.bathrooms}</div>
                  </div>
                )}
                {selectedProperty.areaM2 && (
                  <div className="text-center">
                    <div className="text-2xl mb-2">📐</div>
                    <div className="text-sm text-gray-500">Área</div>
                    <div className="text-lg font-bold text-gray-900">{selectedProperty.areaM2}m²</div>
                  </div>
                )}
              </div>

              {/* Descripción */}
              {selectedProperty.description && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Descripción</h4>
                  <p className="text-gray-600 leading-relaxed">{selectedProperty.description}</p>
                </div>
              )}

              {/* Características */}
              {selectedProperty.features && selectedProperty.features.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-3">Características</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProperty.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-gray-600">
                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Precio y Botón "Me interesa" */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                    <div className="text-3xl font-bold text-gray-900">{formatCurrency(selectedProperty.price)}</div>
                  </div>
                  {prospectId && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        onChange={async (e) => {
                          if (prospectId) {
                            const success = await savePropertyInterest(prospectId, selectedProperty.id, e.target.checked);
                            // Mostrar feedback visual
                            if (e.target.checked && success) {
                              setNotification({
                                isOpen: true,
                                type: 'success',
                                message: '¡Gracias por tu interés! Un agente se pondrá en contacto contigo pronto.',
                                title: '¡Interés registrado!'
                              });
                            }
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                      />
                      <span className="text-lg font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
                        Me interesa
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Proyecto */}
      {selectedProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fade-in-up">
            {/* Header con botón cerrar */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <h3 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h3>
              <button
                onClick={() => setSelectedProject(null)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Imágenes */}
            {selectedProject.images && selectedProject.images.length > 0 && (
              <div className="relative h-64 bg-gray-100">
                <img
                  src={selectedProject.images[0]}
                  alt={selectedProject.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Ubicación */}
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={18} className="text-indigo-500" />
                <span className="font-medium">{selectedProject.zone || 'Zona no especificada'}</span>
                {selectedProject.address && (
                  <span className="text-gray-400">• {selectedProject.address}</span>
                )}
              </div>

              {/* Descripción */}
              {selectedProject.description && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Descripción</h4>
                  <p className="text-gray-600 leading-relaxed">{selectedProject.description}</p>
                </div>
              )}

              {/* Modelos Disponibles */}
              {selectedProject.models && selectedProject.models.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-4">Modelos Disponibles</h4>
                  <div className="space-y-4">
                    {selectedProject.models.map((model) => (
                      <div key={model.id || model.name} className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h5 className="font-bold text-gray-900 text-lg">{model.name}</h5>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              {model.areaM2 && (
                                <span>{model.areaM2}m²</span>
                              )}
                              {model.bedrooms && (
                                <span className="flex items-center gap-1">
                                  <BedDouble size={14} className="text-gray-400" />
                                  {model.bedrooms}
                                </span>
                              )}
                              {model.bathrooms && (
                                <span className="flex items-center gap-1">
                                  <Bath size={14} className="text-gray-400" />
                                  {model.bathrooms}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                            <div className="text-xl font-bold text-gray-900">{formatCurrency(model.price)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {model.unitsAvailable}/{model.unitsTotal} disponibles
                            </div>
                          </div>
                        </div>
                        
                        {model.amenities && model.amenities.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Amenidades</div>
                            <div className="flex flex-wrap gap-2">
                              {model.amenities.map((amenity, idx) => (
                                <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {model.images && model.images.length > 0 && (
                          <div className="mt-3 grid grid-cols-4 gap-2">
                            {model.images.slice(0, 4).map((img, idx) => (
                              <img key={idx} src={img} alt={`${model.name} ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón "Me interesa" - Removido porque ahora se maneja por modelo individual */}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Modelo Individual */}
      {selectedModel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fade-in-up">
            {/* Header con botón cerrar */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedModel.model.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedModel.project.name}</p>
              </div>
              <button
                onClick={() => setSelectedModel(null)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Imágenes */}
            {(selectedModel.model.images && selectedModel.model.images.length > 0) ? (
              <div className="relative h-64 bg-gray-100">
                <img
                  src={selectedModel.model.images[0]}
                  alt={selectedModel.model.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (selectedModel.project.images && selectedModel.project.images.length > 0) ? (
              <div className="relative h-64 bg-gray-100">
                <img
                  src={selectedModel.project.images[0]}
                  alt={selectedModel.project.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Ubicación */}
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={18} className="text-indigo-500" />
                <span className="font-medium">{selectedModel.project.zone || 'Zona no especificada'}</span>
                {selectedModel.project.address && (
                  <span className="text-gray-400">• {selectedModel.project.address}</span>
                )}
              </div>

              {/* Especificaciones */}
              <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-100">
                {selectedModel.model.bedrooms && (
                  <div className="text-center">
                    <BedDouble size={24} className="text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-500">Habitaciones</div>
                    <div className="text-lg font-bold text-gray-900">{selectedModel.model.bedrooms}</div>
                  </div>
                )}
                {selectedModel.model.bathrooms && (
                  <div className="text-center">
                    <Bath size={24} className="text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-500">Baños</div>
                    <div className="text-lg font-bold text-gray-900">{selectedModel.model.bathrooms}</div>
                  </div>
                )}
                {selectedModel.model.areaM2 && (
                  <div className="text-center">
                    <div className="text-2xl mb-2">📐</div>
                    <div className="text-sm text-gray-500">Área</div>
                    <div className="text-lg font-bold text-gray-900">{selectedModel.model.areaM2}m²</div>
                  </div>
                )}
              </div>

              {/* Descripción del proyecto */}
              {selectedModel.project.description && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Sobre el Proyecto</h4>
                  <p className="text-gray-600 leading-relaxed">{selectedModel.project.description}</p>
                </div>
              )}

              {/* Amenidades */}
              {selectedModel.model.amenities && selectedModel.model.amenities.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-3">Amenidades</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.model.amenities.map((amenity, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Más imágenes del modelo */}
              {selectedModel.model.images && selectedModel.model.images.length > 1 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-3">Galería</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedModel.model.images.slice(1, 5).map((img, idx) => (
                      <img key={idx} src={img} alt={`${selectedModel.model.name} ${idx + 2}`} className="w-full h-24 object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}

              {/* Disponibilidad */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Disponibilidad</div>
                <div className="text-lg font-semibold text-green-600">
                  {selectedModel.model.unitsAvailable} {selectedModel.model.unitsAvailable === 1 ? 'unidad disponible' : 'unidades disponibles'} de {selectedModel.model.unitsTotal} totales
                </div>
              </div>

              {/* Precio y Botón "Me interesa" */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                    <div className="text-3xl font-bold text-gray-900">{formatCurrency(selectedModel.model.price)}</div>
                  </div>
                  {prospectId && selectedModel.model.id && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        onChange={async (e) => {
                          if (prospectId && selectedModel.model.id) {
                            const success = await saveProjectModelInterest(prospectId, selectedModel.model.id, e.target.checked);
                            // Mostrar feedback visual
                            if (e.target.checked && success) {
                              setNotification({
                                isOpen: true,
                                type: 'success',
                                message: '¡Gracias por tu interés! Un agente se pondrá en contacto contigo pronto.',
                                title: '¡Interés registrado!'
                              });
                            }
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                      />
                      <span className="text-lg font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
                        Me interesa
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal de Zonas más buscadas - Solo para Broker */}
      {showZonesModal && companyRole === 'Broker' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowZonesModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con botón cerrar */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <MapPin size={20} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Zonas de Interés</h3>
                  <p className="text-sm text-gray-500">Zonas seleccionadas para tu búsqueda</p>
                </div>
              </div>
              <button
                onClick={() => setShowZonesModal(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <div className="space-y-4">
                {preferences.zone.map((zone, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{zone}</h4>
                      <p className="text-sm text-gray-500">
                        {availableProperties.filter(p => p.zone === zone).length} {availableProperties.filter(p => p.zone === zone).length === 1 ? 'propiedad disponible' : 'propiedades disponibles'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {availableProperties.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 text-center">
                    Total: <span className="font-bold text-gray-900">{availableProperties.length}</span> {availableProperties.length === 1 ? 'propiedad encontrada' : 'propiedades encontradas'} en tus zonas de interés
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        type={notification.type}
        message={notification.message}
        title={notification.title}
        duration={4000}
      />
    </div>
  );
};