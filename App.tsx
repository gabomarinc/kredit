import React, { useState, useEffect } from 'react';
import { Layout } from './components/ui/Layout';
import { ProspectFlow } from './components/ProspectFlow';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { AuthSelection } from './components/AuthSelection';
import { ZONES_PANAMA } from './constants';
import { getCompanyById } from './utils/db';

type AuthState = 'selection' | 'login' | 'register' | 'authenticated';

function App() {
  // Check for embed mode query param
  const [isEmbedMode, setIsEmbedMode] = useState(false);
  const [embedCompanyId, setEmbedCompanyId] = useState<string | null>(null);
  const [isLoadingEmbedCompany, setIsLoadingEmbedCompany] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('mode') === 'embed';
    const companyId = params.get('company_id');
    
    if (isEmbed) {
      setIsEmbedMode(true);
      if (companyId) {
        setEmbedCompanyId(companyId);
      }
      // Removed transparency logic: We want to keep the Aurora background!
    }
  }, []);

  // Standard App State
  const [authState, setAuthState] = useState<AuthState>('selection');
  const [isAdminView, setIsAdminView] = useState(true); 
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // App Global Data
  const [zones, setZones] = useState<string[]>(ZONES_PANAMA);
  const [companyName, setCompanyName] = useState('Krêdit');

  // Verificar sesión guardada al cargar la aplicación
  useEffect(() => {
    const checkSession = async () => {
      const savedCompanyId = localStorage.getItem('companyId');
      
      if (savedCompanyId) {
        try {
          console.log('🔄 Verificando sesión guardada...');
          const company = await getCompanyById(savedCompanyId);
          
          if (company) {
            console.log('✅ Sesión válida encontrada, restaurando...');
            // Restaurar datos de la empresa
            setCompanyName(company.companyName);
            setZones(company.zones.length > 0 ? company.zones : ZONES_PANAMA);
            // Restaurar datos en localStorage por si acaso
            localStorage.setItem('companyId', company.id);
            localStorage.setItem('companyName', company.companyName);
            localStorage.setItem('zones', JSON.stringify(company.zones));
            // Establecer como autenticado
            setAuthState('authenticated');
            setIsAdminView(true);
          } else {
            console.log('⚠️ Sesión inválida, limpiando...');
            // Limpiar datos inválidos
            localStorage.removeItem('companyId');
            localStorage.removeItem('companyName');
            localStorage.removeItem('zones');
            setAuthState('selection');
          }
        } catch (error) {
          console.error('❌ Error verificando sesión:', error);
          // En caso de error, limpiar y mostrar pantalla de selección
          localStorage.removeItem('companyId');
          localStorage.removeItem('companyName');
          localStorage.removeItem('zones');
          setAuthState('selection');
        }
      } else {
        console.log('ℹ️ No hay sesión guardada');
        setAuthState('selection');
      }
      
      setIsCheckingSession(false);
    };

    // Solo verificar sesión si no estamos en modo embed
    if (!isEmbedMode) {
      checkSession();
    } else {
      setIsCheckingSession(false);
    }
  }, [isEmbedMode]);

  const handleLogin = async () => {
    // Cargar datos de la empresa desde localStorage o DB
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (company) {
        setCompanyName(company.companyName);
        setZones(company.zones.length > 0 ? company.zones : ZONES_PANAMA);
      }
    } else {
      // Si no hay companyId, usar valores por defecto
      const savedZones = localStorage.getItem('zones');
      if (savedZones) {
        try {
          setZones(JSON.parse(savedZones));
        } catch (e) {
          setZones(ZONES_PANAMA);
        }
      }
      const savedCompanyName = localStorage.getItem('companyName');
      if (savedCompanyName) {
        setCompanyName(savedCompanyName);
      }
    }
    
    setAuthState('authenticated');
    setIsAdminView(true); // Land on dashboard
  };

  const handleRegisterComplete = (data: { companyName: string; zones: string[] }) => {
    setCompanyName(data.companyName);
    setZones(data.zones.length > 0 ? data.zones : ZONES_PANAMA);
    setAuthState('authenticated');
    setIsAdminView(true); // Land on dashboard
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
  // This renders ONLY the form, no admin header, no login checks. 
  // Designed to be inside an iframe on the client's website.
  if (isEmbedMode) {
    // Show loading while fetching company data
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
        {/* We pass true to isEmbed to remove header/nav elements in ProspectFlow if needed */}
        <ProspectFlow 
          availableZones={zones} 
          companyName={companyName}
          isEmbed={true}
        />
      </div>
    );
  }

  // --- STANDARD APP FLOW (For the Agency/Client) ---

  // Mostrar loading mientras se verifica la sesión
  if (isCheckingSession) {
    return (
      <Layout isWelcomeScreen>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-500">Verificando sesión...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // 1. Initial Selection Screen
  if (authState === 'selection') {
    return (
      <Layout isWelcomeScreen>
        <AuthSelection 
          onLogin={() => setAuthState('login')}
          onRegister={() => setAuthState('register')}
        />
      </Layout>
    );
  }

  // 2. Login Screen
  if (authState === 'login') {
    return (
      <Layout>
        <div className="absolute top-6 left-6 z-10">
          <button onClick={() => setAuthState('selection')} className="text-gray-400 hover:text-gray-600 font-medium text-sm">
            ← Volver
          </button>
        </div>
        <Login 
          onLogin={handleLogin} 
          onGoToRegister={() => setAuthState('register')} 
        />
      </Layout>
    );
  }

  // 3. Register Screen
  if (authState === 'register') {
    return (
      <Layout>
        <div className="absolute top-6 left-6 z-10">
          <button onClick={() => setAuthState('selection')} className="text-gray-400 hover:text-gray-600 font-medium text-sm">
            ← Volver
          </button>
        </div>
        <Register 
          onRegisterComplete={handleRegisterComplete}
          onGoToLogin={() => setAuthState('login')}
        />
      </Layout>
    );
  }

  const handleLogout = () => {
    // Limpiar datos de sesión
    localStorage.removeItem('companyId');
    localStorage.removeItem('companyName');
    localStorage.removeItem('zones');
    // Volver a la pantalla de selección
    setAuthState('selection');
    setIsAdminView(true);
  };

  // 4. Main Admin Interface (Authenticated)
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