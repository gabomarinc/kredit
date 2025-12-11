import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, LayoutDashboard } from 'lucide-react';
import { verifyLogin } from '../utils/db';
import { NotificationModal, NotificationType } from './ui/NotificationModal';

interface LoginProps {
  onLogin: () => void;
  onGoToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; message: string; title?: string }>({
    isOpen: false,
    type: 'error',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    try {
      console.log('🔄 Verificando credenciales...');
      const company = await verifyLogin(email, password);
      
      if (company) {
        console.log('✅ Login exitoso');
        // Aquí podrías guardar la información de la empresa en localStorage o estado global
        localStorage.setItem('companyId', company.id);
        localStorage.setItem('companyName', company.companyName);
        localStorage.setItem('zones', JSON.stringify(company.zones));
        onLogin();
      } else {
        console.error('❌ Credenciales incorrectas');
        setNotification({
          isOpen: true,
          type: 'error',
          message: 'Email o contraseña incorrectos. Por favor intenta de nuevo.',
          title: 'Credenciales incorrectas'
        });
      }
    } catch (error) {
      console.error('❌ Error en login:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al iniciar sesión. Por favor intenta de nuevo.',
        title: 'Error de conexión'
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-md animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
        
        {/* Decoracion de fondo sutil */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <LayoutDashboard className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Bienvenido de nuevo</h1>
          <p className="text-gray-500 font-light">Ingresa a tu espacio de trabajo.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input
                type="email"
                placeholder="Correo Electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all text-gray-700 font-medium"
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all text-gray-700 font-medium"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <a href="#" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">¿Olvidaste tu contraseña?</a>
          </div>

          <button
            type="submit"
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex justify-center items-center gap-2 group"
          >
            Iniciar Sesión <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 text-center relative z-10">
          <p className="text-gray-400 text-sm">
            ¿No tienes cuenta?{' '}
            <button onClick={onGoToRegister} className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
              Crear cuenta gratis
            </button>
          </p>
        </div>
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