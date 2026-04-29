import { User } from 'firebase/auth';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, MapPin, Sparkles, LogOut, Menu, X, Club, BarChart3 } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
  user: User;
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
      <aside className="hidden md:flex w-72 bg-brand-sidebar border-r border-brand-border flex-col p-8 sticky top-0 h-screen">
        <div className="mb-12 flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-lg modern-shadow text-white">
            <Club size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none text-brand-text">Game Night</h1>
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-600 font-bold mt-1">Management Hub</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 block mb-4 mt-8">Primary Navigation</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-sans text-xs uppercase tracking-widest font-bold",
                location.pathname === item.href
                  ? "bg-white border border-brand-border text-brand-text modern-shadow"
                  : "text-slate-400 hover:text-brand-text hover:bg-slate-100/50"
              )}
            >
              <item.icon size={16} className={cn(location.pathname === item.href ? "text-emerald-600" : "text-slate-300")} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-brand-border">
          <div className="flex items-center gap-3 mb-6 p-2 rounded-xl bg-white border border-brand-border/50 modern-shadow">
            <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-lg border border-brand-border shadow-sm" />
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-tight truncate">{user.displayName}</p>
              <p className="text-[9px] font-mono text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all font-mono text-[10px] uppercase tracking-widest font-bold"
          >
            <LogOut size={14} />
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
        <div className="md:hidden fixed inset-0 z-40 bg-brand-bg p-8 flex flex-col pt-24 text-center">
          <nav className="space-y-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "block text-3xl font-serif italic tracking-tighter py-2 border-b border-brand-border/10",
                  location.pathname === item.href ? "opacity-100" : "opacity-40"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={onLogout}
            className="mt-auto py-5 bg-black text-white border border-brand-border font-mono uppercase text-sm tracking-widest"
          >
            Logout
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
