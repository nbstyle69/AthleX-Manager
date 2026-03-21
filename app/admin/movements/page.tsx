'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dumbbell, Search, TrendingUp, Users } from 'lucide-react';

interface MovementStat {
  movement: string;
  total_reps: number;
  athlete_count: number;
  best_weight: number | null;
}

interface AthleteMovement {
  user_id: string;
  username: string;
  movement: string;
  total_reps: number;
  best_weight: number | null;
}

export default function AdminMovementsPage() {
  const [stats, setStats] = useState<MovementStat[]>([]);
  const [athletes, setAthletes] = useState<AthleteMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch all movement stats
    const { data: rawStats } = await supabase
      .from('user_movement_stats')
      .select('movement, total_reps, best_weight, user_id')
      .order('total_reps', { ascending: false });

    // Aggregate by movement
    const movMap = new Map<string, { total_reps: number; athlete_count: number; best_weight: number | null }>();
    (rawStats ?? []).forEach((r: any) => {
      const existing = movMap.get(r.movement) ?? { total_reps: 0, athlete_count: 0, best_weight: null };
      existing.total_reps += Number(r.total_reps);
      existing.athlete_count += 1;
      if (r.best_weight && (!existing.best_weight || r.best_weight > existing.best_weight)) {
        existing.best_weight = r.best_weight;
      }
      movMap.set(r.movement, existing);
    });

    const aggregated: MovementStat[] = Array.from(movMap.entries())
      .map(([movement, s]) => ({ movement, ...s }))
      .sort((a, b) => b.total_reps - a.total_reps);

    setStats(aggregated);
    setLoading(false);
  }, []);

  const loadAthletes = useCallback(async (movement: string) => {
    setSelectedMovement(movement);
    const { data } = await supabase
      .from('user_movement_stats')
      .select('user_id, movement, total_reps, best_weight')
      .eq('movement', movement)
      .order('total_reps', { ascending: false })
      .limit(50);

    // Fetch usernames
    const userIds = (data ?? []).map((d: any) => d.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    const nameMap = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => nameMap.set(p.id, p.username));

    setAthletes(
      (data ?? []).map((d: any) => ({
        ...d,
        username: nameMap.get(d.user_id) ?? '?',
      }))
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = stats.filter(s =>
    s.movement.toLowerCase().includes(search.toLowerCase())
  );

  const totalReps = stats.reduce((s, m) => s + m.total_reps, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Dumbbell size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Mouvements</h1>
            <p className="text-sm text-gray-400">{stats.length} mouvements trackés · {totalReps.toLocaleString()} reps au total</p>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un mouvement..."
            className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 w-72"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Movements list */}
          <div className="flex-1">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-left">
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Mouvement</th>
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Reps</th>
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Athlètes</th>
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Meilleure charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map((m, i) => (
                    <tr
                      key={m.movement}
                      onClick={() => loadAthletes(m.movement)}
                      className={`cursor-pointer transition-colors ${
                        selectedMovement === m.movement
                          ? 'bg-emerald-500/10'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{i + 1}</td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-white">{m.movement}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-black text-emerald-400">{m.total_reps.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-gray-500" />
                          <span className="text-gray-300">{m.athlete_count}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {m.best_weight ? `${m.best_weight} kg` : '—'}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-gray-600">Aucun mouvement trouvé</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Athlete leaderboard for selected movement */}
          {selectedMovement && (
            <div className="w-80 shrink-0">
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <h2 className="text-sm font-black text-white">Top athlètes</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">{selectedMovement}</p>
                <div className="space-y-2">
                  {athletes.map((a, i) => (
                    <div
                      key={a.user_id}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03]"
                    >
                      <span className={`text-xs font-black w-5 text-center ${
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{a.username}</p>
                        {a.best_weight && (
                          <p className="text-[10px] text-gray-500">max {a.best_weight} kg</p>
                        )}
                      </div>
                      <span className="text-sm font-black text-emerald-400">{a.total_reps.toLocaleString()}</span>
                    </div>
                  ))}
                  {athletes.length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-4">Aucun athlète</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
