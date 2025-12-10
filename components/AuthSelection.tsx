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
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-60 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center text-center mb-12">
          {/* Logo */}
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-200 transform rotate-3 hover:rotate-6 transition-transform duration-500">
            <span className="text-3xl font-bold text-white tracking-tighter">L</span>
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
              className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 text-gray-900 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <LogIn size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Iniciar Sesión</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-4">
                Ya tengo una cuenta y quiero acceder a mi dashboard.
              </p>
              
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                Ingresar ahora <ArrowRight size={16} />
              </div>

              {/* Decoración sutil en hover */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
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
           <p className="text-xs text-gray-400 font-medium">Krêdit Platform • v1.0</p>
        </div>
      </div>
    </div>
  );
};