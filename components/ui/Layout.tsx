import React from 'react';
import { LayoutDashboard, User, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
  onToggleRole?: () => void;
  onLogout?: () => void;
  isWelcomeScreen?: boolean;
  companyName?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, isAdmin, onToggleRole, onLogout, isWelcomeScreen, companyName = "Krêdit" }) => {
  return (
    <div className={`min-h-screen font-sans text-pastel-dark selection:bg-indigo-100 selection:text-indigo-900 ${isWelcomeScreen ? 'flex flex-col justify-center' : ''}`}>
      
      {/* Universal Header */}
      <nav className="fixed top-0 w-full z-50 p-6 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-center pointer-events-auto">
          {/* Logo Area */}
          <div className="flex items-center gap-3 backdrop-blur-md bg-white/70 p-2 pr-4 rounded-2xl border border-white/50 shadow-sm transition-all hover:shadow-md cursor-default">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-sm transition-colors ${isAdmin ? 'bg-indigo-900' : 'bg-indigo-500'}`}>
              ê
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-gray-900 leading-none">{companyName}</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                {isAdmin ? 'Gerencia' : 'Real Estate'}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          {onLogout && (
            <button 
              onClick={onLogout}
              className="group flex items-center gap-2 bg-white/70 backdrop-blur-md hover:bg-white border border-white/50 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all text-xs font-semibold text-gray-600 hover:text-red-600"
            >
              <LogOut size={14} /> Cerrar Sesión
            </button>
          )}
        </div>
      </nav>

      <main className={`relative w-full pt-24 pb-12`}>
        {children}
      </main>
    </div>
  );
};