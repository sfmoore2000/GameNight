import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Staff } from '../types';
import { Star, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [newName, setNewName] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStaff() {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
      if (data) setStaff(data as Staff[]);
    }

    fetchStaff();

    const subscription = supabase
      .channel('staff-channel')
      .on('postgres_changes', { event: '*', table: 'staff', schema: 'public' }, () => fetchStaff())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const deleteStaff = async (id: string) => {
    if (!window.confirm('PERMANENT DELETION: This will remove this personnel record. This action cannot be undone. Proceed?')) return;
    
    setIsDeleting(id);
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setStaff(staff.filter(s => s.id !== id));
    } catch (error) {
      console.error("Delete staff failed:", error);
      alert("Could not delete staff member. They may have active duty records in session history.");
    } finally {
      setIsDeleting(null);
    }
  };

  const saveStaff = async () => {
    if (!newName) return;
    try {
      if (editingStaff) {
        const { error } = await supabase
          .from('staff')
          .update({
            name: newName,
          })
          .eq('id', editingStaff.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('staff')
          .insert([{
            name: newName,
            active: true,
            createdAt: new Date().toISOString()
          }]);
        if (error) throw error;
      }

      // Refresh local state
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
      if (staffData) setStaff(staffData as Staff[]);

      setNewName('');
      setIsAdding(false);
      setEditingStaff(null);
    } catch (error) {
       console.error("Save staff failed:", error);
    }
  };

  const startEdit = (s: Staff) => {
    setEditingStaff(s);
    setNewName(s.name);
    setIsAdding(true);
  };

  const toggleStaffStatus = async (s: Staff) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({
          active: !s.active
        })
        .eq('id', s.id);
      if (error) throw error;

      // Refresh local state
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
      if (staffData) setStaff(staffData as Staff[]);
    } catch (error) {
      console.error("Toggle status failed:", error);
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-brand-border pb-6 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded leading-none">Force Management</span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Support Staff</h1>
          </div>
          <p className="text-slate-500 font-medium text-xs">Managing active duty hospitality and security personnel.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white font-sans text-[10px] uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
        >
          <Plus size={16} />
          Add Personnel
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-brand-border p-6 rounded-2xl modern-shadow relative flex flex-col md:flex-row gap-4 items-end"
        >
          <div className="flex-1 space-y-2">
            <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">Personnel Designation</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-3 rounded-xl outline-none font-bold text-sm transition-all"
              placeholder="Ex: Agent Smith"
            />
          </div>
          <div className="flex gap-3">
             <button onClick={saveStaff} className="px-6 py-3 bg-emerald-600 text-white font-sans text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 rounded-xl modern-shadow transition-all">
               {editingStaff ? 'Apply' : 'Authorize'}
             </button>
             <button onClick={() => { setIsAdding(false); setEditingStaff(null); setNewName(''); }} className="px-6 py-3 border border-brand-border text-slate-400 font-sans text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {staff.map((s) => (
          <div key={s.id} className="group flex items-center gap-4 p-3 bg-white border border-brand-border rounded-xl hover:border-slate-300 transition-all modern-shadow relative overflow-hidden">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg border transition-all shrink-0",
              s.active ? "bg-slate-50 border-brand-border text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-300 opacity-40 grayscale"
            )}>
              <Star size={16} strokeWidth={2.5} fill={s.active ? "currentColor" : "none"} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                 <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">{s.name}</h3>
                 {!s.active && <span className="text-[7px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Retired</span>}
              </div>
              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 truncate opacity-60">Verified Hospitality</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => startEdit(s)}
                className="p-2.5 rounded-lg border border-brand-border text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => toggleStaffStatus(s)}
                className={cn(
                  "p-2.5 rounded-lg border transition-all",
                  s.active 
                    ? "border-emerald-100 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white" 
                    : "border-slate-200 text-slate-400 bg-slate-50 hover:bg-slate-600 hover:text-white"
                )}
              >
                <Shield size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => deleteStaff(s.id)}
                disabled={isDeleting === s.id}
                className="p-2.5 rounded-lg border border-rose-100 text-rose-300 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
              >
                <Trash2 size={14} className={cn(isDeleting === s.id && "animate-pulse")} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
