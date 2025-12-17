import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, LayoutDashboard, Loader2 } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-md animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
        
        {/* Decoracion de fondo sutil */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(240, 253, 251, 0.8) 0%, rgba(230, 250, 247, 0.6) 100%)' }}></div>
        
        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)', boxShadow: '0 20px 25px -5px rgba(41, 190, 165, 0.2), 0 10px 10px -5px rgba(41, 190, 165, 0.1)' }}>
            <LayoutDashboard className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Bienvenido de nuevo</h1>
          <p className="text-gray-500 font-light">Ingresa a tu espacio de trabajo.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
              <input
                type="email"
                placeholder="Correo Electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-primary-500 focus:bg-primary-50/10 transition-all text-gray-700 font-medium"
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-primary-500 focus:bg-primary-50/10 transition-all text-gray-700 font-medium"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs font-semibold text-primary-500 hover:text-primary-700 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex justify-center items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                Iniciar Sesión <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center relative z-10">
          <p className="text-gray-400 text-sm">
            ¿No tienes cuenta?{' '}
            <button onClick={onGoToRegister} className="text-primary-600 font-bold hover:text-primary-800 transition-colors">
              Crear cuenta gratis
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setShowForgotPassword(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative z-10 animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Restablecer Contraseña</h3>
            <p className="text-gray-600 text-sm mb-6">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Correo Electrónico</label>
                <input
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none focus:bg-primary-50/10 transition-all text-gray-700 font-medium"
                  disabled={isSendingReset}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                  }}
                  disabled={isSendingReset}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!forgotPasswordEmail) {
                      setNotification({
                        isOpen: true,
                        type: 'error',
                        message: 'Por favor ingresa tu correo electrónico',
                        title: 'Email requerido'
                      });
                      return;
                    }

                    setIsSendingReset(true);
                    try {
                      const response = await fetch('/api/password-reset/request', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email: forgotPasswordEmail }),
                      });

                      const data = await response.json();

                      if (data.success) {
                        setNotification({
                          isOpen: true,
                          type: 'success',
                          message: data.message || 'Si el email existe, recibirás un enlace para resetear tu contraseña.',
                          title: 'Email enviado'
                        });
                        setShowForgotPassword(false);
                        setForgotPasswordEmail('');
                      } else {
                        setNotification({
                          isOpen: true,
                          type: 'error',
                          message: data.error || 'Error al enviar el email',
                          title: 'Error'
                        });
                      }
                    } catch (error) {
                      console.error('Error:', error);
                      setNotification({
                        isOpen: true,
                        type: 'error',
                        message: 'Error al enviar el email. Por favor intenta de nuevo.',
                        title: 'Error de conexión'
                      });
                    } finally {
                      setIsSendingReset(false);
                    }
                  }}
                  disabled={isSendingReset}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg text-white disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }}
                  onMouseEnter={(e) => !isSendingReset && (e.currentTarget.style.background = 'linear-gradient(135deg, #1fa890 0%, #1a8674 100%)')}
                  onMouseLeave={(e) => !isSendingReset && (e.currentTarget.style.background = 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)')}
                >
                  {isSendingReset ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Enlace'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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