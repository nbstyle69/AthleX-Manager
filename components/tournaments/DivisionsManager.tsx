'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, UserPlus, ArrowUp, ArrowDown, X, AlertTriangle, Trophy, Plus, Crown, History, RefreshCw } from 'lucide-react';

interface Division {
  id: string;
  tournament_id: string;
  name: string;
  level: number;
  max_members: number;
  promote_count: number;
  relegate_count: number;
}

interface Profile { id: string; username: string; level: string; elo: number; }

interface MemberRow {
  id: string;
  division_id: string;
  athlete_id: string;
  points: number;
  rank: number | null;
  joined_at: string;
  athlete: Profile | Profile[];
}

interface SeasonHistoryRow {
  id: string;
  season_number: number;
  division_level: number;
  division_name: string;
  athlete_id: string;
  final_rank: number;
  final_points: number;
  outcome: 'champion' | 'promoted' | 'relegated' | 'stayed';
  athlete: { id: string; username: string; level: string } | { id: string; username: string; level: string }[] | null;
}

interface Props {
  tournamentId: string;
  currentSeason: number;
  initialDivisions: Division[];
  initialMembers: MemberRow[];
  unassigned: Profile[];
  seasonHistory: SeasonHistoryRow[];
}

export default function DivisionsManager({
  tournamentId,
  currentSeason,
  initialDivisions,
  initialMembers,
  unassigned: initialUnassigned,
  seasonHistory,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [divisions, setDivisions] = useState<Division[]>(initialDivisions);
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [unassigned, setUnassigned] = useState<Profile[]>(initialUnassigned);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const byDiv = useMemo(() => {
    const m: Record<string, MemberRow[]> = {};
    members.forEach(row => {
      const arr = (m[row.division_id] ??= []);
      arr.push(row);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) =>
      b.points - a.points || (a.rank ?? 999) - (b.rank ?? 999)
    ));
    return m;
  }, [members]);

  function profileOf(row: MemberRow): Profile {
    return Array.isArray(row.athlete) ? row.athlete[0] : row.athlete;
  }

  async function addMember(divisionId: string, athleteId: string) {
    setBusy(`add-${athleteId}`); setError(null);
    const { data, error: err } = await supabase
      .from('tournament_division_members')
      .insert({ division_id: divisionId, athlete_id: athleteId, points: 0 })
      .select('*, athlete:profiles!tournament_division_members_athlete_id_fkey(id, username, level, elo)')
      .single();
    setBusy(null);
    if (err) { setError(err.message); return; }
    setMembers(prev => [...prev, data as any]);
    setUnassigned(prev => prev.filter(p => p.id !== athleteId));
    setAddingTo(null);
  }

  async function removeMember(memberRowId: string, athlete: Profile) {
    if (!confirm(`Retirer ${athlete.username} de la division ?`)) return;
    setBusy(`del-${memberRowId}`); setError(null);
    const { error: err } = await supabase.from('tournament_division_members').delete().eq('id', memberRowId);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setMembers(prev => prev.filter(m => m.id !== memberRowId));
    setUnassigned(prev => [...prev, athlete]);
  }

  async function updatePoints(memberRowId: string, points: number) {
    setBusy(`pts-${memberRowId}`); setError(null);
    const { error: err } = await supabase.from('tournament_division_members')
      .update({ points }).eq('id', memberRowId);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setMembers(prev => prev.map(m => m.id === memberRowId ? { ...m, points } : m));
  }

  async function endSeasonAndAdvance() {
    const msg = `Clôturer la saison ${currentSeason} et démarrer la saison ${currentSeason + 1} ?\n\n` +
                `• Snapshot du classement final dans l'historique\n` +
                `• Promus / relégués déplacés entre divisions\n` +
                `• Points remis à 0 pour tous les athlètes\n\n` +
                `Cette action est irréversible.`;
    if (!confirm(msg)) return;
    setBusy('promote'); setError(null);
    const { error: err } = await supabase.rpc('end_season_and_advance', { p_tournament_id: tournamentId });
    setBusy(null);
    if (err) { setError(err.message); return; }
    // Full page reload to refetch server-side data (local state from initialProps won't update with router.refresh)
    window.location.reload();
  }

  async function addDivision() {
    const nextLevel = (divisions[divisions.length - 1]?.level ?? 0) + 1;
    const name = prompt('Nom de la division :', `D${nextLevel}`);
    if (!name) return;
    setBusy('add-div'); setError(null);
    const { data, error: err } = await supabase.from('tournament_divisions').insert({
      tournament_id: tournamentId,
      name, level: nextLevel,
      max_members: 16, promote_count: 3, relegate_count: 0,
    }).select().single();
    setBusy(null);
    if (err) { setError(err.message); return; }
    setDivisions(prev => [...prev, data as any]);
  }

  async function updateDivision(id: string, patch: Partial<Division>) {
    setBusy(`div-${id}`); setError(null);
    const { error: err } = await supabase.from('tournament_divisions').update(patch).eq('id', id);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setDivisions(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Season banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-gradient-to-r from-purple-500/10 to-[#C9A227]/10 border border-purple-500/20 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Trophy size={20} className="text-purple-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Saison en cours</div>
            <div className="text-xl font-black text-white">Saison {currentSeason}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.location.reload()} title="Recharger les données"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors">
            <RefreshCw size={12} /> Rafraîchir
          </button>
          <button onClick={addDivision} disabled={busy === 'add-div'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors">
            <Plus size={12} /> Division
          </button>
          <button onClick={endSeasonAndAdvance} disabled={busy === 'promote' || members.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C9A227] hover:bg-[#e0b730] text-white disabled:opacity-50 transition-colors">
            {busy === 'promote' ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />}
            Clôturer saison {currentSeason} → {currentSeason + 1}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        {divisions.length} division(s) · {members.length} athlète(s) répartis · {unassigned.length} non assigné(s)
      </div>

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Athlètes inscrits non assignés</h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(p => (
              <div key={p.id} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-gray-300 flex items-center gap-2">
                <span className="font-semibold">{p.username}</span>
                <span className="text-[10px] text-gray-500 uppercase">{p.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divisions */}
      {divisions.length === 0 ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-400">Aucune division. Crée la première division pour commencer.</p>
        </div>
      ) : divisions.map((d, idx) => {
        const rows = byDiv[d.id] ?? [];
        const isFirst = idx === 0;
        const isLast = idx === divisions.length - 1;
        return (
          <div key={d.id} className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 bg-white/[0.02] flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-300 font-black text-sm">
                  {d.level}
                </div>
                <div>
                  <input type="text" value={d.name}
                    onChange={e => setDivisions(prev => prev.map(x => x.id === d.id ? { ...x, name: e.target.value } : x))}
                    onBlur={e => updateDivision(d.id, { name: e.target.value.trim() })}
                    className="text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-white/10 focus:border-[#C9A227] outline-none px-1" />
                  <div className="text-[10px] text-gray-500 mt-0.5">{rows.length} / {d.max_members} athlètes</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <ConfigField label="Max" value={d.max_members} disabled={busy === `div-${d.id}`}
                  onCommit={(n) => updateDivision(d.id, { max_members: n })} />
                <ConfigField label="Promus ↑" value={d.promote_count} disabled={isFirst || busy === `div-${d.id}`}
                  onCommit={(n) => updateDivision(d.id, { promote_count: n })} />
                <ConfigField label="Relég. ↓" value={d.relegate_count} disabled={isLast || busy === `div-${d.id}`}
                  onCommit={(n) => updateDivision(d.id, { relegate_count: n })} />
                <button onClick={() => setAddingTo(addingTo === d.id ? null : d.id)}
                  disabled={rows.length >= d.max_members || unassigned.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors">
                  <UserPlus size={11} /> Ajouter
                </button>
              </div>
            </div>

            {addingTo === d.id && (
              <div className="px-5 py-3 border-b border-white/8 bg-white/[0.01]">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Sélectionner un athlète</div>
                {unassigned.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Aucun athlète disponible.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {unassigned.map(p => (
                      <button key={p.id} onClick={() => addMember(d.id, p.id)} disabled={busy === `add-${p.id}`}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-xs text-white border border-white/10 hover:border-emerald-500/40 transition-colors disabled:opacity-50">
                        {p.username} <span className="text-gray-500 text-[10px] ml-1">{p.level}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-500">Aucun athlète dans cette division.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Athlète</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">ELO</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Points</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => {
                    const p = profileOf(row);
                    const willPromote = !isFirst && rIdx < d.promote_count;
                    const willRelegate = !isLast && rIdx >= rows.length - d.relegate_count;
                    return (
                      <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-xs font-bold text-gray-500">{rIdx + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{p?.username ?? '—'}</span>
                            <span className="text-[10px] text-gray-500 uppercase">{p?.level}</span>
                            {willPromote && <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><ArrowUp size={9} />PROMU</span>}
                            {willRelegate && <span className="text-[9px] font-black text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><ArrowDown size={9} />RELÉG.</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-yellow-500 font-bold">{p?.elo ?? 0}</td>
                        <td className="px-5 py-3">
                          <input type="number" defaultValue={row.points} step="0.5"
                            onBlur={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v !== row.points) updatePoints(row.id, v);
                            }}
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => removeMember(row.id, p)} disabled={busy === `del-${row.id}`}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50">
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Season history */}
      {seasonHistory.length > 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 bg-white/[0.02] flex items-center gap-3">
            <History size={16} className="text-gray-400" />
            <h3 className="text-sm font-bold text-white">Historique des saisons clôturées</h3>
          </div>
          <div className="divide-y divide-white/5">
            {Array.from(new Set(seasonHistory.map(h => h.season_number))).map(season => {
              const seasonRows = seasonHistory.filter(h => h.season_number === season);
              const champion = seasonRows.find(r => r.outcome === 'champion');
              const champProfile = champion
                ? (Array.isArray(champion.athlete) ? champion.athlete[0] : champion.athlete)
                : null;
              const promotedCount = seasonRows.filter(r => r.outcome === 'promoted').length;
              const relegatedCount = seasonRows.filter(r => r.outcome === 'relegated').length;
              return (
                <details key={season} className="group">
                  <summary className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors list-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#C9A227]/15 flex items-center justify-center text-[#C9A227] font-black text-sm">
                        S{season}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Saison {season}</div>
                        {champProfile && (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <Crown size={10} className="text-yellow-400" />
                            Champion : <span className="text-yellow-300 font-bold">{champProfile.username}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1 text-emerald-400"><ArrowUp size={10} />{promotedCount}</span>
                      <span className="flex items-center gap-1 text-red-400"><ArrowDown size={10} />{relegatedCount}</span>
                      <span className="text-gray-500">{seasonRows.length} athlètes</span>
                    </div>
                  </summary>
                  <div className="px-5 pb-4 space-y-3">
                    {Array.from(new Set(seasonRows.map(r => r.division_level))).sort().map(lvl => {
                      const divRows = seasonRows
                        .filter(r => r.division_level === lvl)
                        .sort((a, b) => a.final_rank - b.final_rank);
                      const divName = divRows[0]?.division_name ?? `D${lvl}`;
                      return (
                        <div key={lvl} className="bg-white/[0.02] rounded-xl p-3">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                            {divName} (niveau {lvl})
                          </div>
                          <div className="space-y-1">
                            {divRows.map(r => {
                              const a = Array.isArray(r.athlete) ? r.athlete[0] : r.athlete;
                              return (
                                <div key={r.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-white/[0.02]">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-gray-500 font-bold w-6">{r.final_rank}</span>
                                    <span className="text-white font-semibold truncate">{a?.username ?? '—'}</span>
                                    {r.outcome === 'champion' && <Crown size={11} className="text-yellow-400 shrink-0" />}
                                    {r.outcome === 'promoted' && <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><ArrowUp size={8} />PROMU</span>}
                                    {r.outcome === 'relegated' && <span className="text-[9px] font-black text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><ArrowDown size={8} />RELÉG.</span>}
                                  </div>
                                  <span className="text-[#C9A227] font-bold shrink-0">{r.final_points} pts</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigField({ label, value, onCommit, disabled }: {
  label: string; value: number; onCommit: (n: number) => void; disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 uppercase font-bold">{label}</span>
      <input type="number" min={0} value={v} disabled={disabled}
        onChange={e => setV(parseInt(e.target.value) || 0)}
        onBlur={() => v !== value && onCommit(v)}
        className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white disabled:opacity-50" />
    </div>
  );
}
