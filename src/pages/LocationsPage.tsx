import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Location } from '../types';
import { Plus, MapPin, Building, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });
      if (data) setLocations(data as Location[]);
    }

    fetchLocations();

    const subscription = supabase
      .channel('locations-channel')
      .on('postgres_changes', { event: '*', table: 'locations', schema: 'public' }, () => fetchLocations())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const deleteLocation = async (id: string) => {
    if (!window.confirm('PERMANENT DELETION: This will remove this venue. This action cannot be undone. Proceed?')) return;
    
    setIsDeleting(id);
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setLocations(locations.filter(l => l.id !== id));
    } catch (error) {
      console.error("Delete location failed:", error);
      alert("Could not delete location. It may have associated session records that need to be cleared first.");
    } finally {
      setIsDeleting(null);
    }
  };

  const saveLocation = async () => {
    if (!newName) return;
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update({
            name: newName,
            address: newAddress,
          })
          .eq('id', editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('locations')
          .insert([{
            name: newName,
            address: newAddress,
            active: true,
            createdAt: new Date().toISOString()
          }]);
        if (error) throw error;
      }

      // Refresh local state
      const { data: locationsData } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });
      if (locationsData) setLocations(locationsData as Location[]);

      setNewName('');
      setNewAddress('');
      setIsAdding(false);
      setEditingLocation(null);
    } catch (error) {
      console.error("Save location failed:", error);
    }
  };

  const startEdit = (loc: Location) => {
    setEditingLocation(loc);
    setNewName(loc.name);
    setNewAddress(loc.address);
    setIsAdding(true);
  };

  const toggleLocationStatus = async (location: Location) => {
    try {
      const { error } = await supabase
        .from('locations')
        .update({
          active: !location.active
        })
        .eq('id', location.id);
      if (error) throw error;

      // Refresh local state
      const { data: locationsData } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });
      if (locationsData) setLocations(locationsData as Location[]);
    } catch (error) {
      console.error("Toggle status failed:", error);
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-brand-border pb-6 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded leading-none">Venue Operations</span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Locations</h1>
          </div>
          <p className="text-slate-500 font-medium text-xs">Managing the physical deployment hubs for poker sessions.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white font-sans text-[10px] uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
        >
          <Plus size={16} />
          Register Venue
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-brand-border p-6 rounded-2xl modern-shadow relative grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">Venue Designation</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-3 rounded-xl outline-none font-bold text-sm transition-all"
              placeholder="Ex: The Underground"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">Physical Hub / Address</label>
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-3 rounded-xl outline-none font-bold text-sm transition-all"
              placeholder="123 Stealth Ave"
            />
          </div>
          <div className="md:col-span-2 flex gap-3 pt-2">
            <button onClick={saveLocation} className="flex-1 py-3 bg-emerald-600 text-white font-sans text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 rounded-xl modern-shadow transition-all">
              {editingLocation ? 'Apply' : 'Authorize Venue'}
            </button>
            <button onClick={() => { setIsAdding(false); setEditingLocation(null); setNewName(''); setNewAddress(''); }} className="px-6 py-3 border border-brand-border text-slate-400 font-sans text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {locations.map((loc) => (
          <div key={loc.id} className="group flex items-center gap-4 p-3 bg-white border border-brand-border rounded-xl hover:border-slate-300 transition-all modern-shadow relative overflow-hidden">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg border transition-all shrink-0",
              loc.active ? "bg-slate-50 border-brand-border text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-300 opacity-40 grayscale"
            )}>
              <MapPin size={16} strokeWidth={2.5} />
            </div>
            
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">{loc.name}</h3>
                  {!loc.active && <span className="text-[7px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Locked</span>}
               </div>
               <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 truncate opacity-60">{loc.address || 'Classified Coordinates'}</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => startEdit(loc)}
                className="p-2.5 rounded-lg border border-brand-border text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => toggleLocationStatus(loc)}
                className={cn(
                  "p-2.5 rounded-lg border transition-all",
                  loc.active 
                    ? "border-emerald-100 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white" 
                    : "border-slate-200 text-slate-400 bg-slate-50 hover:bg-slate-600 hover:text-white"
                )}
              >
                <Shield size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => deleteLocation(loc.id)}
                disabled={isDeleting === loc.id}
                className="p-2.5 rounded-lg border border-rose-100 text-rose-300 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
              >
                <Trash2 size={14} className={cn(isDeleting === loc.id && "animate-pulse")} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
