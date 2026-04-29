import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session, Location } from '../types';
import { format, parseISO } from 'date-fns';
import { Plus, ChevronRight, Activity, Calendar, MapPin, DollarSign, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);
      
      const { data: locationsData } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });

      if (sessionsData) setSessions(sessionsData as Session[]);
      if (locationsData) setLocations(locationsData as Location[]);
      setLoading(false);
    }

    fetchData();

    // Set up real-time subscriptions
    const sessionsSubscription = supabase
      .channel('sessions-channel')
      .on('postgres_changes', { event: '*', table: 'sessions', schema: 'public' }, () => fetchData())
      .subscribe();

    const locationsSubscription = supabase
      .channel('locations-channel')
      .on('postgres_changes', { event: '*', table: 'locations', schema: 'public' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsSubscription);
      supabase.removeChannel(locationsSubscription);
    };
  }, []);

  const createSession = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          date: new Date().toISOString(),
          locationId,
          status: 'active',
          staffIds: [],
          totalBuyIn: 0,
          totalPayout: 0,
          createdAt: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) navigate(`/sessions/${data.id}`);
    } catch (error) {
      console.error("Create session failed:", error);
    }
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete || deleteConfirmationInput !== 'PURGE') return;

    setIsDeleting(true);
    try {
      // In Supabase, cascading deletes should be handled by schema, 
      // but if not, we do it manually. Assuming FKs are set to cascade.
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionToDelete.id);

      if (error) throw error;

      setSessionToDelete(null);
      setDeleteConfirmationInput('');
      
      // Explicitly refresh data after delete to ensure immediate UI update
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);
      if (sessionsData) setSessions(sessionsData as Session[]);
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 md:p-12 lg:p-16 max-w-7xl mx-auto space-y-12">
      {/* Modern Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded leading-none">System Active</span>
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">Dashboard</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm border-l-2 border-emerald-500 pl-4">
            Unified operations control for active and historical poker sessions.
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-sans text-xs uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
          >
            <Plus size={18} />
            New Session
          </button>
          <button 
            onClick={() => import('../lib/seed').then(m => m.seedDatabase())}
            className="px-4 py-1 text-[9px] font-mono uppercase tracking-widest text-slate-300 hover:text-slate-600 transition-all"
          >
            Reset Sample Environment
          </button>
        </div>
      </div>

      {/* High-Density Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-brand-border p-8 rounded-2xl modern-shadow group hover:border-slate-300 transition-all">
          <div className="flex items-center gap-4 mb-4">
             <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors"><Activity size={20} /></div>
             <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Live Circuits</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-slate-900">{sessions.filter(s => s.status === 'active').length}</p>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Active Now</span>
          </div>
        </div>

        <div className="bg-white border border-brand-border p-8 rounded-2xl modern-shadow group hover:border-slate-300 transition-all">
          <div className="flex items-center gap-4 mb-4">
             <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors"><DollarSign size={20} /></div>
             <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Market Volume</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-slate-900">{formatCurrency(sessions.reduce((acc, s) => acc + (s.totalBuyIn || 0), 0))}</p>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Gross</span>
          </div>
        </div>

        <div className="bg-white border border-brand-border p-8 rounded-2xl modern-shadow group hover:border-slate-300 transition-all">
          <div className="flex items-center gap-4 mb-4">
             <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors"><ChevronRight size={20} /></div>
             <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Capital Velocity</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-slate-900 text-emerald-600">
              {formatCurrency(sessions.length ? sessions.reduce((acc, s) => acc + (s.totalPayout || 0), 0) / sessions.length : 0)}
            </p>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Net</span>
          </div>
        </div>
      </div>

      {/* Grid List View */}
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-brand-border pb-4">
          <h2 className="text-[11px] uppercase font-black tracking-widest text-slate-400">Archived Deployment Journal</h2>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Real-time Feed Enabled</span>
          </div>
        </div>
        
        {sessions.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-brand-border rounded-2xl bg-slate-50/50">
            <p className="text-slate-400 font-medium mb-6 uppercase tracking-widest text-xs">No Deployment Logs Found</p>
            <button 
              onClick={() => import('../lib/seed').then(m => m.seedDatabase())}
              className="px-12 py-4 bg-white border border-brand-border text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest modern-shadow hover:bg-slate-900 hover:text-white transition-all"
            >
              Seed Environment
            </button>
          </div>
        ) : (
          <div className="bg-white border border-brand-border rounded-2xl overflow-hidden modern-shadow">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-brand-border">
                  <th className="px-8 py-5 font-mono text-[9px] uppercase tracking-widest text-slate-400 font-bold">Deployment ID</th>
                  <th className="px-8 py-5 font-mono text-[9px] uppercase tracking-widest text-slate-400 font-bold">Venue</th>
                  <th className="px-8 py-5 font-mono text-[9px] uppercase tracking-widest text-slate-400 font-bold">Financial Pool</th>
                  <th className="px-8 py-5 font-mono text-[9px] uppercase tracking-widest text-slate-400 font-bold text-center">Security Status</th>
                  <th className="px-8 py-5 font-mono text-[9px] uppercase tracking-widest text-slate-400 font-bold text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {sessions.map((session) => (
                  <tr key={session.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{format(parseISO(session.date), 'MMM d, yyyy')}</span>
                        <span className="font-mono text-[8px] text-slate-300 uppercase mt-0.5 tracking-tighter">#{session.id.slice(0, 12)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-300" />
                        <span className="text-xs font-semibold text-slate-600">
                          {locations.find(l => l.id === session.locationId)?.name || 'Restricted Hub'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-900">{formatCurrency(session.totalBuyIn || 0)}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ring-inset",
                        session.status === 'active' 
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200" 
                          : "bg-slate-100 text-slate-500 ring-slate-200"
                      )}>
                        {session.status === 'active' && <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />}
                        {session.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation();
                            setSessionToDelete(session);
                            setDeleteConfirmationInput('');
                          }}
                          className="p-2 text-slate-300 hover:text-rose-600 transition-all group-hover:text-slate-400"
                        >
                          <Trash2 size={16} />
                        </button>
                        <Link
                          to={`/sessions/${session.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-6 py-2.5 bg-white border border-brand-border text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all modern-shadow"
                        >
                          Audit Log
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal Overlay */}
      <AnimatePresence>
        {isCreating && (
          <div key="create-session-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative bg-white border border-brand-border p-8 md:p-12 max-w-xl w-full rounded-3xl modern-shadow-lg"
            >
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Initialize Relay</h3>
                  <p className="text-sm text-slate-400 font-medium">Select location for session deployment.</p>
                </div>
                <button onClick={() => setIsCreating(false)} className="p-2 text-slate-300 hover:text-slate-600"><X size={24} /></button>
              </div>

              <div className="space-y-3">
                {locations.filter(l => l.active).map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => createSession(loc.id)}
                    className="group w-full flex items-center justify-between p-6 bg-slate-50 border border-brand-border hover:border-emerald-500 hover:bg-white rounded-2xl transition-all text-left"
                  >
                    <div>
                      <p className="font-black uppercase tracking-tight text-slate-700 group-hover:text-emerald-700 text-sm">{loc.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{loc.address}</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-600 transition-all" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <div key="delete-confirmation-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isDeleting) setSessionToDelete(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white border border-rose-100 p-8 md:p-12 max-w-xl w-full rounded-[2.5rem] modern-shadow-lg overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
              
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase tracking-widest rounded leading-none">Security Override Required</span>
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tight text-slate-900">Purge Session Data?</h3>
                </div>
                <button 
                  onClick={() => setSessionToDelete(null)}
                  disabled={isDeleting}
                  className="p-2 text-slate-300 hover:text-slate-600 disabled:opacity-0 transition-opacity"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl">
                  <p className="text-sm text-rose-800 font-medium leading-relaxed">
                    You are about to permanently delete all financial records, audit logs, and player entries for the session on <span className="font-black underline">{format(parseISO(sessionToDelete.date), 'MMMM d, yyyy')}</span>.
                  </p>
                  <p className="mt-4 text-[10px] text-rose-600 font-bold uppercase tracking-widest">
                    This action is computationally irreversible.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">
                    Type <span className="text-rose-500">PURGE</span> to confirm destruction
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Type PURGE here..."
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value.toUpperCase())}
                    disabled={isDeleting}
                    className="w-full bg-slate-50 border border-brand-border p-5 rounded-xl text-xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-sans tracking-widest placeholder:text-slate-200"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmDeleteSession}
                    disabled={deleteConfirmationInput !== 'PURGE' || isDeleting}
                    className="w-full flex items-center justify-center gap-3 py-5 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all modern-shadow-lg shadow-rose-200 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Executing Purge...
                      </div>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Confirm Permanent Purge
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSessionToDelete(null)}
                    disabled={isDeleting}
                    className="w-full py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Abort Directive
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
