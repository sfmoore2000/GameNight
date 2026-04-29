import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Staff } from '../types';
import { Star, Plus, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [newName, setNewName] = useState('');

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
    <div className="p-8 md:p-12 lg:p-16 max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-brand-border pb-8 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded leading-none">Force Management</span>
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">Support Staff</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm">Managing active duty hospitality and security personnel.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-sans text-xs uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
        >
          <Plus size={18} />
          Add Personnel
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-brand-border p-10 rounded-[2rem] modern-shadow relative flex flex-col md:flex-row gap-8 items-end"
        >
          <div className="flex-1 space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Personnel Designation</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-4 rounded-xl outline-none font-bold text-lg transition-all"
              placeholder="Ex: Agent Smith"
            />
          </div>
          <div className="flex gap-4">
             <button onClick={saveStaff} className="px-10 py-4 bg-emerald-600 text-white font-sans text-xs font-black uppercase tracking-widest hover:bg-emerald-700 rounded-xl modern-shadow transition-all">
               {editingStaff ? 'Apply Changes' : 'Authorize'}
             </button>
             <button onClick={() => { setIsAdding(false); setEditingStaff(null); setNewName(''); }} className="px-10 py-4 border border-brand-border text-slate-400 font-sans text-xs font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {staff.map((s) => (
          <div key={s.id} className={cn(
            "group p-10 border rounded-[2.5rem] flex flex-col items-center text-center transition-all relative overflow-hidden modern-shadow",
            s.active ? "bg-white border-brand-border" : "bg-slate-50 border-slate-200 grayscale opacity-40"
          )}>
            <div className={cn(
              "w-20 h-20 flex items-center justify-center rounded-[1.5rem] border transition-all mb-8 modern-shadow",
              s.active ? "bg-slate-50 border-brand-border text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-300"
            )}>
              <Star size={32} strokeWidth={2} fill={s.active ? "currentColor" : "none"} />
            </div>
            
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-1">{s.name}</h3>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-slate-400 mb-10">Verified Hospitality</p>
            
            <div className="flex gap-2 w-full">
              <button
                onClick={() => startEdit(s)}
                className="flex-1 py-4 rounded-xl border border-brand-border text-slate-400 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all text-[10px] font-black uppercase tracking-widest modern-shadow"
              >
                <Edit2 size={14} className="mx-auto" />
              </button>
              <button
                onClick={() => toggleStaffStatus(s)}
                className={cn(
                  "flex-[2] py-4 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest",
                  s.active 
                    ? "border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white" 
                    : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-600 hover:text-white"
                )}
              >
                {s.active ? 'Active Duty' : 'Off Rotation'}
              </button>
            </div>

            <span className="absolute -left-2 -top-4 text-7xl font-black text-slate-100/50 select-none pointer-events-none group-hover:translate-x-1 transition-all opacity-20">
              {s.name.charAt(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
