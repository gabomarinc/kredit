import React, { useState, useEffect } from 'react';
import { Lock, Loader2, CheckCircle2, X } from 'lucide-react';
import { NotificationModal, NotificationType } from './ui/NotificationModal';

interface ResetPasswordProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onSuccess, onCancel }) => {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; message: string; title?: string }>({
    isOpen: false,
    type: 'error',
    message: ''
  });

  // Obtener token de la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      setToken(urlToken);
      validateToken(urlToken);
    } else {
      setIsValidating(false);
      setIsTokenValid(false);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Token no encontrado en la URL',
        title: 'Error'
      });
    }
  }, []);

  const validateToken = async (tokenToValidate: string) => {
    setIsValidating(true);
    try {
      const response = await fetch('/api/password-reset/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToValidate }),
      });

      const data = await response.json();

      if (data.valid) {
        setIsTokenValid(true);
      } else {
        setIsTokenValid(false);
        setNotification({
          isOpen: true,
          type: 'error',
          message: data.error || 'Token inválido o expirado',
          title: 'Error'
        });
      }
    } catch (error) {
      console.error('Error validando token:', error);
      setIsTokenValid(false);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al validar el token. Por favor intenta de nuevo.',
        title: 'Error de conexión'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Por favor completa todos los campos',
        title: 'Campos requeridos'
      });
      return;
    }

    if (password.length < 6) {
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'La contraseña debe tener al menos 6 caracteres',
        title: 'Contraseña inválida'
      });
      return;
    }

    if (password !== confirmPassword) {
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Las contraseñas no coinciden',
        title: 'Error de validación'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/password-reset/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setNotification({
          isOpen: true,
          type: 'success',
          message: 'Contraseña actualizada exitosamente. Redirigiendo al login...',
          title: 'Éxito'
        });
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setNotification({
          isOpen: true,
          type: 'error',
          message: data.error || 'Error al actualizar la contraseña',
          title: 'Error'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al actualizar la contraseña. Por favor intenta de nuevo.',
        title: 'Error de conexión'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-md animate-fade-in-up border border-white/50 backdrop-blur-sm text-center">
          <Loader2 size={48} className="animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-600">Validando token...</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-md animate-fade-in-up border border-white/50 backdrop-blur-sm text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <X className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Token Inválido</h1>
          <p className="text-gray-600 mb-6">
            El enlace de restablecimiento es inválido o ha expirado. Por favor solicita un nuevo enlace.
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl font-semibold text-sm transition-colors text-white"
            style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }}
          >
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-md animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
        
        {/* Decoracion de fondo sutil */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(240, 253, 251, 0.8) 0%, rgba(230, 250, 247, 0.6) 100%)' }}></div>
        
        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)', boxShadow: '0 20px 25px -5px rgba(41, 190, 165, 0.2), 0 10px 10px -5px rgba(41, 190, 165, 0.1)' }}>
            <Lock className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Nueva Contraseña</h1>
          <p className="text-gray-500 font-light">Crea una nueva contraseña para tu cuenta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder="Nueva Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-primary-500 focus:bg-primary-50/10 transition-all text-gray-700 font-medium"
                required
                minLength={6}
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder="Confirmar Contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none focus:border-primary-500 focus:bg-primary-50/10 transition-all text-gray-700 font-medium"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full text-white py-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = 'linear-gradient(135deg, #1fa890 0%, #1a8674 100%)')}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.background = 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)')}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                Actualizar Contraseña
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <button 
            onClick={onCancel}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Volver al Login
          </button>
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

