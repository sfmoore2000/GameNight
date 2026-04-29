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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            BUSINESS ANALYTICS
          </h1>
          <p className="text-slate-500 font-medium">Enterprise performance and financial metrics</p>
        </div>

        {/* View Switcher */}
        <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
          <button 
            onClick={() => { setViewMode('players'); setSelectedEntityId(null); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              viewMode === 'players' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users className="w-4 h-4" />
            PLAYERS
          </button>
          <button 
            onClick={() => { setViewMode('staff'); setSelectedEntityId(null); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              viewMode === 'staff' ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles className="w-4 h-4" />
            STAFF
          </button>
        </div>
      </div>

      {viewMode === 'players' ? (
        <>
          {/* Player Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Win Leaders</h3>
              </div>
              <div className="space-y-4">
                {rankings.mostWins.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${i === 0 ? 'text-amber-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{stat.player.name}</span>
                    </div>
                    <span className="text-xs font-black bg-slate-50 px-2 py-1 rounded-lg text-slate-500">{stat.totalWins} Wins</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <Target className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">ROI Giants (%)</h3>
              </div>
              <div className="space-y-4">
                {rankings.highestROI.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${i === 0 ? 'text-emerald-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{stat.player.name}</span>
                    </div>
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${stat.roi >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {stat.roi.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Medal className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Profit Leaders</h3>
              </div>
              <div className="space-y-4">
                {rankings.highestProfit.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${i === 0 ? 'text-blue-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{stat.player.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-600">${stat.totalProfit.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <PieChart className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Most Experienced</h3>
              </div>
              <div className="space-y-4">
                {rankings.mostGames.map((stat, i) => (
                  <div key={stat.player.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${i === 0 ? 'text-purple-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{stat.player.name}</span>
                    </div>
                    <span className="text-xs font-black bg-slate-50 px-2 py-1 rounded-lg text-slate-500">{stat.totalGames} Games</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Player Search and Detail */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[700px]">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search players..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Player</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Profit</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">WR%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredStats.map((stat) => (
                      <tr 
                        key={(stat as PlayerStat).player.id} 
                        className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${selectedEntityId === (stat as PlayerStat).player.id ? 'bg-blue-50/50' : ''}`}
                        onClick={() => setSelectedEntityId((stat as PlayerStat).player.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                              {(stat as PlayerStat).player.name.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{(stat as PlayerStat).player.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-black ${(stat as PlayerStat).totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ${(stat as PlayerStat).totalProfit.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-bold text-slate-500">{(stat as PlayerStat).winRate.toFixed(0)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-2 space-y-6">
              {selectedPlayerStat ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 p-6 rounded-3xl relative overflow-hidden">
                      <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Profit</p>
                      <p className={`text-2xl font-black ${selectedPlayerStat.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${selectedPlayerStat.totalProfit.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Win Rate</p>
                      <div className="flex items-end gap-2">
                        <p className="text-2xl font-black text-slate-900">{selectedPlayerStat.winRate.toFixed(1)}%</p>
                        <p className="text-[10px] font-bold text-slate-400 mb-1.5">{selectedPlayerStat.totalWins} wins</p>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg / Game</p>
                      <p className={`text-2xl font-black ${selectedPlayerStat.avgProfitPerGame >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${selectedPlayerStat.avgProfitPerGame.toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total ROI</p>
                      <div className="flex items-center gap-1.5">
                        {selectedPlayerStat.roi >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                        )}
                        <p className={`text-2xl font-black ${selectedPlayerStat.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {selectedPlayerStat.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cumulative Profit Trend</h3>
                        <p className="text-sm font-medium text-slate-400">Financial performance over {selectedPlayerStat.totalGames} sessions</p>
                      </div>
                    </div>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedPlayerStat.history}>
                          <defs>
                            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                            dy={10}
                            tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                            dx={-10}
                            tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              backgroundColor: '#0f172a',
                              padding: '12px'
                            }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 800 }}
                            labelFormatter={(val) => format(parseISO(val), 'MMM d, yyyy')}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Profit']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cumulativeProfit" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#profitGradient)" 
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
                    <Users className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Select a Player</h3>
                  <p className="text-sm font-medium text-slate-400 max-w-xs">
                    Choose a player from the list on the left to see their detailed financial performance and trends.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Staff Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <DollarSign className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Top Earners</h3>
              </div>
              <div className="space-y-4">
                {rankings.topStaffEarners.map((stat, i) => (
                  <div key={stat.staff.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${i === 0 ? 'text-purple-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-purple-600 transition-colors">{stat.staff.name}</span>
                    </div>
                    <span className="text-xs font-black bg-purple-50 px-2 py-1 rounded-lg text-purple-600">
                      ${stat.totalEarned.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Most Active</h3>
              </div>
              <div className="space-y-4">
                {rankings.mostActiveStaff.map((stat, i) => (
                  <div key={stat.staff.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${i === 0 ? 'text-blue-500' : 'text-slate-300'}`}>#{i + 1}</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{stat.staff.name}</span>
                    </div>
                    <span className="text-xs font-black bg-blue-50 px-2 py-1 rounded-lg text-blue-600">
                      {stat.totalSessions} Sessions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Staff List and Detail */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[700px]">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search staff..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredStats.map((stat) => (
                      <tr 
                        key={(stat as StaffStat).staff.id} 
                        className={`hover:bg-purple-50/30 cursor-pointer transition-colors ${selectedEntityId === (stat as StaffStat).staff.id ? 'bg-purple-50/50' : ''}`}
                        onClick={() => setSelectedEntityId((stat as StaffStat).staff.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                              {(stat as StaffStat).staff.name.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{(stat as StaffStat).staff.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-purple-600">
                            ${(stat as StaffStat).totalEarned.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-bold text-slate-500">${(stat as StaffStat).avgEarnedPerSession.toFixed(0)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-2 space-y-6">
              {selectedStaffStat ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-6 rounded-3xl relative overflow-hidden">
                      <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Earnings</p>
                      <p className="text-2xl font-black text-purple-400">
                        ${selectedStaffStat.totalEarned.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sessions Worked</p>
                      <p className="text-2xl font-black text-slate-900">{selectedStaffStat.totalSessions}</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg / Session</p>
                      <p className="text-2xl font-black text-purple-600">
                        ${selectedStaffStat.avgEarnedPerSession.toFixed(0)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Earning History</h3>
                        <p className="text-sm font-medium text-slate-400">Payroll performance over {selectedStaffStat.totalSessions} sessions</p>
                      </div>
                    </div>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedStaffStat.history}>
                          <defs>
                            <linearGradient id="staffGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                            dy={10}
                            tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                            dx={-10}
                            tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              backgroundColor: '#0f172a',
                              padding: '12px'
                            }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 800 }}
                            labelFormatter={(val) => format(parseISO(val), 'MMM d, yyyy')}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Earned']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cumulativeEarned" 
                            stroke="#8b5cf6" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#staffGradient)" 
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Select Staff Member</h3>
                  <p className="text-sm font-medium text-slate-400 max-w-xs">
                    Choose a staff member from the list to analyze their earnings and workload statistics.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
