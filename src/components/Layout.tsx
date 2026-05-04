import { Link, useLocation } from 'react-router-dom';
import { Home, Users, MapPin, Sparkles, LogOut, Menu, X, Club, BarChart3 } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
  user: any;
  onLogout: () => void;
}

export function Layout({ children, user, onLogout }: LayoutProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/players', label: 'Players', icon: Users },
    { href: '/stats', label: 'Statistics', icon: BarChart3 },
    { href: '/locations', label: 'Locations', icon: MapPin },
    { href: '/staff', label: 'Staff', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-brand-sidebar border-r border-brand-border flex-col p-5 sticky top-0 h-screen">
        <div className="mb-8 flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg modern-shadow text-white">
            <Club size={20} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none text-brand-text">Game Night</h1>
            <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 font-bold mt-0.5">Management Hub</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5">
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-400 block mb-3 mt-4 px-2">Primary Navigation</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all font-sans text-[10px] uppercase tracking-widest font-bold",
                location.pathname === item.href
                  ? "bg-white border border-brand-border text-brand-text modern-shadow"
                  : "text-slate-400 hover:text-brand-text hover:bg-slate-100/50"
              )}
            >
              <item.icon size={14} className={cn(location.pathname === item.href ? "text-emerald-600" : "text-slate-300")} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-5 border-t border-brand-border">
          <div className="flex items-center gap-2.5 mb-4 p-2 rounded-xl bg-white border border-brand-border/50 modern-shadow overflow-hidden">
            <img 
              src={user.user_metadata?.avatar_url || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.displayName || 'User')}&background=random`} 
              referrerPolicy="no-referrer"
              alt="" 
              className="w-8 h-8 rounded-lg border border-brand-border shadow-sm shrink-0 object-cover" 
            />
            <div className="overflow-hidden">
              <p className="text-[9px] font-black uppercase tracking-tight truncate leading-tight">
                {user.user_metadata?.full_name || user.displayName || 'User'}
              </p>
              <p className="text-[8px] font-mono text-slate-400 truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all font-mono text-[9px] uppercase tracking-widest font-bold"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <header className="md:hidden bg-white border-b border-brand-border p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Club className="text-emerald-600" size={20} fill="currentColor" />
          <h1 className="text-lg font-black uppercase tracking-tight">Game Night</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-500">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white p-8 flex flex-col pt-24">
          <nav className="space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-6 py-5 rounded-2xl transition-all font-black uppercase text-xl tracking-tight border border-transparent shadow-sm",
                  location.pathname === item.href 
                    ? "bg-slate-900 text-white modern-shadow shadow-slate-900/40" 
                    : "text-slate-500 bg-slate-50 border-slate-100 hover:bg-slate-100"
                )}
              >
                <item.icon size={28} className={cn(location.pathname === item.href ? "text-emerald-400" : "text-slate-300")} />
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={onLogout}
            className="mt-auto py-6 bg-rose-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest modern-shadow shadow-rose-600/30"
          >
            Terminate Session
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}
