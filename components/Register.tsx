import React, { useState, useEffect } from 'react';
import {
  User, Mail, Lock, Building, Image as ImageIcon, MapPin, ArrowRight, ChevronLeft, Check, Plus, X, Upload, Loader2, Cloud, AlertCircle
} from 'lucide-react';
import { ZONES_PANAMA } from '../constants';
import { saveCompanyToDB } from '../utils/db';
import { NotificationModal, NotificationType } from './ui/NotificationModal';
import { initiateGoogleDriveAuth } from '../utils/googleDrive';

// Componente de registro de empresas - Vercel deploy test

interface RegisterProps {
  onRegisterComplete: (data: { companyName: string; zones: string[] }) => void;
  onGoToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterComplete, onGoToLogin }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    logo: null as File | null,
    zones: [...ZONES_PANAMA], // Start with default zones
    role: 'Broker' as 'Promotora' | 'Broker',
    googleDriveAccessToken: '',
    googleDriveRefreshToken: '',
    googleDriveFolderId: ''
  });
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false);
  const [newZone, setNewZone] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; message: string; title?: string }>({
    isOpen: false,
    type: 'error',
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Manejar callback de OAuth de Google Drive
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleDriveAuth = urlParams.get('google_drive_auth');

    if (googleDriveAuth === 'success') {
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const folderId = urlParams.get('folder_id');

      if (accessToken && refreshToken) {
        // Guardar tokens en el estado
        setFormData(prev => ({
          ...prev,
          googleDriveAccessToken: accessToken,
          googleDriveRefreshToken: refreshToken,
          googleDriveFolderId: folderId || ''
        }));

        setIsGoogleDriveConnected(true);

        // Limpiar parámetros de la URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('google_drive_auth');
        newUrl.searchParams.delete('access_token');
        newUrl.searchParams.delete('refresh_token');
        newUrl.searchParams.delete('folder_id');
        window.history.replaceState({}, '', newUrl.toString());

        // Restaurar datos del formulario desde localStorage si existen
        const savedFormData = localStorage.getItem('registrationFormData');
        if (savedFormData) {
          try {
            const parsed = JSON.parse(savedFormData);
            setFormData(prev => ({
              ...prev,
              name: parsed.name || prev.name,
              email: parsed.email || prev.email,
              password: parsed.password || prev.password,
              confirmPassword: parsed.confirmPassword || prev.confirmPassword,
              companyName: parsed.companyName || prev.companyName,
              zones: parsed.zones || prev.zones,
              role: parsed.role || prev.role,
              googleDriveAccessToken: accessToken,
              googleDriveRefreshToken: refreshToken,
              googleDriveFolderId: folderId || ''
            }));
            localStorage.removeItem('registrationFormData');
          } catch (e) {
            console.error('Error restaurando datos del formulario:', e);
          }
        }

        // Ir al paso 3 (Google Drive) si no estamos ahí
        setStep(3);

        setNotification({
          isOpen: true,
          type: 'success',
          message: 'Google Drive conectado exitosamente. Puedes continuar con el registro.',
          title: 'Conexión exitosa'
        });
      }
    } else if (urlParams.get('error')) {
      // Manejar errores de OAuth
      const error = urlParams.get('error');
      const errorMessage = urlParams.get('message') || 'Error desconocido';

      setNotification({
        isOpen: true,
        type: 'error',
        message: `Error al conectar con Google Drive: ${errorMessage}`,
        title: 'Error de conexión'
      });

      // Limpiar parámetros de error de la URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('message');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleAddZone = () => {
    if (newZone.trim() && !formData.zones.includes(newZone.trim())) {
      setFormData({ ...formData, zones: [...formData.zones, newZone.trim()] });
      setNewZone('');
    }
  };

  const handleDeleteZone = (zoneToDelete: string) => {
    setFormData({ ...formData, zones: formData.zones.filter(z => z !== zoneToDelete) });
  };

  // Función para convertir archivo a base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFinish = async () => {
    try {
      console.log('🔄 Iniciando registro...');
      console.log('📋 Datos del formulario:', {
        email: formData.email,
        name: formData.name,
        companyName: formData.companyName,
        zonesCount: formData.zones.length,
        zones: formData.zones,
        zonesType: typeof formData.zones,
        isArray: Array.isArray(formData.zones)
      });

      // Validar que hay zonas
      if (!formData.zones || formData.zones.length === 0) {
        console.error('❌ ERROR: No hay zonas para guardar');
        setNotification({
          isOpen: true,
          type: 'warning',
          message: 'Por favor selecciona al menos una zona antes de finalizar el registro.',
          title: 'Zonas requeridas'
        });
        setIsLoading(false);
        return;
      }

      // Convertir logo a base64 si existe
      let logoBase64: string | undefined = undefined;
      if (formData.logo) {
        try {
          logoBase64 = await fileToBase64(formData.logo);
          console.log('✅ Logo convertido a base64');
        } catch (error) {
          console.error('❌ Error convirtiendo logo a base64:', error);
        }
      }

      // Guardar en la base de datos
      const companyId = await saveCompanyToDB({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        companyName: formData.companyName || 'Tu Inmobiliaria',
        logoUrl: logoBase64, // Guardar como base64 en lugar de blob URL
        zones: formData.zones, // Asegurar que es un array
        role: formData.role,
        googleDriveAccessToken: formData.googleDriveAccessToken || undefined,
        googleDriveRefreshToken: formData.googleDriveRefreshToken || undefined,
        googleDriveFolderId: formData.googleDriveFolderId || undefined
      });

      console.log('📋 Resultado de saveCompanyToDB:', companyId);

      if (companyId) {
        console.log('✅ Empresa registrada exitosamente con ID:', companyId);
        // Guardar en localStorage para persistencia
        localStorage.setItem('companyId', companyId);
        localStorage.setItem('companyName', formData.companyName || 'Tu Inmobiliaria');
        localStorage.setItem('zones', JSON.stringify(formData.zones));

        // Pass essential data back up to App
        onRegisterComplete({
          companyName: formData.companyName || 'Tu Inmobiliaria',
          zones: formData.zones
        });
      } else {
        console.error('❌ saveCompanyToDB retornó null o undefined');
        console.error('Esto puede significar:');
        console.error('1. El email ya está en uso');
        console.error('2. Error de conexión a la base de datos');
        console.error('3. Error al insertar los datos');
        setNotification({
          isOpen: true,
          type: 'error',
          message: 'El email puede estar en uso o hay un problema de conexión. Intenta con otro email o verifica la consola para más detalles.',
          title: 'Error al registrar'
        });
      }
    } catch (error) {
      console.error('❌ Error en registro (catch):', error);
      console.error('Error completo:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al registrar. Por favor intenta de nuevo. Revisa la consola para más detalles.',
        title: 'Error al registrar'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-2xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative">

        {/* Progress Dots */}
        <div className="flex gap-3 mb-10 justify-center">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-500 ${s <= step ? 'bg-primary-500' : 'bg-gray-200'
                } ${s === step ? 'w-8' : 'w-4'}`}
              style={s <= step ? { background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' } : {}}
            />
          ))}
        </div>

        {/* STEP 1: PERSONAL INFO */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Crea tu cuenta</h1>
              <p className="text-gray-500 font-light">Comienza a gestionar tus prospectos hoy mismo.</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="relative group">
                <User className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Nombre Completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all text-gray-700 font-medium"
                />
              </div>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                  type="email"
                  placeholder="Correo Profesional"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all text-gray-700 font-medium"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                  type="password"
                  placeholder="Crear Contraseña"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    // Validar cuando cambia la contraseña
                    if (formData.confirmPassword && e.target.value !== formData.confirmPassword) {
                      setPasswordError('Las contraseñas no coinciden');
                    } else {
                      setPasswordError('');
                    }
                  }}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all text-gray-700 font-medium"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                  type="password"
                  placeholder="Confirmar Contraseña"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value });
                    // Validar cuando cambia la confirmación
                    if (formData.password && e.target.value !== formData.password) {
                      setPasswordError('Las contraseñas no coinciden');
                    } else {
                      setPasswordError('');
                    }
                  }}
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl border outline-none transition-all text-gray-700 font-medium ${passwordError
                      ? 'border-red-300 focus:border-red-500 focus:bg-red-50/10'
                      : 'border-gray-200 focus:border-indigo-500 focus:bg-indigo-50/10'
                    }`}
                />
              </div>
              {passwordError && (
                <div className="text-red-500 text-sm font-medium flex items-center gap-2 animate-fade-in-up">
                  <X size={16} />
                  {passwordError}
                </div>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={!formData.name || !formData.email || !formData.password || !formData.confirmPassword || passwordError !== '' || formData.password !== formData.confirmPassword}
              className={`w-full py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${!formData.name || !formData.email || !formData.password || !formData.confirmPassword || passwordError !== '' || formData.password !== formData.confirmPassword
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'
                }`}
            >
              Continuar <ArrowRight size={18} />
            </button>

            <div className="mt-6 text-center">
              <button onClick={onGoToLogin} className="text-sm text-primary-600 font-medium hover:text-primary-800">
                ¿Ya tienes cuenta? <span className="font-bold">Inicia sesión</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: COMPANY INFO */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Tu Identidad</h1>
              <p className="text-gray-500 font-light">Personaliza cómo te verán tus clientes.</p>
            </div>

            <div className="space-y-6 mb-8">
              <div className="flex flex-col items-center gap-4">
                <label className="relative w-32 h-32 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group bg-gray-50">
                  {formData.logo ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-indigo-50 rounded-3xl">
                      <Check className="text-indigo-600" size={32} />
                    </div>
                  ) : (
                    <>
                      <Upload className="text-gray-400 group-hover:text-indigo-500 mb-2" size={24} />
                      <span className="text-xs text-gray-400 font-medium">Subir Logo</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, logo: e.target.files ? e.target.files[0] : null })}
                  />
                </label>
                <span className="text-xs text-gray-400">Formatos: PNG, JPG (Max 2MB)</span>
              </div>

              <div className="relative group">
                <Building className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Nombre de tu Empresa / Inmobiliaria"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all text-gray-700 font-medium"
                />
              </div>

              {/* Rol: Promotora o Broker */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 block">Rol</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'Broker' })}
                    className={`px-6 py-4 rounded-2xl border-2 transition-all font-semibold ${formData.role === 'Broker'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    Broker
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'Promotora' })}
                    className={`px-6 py-4 rounded-2xl border-2 transition-all font-semibold ${formData.role === 'Promotora'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    Promotora
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={handleBack} className="px-6 py-4 text-gray-400 hover:text-gray-600 font-medium">
                Atrás
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.companyName}
                className={`flex-1 py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${!formData.companyName
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'
                  }`}
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GOOGLE DRIVE INTEGRATION */}
        {step === 3 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <div className="flex justify-center mb-4">
                <div className="bg-indigo-100 p-4 rounded-full">
                  <Cloud className="text-indigo-600" size={32} />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Integración con Google Drive</h1>
              <p className="text-gray-500 font-light">Conecta tu cuenta para organizar documentos automáticamente.</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-2">¿Por qué es importante?</h3>
                  <ul className="text-sm text-amber-800 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-1">•</span>
                      <span><strong>Organización automática:</strong> Todos los documentos de tus prospectos se guardan automáticamente en carpetas organizadas por cliente.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-1">•</span>
                      <span><strong>Acceso fácil:</strong> Puedes acceder a todos los documentos directamente desde Google Drive sin necesidad de la aplicación.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-1">•</span>
                      <span><strong>Backup automático:</strong> Tus documentos estarán seguros en la nube de Google.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-1">•</span>
                      <span><strong>Obligatorio:</strong> Esta integración es necesaria para que el sistema funcione correctamente.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mb-8">
              {isGoogleDriveConnected ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Check className="text-green-600 mx-auto mb-3" size={32} />
                  <p className="text-green-800 font-semibold mb-1">Google Drive conectado</p>
                  <p className="text-green-700 text-sm">Tu cuenta está lista para guardar documentos automáticamente</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    try {
                      // Guardar estado temporal en localStorage para recuperarlo después del OAuth
                      localStorage.setItem('registrationFormData', JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        password: formData.password,
                        confirmPassword: formData.confirmPassword,
                        companyName: formData.companyName,
                        logo: formData.logo ? 'hasLogo' : null,
                        zones: formData.zones,
                        role: formData.role
                      }));
                      initiateGoogleDriveAuth();
                    } catch (error) {
                      console.error('Error iniciando Google Drive auth:', error);
                      setNotification({
                        isOpen: true,
                        type: 'error',
                        message: 'Error al conectar con Google Drive. Por favor verifica la configuración.',
                        title: 'Error de conexión'
                      });
                    }
                  }}
                  className="w-full py-4 px-6 bg-white border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Conectar con Google Drive
                </button>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={handleBack} className="px-6 py-4 text-gray-400 hover:text-gray-600 font-medium">
                Atrás
              </button>

              {!isGoogleDriveConnected && (
                <button
                  onClick={handleNext}
                  className="px-6 py-4 text-indigo-600 hover:text-indigo-800 font-medium hover:bg-indigo-50 rounded-xl transition-all"
                >
                  Hacerlo más tarde
                </button>
              )}

              <button
                onClick={handleNext}
                disabled={!isGoogleDriveConnected}
                className={`flex-1 py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${!isGoogleDriveConnected
                    ? 'hidden' // Ocultar el botón principal si no está conectado, usar "Hacerlo más tarde"
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                  }`}
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ZONES */}
        {step === 4 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Tu Mercado</h1>
              <p className="text-gray-500 font-light max-w-sm mx-auto">
                Define las zonas donde operas. <br />
                <span className="text-indigo-600 font-medium">Importante:</span> Estas serán las opciones que verán tus clientes en la calculadora.
              </p>
            </div>

            <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 mb-8">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <MapPin className="absolute left-4 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddZone()}
                    placeholder="Ej: Costa del Este, Obarrio..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-indigo-500 outline-none bg-white"
                  />
                </div>
                <button
                  onClick={handleAddZone}
                  disabled={!newZone.trim()}
                  className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-100"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {formData.zones.map(zone => (
                  <div key={zone} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
                    {zone}
                    <button
                      onClick={() => handleDeleteZone(zone)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {formData.zones.length === 0 && (
                  <p className="text-sm text-gray-400 italic w-full text-center py-4">Agrega al menos una zona para continuar.</p>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={handleBack} className="px-6 py-4 text-gray-400 hover:text-gray-600 font-medium">
                Atrás
              </button>
              <button
                onClick={handleFinish}
                disabled={formData.zones.length === 0 || isLoading}
                className={`flex-1 py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${formData.zones.length === 0 || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Finalizar Registro <Check size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        type={notification.type}
        message={notification.message}
        title={notification.title}
        duration={5000}
      />
    </div>
  );
};