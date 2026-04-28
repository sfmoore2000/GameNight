/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SessionDetail } from './pages/SessionDetail';
import { PlayersPage } from './pages/PlayersPage';
import { LocationsPage } from './pages/LocationsPage';
import { StaffPage } from './pages/StaffPage';
import { LogIn, Loader2, Club, ShieldAlert, ExternalLink, Settings } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>
            
            <h1 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Configuration Required</h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              To use this application with Supabase, you need to provide your project credentials.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-1">Create a Supabase Project</p>
                  <a 
                    href="https://supabase.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline"
                  >
                    supabase.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-1">Get your API Keys</p>
                  <p className="text-xs text-slate-500">Go to Settings &gt; API to find your Project URL and anon public key.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-1">Update Environment</p>
                  <p className="text-xs text-slate-500">Add <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to your settings.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Settings className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Platform Note</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                If you are running in AI Studio, use the Settings menu to add these variables. If on Vercel, use the Vercel Dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full text-center space-y-10 bg-white p-12 rounded-[2.5rem] modern-shadow-lg border border-brand-border">
          <div className="flex justify-center flex-col items-center gap-4">
             <div className="p-4 bg-emerald-600 text-white rounded-[2rem] modern-shadow">
               <Club size={48} fill="currentColor" />
             </div>
             <div>
               <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">Game Night</h1>
               <p className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.2em] font-bold mt-2">Precision Ledger System</p>
             </div>
          </div>
          
          <p className="text-slate-500 text-sm font-medium">Verify credentials to access active session protocols and member records.</p>
          
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-2xl modern-shadow transition-all hover:bg-slate-800 font-sans font-black uppercase text-xs tracking-widest"
          >
            <LogIn size={18} />
            Initialize Google Auth
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
