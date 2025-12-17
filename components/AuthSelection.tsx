import React from 'react';
import { LogIn, Sparkles, LayoutDashboard, UserPlus, ArrowRight } from 'lucide-react';

interface AuthSelectionProps {
  onLogin: () => void;
  onRegister: () => void;
}

export const AuthSelection: React.FC<AuthSelectionProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Container expanded to max-w-4xl to accommodate side-by-side cards comfortably */}
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(240, 253, 251, 0.8) 0%, rgba(230, 250, 247, 0.6) 100%)' }}></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl -ml-20 -mb-20 opacity-60 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(41, 190, 165, 0.15) 0%, rgba(240, 253, 251, 0.5) 100%)' }}></div>

        <div className="relative z-10 flex flex-col items-center text-center mb-12">
          {/* Logo */}
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl transform rotate-3 hover:rotate-6 transition-transform duration-500" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)', boxShadow: '0 20px 25px -5px rgba(41, 190, 165, 0.2), 0 10px 10px -5px rgba(41, 190, 165, 0.1)' }}>
            <span className="text-3xl font-bold text-white tracking-tighter">ê</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Bienvenido a Krêdit</h1>
          <p className="text-gray-500 text-lg leading-relaxed max-w-lg mx-auto font-light">
            Elige cómo deseas ingresar a tu espacio de trabajo inteligente.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 relative z-10">
            {/* Login Card */}
            <button
              onClick={onLogin}
              className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 text-gray-900 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:text-white transition-all duration-300" onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                <LogIn size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Iniciar Sesión</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-4">
                Ya tengo una cuenta y quiero acceder a mi dashboard.
              </p>
              
              <div className="flex items-center gap-2 text-primary-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                Ingresar ahora <ArrowRight size={16} />
              </div>

              {/* Decoración sutil en hover */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>

            {/* Register Card */}
            <button
              onClick={onRegister}
              className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-gray-50/30 hover:border-gray-900 hover:bg-gray-900 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center mb-6 shadow-lg shadow-gray-200 group-hover:bg-white group-hover:text-gray-900 transition-all duration-300 group-hover:scale-110">
                <Sparkles size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-white transition-colors">Crear Cuenta</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-4 group-hover:text-gray-300 transition-colors">
                Soy nuevo aquí y quiero configurar mi inmobiliaria.
              </p>

              <div className="flex items-center gap-2 text-white font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                Comenzar registro <ArrowRight size={16} />
              </div>

               {/* Decoración sutil en hover */}
               <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl -mr-16 -mb-16 opacity-0 group-hover:opacity-10 transition-opacity"></div>
            </button>
        </div>

        <div className="mt-12 text-center relative z-10">
           <p className="text-xs text-gray-400 font-medium">Kônsul Krêdit • v1.0</p>
        </div>
      </div>
    </div>
  );
};