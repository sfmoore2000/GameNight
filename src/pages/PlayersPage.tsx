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
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-brand-border pb-6 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded leading-none">Security Registry</span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Members</h1>
          </div>
          <p className="text-slate-500 font-medium text-xs">Managing the verified roster of poker contestants.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white font-sans text-[10px] uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
        >
          <Plus size={16} />
          New Member
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-brand-border p-6 rounded-2xl modern-shadow relative grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">Display Identity</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-3 rounded-xl outline-none font-bold text-sm transition-all"
              placeholder="Ex: Alexander Hamilton"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">Email Node</label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-3 rounded-xl outline-none font-bold text-sm transition-all"
              placeholder="email@vault.com"
            />
          </div>
          <div className="md:col-span-2 flex gap-3 pt-2">
            <button onClick={savePlayer} className="flex-1 py-3 bg-emerald-600 text-white font-sans text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 rounded-xl modern-shadow transition-all">
              {editingPlayer ? 'Apply' : 'Authorize'}
            </button>
            <button onClick={() => { setIsAdding(false); setEditingPlayer(null); setNewName(''); setNewEmail(''); }} className="px-6 py-3 border border-brand-border text-slate-400 font-sans text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {players.map((player) => (
          <div key={player.id} className="group flex items-center gap-4 p-3 bg-white border border-brand-border rounded-xl hover:border-slate-300 transition-all modern-shadow relative overflow-hidden">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg border transition-all shrink-0",
              player.active ? "bg-slate-50 border-brand-border text-slate-900" : "bg-slate-100 border-slate-200 grayscale opacity-40 text-slate-400"
            )}>
              <User size={16} strokeWidth={2.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                 <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">{player.name}</h3>
                 {!player.active && <span className="text-[7px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Locked</span>}
              </div>
              <div className="flex items-center gap-1.5 opacity-60">
                <Mail size={10} className="text-slate-300" />
                <p className="text-[9px] font-mono lowercase tracking-widest text-slate-400 truncate">{player.email || 'No email registered'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => startEdit(player)}
                className="p-2.5 rounded-lg border border-brand-border text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => togglePlayerStatus(player)}
                className={cn(
                  "p-2.5 rounded-lg border transition-all",
                  player.active 
                    ? "border-emerald-100 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white" 
                    : "border-slate-200 text-slate-400 bg-slate-50 hover:bg-slate-600 hover:text-white"
                )}
              >
                <Shield size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => deletePlayer(player.id)}
                disabled={isDeleting === player.id}
                className="p-2.5 rounded-lg border border-rose-100 text-rose-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all disabled:opacity-50"
              >
                <Trash2 size={14} className={cn(isDeleting === player.id && "animate-pulse")} />
              </button>
            </div>
            
            <span className="absolute bottom-2 right-2 flex gap-1 opacity-[0.03] select-none pointer-events-none font-mono text-[80px] font-black leading-none uppercase -mr-4 -mb-4">
              {player.name.slice(0, 1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
