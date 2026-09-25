'use client';

/** Onglet « Statistiques » de /admin/movements : volumes `user_movement_stats` par mouvement × unité. */
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, TrendingUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { SUB_ORANGE_TEXT } from '@/components/admin/adminTokens';
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

  // Or, argent, bronze, puis le reste : même sens qu'avant, en jetons.
  const rankClass = (i: number) =>
    i === 0 ? 'text-ax-warning' : i === 1 ? 'text-ax-text' : i === 2 ? SUB_ORANGE_TEXT : 'text-ax-text-secondary';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ax-text-secondary">{statsError ? '—' : `${stats.length} mouvements trackés · ${totalReps.toLocaleString()} reps au total`}</p>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un mouvement..."
            aria-label="Rechercher un mouvement"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : (
        // Sous 1024 px, le classement passe sous le tableau au lieu de le
        // pousser hors de l'écran.
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Movements list */}
          <div className="flex-1 min-w-0">
            <Table aria-label="Volumes par mouvement">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['#', 'Mouvement', 'Total', 'Athlètes', 'Meilleure charge'].map(h => (
                    <TableHead key={h} className="font-bold uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m, i) => {
                  const isSel = selected?.movement === m.movement && selected?.unit === m.unit;
                  return (
                    <TableRow
                      key={`${m.movement}|${m.unit}`}
                      onClick={() => loadAthletes(m.movement, m.unit)}
                      // Même action au clavier qu'à la souris.
                      tabIndex={0}
                      data-state={isSel ? 'selected' : undefined}
                      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); loadAthletes(m.movement, m.unit); } }}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-focus"
                    >
                      <TableCell className="text-ax-text-secondary font-mono text-xs">{i + 1}</TableCell>
                      <TableCell className="min-w-[10rem]">
                        <span className="font-bold text-ax-text break-words">{m.movement}</span>
                        {m.unit !== 'reps' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-ax-badge bg-ax-info-soft text-ax-info text-[10px] font-bold uppercase">{m.unit}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-black text-ax-success">{m.total_reps.toLocaleString()}</span>
                        <span className="ml-1 text-xs text-ax-text-secondary">{unitLabel(m.unit)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-ax-text-muted" />
                          <span className="text-ax-text">{m.athlete_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-ax-text-secondary whitespace-nowrap">
                        {m.best_weight ? `${m.best_weight} kg` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    {statsError ? (
                      <TableCell colSpan={5} role="alert" className="py-10 text-center text-ax-danger">{statsError}</TableCell>
                    ) : (
                      <TableCell colSpan={5} className="py-10 text-center text-ax-text-secondary">Aucun mouvement trouvé</TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Athlete leaderboard for selected movement */}
          {selected && (
            <div className="w-full lg:w-80 shrink-0">
              <div className="bg-ax-surface border border-ax-border rounded-ax-card p-5 lg:sticky lg:top-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-ax-success" />
                  <h2 className="text-sm font-black text-ax-text">Top athlètes</h2>
                </div>
                <p className="text-xs text-ax-text-secondary mb-4 break-words">{selected.movement} · {unitLabel(selected.unit)}</p>
                <div className="space-y-2">
                  {athletes.map((a, i) => (
                    <div
                      key={a.user_id}
                      className="flex items-center gap-3 px-3 py-2 rounded-ax-control bg-ax-surface-secondary"
                    >
                      <span className={`text-xs font-black w-5 text-center shrink-0 ${rankClass(i)}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ax-text break-words">{a.username}</p>
                        {a.best_weight && (
                          <p className="text-[10px] text-ax-text-secondary">max {a.best_weight} kg</p>
                        )}
                      </div>
                      <span className="text-sm font-black text-ax-success shrink-0">{a.total_reps.toLocaleString()} <span className="text-[10px] text-ax-text-secondary font-normal">{unitLabel(a.unit)}</span></span>
                    </div>
                  ))}
                  {athletes.length === 0 && (athletesError
                    ? <p role="alert" className="text-xs text-ax-danger text-center py-4">{athletesError}</p>
                    : <p className="text-xs text-ax-text-secondary text-center py-4">Aucun athlète</p>
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
