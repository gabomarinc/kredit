import React, { useState } from 'react';
import { HardHat, Briefcase, ArrowRight, Home } from 'lucide-react';

interface WelcomeScreenProps {
  onSelectRole: (role: 'promotor' | 'broker' | 'client') => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectRole }) => {
  const [selected, setSelected] = useState<'promotor' | 'broker' | null>(null);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      {/* Progress Dots */}
      <div className="flex gap-3 mb-8">
        <div className="w-8 h-1.5 rounded-full bg-indigo-500"></div>
        <div className="w-8 h-1.5 rounded-full bg-indigo-200"></div>
        <div className="w-8 h-1.5 rounded-full bg-gray-200"></div>
        <div className="w-8 h-1.5 rounded-full bg-gray-200"></div>
        <div className="w-8 h-1.5 rounded-full bg-gray-200"></div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">¿En qué sector estás?</h1>
          <p className="text-gray-500 text-lg font-light">Personalizaremos tu dashboard según tu rol.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Promotor Card */}
          <button
            onClick={() => setSelected('promotor')}
            className={`group text-left p-8 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden ${
              selected === 'promotor' 
                ? 'border-indigo-100 bg-indigo-50/30 shadow-lg scale-[1.02]' 
                : 'border-gray-100 bg-white hover:border-indigo-50 hover:shadow-md'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
              selected === 'promotor' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
            }`}>
              <HardHat size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Promotor Inmobiliario</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Desarrollo y venta de proyectos nuevos. Gestión de leads y analítica.
            </p>
            {selected === 'promotor' && (
              <div className="absolute top-6 right-6 w-4 h-4 bg-indigo-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Broker Card */}
          <button
            onClick={() => setSelected('broker')}
            className={`group text-left p-8 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden ${
              selected === 'broker' 
                ? 'border-indigo-100 bg-indigo-50/30 shadow-lg scale-[1.02]' 
                : 'border-gray-100 bg-white hover:border-indigo-50 hover:shadow-md'
            }`}
          >
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
              selected === 'broker' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
            }`}>
              <Briefcase size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Broker / Agente</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Intermediación, compra, venta y alquiler. Gestión de cartera de clientes.
            </p>
             {selected === 'broker' && (
              <div className="absolute top-6 right-6 w-4 h-4 bg-indigo-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button
            onClick={() => selected && onSelectRole(selected)}
            disabled={!selected}
            className={`flex items-center gap-2 px-10 py-4 rounded-full font-semibold transition-all duration-500 ${
              selected 
                ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm translate-y-0 opacity-100' 
                : 'bg-gray-50 text-gray-300 cursor-not-allowed translate-y-4 opacity-0'
            }`}
          >
            Continuar <ArrowRight size={18} />
          </button>

          <button 
             onClick={() => onSelectRole('client')}
             className="text-gray-400 text-sm hover:text-indigo-500 transition-colors flex items-center gap-2 mt-4"
          >
             <Home size={14} /> No soy agente, busco comprar una propiedad
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-gray-400 font-medium">
        Powered by Kônsul AI • Seguro & Encriptado
      </p>
    </div>
  );
};