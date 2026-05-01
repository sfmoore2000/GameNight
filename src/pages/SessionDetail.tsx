import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session, PlayerSessionEntry, StaffSessionEntry, Player, Staff, Location, PAYMENT_METHODS, PaymentMethod } from '../types';
import { format, parseISO } from 'date-fns';
import { Plus, ArrowLeft, MoreHorizontal, UserPlus, DollarSign, CheckCircle2, XCircle, Loader2, Trash2, MapPin, CreditCard } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<PlayerSessionEntry[]>([]);
  const [staffEntries, setStaffEntries] = useState<StaffSessionEntry[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'buyin' | 'settle' | 'ledger'>('buyin');
  const [selectedStaffEntryId, setSelectedStaffEntryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [buyInAmount, setBuyInAmount] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [staffPayoutAmount, setStaffPayoutAmount] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');

  // Add Player Modal States
  const [selectedPlayerForAdd, setSelectedPlayerForAdd] = useState<Player | null>(null);
  const [initialBuyIn, setInitialBuyIn] = useState('');
  const [initialMethod, setInitialMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      try {
        const [
          { data: sessionData, error: sessionError },
          { data: entriesData, error: entriesError },
          { data: staffEntriesData, error: staffEntriesError },
          { data: playersData, error: playersDataError },
          { data: staffData, error: staffDataError },
          { data: locationsData, error: locationsDataError }
        ] = await Promise.all([
          supabase.from('sessions').select('*').eq('id', id).single(),
          supabase.from('player_session_entries').select('*').eq('sessionId', id),
          supabase.from('staff_session_entries').select('*').eq('sessionId', id),
          supabase.from('players').select('*').order('name', { ascending: true }),
          supabase.from('staff').select('*').order('name', { ascending: true }),
          supabase.from('locations').select('*').order('name', { ascending: true })
        ]);

        if (sessionError) throw sessionError;
        if (sessionData) setSession(sessionData as Session);
        else {
          console.warn("Session not found:", id);
          navigate('/');
          return;
        }

        if (entriesError) console.error("Error fetching entries:", entriesError);
        else if (entriesData) setEntries(entriesData as PlayerSessionEntry[]);

        if (staffEntriesError) console.error("Error fetching staff entries:", staffEntriesError);
        else if (staffEntriesData) setStaffEntries(staffEntriesData as StaffSessionEntry[]);

        if (playersDataError) console.error("Error fetching players:", playersDataError);
        else if (playersData) setAvailablePlayers(playersData as Player[]);

        if (staffDataError) console.error("Error fetching staff:", staffDataError);
        else if (staffData) setAllStaff(staffData as Staff[]);

        if (locationsDataError) console.error("Error fetching locations:", locationsDataError);
        else if (locationsData) setLocations(locationsData as Location[]);

      } catch (error) {
        console.error("fetchData failed:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Export fetchData to window for manual mutation triggers if needed, 
    // or just let the mutation functions call a local copy.
    // For simplicity, we'll keep it local and call it after mutations.

    // Set up real-time subscriptions
    const channel = supabase.channel(`session-${id}`)
      .on('postgres_changes', { event: '*', table: 'sessions', schema: 'public', filter: `id=eq.${id}` }, (payload) => {
        console.log('Real-time session update:', payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', table: 'player_session_entries', schema: 'public', filter: `sessionId=eq.${id}` }, (payload) => {
        console.log('Real-time player entry update:', payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', table: 'staff_session_entries', schema: 'public', filter: `sessionId=eq.${id}` }, (payload) => {
        console.log('Real-time staff entry update:', payload);
        fetchData();
      })
      .subscribe((status) => {
        console.log(`Supabase Realtime subscription status [session-${id}]:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate]);

  // Helper for manual data refresh after mutations
  const refreshData = async () => {
    if (!id) return;
    try {
      const [{ data: sessionData }, { data: entriesData }, { data: staffEntriesData }] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase.from('player_session_entries').select('*').eq('sessionId', id),
        supabase.from('staff_session_entries').select('*').eq('sessionId', id)
      ]);
      if (sessionData) setSession(sessionData as Session);
      if (entriesData) setEntries(entriesData as PlayerSessionEntry[]);
      if (staffEntriesData) setStaffEntries(staffEntriesData as StaffSessionEntry[]);
    } catch (err) {
      console.error("Manual refresh failed:", err);
    }
  };

  const addPlayerToSession = async () => {
    if (!session || !id || !selectedPlayerForAdd) return;
    if (entries.some(e => e.playerId === selectedPlayerForAdd.id)) return;

    try {
      const buyInVal = parseFloat(initialBuyIn) || 0;
      const buyIns = buyInVal > 0 
        ? [{ amount: buyInVal, method: initialMethod, timestamp: new Date().toISOString() }]
        : [];

      const entry: Partial<PlayerSessionEntry> = {
        sessionId: id,
        playerId: selectedPlayerForAdd.id,
        playerDisplayName: selectedPlayerForAdd.name,
        buyIns: buyIns,
        totalBuyIn: buyInVal,
        payouts: [],
        totalPayout: 0,
        netProfit: -buyInVal,
        status: 'playing',
      };

      const { error: entryError } = await supabase
        .from('player_session_entries')
        .insert([entry]);

      if (entryError) throw entryError;

      if (buyInVal > 0) {
        const { error: sessionError } = await supabase
          .from('sessions')
          .update({
            totalBuyIn: (session.totalBuyIn || 0) + buyInVal
          })
          .eq('id', id);
        if (sessionError) throw sessionError;
      }

      await refreshData();
      setIsAddingPlayer(false);
      setSelectedPlayerForAdd(null);
      setInitialBuyIn('');
      setInitialMethod('cash');
    } catch (error) {
      console.error("Add player failed:", error);
    }
  };

  const addBuyIn = async (entryId: string, method: PaymentMethod) => {
    if (!id || !buyInAmount) return;
    const amount = parseFloat(buyInAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newBuyIn = { amount, method, timestamp: new Date().toISOString() };
      const newBuyIns = [...entry.buyIns, newBuyIn];
      const newTotal = newBuyIns.reduce((acc, b) => acc + b.amount, 0);

      const { error: entryError } = await supabase
        .from('player_session_entries')
        .update({
          buyIns: newBuyIns,
          totalBuyIn: newTotal,
          netProfit: (entry.totalPayout || 0) - newTotal
        })
        .eq('id', entryId);

      if (entryError) throw entryError;

      // Update session total
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          totalBuyIn: (session?.totalBuyIn || 0) + amount
        })
        .eq('id', id);

      if (sessionError) throw sessionError;

      await refreshData();
      setBuyInAmount('');
    } catch (error) {
       console.error("Add buy-in failed:", error);
    }
  };

  const removeBuyIn = async (entryId: string, index: number) => {
    if (!id || !window.confirm('Delete this buy-in record? This will adjust totals instantly.')) return;
    
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const buyIns = entry.buyIns || [];
      const removedAmount = buyIns[index]?.amount || 0;
      const newBuyIns = buyIns.filter((_, i) => i !== index);
      const newTotal = newBuyIns.reduce((acc, b) => acc + b.amount, 0);

      const { error: entryError } = await supabase
        .from('player_session_entries')
        .update({
          buyIns: newBuyIns,
          totalBuyIn: newTotal,
          netProfit: (entry.totalPayout || 0) - newTotal
        })
        .eq('id', entryId);

      if (entryError) throw entryError;

      // Update session total
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          totalBuyIn: (session?.totalBuyIn || 0) - removedAmount
        })
        .eq('id', id);
      
      if (sessionError) throw sessionError;
      await refreshData();
    } catch (error) {
      console.error("Remove buy-in failed:", error);
    }
  };

  const cashOutPlayer = async (entryId: string, method: PaymentMethod, amountOverride?: number) => {
    if (!id) return;
    
    const amount = amountOverride !== undefined ? amountOverride : parseFloat(cashOutAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newPayout = { amount, method, timestamp: new Date().toISOString() };
      const newPayouts = [...(entry.payouts || []), newPayout];
      const newTotalPayout = newPayouts.reduce((acc, p) => acc + p.amount, 0);
      
      const { error } = await supabase
        .from('player_session_entries')
        .update({
          payouts: newPayouts,
          totalPayout: newTotalPayout,
          netProfit: newTotalPayout - (entry.totalBuyIn || 0),
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();

      if (amountOverride === undefined) {
        setCashOutAmount('');
      }
    } catch (error) {
      console.error("Cash out failed:", error);
    }
  };

  const removePayout = async (entryId: string, index: number) => {
    if (!id || !window.confirm('Delete this payout record?')) return;
    
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newPayouts = (entry.payouts || []).filter((_, i) => i !== index);
      const newTotalPayout = newPayouts.reduce((acc, p) => acc + p.amount, 0);

      const { error } = await supabase
        .from('player_session_entries')
        .update({
          payouts: newPayouts,
          totalPayout: newTotalPayout,
          netProfit: newTotalPayout - (entry.totalBuyIn || 0)
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
    } catch (error) {
       console.error("Remove payout failed:", error);
    }
  };

  const settleCredit = async (entryId: string, method: PaymentMethod) => {
    if (!id || !settlementAmount) return;
    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newSettlement = { amount, method, timestamp: new Date().toISOString() };
      const newSettlements = [...(entry.creditSettlements || []), newSettlement];
      const newTotalSettled = newSettlements.reduce((acc, s) => acc + s.amount, 0);

      const { error } = await supabase
        .from('player_session_entries')
        .update({
          creditSettlements: newSettlements,
          totalSettled: newTotalSettled
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();

      setSettlementAmount('');
    } catch (error) {
      console.error("Settle credit failed:", error);
    }
  };

  const removeSettlement = async (entryId: string, index: number) => {
    if (!id || !window.confirm('Delete this settlement record?')) return;
    
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newSettlements = (entry.creditSettlements || []).filter((_, i) => i !== index);
      const newTotalSettled = newSettlements.reduce((acc, s) => acc + s.amount, 0);

      const { error } = await supabase
        .from('player_session_entries')
        .update({
          creditSettlements: newSettlements,
          totalSettled: newTotalSettled
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
    } catch (error) {
       console.error("Remove settlement failed:", error);
    }
  };

  const toggleEntryStatus = async (entryId: string) => {
    if (!id) return;
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    try {
      const { error } = await supabase
        .from('player_session_entries')
        .update({
          status: entry.status === 'playing' ? 'finished' : 'playing'
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
    } catch (error) {
      console.error("Toggle status failed:", error);
    }
  };

  const addStaffToSession = async (staff: Staff) => {
    if (!session || !id) return;
    if (staffEntries.some(e => e.staffId === staff.id)) return;

    try {
      const entry = {
        sessionId: id,
        staffId: staff.id,
        staffDisplayName: staff.name,
        payoutAmount: 0,
        method: 'cash',
        createdAt: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('staff_session_entries')
        .insert([entry]);

      if (error) throw error;
      await refreshData();
      setIsAddingStaff(false);
    } catch (error) {
      console.error("Add staff failed:", error);
    }
  };

  const payoutStaff = async (staffEntryId: string, method: PaymentMethod) => {
    if (!id || !staffPayoutAmount) return;
    const amount = parseFloat(staffPayoutAmount);
    if (isNaN(amount) || amount < 0) return;

    try {
      const { error: entryError } = await supabase
        .from('staff_session_entries')
        .update({
          payoutAmount: amount,
          method: method
        })
        .eq('id', staffEntryId);

      if (entryError) throw entryError;

      // Update session total payout
      const playerPayouts = entries.reduce((acc, e) => acc + (e.totalPayout || 0), 0);
      const staffPayoutsTotal = staffEntries.reduce((acc, e) => {
        if (e.id === staffEntryId) return acc + amount;
        return acc + (e.payoutAmount || 0);
      }, 0);
      
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          totalPayout: playerPayouts + staffPayoutsTotal
        })
        .eq('id', id);

      if (sessionError) throw sessionError;

      await refreshData();
      setStaffPayoutAmount('');
      setSelectedStaffEntryId(null);
    } catch (error) {
       console.error("Payout staff failed:", error);
    }
  };

  useEffect(() => {
    if (!session || !id) return;
    const playerPayouts = entries.reduce((acc, e) => acc + (e.totalPayout || 0), 0);
    const staffPayoutsTotal = staffEntries.reduce((acc, e) => acc + (e.payoutAmount || 0), 0);
    const total = playerPayouts + staffPayoutsTotal;
    
    if (total !== session.totalPayout) {
      supabase.from('sessions').update({ totalPayout: total }).eq('id', id).then(({ error }) => {
        if (error) console.error("Sync total payout failed:", error);
      });
    }
  }, [entries, staffEntries, id, session]);

  const updateSessionMetadata = async () => {
    if (!session || !editDate || !editLocationId) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          date: new Date(editDate).toISOString(),
          locationId: editLocationId
        })
        .eq('id', session.id);

      if (error) throw error;
      await refreshData();
      setIsEditingMetadata(false);
    } catch (error) {
      console.error("Update session metadata failed:", error);
    }
  };

  const startEditMetadata = () => {
    if (!session) return;
    setEditDate(format(parseISO(session.date), "yyyy-MM-dd'T'HH:mm"));
    setEditLocationId(session.locationId);
    setIsEditingMetadata(true);
  };

  const closeSession = async () => {
    if (!session || !id) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', id);

      if (error) throw error;
      await refreshData();
    } catch (error) {
      console.error("Close session failed:", error);
    }
  };

  const deleteSession = async () => {
    if (!id || !window.confirm('PERMANENT DELETION: This will remove all ledger entries and financial data for this session. This action cannot be undone. Proceed?')) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error("Delete failed:", error);
      setIsDeleting(false);
    }
  };

  const primaryPayoutMethod = useMemo(() => {
    const methods: Record<string, number> = {};
    entries.forEach(e => {
      e.payouts?.forEach(p => {
        methods[p.method] = (methods[p.method] || 0) + 1;
      });
    });
    staffEntries.forEach(e => {
      if (e.payoutAmount > 0) {
        methods[e.method] = (methods[e.method] || 0) + 1;
      }
    });
    let max = 0;
    let primaryId = '';
    Object.entries(methods).forEach(([id, count]) => {
      if (count > max) {
        max = count;
        primaryId = id as string;
      }
    });
    return PAYMENT_METHODS.find(m => m.id === primaryId)?.label || 'None';
  }, [entries, staffEntries]);

  const sessionStats = useMemo(() => {
    if (!session) return { realizedCash: 0, totalCredit: 0, totalSettled: 0, outstandingCredit: 0, hostBalance: 0 };
    
    let totalCredit = 0;
    let totalSettled = 0;
    entries.forEach(e => {
      e.buyIns.forEach(b => {
        if (b.method === 'credit') totalCredit += b.amount;
      });
      totalSettled += (e.totalSettled || 0);
    });
    
    const outstandingCredit = totalCredit - totalSettled;
    const realizedCash = session.totalBuyIn - totalCredit + totalSettled;
    
    // Total payout includes both players and staff
    const totalStaffPayout = staffEntries.reduce((acc, e) => acc + e.payoutAmount, 0);
    const totalPlayerPayout = entries.reduce((acc, e) => acc + (e.totalPayout || 0), 0);
    const hostBalance = realizedCash - (totalPlayerPayout + totalStaffPayout);
    
    return { realizedCash, totalCredit, totalSettled, outstandingCredit, hostBalance };
  }, [session, entries, staffEntries]);

  if (loading || !session) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );

  const filteredPlayers = availablePlayers.filter(p => 
    p.active && 
    !entries.some(e => e.playerId === p.id) && 
    p.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
  );

  const locationName = locations.find(l => l.id === session.locationId)?.name || 'Unknown';
  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  const buyInBreakdown = selectedEntry ? selectedEntry.buyIns.reduce((acc, b) => {
    acc[b.method] = (acc[b.method] || 0) + b.amount;
    return acc;
  }, {} as Record<string, number>) : {};

  return (
    <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-8 md:space-y-12">
      {/* Top Navigation */}
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-widest font-black text-slate-400 hover:text-slate-900 transition-all bg-white px-4 py-2 rounded-lg border border-brand-border modern-shadow"
      >
        <ArrowLeft size={14} /> Back to Operations
      </button>

      {/* Modern Session Header */}
      <div className="bg-white border border-brand-border rounded-3xl p-6 md:p-10 modern-shadow overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <DollarSign size={200} className="text-slate-900" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-12 lg:col-span-4">
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">
                {format(parseISO(session.date), 'MMM d, yyyy')}
              </h1>
              {session.status === 'active' && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-widest border border-emerald-200 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
              <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px] uppercase tracking-widest font-bold">
                <MapPin size={14} className="text-emerald-500" />
                {locationName}
              </div>
              <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px] uppercase tracking-widest font-bold">
                <CreditCard size={14} className="text-emerald-500" />
                Primary Payout: {primaryPayoutMethod}
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsAddingPlayer(true)}
                disabled={session.status === 'completed'}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all modern-shadow disabled:opacity-20"
              >
                + Player
              </button>
              <button
                onClick={() => setIsAddingStaff(true)}
                disabled={session.status === 'completed'}
                className="px-6 py-3 bg-white border border-brand-border text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all modern-shadow disabled:opacity-20"
              >
                + Staff
              </button>
              {session.status === 'active' && (
                <button
                  onClick={closeSession}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all modern-shadow"
                >
                  Close Session
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession();
                }}
                disabled={isDeleting}
                className="p-3 text-rose-400 hover:text-rose-600 transition-all hover:bg-rose-50 rounded-xl disabled:opacity-50"
                title="Purge Session"
              >
                {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
              </button>
            </div>
          </div>

          <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Gross Volume</span>
              <p className="text-xl font-black text-slate-900">{formatCurrency(session.totalBuyIn || 0)}</p>
            </div>
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Account Receivable</span>
              <p className="text-xl font-black text-rose-500">{formatCurrency(sessionStats.outstandingCredit)}</p>
            </div>
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Cash In-Hand</span>
              <p className="text-xl font-black text-slate-900">{formatCurrency(sessionStats.realizedCash)}</p>
            </div>
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Net Liquidity</span>
              <p className={cn(
                "text-xl font-black",
                sessionStats.hostBalance < 0 ? "text-rose-500" : "text-emerald-600"
              )}>
                {formatCurrency(sessionStats.hostBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Ledgers Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Player Ledger */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex justify-between items-center border-b border-brand-border pb-4">
             <h2 className="text-[11px] uppercase font-black tracking-widest text-slate-900 flex items-center gap-2">
               <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
               Player Ledger
             </h2>
             <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest">Active Seats: {entries.filter(e => e.status === 'playing').length} / {entries.length}</span>
          </div>

          <div className="bg-white border border-brand-border rounded-2xl overflow-x-auto modern-shadow">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-brand-border">
                  <th className="px-6 py-4 text-left font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Member</th>
                  <th className="px-6 py-4 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Buy-Ins</th>
                  <th className="px-6 py-4 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Settlement</th>
                  <th className="px-6 py-4 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Net</th>
                  <th className="px-6 py-4 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className={cn("group hover:bg-slate-50 transition-all", entry.status === 'finished' && "bg-slate-50/10")}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{entry.playerDisplayName}</p>
                          <span className={cn(
                            "text-[8px] font-mono border px-1.5 py-0.5 rounded uppercase tracking-tighter",
                            entry.status === 'playing' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                          )}>{entry.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="text-sm font-black text-slate-900">{formatCurrency(entry.totalBuyIn)}</p>
                      {entry.buyIns.some(b => b.method === 'credit') && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-mono text-rose-500 uppercase tracking-widest font-bold">Includes Credit</span>
                          {(entry.buyIns.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0) - (entry.totalSettled || 0)) > 0 && (
                            <span className="text-[7px] font-mono bg-rose-50 text-rose-600 px-1 rounded border border-rose-100">
                              Owed: {formatCurrency(entry.buyIns.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0) - (entry.totalSettled || 0))}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="text-sm font-black text-slate-900">{entry.totalPayout > 0 ? formatCurrency(entry.totalPayout) : '—'}</p>
                      {entry.payouts?.length > 0 && (
                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-tight">
                          {entry.payouts.length > 1 ? `${entry.payouts.length} Parts` : PAYMENT_METHODS.find(m => m.id === entry.payouts[0].method)?.label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className={cn("text-base font-black tracking-tight", entry.netProfit >= 0 ? "text-emerald-600" : "text-rose-500")}>
                        {entry.netProfit > 0 ? '+' : ''}{formatCurrency(entry.netProfit)}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                           onClick={() => {
                             setSelectedEntryId(entry.id);
                             setModalMode('buyin');
                           }}
                           disabled={session.status === 'completed' || entry.status === 'finished'}
                           className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all modern-shadow disabled:opacity-10"
                        >
                           + Buy-In
                        </button>
                        <button 
                           onClick={() => {
                             setSelectedEntryId(entry.id);
                             const hasCredit = entry.buyIns.some(b => b.method === 'credit');
                             setModalMode(hasCredit ? 'ledger' : 'settle');
                           }}
                           disabled={session.status === 'completed'}
                           className={cn(
                             "px-4 py-2 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-10",
                             (entry.buyIns.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0) - (entry.totalSettled || 0)) > 0
                               ? "border-rose-200 text-rose-500 hover:bg-rose-50"
                               : "border-brand-border text-slate-900 hover:bg-slate-50"
                           )}
                        >
                           {(entry.buyIns.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0) - (entry.totalSettled || 0)) > 0 ? 'Collect' : 'Settle'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Staff & Support Section */}
        <div className="lg:col-span-4 space-y-6">
           <div className="flex justify-between items-center border-b border-brand-border pb-4">
             <h2 className="text-[11px] uppercase font-black tracking-widest text-slate-900 flex items-center gap-2">
               <span className="w-1.5 h-6 bg-slate-900 rounded-full" />
               Personnel
             </h2>
          </div>

          <div className="bg-white border border-brand-border rounded-2xl overflow-hidden modern-shadow divide-y divide-brand-border">
            {staffEntries.length === 0 && (
              <div className="p-8 text-center bg-slate-50/50">
                 <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">No assigned staff yet</p>
              </div>
            )}
            {staffEntries.map((entry) => (
              <div key={entry.id} className="p-6 group hover:bg-slate-50 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{entry.staffDisplayName}</p>
                    <span className="text-[8px] font-mono text-slate-300 uppercase tracking-widest">Support Division</span>
                  </div>
                  <button 
                    onClick={() => setSelectedStaffEntryId(entry.id)}
                    disabled={session.status === 'completed'}
                    className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>
                <div className="flex justify-between items-end">
                  <div className="px-3 py-1 bg-slate-100 rounded text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {entry.payoutAmount > 0 ? PAYMENT_METHODS.find(m => m.id === entry.method)?.label : 'Pending Payout'}
                  </div>
                  <p className="text-xl font-black text-rose-500">{entry.payoutAmount > 0 ? formatCurrency(entry.payoutAmount) : '$0.00'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern High-Performance Modals */}
      <AnimatePresence>
        {selectedEntryId && (
          <div key="player-action-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEntryId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }} 
               className="relative bg-white p-6 md:p-10 lg:p-14 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-[2.5rem] modern-shadow-lg"
            >
              {/* Modal Mode Selector */}
              <div className="flex gap-1 mb-8 p-1 bg-slate-50 rounded-xl border border-brand-border w-fit">
                <button 
                  onClick={() => setModalMode('buyin')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    modalMode === 'buyin' ? "bg-white text-slate-900 modern-shadow" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Buy-In
                </button>
                <button 
                  onClick={() => setModalMode('settle')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    modalMode === 'settle' ? "bg-white text-slate-900 modern-shadow" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Payout
                </button>
                {(selectedEntry?.buyIns?.some(b => b.method === 'credit') || (selectedEntry?.creditSettlements?.length || 0) > 0) && (
                  <button 
                    onClick={() => setModalMode('ledger')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      modalMode === 'ledger' ? "bg-white text-slate-900 modern-shadow" : "text-rose-400 hover:text-rose-500"
                    )}
                  >
                    Credit Ledger
                  </button>
                )}
              </div>

              {modalMode === 'buyin' ? (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Re-Buy / Add Liquidity</h2>
                    <p className="text-sm text-slate-400 font-medium">Inject funds into player position.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                       <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Amount</label>
                       <div className="text-right">
                         <span className="text-[8px] font-mono text-slate-300 uppercase block">Total Buy-In</span>
                         <span className="text-sm font-black text-slate-900">{formatCurrency(selectedEntry?.totalBuyIn || 0)}</span>
                       </div>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-200 group-focus-within:text-emerald-500 transition-colors">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={buyInAmount}
                        onChange={(e) => setBuyInAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-brand-border p-6 pl-12 rounded-2xl text-4xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {PAYMENT_METHODS.map(method => (
                        <button
                          key={method.id}
                          onClick={() => addBuyIn(selectedEntryId!, method.id)}
                          className={cn(
                            "py-4 border border-brand-border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all modern-shadow",
                            method.id === 'credit' ? "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white" : "text-slate-600 hover:bg-slate-900 hover:text-white"
                          )}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(selectedEntry?.buyIns.length || 0) > 0 && (
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-2">
                      <span className="text-[8px] font-mono text-slate-300 uppercase tracking-widest block mb-2">Buy-In History</span>
                      {selectedEntry?.buyIns.map((bi, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-brand-border border-dashed last:border-0 group/bi">
                          <div className="flex items-center gap-4">
                            <Trash2 
                              size={12} 
                              className="opacity-0 group-hover/bi:opacity-100 cursor-pointer text-rose-300 hover:text-rose-500 transition-all"
                              onClick={() => removeBuyIn(selectedEntryId!, i)}
                            />
                            <span className={cn("text-[9px] font-black uppercase", bi.method === 'credit' ? "text-rose-500" : "text-slate-400")}>
                               {PAYMENT_METHODS.find(m => m.id === bi.method)?.label}
                            </span>
                          </div>
                          <span className="text-xs font-black text-slate-900">{formatCurrency(bi.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-6 border-t border-brand-border">
                    <button 
                      onClick={() => setSelectedEntryId(null)}
                      className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : modalMode === 'settle' ? (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Settlement Ledger</h2>
                    <p className="text-sm text-slate-400 font-medium">Process payouts and verify seat integrity.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-brand-border">
                      <div className="relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-200 group-focus-within:text-emerald-500 transition-colors">$</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={cashOutAmount}
                          onChange={(e) => setCashOutAmount(e.target.value)}
                          className="w-full bg-white border border-brand-border p-5 pl-12 rounded-xl text-3xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.map(method => (
                          <button
                            key={method.id}
                            onClick={() => cashOutPlayer(selectedEntryId!, method.id)}
                            className="py-4 bg-white border border-brand-border rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all modern-shadow"
                          >
                            Pay via {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Suggested Distribution */}
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-3">
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest font-black">Principal Recovery Suggestions</span>
                         <span className="text-[8px] font-mono text-emerald-500 uppercase font-black italic">Click Appointed Method to Record</span>
                       </div>
                       <div className="space-y-2">
                         {Object.entries(buyInBreakdown).map(([mid, val]) => {
                           const buyInTotal = val as number;
                           // Calculate how much of THIS specific method has already been paid out?
                           // Actually, just suggest paying back the original buy-in amount.
                           if (buyInTotal <= 0) return null;
                           
                           return (
                             <button 
                               key={mid} 
                               onClick={() => {
                                 cashOutPlayer(selectedEntryId!, mid as PaymentMethod, buyInTotal);
                               }}
                               className="w-full flex justify-between items-center p-2 bg-white border border-brand-border rounded hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group/suggest"
                             >
                               <div className="flex flex-col">
                                 <span className="text-[8px] font-black uppercase text-slate-400 transition-colors group-hover/suggest:text-emerald-600">{PAYMENT_METHODS.find(m => m.id === mid)?.label}</span>
                                 <span className="text-[7px] font-mono text-slate-300 uppercase italic">Original Buy-In: {formatCurrency(buyInTotal)}</span>
                               </div>
                               <div className="text-right">
                                 <span className="text-[10px] font-black text-slate-900 block group-hover/suggest:text-emerald-600">{formatCurrency(buyInTotal)}</span>
                                 <span className="text-[7px] font-mono text-emerald-500 uppercase font-black">Quick Record</span>
                               </div>
                             </button>
                           );
                         })}
                         {/* Optional: Add a button for "Remaining Net Balance" if positive */}
                         {(selectedEntry?.netProfit || 0) > 0 && (
                           <button 
                             onClick={() => {
                               // Calculate how much profit is left to pay
                               const remainingProfit = selectedEntry?.netProfit || 0;
                               setCashOutAmount(remainingProfit.toString());
                             }}
                             className="w-full flex justify-between items-center p-2 bg-slate-900 border border-slate-900 rounded hover:bg-slate-800 transition-all text-left"
                           >
                             <div className="flex flex-col">
                               <span className="text-[8px] font-black uppercase text-emerald-400">Net Surplus (Profit)</span>
                               <span className="text-[7px] font-mono text-slate-400 uppercase">Load Remaining into Input</span>
                             </div>
                             <div className="text-right">
                               <span className="text-[10px] font-black text-white block">{formatCurrency(selectedEntry?.netProfit || 0)}</span>
                               <span className="text-[7px] font-mono text-slate-400 uppercase">Surplus</span>
                             </div>
                           </button>
                         )}
                       </div>
                    </div>

                    <div className="space-y-4">
                      {/* Payout Records */}
                      <div className="flex justify-between items-center border-b border-brand-border pb-2">
                         <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black">Disbursement Records</span>
                         <div className="text-right">
                           <span className="text-[8px] font-mono text-slate-300 uppercase block">Total Payout</span>
                           <span className="text-sm font-black text-emerald-600 font-sans tracking-tight">{formatCurrency(selectedEntry?.totalPayout || 0)}</span>
                         </div>
                      </div>

                      {(selectedEntry?.payouts?.length || 0) > 0 && (
                        <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2">
                          {selectedEntry?.payouts?.map((p, i) => (
                             <div key={i} className="flex justify-between items-center p-2 bg-slate-50 border border-brand-border border-dashed rounded text-[10px] group/item">
                               <div className="flex items-center gap-3">
                                 <Trash2 
                                   size={10} 
                                   className="text-slate-300 hover:text-rose-500 cursor-pointer transition-colors"
                                   onClick={() => removePayout(selectedEntry.id, i)}
                                 />
                                 <span className="font-black text-slate-900 uppercase">Paid: {PAYMENT_METHODS.find(m => m.id === p.method)?.label}</span>
                               </div>
                               <span className="font-sans font-black text-slate-600">{formatCurrency(p.amount)}</span>
                             </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-brand-border">
                          <span className="text-[8px] font-mono text-slate-400 uppercase block mb-1">Buy-In Base</span>
                          <span className="text-base font-black text-slate-900">{formatCurrency(selectedEntry?.totalBuyIn || 0)}</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-brand-border">
                          <span className="text-[8px] font-mono text-slate-400 uppercase block mb-1">Net Balance</span>
                          <p className={cn("text-base font-black font-sans leading-none", (selectedEntry?.netProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-500")}>
                            {formatCurrency(selectedEntry?.netProfit || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <button 
                           onClick={() => toggleEntryStatus(selectedEntryId!)}
                           className={cn(
                             "flex-1 py-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                             selectedEntry?.status === 'finished' 
                               ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white" 
                               : "bg-brand-gold text-white hover:opacity-90"
                           )}
                        >
                           {selectedEntry?.status === 'finished' ? "Re-Open Table Seat" : "Finalize & Close Seat"}
                        </button>
                        <button 
                          onClick={() => setSelectedEntryId(null)}
                          className="px-8 py-4 border border-brand-border rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-sans"
                        >
                          Exit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-rose-600">Accounts Receivable</h2>
                    <p className="text-sm text-slate-400 font-medium">Settle player's credit obligations.</p>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <span className="text-[10px] font-mono text-rose-400 uppercase tracking-widest font-black block">Outstanding Liability</span>
                        <p className="text-3xl font-black text-rose-600">
                          {formatCurrency((selectedEntry?.buyIns?.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0) || 0) - (selectedEntry?.totalSettled || 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-mono text-slate-400 uppercase block">Total Credit Borrowed</span>
                        <span className="text-sm font-black text-slate-600">
                          {formatCurrency(selectedEntry?.buyIns?.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0) || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-rose-200 group-focus-within:text-rose-500 transition-colors">$</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={settlementAmount}
                          onChange={(e) => setSettlementAmount(e.target.value)}
                          className="w-full bg-white border border-rose-100 p-5 pl-10 rounded-xl text-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-sans"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.filter(m => m.id !== 'credit').map(method => (
                          <button
                            key={method.id}
                            onClick={() => settleCredit(selectedEntryId!, method.id)}
                            className="py-4 bg-white border border-brand-border rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all modern-shadow"
                          >
                            Recv via {method.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black block">Settlement History</span>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                       {selectedEntry?.creditSettlements?.map((s, i) => (
                         <div key={i} className="flex justify-between items-center p-3 bg-slate-50 border border-brand-border border-dashed rounded group/item">
                           <div className="flex items-center gap-3">
                             <Trash2 
                               size={12} 
                               className="text-slate-300 hover:text-rose-500 cursor-pointer transition-colors"
                               onClick={() => removeSettlement(selectedEntry.id, i)}
                             />
                             <span className="text-[10px] font-black text-slate-900 uppercase">{PAYMENT_METHODS.find(m => m.id === s.method)?.label}</span>
                           </div>
                           <span className="font-sans font-black text-emerald-600 text-sm">{formatCurrency(s.amount)}</span>
                         </div>
                       ))}
                       {(!selectedEntry?.creditSettlements || selectedEntry.creditSettlements.length === 0) && (
                         <p className="text-[10px] font-mono text-slate-300 uppercase py-4 text-center">No settlements recorded</p>
                       )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => setSelectedEntryId(null)}
                      className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => { setSelectedEntryId(null); setBuyInAmount(''); setCashOutAmount(''); }}
                className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-900 transition-all"
              >
                <XCircle size={32} strokeWidth={1.5} />
              </button>
            </motion.div>
          </div>
        )}

        {selectedStaffEntryId && (
          <div key="staff-payout-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStaffEntryId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }} 
               className="relative bg-white p-8 md:p-14 max-w-md w-full max-h-[90vh] overflow-y-auto rounded-[2.5rem] modern-shadow-lg"
            >
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Staff Disbursement</h3>
                  <p className="text-sm text-slate-400 font-medium">Capture payout for {staffEntries.find(e => e.id === selectedStaffEntryId)?.staffDisplayName}.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-200 group-focus-within:text-rose-500 transition-colors">$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={staffPayoutAmount}
                      onChange={(e) => setStaffPayoutAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-brand-border p-6 pl-12 rounded-2xl text-4xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-sans"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.filter(m => m.id !== 'credit').map(method => (
                      <button
                        key={method.id}
                        onClick={() => payoutStaff(selectedStaffEntryId, method.id)}
                        className="py-4 bg-white border border-brand-border rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all modern-shadow"
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedStaffEntryId(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingMetadata && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditingMetadata(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative bg-white border border-brand-border p-8 md:p-10 max-w-xl w-full rounded-3xl modern-shadow-lg"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Edit Deployment</h3>
                    <p className="text-sm text-slate-400 font-medium">Update operational metadata for this relay.</p>
                  </div>
                  <button onClick={() => setIsEditingMetadata(false)} className="p-2 text-slate-300 hover:text-slate-600"><XCircle size={24} /></button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Hub Location</label>
                    <select
                      value={editLocationId}
                      onChange={(e) => setEditLocationId(e.target.value)}
                      className="w-full bg-slate-50 border border-brand-border p-4 rounded-xl outline-none text-sm font-bold appearance-none cursor-pointer"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Temporal Timestamp</label>
                    <input
                      type="datetime-local"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-slate-50 border border-brand-border p-4 rounded-xl outline-none text-sm font-bold"
                    />
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      onClick={updateSessionMetadata}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all modern-shadow"
                    >
                      Confirm Synchronization
                    </button>
                    <button
                      onClick={() => { setIsEditingMetadata(false); }}
                      className="px-8 py-4 border border-brand-border text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      Abort
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAddingStaff && (
            <div key="add-staff-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingStaff(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative bg-white p-12 max-w-md w-full rounded-[2.5rem] modern-shadow-lg">
               <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-8">Force Support</h3>
               <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrolling-touch">
                  {allStaff.filter(s => s.active && !staffEntries.some(e => e.staffId === s.id)).map(person => (
                    <button
                      key={person.id}
                      onClick={() => addStaffToSession(person)}
                      className="w-full flex justify-between items-center p-5 bg-slate-50 hover:bg-white border hover:border-emerald-500 rounded-2xl transition-all group"
                    >
                      <span className="text-sm font-black uppercase tracking-tight text-slate-700 group-hover:text-emerald-700">{person.name}</span>
                      <Plus size={16} className="text-slate-300 group-hover:text-emerald-500" />
                    </button>
                  ))}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enhanced Player Addition Modal */}
      <AnimatePresence>
        {isAddingPlayer && (
          <div key="add-player-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              key="add-player-backdrop"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingPlayer(false);
                setSelectedPlayerForAdd(null);
              }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              className="relative bg-white p-6 md:p-10 lg:p-14 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-[3rem] modern-shadow-xl"
            >
              <div className="space-y-8">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tight text-slate-900">Open Seat</h3>
                  <p className="text-sm text-slate-400 font-medium">Register player and capture opening buy-in.</p>
                </div>

                {!selectedPlayerForAdd ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-widest">Search Member Database</p>
                      <input
                        type="text"
                        placeholder="Filter by name..."
                        value={playerSearchQuery}
                        onChange={(e) => setPlayerSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-brand-border p-3 rounded-xl outline-none text-xs font-bold focus:border-slate-900 transition-all"
                      />
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {filteredPlayers.map(player => (
                        <button
                          key={player.id}
                          onClick={() => setSelectedPlayerForAdd(player)}
                          className="w-full flex justify-between items-center p-6 bg-slate-50 hover:bg-white border hover:border-emerald-500 rounded-2xl transition-all group"
                        >
                          <span className="text-base font-black uppercase tracking-tight text-slate-700 group-hover:text-emerald-700">{player.name}</span>
                          <Plus size={18} className="text-slate-300 group-hover:text-emerald-500" />
                        </button>
                      ))}
                      {filteredPlayers.length === 0 && (
                        <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.25em]">No Matches Found</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10">
                    <div className="flex items-center justify-between bg-slate-900 text-white p-6 rounded-2xl">
                      <div>
                        <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block mb-1">Authenticated Member</span>
                        <p className="text-2xl font-black uppercase tracking-tight">{selectedPlayerForAdd.name}</p>
                      </div>
                      <button onClick={() => setSelectedPlayerForAdd(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ArrowLeft size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">Opening Buy-In</label>
                        <div className="relative group">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-200 group-focus-within:text-emerald-500 transition-colors">$</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={initialBuyIn}
                            onChange={(e) => setInitialBuyIn(e.target.value)}
                            className="w-full bg-slate-50 border border-brand-border p-5 pl-10 rounded-xl text-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                           {PAYMENT_METHODS.map(m => (
                             <button
                                key={m.id}
                                onClick={() => setInitialMethod(m.id)}
                                className={cn(
                                  "py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                  initialMethod === m.id 
                                    ? "bg-slate-900 text-white modern-shadow" 
                                    : "bg-slate-50 text-slate-400 border border-brand-border hover:bg-slate-100"
                                )}
                             >
                               {m.label}
                             </button>
                           ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={addPlayerToSession}
                        className="flex-1 py-5 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all modern-shadow shadow-emerald-200"
                      >
                        Confirm Seat & Ledger
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    setIsAddingPlayer(false);
                    setSelectedPlayerForAdd(null);
                  }}
                  className="absolute top-10 right-10 p-2 text-slate-300 hover:text-slate-900"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
