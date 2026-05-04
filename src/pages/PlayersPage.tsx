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
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-brand-border pb-8 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded leading-none">Security Registry</span>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-slate-900">Members</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm sm:text-base border-l-2 border-emerald-500 pl-4 opacity-80">Managing the verified roster of poker contestants.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 text-white font-sans text-xs uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-2xl modern-shadow-xl"
        >
          <Plus size={20} />
          New Member
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-brand-border p-8 rounded-3xl modern-shadow-lg relative grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Display Identity</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-5 rounded-2xl outline-none font-black text-base sm:text-lg transition-all"
              placeholder="Ex: Alexander Hamilton"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Email Node</label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-5 rounded-2xl outline-none font-black text-base sm:text-lg transition-all"
              placeholder="email@vault.com"
            />
          </div>
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 pt-4">
            <button onClick={savePlayer} className="flex-1 py-5 bg-emerald-600 text-white font-sans text-xs font-black uppercase tracking-widest hover:bg-emerald-700 rounded-2xl modern-shadow transition-all">
              {editingPlayer ? 'Apply Transformation' : 'Authorize Member'}
            </button>
            <button onClick={() => { setIsAdding(false); setEditingPlayer(null); setNewName(''); setNewEmail(''); }} className="px-10 py-5 border border-brand-border text-slate-400 font-sans text-xs font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {players.map((player) => (
          <div key={player.id} className="group flex flex-col sm:flex-row sm:items-center gap-6 p-6 bg-white border border-brand-border rounded-2xl hover:border-slate-300 hover:scale-[1.01] transition-all modern-shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-6 flex-1 min-w-0">
              <div className={cn(
                "w-14 h-14 flex items-center justify-center rounded-2xl border-2 transition-all shrink-0",
                player.active ? "bg-slate-50 border-brand-border text-slate-900 shadow-sm" : "bg-slate-100 border-slate-200 grayscale opacity-40 text-slate-400"
              )}>
                <User size={24} strokeWidth={2.5} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                   <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 truncate">{player.name}</h3>
                   {!player.active && <span className="text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 px-2 py-1 rounded">Locked</span>}
                </div>
                <div className="flex items-center gap-2 opacity-60">
                  <Mail size={12} className="text-slate-300" />
                  <p className="text-[11px] font-mono lowercase tracking-widest text-slate-400 truncate font-bold leading-none">{player.email || 'No email registered'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t sm:border-t-0 pt-4 sm:pt-0">
              <button
                onClick={() => startEdit(player)}
                className="p-4 rounded-xl border border-brand-border text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all modern-shadow-sm"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => togglePlayerStatus(player)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all modern-shadow-sm",
                  player.active 
                    ? "border-emerald-100 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white hover:border-emerald-600" 
                    : "border-slate-100 text-slate-400 bg-slate-50 hover:bg-slate-700 hover:text-white hover:border-slate-700"
                )}
              >
                <Shield size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => deletePlayer(player.id)}
                disabled={isDeleting === player.id}
                className="p-4 rounded-xl border border-rose-100 text-rose-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all disabled:opacity-50 modern-shadow-sm"
              >
                <Trash2 size={18} className={cn(isDeleting === player.id && "animate-pulse")} />
              </button>
            </div>
            
            <span className="absolute bottom-2 right-2 flex gap-1 opacity-[0.03] select-none pointer-events-none font-mono text-[100px] font-black leading-none uppercase -mr-6 -mb-6">
              {player.name.slice(0, 1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
