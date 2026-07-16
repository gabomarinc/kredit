import React, { useEffect, useRef } from 'react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { LayoutDashboard, LogIn, UserPlus, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, register, isLoading, isAuthenticated } = useKindeAuth();
  const hasAttemptedSilentLogin = useRef(false);

  useEffect(() => {
    // Check if the URL has prompt=none
    const params = new URLSearchParams(window.location.search);
    const promptParam = params.get('prompt');

    if (promptParam === 'none' && !isLoading && !isAuthenticated && !hasAttemptedSilentLogin.current) {
      hasAttemptedSilentLogin.current = true;
      console.log('🔄 Intentando inicio de sesión silencioso (prompt=none)...');
      
      // The Kinde React SDK allows passing authUrlParams
      login({
        authUrlParams: {
          prompt: 'none'
        }
      });
    }
  }, [isLoading, isAuthenticated, login]);

  // If we are attempting silent login, show a loading state
  if (hasAttemptedSilentLogin.current && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Verificando sesión centralizada...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-md animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden text-center">
        
        {/* Decoracion de fondo sutil */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(240, 253, 251, 0.8) 0%, rgba(230, 250, 247, 0.6) 100%)' }}></div>
        
        <div className="mb-10 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)', boxShadow: '0 20px 25px -5px rgba(41, 190, 165, 0.2), 0 10px 10px -5px rgba(41, 190, 165, 0.1)' }}>
            <LayoutDashboard className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Kredit</h1>
          <p className="text-gray-500 font-light">Identificación única para tus herramientas de Konsul.</p>
        </div>

        <div className="space-y-4 relative z-10">
          <button
            onClick={() => login()}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex justify-center items-center gap-2 group"
          >
            <LogIn size={18} />
            Iniciar Sesión con Kinde
          </button>
          
          <button
            onClick={() => register()}
            className="w-full bg-white text-gray-700 border border-gray-200 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all flex justify-center items-center gap-2"
          >
            <UserPlus size={18} />
            Crear cuenta nueva
          </button>
        </div>
      </div>
    </div>
  );
};