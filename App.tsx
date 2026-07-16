import React, { useState, useEffect } from 'react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { Layout } from './components/ui/Layout';
import { ProspectFlow } from './components/ProspectFlow';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ZONES_PANAMA } from './constants';
import { getCompanyById, getCompanyByEmail } from './utils/db';

function App() {
  const { isLoading: isKindeLoading, isAuthenticated, user, logout } = useKindeAuth();

  // Check for embed mode query param
  const [isEmbedMode, setIsEmbedMode] = useState(false);
  const [embedCompanyId, setEmbedCompanyId] = useState<string | null>(null);
  const [embedFormId, setEmbedFormId] = useState<string | null>(null);
  const [isLoadingEmbedCompany, setIsLoadingEmbedCompany] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('mode') === 'embed';
    const companyId = params.get('company_id');
    const formId = params.get('form_id');

    if (isEmbed) {
      setIsEmbedMode(true);
      if (companyId) {
        setEmbedCompanyId(companyId);
      }
      if (formId) {
        setEmbedFormId(formId);
      }
    }
  }, []);

  // Standard App State
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [isAdminView, setIsAdminView] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // App Global Data
  const [zones, setZones] = useState<string[]>(ZONES_PANAMA);
  const [companyName, setCompanyName] = useState('Krêdit');

  // Verificar si el usuario está registrado en DB al cambiar estado de Kinde
  useEffect(() => {
    const checkUserOnboarding = async () => {
      if (isKindeLoading) return;

      if (isAuthenticated && user?.email) {
        try {
          console.log('🔄 Buscando datos de la empresa por email:', user.email);
          const company = await getCompanyByEmail(user.email);

          if (company) {
            console.log('✅ Empresa encontrada en DB:', company.companyName);
            setCompanyName(company.companyName);
            setZones(company.zones.length > 0 ? company.zones : ZONES_PANAMA);
            
            // Guardar localmente para compatibilidad con código existente
            localStorage.setItem('companyId', company.id);
            localStorage.setItem('companyName', company.companyName);
            localStorage.setItem('zones', JSON.stringify(company.zones));

            setIsOnboarded(true);
          } else {
            console.log('⚠️ Empresa no registrada en DB, requiere onboarding');
            setIsOnboarded(false);
          }
        } catch (error) {
          console.error('❌ Error buscando empresa en DB:', error);
          setIsOnboarded(false);
        }
      } else {
        console.log('ℹ️ Usuario no autenticado en Kinde');
        setIsOnboarded(null);
      }
      setIsCheckingSession(false);
    };

    if (!isEmbedMode) {
      checkUserOnboarding();
    } else {
      setIsCheckingSession(false);
    }
  }, [isKindeLoading, isAuthenticated, user, isEmbedMode]);

  const handleRegisterComplete = (data: { companyName: string; zones: string[] }) => {
    setCompanyName(data.companyName);
    setZones(data.zones.length > 0 ? data.zones : ZONES_PANAMA);
    setIsOnboarded(true);
    setIsAdminView(true); // Redirigir al dashboard
  };

  // Load company data when in embed mode with company_id
  useEffect(() => {
    const loadEmbedCompanyData = async () => {
      if (isEmbedMode && embedCompanyId && !isLoadingEmbedCompany) {
        setIsLoadingEmbedCompany(true);
        try {
          console.log('🔄 Cargando datos de empresa para embed mode:', embedCompanyId);
          const company = await getCompanyById(embedCompanyId);
          if (company) {
            console.log('✅ Datos de empresa cargados para embed:', company.companyName);
            setCompanyName(company.companyName);
            setZones(company.zones.length > 0 ? company.zones : ZONES_PANAMA);
          } else {
            console.warn('⚠️ Empresa no encontrada para embed, usando valores por defecto');
          }
        } catch (error) {
          console.error('❌ Error cargando datos de empresa para embed:', error);
        } finally {
          setIsLoadingEmbedCompany(false);
        }
      }
    };

    loadEmbedCompanyData();
  }, [isEmbedMode, embedCompanyId]);

  // --- EMBEDDED / PUBLIC VIEW MODE ---
  if (isEmbedMode) {
    if (isLoadingEmbedCompany) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-500">Cargando formulario...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen py-4 flex items-center justify-center">
        <ProspectFlow
          availableZones={zones}
          companyName={companyName}
          isEmbed={true}
          formId={embedFormId}
        />
      </div>
    );
  }

  // --- STANDARD APP FLOW ---

  // Mostrar loading si Kinde o la base de datos están verificando sesión
  if (isKindeLoading || isCheckingSession) {
    return (
      <Layout isWelcomeScreen>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
            <p className="text-gray-500">Verificando sesión...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // 1. Si no está autenticado, mostrar pantalla de login
  if (!isAuthenticated) {
    return (
      <Layout isWelcomeScreen>
        <Login />
      </Layout>
    );
  }

  // 2. Si está autenticado pero no está en la base de datos local, mostrar Asistente de Configuración (Onboarding)
  if (isAuthenticated && isOnboarded === false) {
    return (
      <Layout>
        <Register
          kindeUser={{
            email: user?.email || '',
            name: `${user?.given_name || ''} ${user?.family_name || ''}`.trim()
          }}
          onRegisterComplete={handleRegisterComplete}
        />
      </Layout>
    );
  }

  const handleLogout = async () => {
    // Limpiar datos locales
    localStorage.removeItem('companyId');
    localStorage.removeItem('companyName');
    localStorage.removeItem('zones');
    // Salir de Kinde
    await logout();
  };

  // 3. Interfaz Principal de Administración (Autenticado y Onboarded)
  return (
    <Layout
      isAdmin={isAdminView}
      onLogout={handleLogout}
      companyName={companyName}
    >
      <Dashboard
        availableZones={zones}
        onUpdateZones={setZones}
        companyName={companyName}
        onUpdateCompanyName={setCompanyName}
      />
    </Layout>
  );
}

export default App;