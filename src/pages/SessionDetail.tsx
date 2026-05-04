import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session, PlayerSessionEntry, StaffSessionEntry, Player, Staff, Location, PAYMENT_METHODS, PaymentMethod } from '../types';
import { format, parseISO } from 'date-fns';
import { Plus, ArrowLeft, MoreHorizontal, UserPlus, DollarSign, CheckCircle2, XCircle, Loader2, Trash2, MapPin, CreditCard, Edit3 } from 'lucide-react';
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

  // Modal States
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'buyin' | 'settle' | 'ledger'>('buyin');
  const [selectedStaffEntryId, setSelectedStaffEntryId] = useState<string | null>(null);

  // Form States
  const [buyInAmount, setBuyInAmount] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [returnedChips, setReturnedChips] = useState('');
  const [staffPayoutAmount, setStaffPayoutAmount] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [initialBuyIn, setInitialBuyIn] = useState('');
  const [initialMethod, setInitialMethod] = useState<PaymentMethod>('cash');
  const [editDate, setEditDate] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Editing states
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);

  // Add Player Modal States
  const [selectedPlayerForAdd, setSelectedPlayerForAdd] = useState<Player | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          { data: sessionData },
          { data: entriesData },
          { data: staffEntriesData },
          { data: allPlayersData },
          { data: allStaffData },
          { data: locationsData }
        ] = await Promise.all([
          supabase.from('sessions').select('*').eq('id', id).single(),
          supabase.from('player_session_entries').select('*').eq('sessionId', id),
          supabase.from('staff_session_entries').select('*').eq('sessionId', id),
          supabase.from('players').select('*').eq('active', true),
          supabase.from('staff').select('*').eq('active', true),
          supabase.from('locations').select('*').eq('active', true)
        ]);

        if (sessionData) {
          setSession(sessionData as Session);
          setEditDate(format(parseISO(sessionData.date), "yyyy-MM-dd'T'HH:mm"));
          setEditLocationId(sessionData.locationId);
        }
        if (entriesData) setEntries(entriesData as PlayerSessionEntry[]);
        if (staffEntriesData) setStaffEntries(staffEntriesData as StaffSessionEntry[]);
        if (allPlayersData) setAvailablePlayers(allPlayersData as Player[]);
        if (allStaffData) setAllStaff(allStaffData as Staff[]);
        if (locationsData) setLocations(locationsData as Location[]);
      } catch (error) {
        console.error("Fetch failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`session-${id}`)
      .on('postgres_changes' as any, { event: '*', table: 'player_session_entries', filter: `sessionId=eq.${id}` }, () => fetchData())
      .on('postgres_changes' as any, { event: '*', table: 'staff_session_entries', filter: `sessionId=eq.${id}` }, () => fetchData())
      .on('postgres_changes' as any, { event: '*', table: 'sessions', filter: `id=eq.${id}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate]);

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

  const updateBuyIn = async (entryId: string, index: number, amount: number, method: PaymentMethod) => {
    if (!id) return;
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const oldAmount = entry.buyIns[index].amount;
      const newBuyIns = [...entry.buyIns];
      newBuyIns[index] = { ...newBuyIns[index], amount, method };
      const newTotal = newBuyIns.reduce((acc, b) => acc + b.amount, 0);

      const { error: entryError } = await supabase
        .from('player_session_entries')
        .update({
          buyIns: newBuyIns,
          totalBuyIn: newTotal,
          netProfit: (entry.totalPayout || 0) - newTotal + (entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0)
        })
        .eq('id', entryId);

      if (entryError) throw entryError;

      const { error: sessionError } = await supabase
        .from('sessions')
        .update({ totalBuyIn: (session?.totalBuyIn || 0) - oldAmount + amount })
        .eq('id', id);

      if (sessionError) throw sessionError;

      await refreshData();
      setIsEditingRecord(false);
      setEditingIndex(null);
      setBuyInAmount('');
    } catch (error) {
      console.error("Update buy-in failed:", error);
    }
  };

  const updatePayout = async (entryId: string, index: number, amount: number, method: PaymentMethod) => {
    if (!id) return;
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newPayouts = [...(entry.payouts || [])];
      newPayouts[index] = { ...newPayouts[index], amount, method };
      const newTotalPayout = newPayouts.reduce((acc, p) => acc + p.amount, 0);
      
      const { error } = await supabase
        .from('player_session_entries')
        .update({
          payouts: newPayouts,
          totalPayout: newTotalPayout,
          netProfit: newTotalPayout - (entry.totalBuyIn || 0) + (entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0),
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
      setIsEditingRecord(false);
      setEditingIndex(null);
      setCashOutAmount('');
    } catch (error) {
      console.error("Update payout failed:", error);
    }
  };

  const updateSettlement = async (entryId: string, index: number, amount: number, method: PaymentMethod) => {
    if (!id) return;
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newSettlements = [...(entry.creditSettlements || [])];
      newSettlements[index] = { ...newSettlements[index], amount, method };
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
      setIsEditingRecord(false);
      setEditingIndex(null);
      setSettlementAmount('');
    } catch (error) {
      console.error("Update settlement failed:", error);
    }
  };

  const addAdjustment = async (entryId: string) => {
    if (!id || !adjustmentAmount) return;
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount)) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newAdjustment = { 
        amount, 
        reason: adjustmentReason || 'Manual adjustment', 
        timestamp: new Date().toISOString() 
      };
      const newAdjustments = [...(entry.adjustments || []), newAdjustment];
      const totalAdjustment = newAdjustments.reduce((acc, adj) => acc + adj.amount, 0);

      const netProfit = (entry.totalPayout || 0) - (entry.totalBuyIn || 0) + totalAdjustment;

      const { error } = await supabase
        .from('player_session_entries')
        .update({
          adjustments: newAdjustments,
          netProfit
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
      setAdjustmentAmount('');
      setAdjustmentReason('');
    } catch (error) {
      console.error("Add adjustment failed:", error);
    }
  };

  const removeAdjustment = async (entryId: string, index: number) => {
    if (!id || !window.confirm('Delete this adjustment?')) return;
    
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newAdjustments = (entry.adjustments || []).filter((_, i) => i !== index);
      const totalAdjustment = newAdjustments.reduce((acc, adj) => acc + adj.amount, 0);
      const netProfit = (entry.totalPayout || 0) - (entry.totalBuyIn || 0) + totalAdjustment;

      const { error } = await supabase
        .from('player_session_entries')
        .update({
          adjustments: newAdjustments,
          netProfit
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
    } catch (error) {
       console.error("Remove adjustment failed:", error);
    }
  };

  const addBuyIn = async (entryId: string, method: PaymentMethod) => {
    if (!id || !buyInAmount) return;
    const amount = parseFloat(buyInAmount);
    if (isNaN(amount)) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newBuyIn = { amount, method, timestamp: new Date().toISOString() };
      const newBuyIns = [...entry.buyIns, newBuyIn];
      const newTotal = entry.totalBuyIn + amount;

      const { error: entryError } = await supabase
        .from('player_session_entries')
        .update({
          buyIns: newBuyIns,
          totalBuyIn: newTotal,
          netProfit: entry.totalPayout - newTotal + (entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0)
        })
        .eq('id', entryId);

      if (entryError) throw entryError;

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
    if (!id || !window.confirm('Delete this buy-in?')) return;
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const amountRemoved = entry.buyIns[index].amount;
      const newBuyIns = entry.buyIns.filter((_, i) => i !== index);
      const newTotal = newBuyIns.reduce((acc, b) => acc + b.amount, 0);

      const { error: entryError } = await supabase
        .from('player_session_entries')
        .update({
          buyIns: newBuyIns,
          totalBuyIn: newTotal,
          netProfit: entry.totalPayout - newTotal + (entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0)
        })
        .eq('id', entryId);

      if (entryError) throw entryError;

      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          totalBuyIn: (session?.totalBuyIn || 0) - amountRemoved
        })
        .eq('id', id);

      if (sessionError) throw sessionError;

      await refreshData();
    } catch (error) {
      console.error("Remove buy-in failed:", error);
    }
  };

  const cashOutPlayer = async (entryId: string, method: PaymentMethod, customAmount?: number) => {
    if (!id) return;
    const amount = customAmount || parseFloat(cashOutAmount);
    if (isNaN(amount)) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newPayout = { amount, method, timestamp: new Date().toISOString() };
      const newPayouts = [...(entry.payouts || []), newPayout];
      const newTotalPayout = (entry.totalPayout || 0) + amount;

      const { error } = await supabase
        .from('player_session_entries')
        .update({
          payouts: newPayouts,
          totalPayout: newTotalPayout,
          netProfit: newTotalPayout - entry.totalBuyIn + (entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0)
        })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
      setCashOutAmount('');
    } catch (error) {
      console.error("Cash out failed:", error);
    }
  };

  const removePayout = async (entryId: string, index: number) => {
    if (!id || !window.confirm('Delete this payout?')) return;
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
          netProfit: newTotalPayout - entry.totalBuyIn + (entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0)
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
    if (isNaN(amount)) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newSettlement = { amount, method, timestamp: new Date().toISOString() };
      const newSettlements = [...(entry.creditSettlements || []), newSettlement];
      const newTotalSettled = (entry.totalSettled || 0) + amount;

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
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const { error } = await supabase
        .from('player_session_entries')
        .update({ status: entry.status === 'playing' ? 'finished' : 'playing' })
        .eq('id', entryId);

      if (error) throw error;
      await refreshData();
    } catch (error) {
      console.error("Toggle seat status failed:", error);
    }
  };

  const removePlayerEntry = async (entryId: string) => {
    if (!window.confirm('CRITICAL: Remove this player and all their financial records from this session?')) return;
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const { error } = await supabase
        .from('player_session_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Update session total buy-in
      if (entry.totalBuyIn > 0) {
        await supabase
          .from('sessions')
          .update({ totalBuyIn: (session?.totalBuyIn || 0) - entry.totalBuyIn })
          .eq('id', id);
      }

      await refreshData();
    } catch (error) {
      console.error("Remove player entry failed:", error);
    }
  };

  const addStaffToSession = async (staff: Staff) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('staff_session_entries')
        .insert([{
          sessionId: id,
          staffId: staff.id,
          staffDisplayName: staff.name,
          payoutAmount: 0,
          method: 'cash',
          createdAt: new Date().toISOString()
        }]);
      if (error) throw error;
      await refreshData();
      setIsAddingStaff(false);
    } catch (error) {
      console.error("Add staff failed:", error);
    }
  };

  const payoutStaff = async (staffEntryId: string, method: PaymentMethod) => {
    if (!staffPayoutAmount) return;
    const amount = parseFloat(staffPayoutAmount);
    if (isNaN(amount)) return;

    try {
      const { error } = await supabase
        .from('staff_session_entries')
        .update({ payoutAmount: amount, method })
        .eq('id', staffEntryId);
      if (error) throw error;
      await refreshData();
      setSelectedStaffEntryId(null);
      setStaffPayoutAmount('');
    } catch (error) {
      console.error("Staff payout failed:", error);
    }
  };

  const removeStaffPayout = async (staffEntryId: string) => {
    if (!window.confirm('Delete this staff record?')) return;
    try {
      const { error } = await supabase
        .from('staff_session_entries')
        .delete()
        .eq('id', staffEntryId);
      if (error) throw error;
      await refreshData();
    } catch (error) {
      console.error("Remove staff failed:", error);
    }
  };

  const updateSessionMetadata = async () => {
    if (!id || !session) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          date: editDate,
          locationId: editLocationId
        })
        .eq('id', id);

      if (error) throw error;
      await refreshData();
      setIsEditingMetadata(false);
    } catch (error) {
      console.error("Update session failed:", error);
    }
  };

  const deleteSession = async () => {
    if (!id || !window.confirm('PERMANENT DELETION: This session and all associated financial records will be wiped. Proceed?')) return;
    try {
      // Cascade delete should handle entries if configured, but we'll be safe
      await supabase.from('player_session_entries').delete().eq('sessionId', id);
      await supabase.from('staff_session_entries').delete().eq('sessionId', id);
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;
      navigate('/sessions');
    } catch (error) {
      console.error("Delete session failed:", error);
    }
  };

  const completeSession = async () => {
    if (!id || !window.confirm('Are you sure you want to complete this session? This will lock most editing actions.')) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', id);
      if (error) throw error;
      await refreshData();
    } catch (error) {
      console.error("Complete session failed:", error);
    }
  };

  const sessionStats = useMemo(() => {
    const totalBuyIn = entries.reduce((acc, entry) => acc + entry.totalBuyIn, 0);
    const totalPayout = entries.reduce((acc, entry) => acc + entry.totalPayout, 0);
    const totalStaffPayout = staffEntries.reduce((acc, entry) => acc + entry.payoutAmount, 0);
    const totalCredit = entries.reduce((acc, entry) => 
      acc + entry.buyIns.filter(b => b.method === 'credit').reduce((sum, b) => sum + b.amount, 0), 0);
    const totalSettled = entries.reduce((acc, entry) => acc + (entry.totalSettled || 0), 0);
    
    const realizedCash = totalBuyIn - totalCredit + totalSettled;
    const hostBalance = realizedCash - totalPayout - totalStaffPayout;
    const totalPlayers = entries.length;

    return {
      totalBuyIn,
      totalPayout,
      totalStaffPayout,
      totalCredit,
      totalSettled,
      outstandingCredit: totalCredit - totalSettled,
      realizedCash,
      hostBalance,
      totalPlayers
    };
  }, [entries, staffEntries]);

  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  const buyInBreakdown = selectedEntry ? selectedEntry.buyIns.reduce((acc, bi) => {
    acc[bi.method] = (acc[bi.method] || 0) + bi.amount;
    return acc;
  }, {} as Record<string, number>) : {};

  if (loading || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-slate-400" size={32} />
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 font-bold">Initializing Relay...</p>
      </div>
    );
  }

  const filteredPlayersForAdd = availablePlayers.filter(p => 
    p.name.toLowerCase().includes(playerSearchQuery.toLowerCase()) &&
    !entries.some(e => e.playerId === p.id)
  );

  return (
    <div className="p-4 md:p-4 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-6">
      {/* Top Navigation */}
      <div className="flex justify-between items-center px-2">
        <button 
          onClick={() => navigate('/sessions')}
          className="p-3 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditingMetadata(true)}
            className="px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 modern-shadow"
          >
            <Edit3 size={16} />
            <span className="hidden sm:inline">Edit Session</span>
          </button>
          <button 
            onClick={deleteSession}
            className="px-4 py-3 border border-rose-100 text-rose-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Scrub</span>
          </button>
        </div>
      </div>

      {/* Session Header Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-brand-border modern-shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">
                  {locations.find(l => l.id === session.locationId)?.name || 'Unknown Hub'}
                </h1>
                <p className="text-[10px] sm:text-xs font-mono text-slate-400 font-bold uppercase tracking-widest">
                  {format(parseISO(session.date), 'PPPP')} @ {format(parseISO(session.date), 'p')}
                </p>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                session.status?.toLowerCase() === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
              )}>
                {session.status}
              </div>
            </div>
            <div className="pt-6 border-t border-brand-border space-y-4">
              <button 
                onClick={() => setIsAddingPlayer(true)}
                disabled={session.status?.toLowerCase() === 'completed'}
                className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all modern-shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={20} />
                Assign Player to Seat
              </button>
              
              {session.status?.toLowerCase() === 'active' && (
                <button 
                  onClick={completeSession}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all modern-shadow-lg"
                >
                  <CheckCircle2 size={20} />
                  End Session & Close Ledger
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50/50 p-4 rounded-xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Buy-In</span>
              <p className="text-lg font-black text-slate-900 leading-none">{formatCurrency(session.totalBuyIn || 0)}</p>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">A/R (Credit)</span>
              <p className="text-lg font-black text-rose-500 leading-none">{formatCurrency(sessionStats.outstandingCredit)}</p>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Cash-In</span>
              <p className="text-lg font-black text-slate-900 leading-none">{formatCurrency(sessionStats.realizedCash)}</p>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Balance</span>
              <p className={cn(
                "text-lg font-black font-sans leading-none",
                sessionStats.hostBalance < 0 ? "text-rose-500" : "text-emerald-600"
              )}>
                {formatCurrency(sessionStats.hostBalance)}
              </p>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-xl border border-brand-border/50">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black mb-1 block">Total Players</span>
              <p className="text-lg font-black text-slate-900 leading-none">{sessionStats.totalPlayers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Ledgers Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Main Player Ledger */}
        <div className="xl:col-span-9 space-y-4">
          <div className="flex justify-between items-center border-b border-brand-border pb-3">
             <div className="flex items-center gap-4">
                <h2 className="text-xs uppercase font-black tracking-widest flex items-center gap-2 transition-all text-slate-900">
                  <span className="w-1 h-3 rounded-full bg-emerald-500" />
                  Player Ledger
                </h2>
             </div>
             <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest">Active: {entries.filter(e => e.status === 'playing').length}</span>
          </div>

          <div className="bg-white border border-brand-border rounded-xl overflow-x-auto modern-shadow">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/30 border-b border-brand-border">
                  <th className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Member</th>
                  <th className="px-4 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Buy-In</th>
                  <th className="px-4 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Payout</th>
                  <th className="px-4 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Adjust</th>
                  <th className="px-4 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Net</th>
                  <th className="px-4 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-slate-400 font-black">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className={cn("group hover:bg-slate-50 transition-all", entry.status === 'finished' && "bg-slate-50/5 opacity-80")}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{entry.playerDisplayName}</p>
                          <span className={cn(
                            "text-[8px] font-mono border px-1.5 py-0.5 rounded uppercase tracking-tighter",
                            entry.status === 'playing' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                          )}>{entry.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-xs font-black text-slate-900">{formatCurrency(entry.totalBuyIn)}</p>
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest font-bold leading-none">Rebuys: {entry.buyIns.length - 1 > 0 ? entry.buyIns.length -1 : 0}</span>
                        {entry.buyIns.some(b => b.method === 'credit') && (
                          <span className="text-[8px] font-mono text-rose-500 uppercase tracking-widest font-bold mt-0.5">Credit</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-xs font-black text-slate-900">{entry.totalPayout > 0 ? formatCurrency(entry.totalPayout) : '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className={cn("text-xs font-black", (entry.adjustments?.length || 0) > 0 ? "text-blue-500" : "text-slate-300")}>
                        {formatCurrency(entry.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className={cn("text-sm font-black tracking-tight", entry.netProfit >= 0 ? "text-emerald-600" : "text-rose-500")}>
                        {entry.netProfit > 0 ? '+' : ''}{formatCurrency(entry.netProfit)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                           onClick={() => {
                             setSelectedEntryId(entry.id);
                             setModalMode('buyin');
                           }}
                           disabled={session.status === 'completed' || entry.status === 'finished'}
                           className="px-3 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-5 touch-manipulation"
                        >
                           Buy
                        </button>
                        <button 
                           onClick={() => {
                             setSelectedEntryId(entry.id);
                             setModalMode('settle');
                             setReturnedChips('');
                             setCashOutAmount('');
                           }}
                           disabled={session.status === 'completed'}
                           className="px-3 py-2 border border-brand-border text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-5 touch-manipulation"
                        >
                           Out
                        </button>
                        <button 
                           onClick={() => removePlayerEntry(entry.id)}
                           disabled={session.status === 'completed'}
                           className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-0"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dense Staff & Support Section */}
        <div className="xl:col-span-3 space-y-4">
           <div className="flex justify-between items-center border-b border-brand-border pb-3">
             <h2 className="text-xs uppercase font-black tracking-widest text-slate-900 flex items-center gap-2">
               <span className="w-1 h-3 bg-slate-900 rounded-full" />
               Personnel
             </h2>
          </div>

          <div className="bg-white border border-brand-border rounded-xl overflow-hidden modern-shadow divide-y divide-brand-border">
            {staffEntries.length === 0 && (
              <div className="p-8 text-center bg-slate-50/50">
                 <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">No assigned staff</p>
              </div>
            )}
            {staffEntries.map((entry) => (
              <div key={entry.id} className="p-5 group hover:bg-slate-50 transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-900">{entry.staffDisplayName}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-mono text-slate-400 uppercase font-black">{entry.method !== 'cash' ? entry.method : 'Standard Deployment'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeStaffPayout(entry.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div 
                  onClick={() => {
                    setSelectedStaffEntryId(entry.id);
                    setStaffPayoutAmount(entry.payoutAmount.toString());
                  }}
                  className="flex justify-between items-end cursor-pointer group/stat p-3 -mx-2 rounded-xl hover:bg-slate-100 transition-all"
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono text-slate-400 uppercase leading-tight font-black mb-1">Disbursement</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-emerald-500 font-black opacity-0 group-hover/stat:opacity-100 transition-all">Edit Value</span>
                    </div>
                  </div>
                  <p className="text-base font-black text-rose-500">{entry.payoutAmount > 0 ? formatCurrency(entry.payoutAmount) : '$0.00'}</p>
                </div>
              </div>
            ))}
            <button 
              onClick={() => setIsAddingStaff(true)}
              className="w-full py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-900 hover:text-white transition-all bg-slate-50/50"
            >
              Add Staff Support
            </button>
          </div>

          {/* Location Summary Plate */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 modern-shadow transition-all group overflow-hidden relative">
            <MapPin className="absolute top-2 right-2 text-slate-800 group-hover:text-slate-700 transition-colors" size={56} />
            <div className="relative">
              <span className="text-[10px] font-mono text-brand-gold uppercase tracking-widest font-black block mb-2">Operational Hub</span>
              <p className="text-base font-black text-white uppercase tracking-tight">{locations.find(l => l.id === session.locationId)?.name}</p>
              <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase truncate opacity-80">{locations.find(l => l.id === session.locationId)?.address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern High-Performance Modals */}
      <AnimatePresence>
        {selectedEntryId && (
          <div key="player-action-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEntryId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }} 
               className="relative bg-white p-6 sm:p-10 lg:p-14 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-[2rem] sm:rounded-[2.5rem] modern-shadow-lg"
            >
              {/* Modal Mode Selector */}
              <div className="flex gap-1 mb-6 sm:mb-8 p-1 bg-slate-50 rounded-xl border border-brand-border w-full sm:w-fit overflow-x-auto">
                <button 
                  onClick={() => setModalMode('buyin')}
                  className={cn(
                    "flex-1 sm:flex-none px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    modalMode === 'buyin' ? "bg-white text-slate-900 modern-shadow border border-brand-border/50" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Buy-In
                </button>
                <button 
                  onClick={() => setModalMode('settle')}
                  className={cn(
                    "flex-1 sm:flex-none px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    modalMode === 'settle' ? "bg-white text-slate-900 modern-shadow border border-brand-border/50" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Payout
                </button>
                {(selectedEntry?.buyIns?.some(b => b.method === 'credit') || (selectedEntry?.creditSettlements?.length || 0) > 0) && (
                  <button 
                    onClick={() => setModalMode('ledger')}
                    className={cn(
                      "flex-1 sm:flex-none px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      modalMode === 'ledger' ? "bg-white text-slate-900 modern-shadow border border-brand-border/50" : "text-rose-400 hover:text-rose-500"
                    )}
                  >
                    Credit
                  </button>
                )}
              </div>

              {modalMode === 'buyin' ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Re-Buy / Add Liquidity</h2>
                    <p className="text-xs text-slate-400 font-medium">Inject funds into player position.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end mb-1">
                       <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">Amount</label>
                       <div className="text-right">
                         <span className="text-[7px] font-mono text-slate-300 uppercase block leading-none">Total Buy-In</span>
                         <span className="text-xs font-black text-slate-900">{formatCurrency(selectedEntry?.totalBuyIn || 0)}</span>
                       </div>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-200 group-focus-within:text-emerald-500 transition-colors">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={buyInAmount}
                        onChange={(e) => setBuyInAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-brand-border p-4 pl-10 rounded-xl text-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {isEditingRecord && editingIndex !== null ? (
                        PAYMENT_METHODS.map(method => (
                          <button
                            key={method.id}
                            onClick={() => {
                              const amt = parseFloat(buyInAmount);
                              if (!isNaN(amt)) updateBuyIn(selectedEntryId!, editingIndex, amt, method.id);
                            }}
                            className={cn(
                              "py-5 border border-blue-500 bg-blue-50 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all modern-shadow",
                            )}
                          >
                            Update as {method.label}
                          </button>
                        ))
                      ) : (
                        PAYMENT_METHODS.map(method => (
                          <button
                            key={method.id}
                            onClick={() => addBuyIn(selectedEntryId!, method.id)}
                            className={cn(
                              "py-5 border border-brand-border rounded-2xl text-xs font-black uppercase tracking-widest transition-all modern-shadow",
                              method.id === 'credit' ? "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white" : "text-slate-600 hover:bg-slate-900 hover:text-white"
                            )}
                          >
                            {method.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {(selectedEntry?.buyIns.length || 0) > 0 && (
                    <div className="space-y-1">
                      <span className="text-[7px] font-mono text-slate-300 uppercase tracking-widest block mb-1">Buy-In History</span>
                      {selectedEntry?.buyIns.map((bi, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-brand-border border-dashed last:border-0 group/bi">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Trash2 
                                size={10} 
                                className="cursor-pointer text-rose-300 hover:text-rose-500 transition-all"
                                onClick={() => removeBuyIn(selectedEntryId!, i)}
                              />
                              <Edit3
                                size={10}
                                className="cursor-pointer text-blue-300 hover:text-blue-500 transition-all"
                                onClick={() => {
                                  setEditingIndex(i);
                                  setIsEditingRecord(true);
                                  setBuyInAmount(bi.amount.toString());
                                }}
                              />
                            </div>
                            <span className={cn("text-[9px] font-black uppercase", bi.method === 'credit' ? "text-rose-500" : "text-slate-500")}>
                               {PAYMENT_METHODS.find(m => m.id === bi.method)?.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-slate-900">{formatCurrency(bi.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-brand-border">
                    <button 
                      onClick={() => setSelectedEntryId(null)}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : modalMode === 'settle' ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Chip Return & Settlement</h2>
                    <p className="text-xs text-slate-400 font-medium">Verify chips and calculate final disbursement/settlement.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-brand-border space-y-4">
                       <div className="flex justify-between items-end mb-1">
                          <label className="text-[10px] font-mono uppercase tracking-widest font-black text-slate-400">Total Chips Returned</label>
                          <span className="text-[8px] font-mono text-slate-300 uppercase font-black">Value in Dollars</span>
                       </div>
                       <div className="relative group">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-200 group-focus-within:text-emerald-500 transition-colors">$</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={returnedChips}
                          onChange={(e) => setReturnedChips(e.target.value)}
                          className="w-full bg-white border border-brand-border p-5 pl-10 rounded-xl text-3xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
                        />
                      </div>

                      {/* Calculation Panel */}
                      {selectedEntry && (
                        <div className="space-y-3 pt-4 border-t border-brand-border">
                          {(() => {
                            const creditDebt = (selectedEntry.buyIns.filter(b => b.method === 'credit').reduce((a, b) => a + b.amount, 0)) - (selectedEntry.totalSettled || 0);
                            const chips = parseFloat(returnedChips) || 0;
                            const balance = chips - creditDebt;

                            return (
                              <>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight text-slate-500">
                                    <span>Chips Value</span>
                                    <span>{formatCurrency(chips)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight text-rose-500">
                                    <span>Outstanding Credit</span>
                                    <span>-{formatCurrency(creditDebt)}</span>
                                  </div>
                                </div>
                                <div className={cn(
                                  "p-4 rounded-xl flex justify-between items-center",
                                  balance >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"
                                )}>
                                   <div>
                                     <span className="text-[8px] font-mono uppercase tracking-widest font-black opacity-60 block">
                                       {balance >= 0 ? "Owed to Player" : "Debt Still Owed"}
                                     </span>
                                     <p className={cn("text-xl font-black leading-none", balance >= 0 ? "text-emerald-700" : "text-rose-700")}>
                                       {formatCurrency(Math.abs(balance))}
                                     </p>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[8px] font-mono uppercase tracking-widest font-black opacity-60 block">Status</span>
                                      <span className={cn("text-[9px] font-black uppercase", balance === 0 ? "text-slate-400" : (balance > 0 ? "text-emerald-600" : "text-rose-600"))}>
                                        {balance === 0 ? "Balanced" : (balance > 0 ? "Payout Required" : "Settlement Needed")}
                                      </span>
                                   </div>
                                </div>

                                {/* Action Buttons */}
                                {balance !== 0 && (
                                  <div className="space-y-3 pt-2">
                                     <div className="flex justify-between items-center">
                                       <label className="text-[9px] font-mono uppercase tracking-widest font-black text-slate-400">
                                         {balance > 0 ? "Select Payout Method" : "Select Settlement Method"}
                                       </label>
                                     </div>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       {PAYMENT_METHODS.filter(m => m.id !== 'credit').map(method => (
                                         <button
                                           key={method.id}
                                           onClick={async () => {
                                             if (balance > 0) {
                                               // Host pays player the balance
                                               await cashOutPlayer(selectedEntry.id, method.id, balance);
                                             } else {
                                               // Player pays host the balance (negative)
                                               const originalAmount = settlementAmount;
                                               setSettlementAmount(Math.abs(balance).toString());
                                               await settleCredit(selectedEntry.id, method.id);
                                               setSettlementAmount(originalAmount);
                                             }
                                             setReturnedChips('');
                                           }}
                                           className={cn(
                                             "py-5 border rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all modern-shadow",
                                             balance > 0 
                                               ? "bg-white border-brand-border text-slate-600 hover:bg-slate-900 hover:text-white" 
                                               : "bg-rose-600 border-rose-700 text-white hover:bg-rose-700"
                                           )}
                                         >
                                           {balance > 0 ? `Pay via ${method.label}` : `Settle via ${method.label}`}
                                         </button>
                                       ))}
                                     </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-brand-border pb-2">
                           <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black">History</span>
                           <div className="flex gap-4">
                             <div className="text-right">
                               <span className="text-[7px] font-mono text-slate-300 uppercase block">Total Payouts</span>
                               <span className="text-xs font-black text-emerald-600">{formatCurrency(selectedEntry?.totalPayout || 0)}</span>
                             </div>
                             <div className="text-right">
                               <span className="text-[7px] font-mono text-slate-300 uppercase block">Total Settled</span>
                               <span className="text-xs font-black text-blue-500">{formatCurrency(selectedEntry?.totalSettled || 0)}</span>
                             </div>
                           </div>
                        </div>

                        {/* Adjustments */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black">Manual Adjustments</span>
                            <span className="text-[8px] font-mono text-blue-500 uppercase font-black">Current: {formatCurrency(selectedEntry?.adjustments?.reduce((a, b) => a + b.amount, 0) || 0)}</span>
                          </div>
                          
                          <div className="space-y-2">
                            {selectedEntry?.adjustments?.map((adj, i) => (
                              <div key={i} className="flex justify-between items-center p-2 bg-blue-50/50 border border-blue-100 border-dashed rounded text-[10px]">
                                <div className="flex items-center gap-2">
                                  <Trash2 
                                    size={10} 
                                    className="text-slate-300 hover:text-rose-500 cursor-pointer transition-colors"
                                    onClick={() => removeAdjustment(selectedEntry.id, i)}
                                  />
                                  <span className="font-black text-slate-900">[{adj.reason}]</span>
                                </div>
                                <span className={cn("font-black", adj.amount >= 0 ? "text-emerald-600" : "text-rose-500")}>
                                  {adj.amount >= 0 ? '+' : ''}{formatCurrency(adj.amount)}
                                </span>
                              </div>
                            ))}
                            
                            <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl">
                              <input 
                                placeholder="Reason"
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                className="flex-1 bg-white border border-brand-border rounded-lg p-2 text-[10px] outline-none font-bold"
                              />
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">$</span>
                                <input 
                                  type="number"
                                  placeholder="0.00"
                                  value={adjustmentAmount}
                                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                                  className="w-16 bg-white border border-brand-border rounded-lg p-2 pl-4 text-[10px] outline-none font-bold"
                                />
                              </div>
                              <button 
                                onClick={() => addAdjustment(selectedEntry.id)}
                                className="bg-slate-900 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                        <button 
                           onClick={() => toggleEntryStatus(selectedEntryId!)}
                           className={cn(
                             "flex-1 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
                             selectedEntry?.status === 'finished' 
                               ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white" 
                               : "bg-brand-gold text-white hover:opacity-90"
                           )}
                        >
                           {selectedEntry?.status === 'finished' ? "Re-Open Table Seat" : "Finalize & Close Seat"}
                        </button>
                        <button 
                          onClick={() => setSelectedEntryId(null)}
                          className="px-8 py-5 border border-brand-border rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-sans"
                        >
                          Exit Navigation
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
                      {isEditingRecord && editingIndex !== null ? (
                        PAYMENT_METHODS.filter(m => m.id !== 'credit').map(method => (
                          <button
                            key={method.id}
                            onClick={() => {
                              const amt = parseFloat(settlementAmount);
                              if (!isNaN(amt)) updateSettlement(selectedEntryId!, editingIndex, amt, method.id);
                            }}
                            className="py-4 bg-blue-50 border border-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-600 hover:text-white transition-all modern-shadow"
                          >
                            Update as {method.label}
                          </button>
                        ))
                      ) : (
                        PAYMENT_METHODS.filter(m => m.id !== 'credit').map(method => (
                          <button
                            key={method.id}
                            onClick={() => settleCredit(selectedEntryId!, method.id)}
                            className="py-4 bg-white border border-brand-border rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all modern-shadow"
                          >
                            Recv via {method.label}
                          </button>
                        ))
                      )}
                    </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black block">Settlement History</span>
                    <div className="space-y-2 pr-2">
                       {selectedEntry?.creditSettlements?.map((s, i) => (
                         <div key={i} className="flex justify-between items-center p-3 bg-slate-50 border border-brand-border border-dashed rounded group/item">
                           <div className="flex items-center gap-2">
                             <Trash2 
                               size={10} 
                               className="text-slate-200 hover:text-rose-500 cursor-pointer transition-colors"
                               onClick={() => removeSettlement(selectedEntry.id, i)}
                             />
                             <Edit3
                               size={10}
                               className="text-slate-200 hover:text-blue-500 cursor-pointer transition-colors"
                               onClick={() => {
                                 setEditingIndex(i);
                                 setIsEditingRecord(true);
                                 setSettlementAmount(s.amount.toString());
                               }}
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
                onClick={() => { setSelectedEntryId(null); setBuyInAmount(''); setCashOutAmount(''); setIsEditingRecord(false); setEditingIndex(null); }}
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

      {/* Other Modals (Metadata, Add Player, Add Staff) - Simplified for restoration */}
      <AnimatePresence>
        {isEditingMetadata && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditingMetadata(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative bg-white p-8 max-w-xl w-full rounded-3xl modern-shadow-lg">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-2xl font-black uppercase tracking-tight">Edit Session</h3>
                <button onClick={() => setIsEditingMetadata(false)} className="text-slate-300 hover:text-slate-600"><XCircle size={24} /></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase font-black text-slate-400">Location</label>
                  <select value={editLocationId} onChange={(e) => setEditLocationId(e.target.value)} className="w-full bg-slate-50 border p-4 rounded-xl font-bold">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase font-black text-slate-400">Date</label>
                  <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-slate-50 border p-4 rounded-xl font-bold" />
                </div>
                <button onClick={updateSessionMetadata} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase">Confirm Updates</button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingPlayer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingPlayer(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative bg-white p-10 max-w-xl w-full rounded-[2.5rem] modern-shadow-lg">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-2xl font-black uppercase tracking-tight">Add Player</h3>
                <button onClick={() => setIsAddingPlayer(false)}><XCircle size={24} className="text-slate-300" /></button>
              </div>
              
              {!selectedPlayerForAdd ? (
                <div className="space-y-4">
                  <input 
                    placeholder="Search roster..." 
                    value={playerSearchQuery} 
                    onChange={e => setPlayerSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border p-4 rounded-xl font-bold"
                  />
                  <div className="max-h-[300px] overflow-y-auto pr-2 space-y-1">
                    {filteredPlayersForAdd.map(p => (
                      <button key={p.id} onClick={() => setSelectedPlayerForAdd(p)} className="w-full p-4 text-left hover:bg-slate-50 rounded-xl transition-all font-black uppercase text-xs">
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-center">
                  <h4 className="text-xl font-black">{selectedPlayerForAdd.name}</h4>
                  <div className="space-y-4">
                    <input type="number" placeholder="Initial Buy-In" value={initialBuyIn} onChange={e => setInitialBuyIn(e.target.value)} className="w-full border p-4 rounded-xl text-xl font-black text-center" />
                    <div className="grid grid-cols-2 gap-2">
                       {PAYMENT_METHODS.map(m => (
                         <button key={m.id} onClick={() => setInitialMethod(m.id)} className={cn("p-4 border rounded-xl text-[10px] font-black uppercase transition-all", initialMethod === m.id ? "bg-slate-900 text-white" : "hover:bg-slate-50")}>{m.label}</button>
                       ))}
                    </div>
                    <button onClick={addPlayerToSession} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest">Confirm Seat Assignment</button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {isAddingStaff && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingStaff(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative bg-white p-10 max-w-xl w-full rounded-[2.5rem] modern-shadow-lg">
               <h3 className="text-2xl font-black uppercase tracking-tight mb-8">Add Staff Support</h3>
               <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {allStaff.filter(s => s.active && !staffEntries.some(e => e.staffId === s.id)).map(person => (
                    <button key={person.id} onClick={() => addStaffToSession(person)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-white border hover:border-emerald-500 rounded-2xl transition-all">
                      <span className="text-sm font-black uppercase">{person.name}</span>
                      <Plus size={16} />
                    </button>
                  ))}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
