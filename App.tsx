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
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('mode') === 'embed';
    
    if (isEmbed) {
      setIsEmbedMode(true);
      // Removed transparency logic: We want to keep the Aurora background!
    }
  }, []);

  // Standard App State
  const [authState, setAuthState] = useState<AuthState>('selection');
  const [isAdminView, setIsAdminView] = useState(true); 
  
  // App Global Data
  const [zones, setZones] = useState<string[]>(ZONES_PANAMA);
  const [companyName, setCompanyName] = useState('Krêdit');

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

  // --- EMBEDDED / PUBLIC VIEW MODE ---
  // This renders ONLY the form, no admin header, no login checks. 
  // Designed to be inside an iframe on the client's website.
  if (isEmbedMode) {
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

  // 4. Main Admin Interface (Authenticated)
  return (
    <Layout 
      isAdmin={isAdminView} 
      // Only show toggle if we are not in admin view, or if we want to preview the flow
      onToggleRole={() => setIsAdminView(!isAdminView)}
      companyName={companyName}
    >
      {isAdminView ? (
        <Dashboard 
          availableZones={zones} 
          onUpdateZones={setZones} 
          companyName={companyName}
          onUpdateCompanyName={setCompanyName}
        />
      ) : (
        <ProspectFlow 
          availableZones={zones} 
          companyName={companyName}
        />
      )}
    </Layout>
  );
}

export default App;