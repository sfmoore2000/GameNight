import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Player } from '../types';
import { Plus, User, Mail, Shield, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlayers() {
      const { data } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });
      if (data) setPlayers(data as Player[]);
    }

    fetchPlayers();

    const subscription = supabase
      .channel('players-channel')
      .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchPlayers())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const deletePlayer = async (id: string) => {
    if (!window.confirm('PERMANENT DELETION: This will remove this member and all associated session history. This action cannot be undone. Proceed?')) return;
    
    setIsDeleting(id);
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setPlayers(players.filter(p => p.id !== id));
    } catch (error) {
      console.error("Delete player failed:", error);
      alert("Could not delete member. They may have active session records that need to be cleared first.");
    } finally {
      setIsDeleting(null);
    }
  };

  const savePlayer = async () => {
    if (!newName) return;
    try {
      if (editingPlayer) {
        const { error } = await supabase
          .from('players')
          .update({
            name: newName,
            email: newEmail,
          })
          .eq('id', editingPlayer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('players')
          .insert([{
            name: newName,
            email: newEmail,
            active: true,
            createdAt: new Date().toISOString()
          }]);
        if (error) throw error;
      }

      // Refresh local state
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });
      if (playersData) setPlayers(playersData as Player[]);

      setNewName('');
      setNewEmail('');
      setIsAdding(false);
      setEditingPlayer(null);
    } catch (error) {
      console.error("Save player failed:", error);
    }
  };

  const startEdit = (player: Player) => {
    setEditingPlayer(player);
    setNewName(player.name);
    setNewEmail(player.email || '');
    setIsAdding(true);
  };

  const togglePlayerStatus = async (player: Player) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({
          active: !player.active
        })
        .eq('id', player.id);
      if (error) throw error;

      // Refresh local state
      const { data } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });
      if (data) setPlayers(data as Player[]);
    } catch (error) {
      console.error("Toggle status failed:", error);
    }
  };

  return (
    <div className="p-8 md:p-12 lg:p-16 max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-brand-border pb-8 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded leading-none">Security Registry</span>
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">Members</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm">Managing the verified roster of elite poker contestants.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-sans text-xs uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
        >
          <Plus size={18} />
          New Member
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-brand-border p-10 rounded-[2rem] modern-shadow relative grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Full Display Identity</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-4 rounded-xl outline-none font-bold text-lg transition-all"
              placeholder="Ex: Alexander Hamilton"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Communication Node / Email</label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-4 rounded-xl outline-none font-bold text-lg transition-all"
              placeholder="email@vault.com"
            />
          </div>
          <div className="md:col-span-2 flex gap-4 pt-4">
            <button onClick={savePlayer} className="flex-1 py-4 bg-emerald-600 text-white font-sans text-xs font-black uppercase tracking-widest hover:bg-emerald-700 rounded-xl modern-shadow transition-all">
              {editingPlayer ? 'Apply Changes' : 'Authorize Profile'}
            </button>
            <button onClick={() => { setIsAdding(false); setEditingPlayer(null); setNewName(''); setNewEmail(''); }} className="px-10 py-4 border border-brand-border text-slate-400 font-sans text-xs font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {players.map((player) => (
          <div key={player.id} className="group flex items-center gap-6 p-6 bg-white border border-brand-border rounded-2xl hover:border-slate-300 transition-all modern-shadow relative overflow-hidden">
            <div className={cn(
              "w-16 h-16 flex items-center justify-center rounded-xl border transition-all shrink-0",
              player.active ? "bg-slate-50 border-brand-border text-slate-900" : "bg-slate-100 border-slate-200 grayscale opacity-40 text-slate-400"
            )}>
              <User size={24} strokeWidth={2} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                 <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 truncate">{player.name}</h3>
                 {!player.active && <span className="text-[8px] font-black uppercase tracking-widest bg-slate-200 px-2 py-0.5 rounded">Access Revoked</span>}
              </div>
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-slate-300" />
                <p className="text-[10px] font-mono lowercase tracking-widest text-slate-400 truncate">{player.email || 'No communication record'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => startEdit(player)}
                className="p-4 rounded-xl border border-brand-border text-slate-400 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all modern-shadow"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => togglePlayerStatus(player)}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  player.active 
                    ? "border-emerald-100 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white" 
                    : "border-slate-200 text-slate-400 bg-slate-50 hover:bg-slate-600 hover:text-white"
                )}
              >
                <Shield size={18} strokeWidth={2} />
              </button>
              <button
                onClick={() => deletePlayer(player.id)}
                disabled={isDeleting === player.id}
                className="p-4 rounded-xl border border-rose-100 text-rose-400 bg-rose-50/30 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all modern-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={18} className={cn(isDeleting === player.id && "animate-pulse")} />
              </button>
            </div>

            {/* Subtle ID watermark */}
            <span className="absolute top-4 right-20 text-[10px] font-mono font-black text-slate-100 select-none pointer-events-none uppercase tracking-tighter">
              UID: {player.id.slice(0, 8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
