import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Location } from '../types';
import { Plus, MapPin, Building, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

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
    <div className="p-8 md:p-12 lg:p-16 max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-brand-border pb-8 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded leading-none">Venue Operations</span>
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">Locations</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm">Managing the physical deployment hubs for poker sessions.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-sans text-xs uppercase tracking-widest font-black transition-all hover:bg-slate-800 rounded-xl modern-shadow-lg"
        >
          <Plus size={18} />
          Register Venue
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-brand-border p-10 rounded-[2rem] modern-shadow relative grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Venue Designation</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-4 rounded-xl outline-none font-bold text-lg transition-all"
              placeholder="Ex: The Underground"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Physical Hub / Address</label>
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full bg-slate-50 border border-brand-border focus:border-emerald-500 p-4 rounded-xl outline-none font-bold text-lg transition-all"
              placeholder="123 Stealth Ave"
            />
          </div>
          <div className="md:col-span-2 flex gap-4 pt-4">
            <button onClick={saveLocation} className="flex-1 py-4 bg-emerald-600 text-white font-sans text-xs font-black uppercase tracking-widest hover:bg-emerald-700 rounded-xl modern-shadow transition-all">
              {editingLocation ? 'Apply Changes' : 'Authorize Venue'}
            </button>
            <button onClick={() => { setIsAdding(false); setEditingLocation(null); setNewName(''); setNewAddress(''); }} className="px-10 py-4 border border-brand-border text-slate-400 font-sans text-xs font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {locations.map((loc) => (
          <div key={loc.id} className="group p-8 bg-white border border-brand-border rounded-2xl hover:border-slate-300 transition-all relative overflow-hidden modern-shadow">
            <div className="flex justify-between items-start mb-8">
              <div className="flex gap-2">
                <div className="bg-slate-50 w-12 h-12 flex items-center justify-center border border-brand-border rounded-xl modern-shadow group-hover:bg-white transition-all">
                  <MapPin size={20} className="text-emerald-600" />
                </div>
                <button
                  onClick={() => startEdit(loc)}
                  className="bg-white w-12 h-12 flex items-center justify-center border border-brand-border rounded-xl modern-shadow hover:bg-slate-900 hover:text-white transition-all"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <button
                onClick={() => toggleLocationStatus(loc)}
                className={cn(
                  "px-4 py-1.5 rounded-full border transition-all text-[9px] font-black uppercase tracking-widest",
                  loc.active 
                    ? "border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white" 
                    : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-600 hover:text-white"
                )}
              >
                {loc.active ? 'Operational' : 'Decommissioned'}
              </button>
            </div>
            
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2 truncate">{loc.name}</h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed max-w-[90%] line-clamp-1">{loc.address}</p>
            
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-all">
               <Building size={120} strokeWidth={1} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
