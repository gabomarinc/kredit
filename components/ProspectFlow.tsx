import React, { useState, useEffect } from 'react';
import { PropertyType, UserPreferences, FinancialData, PersonalData, CalculationResult } from '../types';
import { calculateAffordability, formatCurrency } from '../utils/calculator';
import { saveProspectToDB, getCompanyById } from '../utils/db';
import { 
  Home, Building2, MapPin, User, Upload, FileCheck, ArrowRight, CheckCircle2, Download, HeartHandshake, ChevronLeft, Check, BedDouble, Bath
} from 'lucide-react';

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

export const ProspectFlow: React.FC<ProspectFlowProps> = ({ availableZones, companyName = "Krêdit", isEmbed = false }) => {
  const [step, setStep] = useState<number>(1);
  const [preferences, setPreferences] = useState<UserPreferences>({
    propertyType: PropertyType.Apartment,
    bedrooms: 2,
    bathrooms: 2,
    zone: [] // Initialized as empty array
  });
  const [financial, setFinancial] = useState<FinancialData>({ familyIncome: 3000 });
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
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // Cargar logo de la empresa si hay company_id en la URL o localStorage
  useEffect(() => {
    const loadCompanyLogo = async () => {
      // Buscar company_id en la URL (para embed)
      const urlParams = new URLSearchParams(window.location.search);
      const companyIdFromUrl = urlParams.get('company_id');
      
      // O usar el de localStorage (si está en modo embed desde el mismo dominio)
      const companyId = companyIdFromUrl || localStorage.getItem('companyId');
      
      if (companyId) {
        try {
          const company = await getCompanyById(companyId);
          if (company && company.logoUrl) {
            setCompanyLogo(company.logoUrl);
            console.log('✅ Logo de empresa cargado');
          }
        } catch (error) {
          console.warn('⚠️ No se pudo cargar el logo de la empresa:', error);
        }
      }
    };
    
    loadCompanyLogo();
  }, []);

  // Smooth scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

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

  const handleCalculate = async () => {
    setIsCalculating(true);
    
    // 1. Calculate Results Locally
    const res = calculateAffordability(financial.familyIncome);
    setResult(res);

    try {
        // 2. Save to Neon Database
        await saveProspectToDB(personal, financial, preferences, res);
    } catch (e) {
        console.error("Failed to save to DB, but showing results anyway", e);
        // We continue even if DB fails so the user experience isn't broken
    }
    
    // 3. Fake delay for emotional effect (reduced slightly since DB call takes time)
    setTimeout(() => {
      setIsCalculating(false);
      handleNext();
    }, 1500);
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
        {step < 5 && <ProgressDots currentStep={step} totalSteps={4} />}

        {/* STEP 1: PREFERENCES */}
        {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-10">
                {companyLogo && (
                  <div className="mb-6 flex justify-center">
                    <img 
                      src={companyLogo} 
                      alt={`Logo de ${companyName}`}
                      className="h-16 w-auto object-contain"
                      onError={() => {
                        console.warn('⚠️ Error cargando logo, ocultando');
                        setCompanyLogo(null);
                      }}
                    />
                  </div>
                )}
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
                    {availableZones.map(zone => {
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

              <div className="flex justify-between items-center px-4">
                <button 
                  onClick={handleBack} 
                  className="text-gray-400 hover:text-gray-600 font-medium flex items-center gap-2 transition-colors"
                >
                  <ChevronLeft size={20} /> Atrás
                </button>
                <button
                  onClick={handleNext}
                  disabled={financial.familyIncome < 800}
                   className={`flex items-center gap-2 px-8 py-3 rounded-full font-semibold transition-all duration-300 ${
                    financial.familyIncome >= 800
                      ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-md'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </div>
        )}

        {/* STEP 3: IDENTITY & DOCS */}
        {step === 3 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Casi listos</h1>
                <p className="text-gray-500 text-lg font-light">Validemos tus datos para proteger tu información.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><User size={16} /></div>
                      Datos Personales
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
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                     <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg mb-4">
                       <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><FileCheck size={16} /></div>
                      Documentación
                    </h3>
                    <FileUpload label="Foto de Cédula / ID" file={personal.idFile} setFile={(f) => setPersonal({...personal, idFile: f})} />
                    <FileUpload label="Ficha de Seguro Social" file={personal.fichaFile} setFile={(f) => setPersonal({...personal, fichaFile: f})} />
                    <FileUpload label="Talonario de Pago" file={personal.talonarioFile} setFile={(f) => setPersonal({...personal, talonarioFile: f})} />
                  </div>

                  <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-indigo-900 flex items-center gap-2 text-sm">
                        Autorización APC
                      </h3>
                      <a 
                         href="#" 
                         onClick={(e) => { e.preventDefault(); alert("En un entorno real, esto descargaría el PDF proporcionado."); }}
                         className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                       >
                         <Download size={12} /> Descargar PDF
                       </a>
                    </div>
                    <FileUpload label="Subir APC Firmada" file={personal.signedAcpFile} setFile={(f) => setPersonal({...personal, signedAcpFile: f})} />
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-between items-center px-4">
                <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 font-medium flex items-center gap-2">
                   <ChevronLeft size={20} /> Atrás
                </button>
                <button
                  onClick={handleCalculate}
                  disabled={!personal.fullName || !personal.email || !personal.phone || !personal.signedAcpFile}
                  className={`flex items-center gap-3 px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl ${
                    !personal.fullName || !personal.email || !personal.phone || !personal.signedAcpFile || isCalculating
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {isCalculating ? 'Analizando...' : 'Ver Resultados'} 
                  {!isCalculating && <ArrowRight size={20} />}
                </button>
              </div>
            </div>
        )}

        {/* STEP 4: RESULT */}
        {step === 4 && result && (
            <div className="animate-fade-in-up text-center max-w-3xl mx-auto">
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

                  <div className="bg-gray-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="relative z-10">
                      <h4 className="text-xl font-bold mb-2">Próximos Pasos</h4>
                      <p className="text-gray-300 leading-relaxed mb-6 font-light text-sm">
                        Un agente especializado de <span className="text-white font-medium">{companyName}</span> en <span className="text-white font-medium">{preferences.zone.length > 0 ? preferences.zone[0] : 'tu zona'}</span> ya está analizando opciones para ti.
                      </p>
                      <button 
                        onClick={() => window.location.reload()}
                        className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors"
                      >
                        Finalizar
                      </button>
                    </div>
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
    </div>
  );
};