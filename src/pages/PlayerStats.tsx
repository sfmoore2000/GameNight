import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Player, PlayerSessionEntry, Session, Staff, StaffSessionEntry } from '../types';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BarChart3, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  DollarSign,
  Medal,
  Target,
  Sparkles,
  PieChart
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

interface PlayerStat {
  player: Player;
  totalGames: number;
  totalWins: number;
  totalProfit: number;
  totalBuyIn: number;
  winRate: number;
  roi: number;
  avgProfitPerGame: number;
  history: {
    date: string;
    profit: number;
    cumulativeProfit: number;
    sessionId: string;
  }[];
}

interface StaffStat {
  staff: Staff;
  totalSessions: number;
  totalEarned: number;
  avgEarnedPerSession: number;
  history: {
    date: string;
    amount: number;
    cumulativeEarned: number;
    sessionId: string;
  }[];
}

export function PlayerStats() {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'players' | 'staff'>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<PlayerSessionEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffEntries, setStaffEntries] = useState<StaffSessionEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [
          { data: playersData },
          { data: entriesData },
          { data: sessionsData },
          { data: staffData },
          { data: staffEntriesData }
        ] = await Promise.all([
          supabase.from('players').select('*').order('name', { ascending: true }),
          supabase.from('player_session_entries').select('*'),
          supabase.from('sessions').select('*').order('date', { ascending: true }),
          supabase.from('staff').select('*').order('name', { ascending: true }),
          supabase.from('staff_session_entries').select('*')
        ]);

        if (playersData) setPlayers(playersData as Player[]);
        if (entriesData) setEntries(entriesData as PlayerSessionEntry[]);
        if (sessionsData) setSessions(sessionsData as Session[]);
        if (staffData) setStaff(staffData as Staff[]);
        if (staffEntriesData) setStaffEntries(staffEntriesData as StaffSessionEntry[]);
      } catch (error) {
        console.error('Error fetching stats data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const playerStats = useMemo(() => {
    const statsMap = new Map<string, PlayerStat>();

    players.forEach(player => {
      const playerEntries = entries.filter(e => e.playerId === player.id);
      
      const sortedEntries = playerEntries.map(entry => {
        const session = sessions.find(s => s.id === entry.sessionId);
        return {
          ...entry,
          sessionDate: session?.date || '2000-01-01'
        };
      }).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

      let cumulativeProfit = 0;
      const history = sortedEntries.map(entry => {
        cumulativeProfit += (entry.netProfit || 0);
        return {
          date: entry.sessionDate,
          profit: entry.netProfit || 0,
          cumulativeProfit,
          sessionId: entry.sessionId
        };
      });

      const totalProfit = history.reduce((sum, h) => sum + h.profit, 0);
      const totalBuyIn = playerEntries.reduce((sum, e) => sum + (e.totalBuyIn || 0), 0);
      const totalWins = playerEntries.filter(e => (e.netProfit || 0) > 0).length;

      statsMap.set(player.id, {
        player,
        totalGames: playerEntries.length,
        totalWins,
        totalProfit,
        totalBuyIn,
        winRate: playerEntries.length > 0 ? (totalWins / playerEntries.length) * 100 : 0,
        roi: totalBuyIn > 0 ? (totalProfit / totalBuyIn) * 100 : 0,
        avgProfitPerGame: playerEntries.length > 0 ? totalProfit / playerEntries.length : 0,
        history
      });
    });

    return Array.from(statsMap.values());
  }, [players, entries, sessions]);

  const staffStats = useMemo(() => {
    const statsMap = new Map<string, StaffStat>();

    staff.forEach(s => {
      const sEntries = staffEntries.filter(e => e.staffId === s.id);
      
      const sortedEntries = sEntries.map(entry => {
        const session = sessions.find(sess => sess.id === entry.sessionId);
        return {
          ...entry,
          sessionDate: session?.date || '2000-01-01'
        };
      }).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

      let cumulativeEarned = 0;
      const history = sortedEntries.map(entry => {
        cumulativeEarned += (entry.payoutAmount || 0);
        return {
          date: entry.sessionDate,
          amount: entry.payoutAmount || 0,
          cumulativeEarned,
          sessionId: entry.sessionId
        };
      });

      const totalEarned = history.reduce((sum, h) => sum + h.amount, 0);

      statsMap.set(s.id, {
        staff: s,
        totalSessions: sEntries.length,
        totalEarned,
        avgEarnedPerSession: sEntries.length > 0 ? totalEarned / sEntries.length : 0,
        history
      });
    });

    return Array.from(statsMap.values());
  }, [staff, staffEntries, sessions]);

  const filteredStats = useMemo(() => {
    if (viewMode === 'players') {
      return playerStats.filter(stat => 
        stat.player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      return staffStats.filter(stat => 
        stat.staff.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  }, [viewMode, playerStats, staffStats, searchTerm]);

  const rankings = useMemo(() => {
    return {
      mostWins: [...playerStats].sort((a, b) => b.totalWins - a.totalWins).slice(0, 5),
      highestROI: [...playerStats].sort((a, b) => b.roi - a.roi).slice(0, 5),
      mostGames: [...playerStats].sort((a, b) => b.totalGames - a.totalGames).slice(0, 5),
      highestProfit: [...playerStats].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5),
      topStaffEarners: [...staffStats].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 5),
      mostActiveStaff: [...staffStats].sort((a, b) => b.totalSessions - a.totalSessions).slice(0, 5),
    };
  }, [playerStats, staffStats]);

  const selectedPlayerStat = viewMode === 'players' && selectedEntityId ? playerStats.find(s => s.player.id === selectedEntityId) : null;
  const selectedStaffStat = viewMode === 'staff' && selectedEntityId ? staffStats.find(s => s.staff.id === selectedEntityId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Activity className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            BUSINESS ANALYTICS
          </h1>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Enterprise performance metrics</p>
        </div>

        {/* View Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button 
            onClick={() => { setViewMode('players'); setSelectedEntityId(null); setSearchTerm(''); }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 uppercase tracking-widest",
              viewMode === 'players' ? "bg-white text-blue-600 modern-shadow" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users size={12} />
            Players
          </button>
          <button 
            onClick={() => { setViewMode('staff'); setSelectedEntityId(null); setSearchTerm(''); }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 uppercase tracking-widest",
              viewMode === 'staff' ? "bg-white text-purple-600 modern-shadow" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles size={12} />
            Staff
          </button>
        </div>
      </div>

      {viewMode === 'players' ? (
        <>
          {/* Player Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Win Leaders</h3>
              </div>
              <div className="space-y-2">
                {rankings.mostWins.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-black ${i === 0 ? 'text-amber-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="font-bold text-slate-700 truncate">{stat.player.name}</span>
                    </div>
                    <span className="font-black text-slate-400 whitespace-nowrap">{stat.totalWins} W</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[9px]">ROI Giants</h3>
              </div>
              <div className="space-y-2">
                {rankings.highestROI.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-black ${i === 0 ? 'text-emerald-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="font-bold text-slate-700 truncate">{stat.player.name}</span>
                    </div>
                    <span className={`font-black ${stat.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stat.roi.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Medal className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Profit Leaders</h3>
              </div>
              <div className="space-y-2">
                {rankings.highestProfit.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-black ${i === 0 ? 'text-blue-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="font-bold text-slate-700 truncate">{stat.player.name}</span>
                    </div>
                    <span className="font-black text-slate-700">${stat.totalProfit.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="w-4 h-4 text-purple-500" />
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Active</h3>
              </div>
              <div className="space-y-2">
                {rankings.mostGames.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-black ${i === 0 ? 'text-purple-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="font-bold text-slate-700 truncate">{stat.player.name}</span>
                    </div>
                    <span className="font-black text-slate-400">{stat.totalGames} G</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Player Search and Detail */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
              <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Player</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredStats.map((stat) => (
                      <tr 
                        key={(stat as PlayerStat).player.id} 
                        className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${selectedEntityId === (stat as PlayerStat).player.id ? 'bg-blue-50/50' : ''}`}
                        onClick={() => setSelectedEntityId((stat as PlayerStat).player.id)}
                      >
                        <td className="px-4 py-2">
                          <span className="text-[11px] font-bold text-slate-700 truncate block">{(stat as PlayerStat).player.name}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-[11px] font-black ${(stat as PlayerStat).totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ${(stat as PlayerStat).totalProfit.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-3 space-y-4">
              {selectedPlayerStat ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900 p-4 rounded-2xl relative overflow-hidden">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Profit</p>
                      <p className={`text-xl font-black ${selectedPlayerStat.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${selectedPlayerStat.totalProfit.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Win Rate</p>
                      <p className="text-xl font-black text-slate-900">{selectedPlayerStat.winRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg/Game</p>
                      <p className={`text-xl font-black ${selectedPlayerStat.avgProfitPerGame >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${selectedPlayerStat.avgProfitPerGame.toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">ROI</p>
                      <p className={`text-xl font-black ${selectedPlayerStat.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedPlayerStat.roi.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="mb-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Financial Performance</h3>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedPlayerStat.history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{fontSize: 8, fontWeight: 'bold', fill: '#94a3b8'}}
                            tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{fontSize: 8, fontWeight: 'bold', fill: '#94a3b8'}}
                            tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#0f172a', padding: '8px' }}
                            itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '8px', marginBottom: '2px', textTransform: 'uppercase', fontWeight: 800 }}
                            labelFormatter={(val) => format(parseISO(val), 'MMM d, yyyy')}
                          />
                          <Area type="monotone" dataKey="cumulativeProfit" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.1} fill="#3b82f6" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">No Selection</p>
                  <p className="text-[10px] font-medium text-slate-400">Select a player from the registry</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Staff Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-purple-500" />
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Top Earners</h3>
              </div>
              <div className="space-y-2">
                {rankings.topStaffEarners.map((stat, i) => (
                  <div key={stat.staff.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-black ${i === 0 ? 'text-purple-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="font-bold text-slate-700 truncate">{stat.staff.name}</span>
                    </div>
                    <span className="font-black text-purple-600">${stat.totalEarned.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Most Active</h3>
              </div>
              <div className="space-y-2">
                {rankings.mostActiveStaff.map((stat, i) => (
                  <div key={stat.staff.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-black ${i === 0 ? 'text-blue-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="font-bold text-slate-700 truncate">{stat.staff.name}</span>
                    </div>
                    <span className="font-black text-blue-600">{stat.totalSessions} S</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Staff List and Detail */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
              <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredStats.map((stat) => (
                      <tr 
                        key={(stat as StaffStat).staff.id} 
                        className={`hover:bg-purple-50/30 cursor-pointer transition-colors ${selectedEntityId === (stat as StaffStat).staff.id ? 'bg-purple-50/50' : ''}`}
                        onClick={() => setSelectedEntityId((stat as StaffStat).staff.id)}
                      >
                        <td className="px-4 py-2">
                          <span className="text-[11px] font-bold text-slate-700 truncate block">{(stat as StaffStat).staff.name}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-[11px] font-black text-purple-600">
                            ${(stat as StaffStat).totalEarned.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-3 space-y-4">
              {selectedStaffStat ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-900 p-4 rounded-2xl relative overflow-hidden">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Earned</p>
                      <p className="text-xl font-black text-purple-400">
                        ${selectedStaffStat.totalEarned.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sessions</p>
                      <p className="text-xl font-black text-slate-900">{selectedStaffStat.totalSessions}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg/Session</p>
                      <p className="text-xl font-black text-purple-600">${selectedStaffStat.avgEarnedPerSession.toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="mb-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Earnings Trend</h3>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedStaffStat.history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94a3b8'}} tickFormatter={(val) => format(parseISO(val), 'MMM d')} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94a3b8'}} tickFormatter={(val) => `$${val}`} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', padding: '8px' }}
                            itemStyle={{ color: '#fff', fontSize: '10px' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '8px', textTransform: 'uppercase' }}
                          />
                          <Area type="monotone" dataKey="cumulativeEarned" stroke="#8b5cf6" strokeWidth={2} fillOpacity={0.1} fill="#8b5cf6" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">No Selection</p>
                  <p className="text-[10px] font-medium text-slate-400">Select a staff member from the list</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
