'use client';

/** Onglet « Statistiques » de /admin/movements : volumes `user_movement_stats` par mouvement × unité. */
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, TrendingUp, Users } from 'lucide-react';
import {
  loadMovementAthletes,
  loadMovementTotals,
  type AthleteMovement,
  type MovementStat,
  type MovementUnit,
} from '@/lib/admin/movementStats';

export default function MovementStats() {
  const [stats, setStats] = useState<MovementStat[]>([]);
  const [athletes, setAthletes] = useState<AthleteMovement[]>([]);
  const [loading, setLoading] = useState(true);
  // Une lecture en échec n'est pas une base vide : on l'affiche comme telle.
  const [statsError, setStatsError] = useState<string | null>(null);
  const [athletesError, setAthletesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ movement: string; unit: MovementUnit } | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { stats, error } = await loadMovementTotals(supabase);
    setStats(stats);
    setStatsError(error);
    setLoading(false);
  }, []);

  const loadAthletes = useCallback(async (movement: string, unit: MovementUnit) => {
    setSelected({ movement, unit });
    const { athletes, error } = await loadMovementAthletes(supabase, movement, unit);
    setAthletes(athletes);
    setAthletesError(error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = stats.filter(s =>
    s.movement.toLowerCase().includes(search.toLowerCase())
  );

  const totalReps = stats.filter(m => m.unit === 'reps').reduce((s, m) => s + m.total_reps, 0);
  const unitLabel = (u: MovementUnit) => (u === 'reps' ? 'reps' : u);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-400">{statsError ? '—' : `${stats.length} mouvements trackés · ${totalReps.toLocaleString()} reps au total`}</p>
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
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Athlètes</th>
                    <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Meilleure charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map((m, i) => (
                    <tr
                      key={`${m.movement}|${m.unit}`}
                      onClick={() => loadAthletes(m.movement, m.unit)}
                      className={`cursor-pointer transition-colors ${
                        selected?.movement === m.movement && selected?.unit === m.unit
                          ? 'bg-emerald-500/10'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{i + 1}</td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-white">{m.movement}</span>
                        {m.unit !== 'reps' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 text-[10px] font-bold uppercase">{m.unit}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-black text-emerald-400">{m.total_reps.toLocaleString()}</span>
                        <span className="ml-1 text-xs text-gray-500">{unitLabel(m.unit)}</span>
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
                      {statsError ? (
                        <td colSpan={5} role="alert" className="px-5 py-10 text-center text-red-400">{statsError}</td>
                      ) : (
                        <td colSpan={5} className="px-5 py-10 text-center text-gray-600">Aucun mouvement trouvé</td>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Athlete leaderboard for selected movement */}
          {selected && (
            <div className="w-80 shrink-0">
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <h2 className="text-sm font-black text-white">Top athlètes</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">{selected.movement} · {unitLabel(selected.unit)}</p>
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
                      <span className="text-sm font-black text-emerald-400">{a.total_reps.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">{unitLabel(a.unit)}</span></span>
                    </div>
                  ))}
                  {athletes.length === 0 && (athletesError
                    ? <p role="alert" className="text-xs text-red-400 text-center py-4">{athletesError}</p>
                    : <p className="text-xs text-gray-600 text-center py-4">Aucun athlète</p>
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
