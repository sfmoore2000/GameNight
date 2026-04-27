/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SessionDetail } from './pages/SessionDetail';
import { PlayersPage } from './pages/PlayersPage';
import { LocationsPage } from './pages/LocationsPage';
import { StaffPage } from './pages/StaffPage';
import { LogIn, LogOut, Loader2, Club } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

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
