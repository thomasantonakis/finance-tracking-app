import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Settings, Calendar, BarChart3, Wallet } from 'lucide-react';
import { createPageUrl } from './utils';
import { Toaster } from 'sonner';

export default function Layout({ children, currentPageName }) {
  const navItems = [
    { name: 'Home', icon: Home, path: 'Home' },
    { name: 'Accounts', icon: Wallet, path: 'Accounts' },
    { name: 'Calendar', icon: Calendar, path: 'Calendar' },
    { name: 'Charts', icon: BarChart3, path: 'Charts' },
    { name: 'Settings', icon: Settings, path: 'Settings' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <Toaster position="top-right" richColors closeButton />
      
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-1 py-2 shadow-lg z-50"
        style={{ height: 'calc(5rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-around items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.path;
              
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.path)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${
                    isActive 
                      ? 'text-slate-900 bg-slate-100' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
