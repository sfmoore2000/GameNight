/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SessionDetail } from './pages/SessionDetail';
import { PlayersPage } from './pages/PlayersPage';
import { LocationsPage } from './pages/LocationsPage';
import { StaffPage } from './pages/StaffPage';
import { LogIn, Loader2, Club } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
