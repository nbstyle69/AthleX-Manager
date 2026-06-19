'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, Timer, CheckCircle, Clock, Layers, Globe, Calendar } from 'lucide-react';
import WODForm from './WODForm';

interface Division { id: string; name: string; level: number; }
interface BracketStage { value: number; label: string; }

const TYPE_COLORS: Record<string, string> = {
  'For Time': '#EF4444',
  'AMRAP':    '#3B82F6',
  'EMOM':     '#8B5CF6',
  'Tabata':   '#F59E0B',
  'Strength': '#16A34A',
  'Max Reps': '#EC4899',
  'Custom':   '#6B7280',
};

function timerLabel(wod: any) {
  switch (wod.timer_type) {
    case 'countdown': return `${Math.floor((wod.time_cap_seconds ?? 0) / 60)} min cap ↓`;
    case 'stopwatch': return `${wod.duration_minutes} min ↑`;
    case 'emom':      return `EMOM ${wod.rounds ?? wod.duration_minutes} × 1 min`;
    case 'tabata':    return `${wod.work_seconds ?? 20}s / ${wod.rest_seconds ?? 10}s × ${wod.rounds ?? 8}`;
    case 'none':      return 'Sans timer';
    default:          return `${wod.duration_minutes} min`;
  }
}

interface Props {
  tournamentId: string;
  initialWODs: any[];
  divisions?: Division[];
  isLeague?: boolean;
  isBracket?: boolean;
  bracketStages?: BracketStage[];
  currentSeason?: number;
}

export default function TournamentWODManager({ tournamentId, initialWODs, divisions = [], isLeague = false, isBracket = false, bracketStages = [], currentSeason = 1 }: Props) {
  const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d]));
  const stageMap = Object.fromEntries(bracketStages.map(s => [s.value, s.label]));
  const [wods,     setWods]     = useState<any[]>(initialWODs);
  const [showForm, setShowForm] = useState(false);
  const [editWOD,  setEditWOD]  = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(currentSeason);

  // Available seasons = union of WOD seasons + current season, sorted desc.
  const availableSeasons = useMemo(() => {
    const set = new Set<number>();
    set.add(currentSeason);
    for (const w of wods) set.add(w.season_number ?? 1);
    return Array.from(set).sort((a, b) => b - a);
  }, [wods, currentSeason]);

  const filteredWods = isLeague
    ? wods.filter(w => (w.season_number ?? 1) === selectedSeason)
    : wods;

  async function reload() {
    const supabase = createClient();
    const { data } = await supabase
      .from('tournament_wods')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at');
    setWods(data ?? []);
    setSelectedSeason(currentSeason);
  }

  function openAdd()       { setEditWOD(null);  setShowForm(true); }
  function openEdit(w: any){ setEditWOD(w);     setShowForm(true); }
  function onSaved()       { setShowForm(false); reload(); }
  function onCancel()      { setShowForm(false); }

  async function deleteWOD(id: string) {
    if (!confirm('Supprimer ce WOD ?')) return;
    setDeleting(id);
    const supabase = createClient();
    await supabase.from('tournament_wods').delete().eq('id', id);
    setDeleting(null);
    reload();
  }

  async function toggleStatus(wod: any) {
    const next = wod.status === 'active' ? 'pending' : 'active';
    const supabase = createClient();
    await supabase.from('tournament_wods').update({ status: next }).eq('id', wod.id);
    reload();
  }

  return (
    <div className="space-y-4">
      {/* Season tabs (league only) */}
      {isLeague && availableSeasons.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Saison</span>
          {availableSeasons.map(s => {
            const isActive = s === selectedSeason;
            const isCurrent = s === currentSeason;
            return (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#C9A227] text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}>
                S{s}
                {isCurrent && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-black/20 text-black' : 'bg-green-500/20 text-green-400'
                  }`}>
                    EN COURS
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-white hover:bg-[#D4A832] transition-colors">
          <Plus size={15} /> Ajouter un WOD
        </button>
        <p className="text-xs text-gray-500">
          {filteredWods.length} WOD{filteredWods.length !== 1 ? 's' : ''} configuré{filteredWods.length !== 1 ? 's' : ''}
          {isLeague && <span className="text-gray-600"> · Saison {selectedSeason}</span>}
        </p>
      </div>

      {/* Empty state */}
      {filteredWods.length === 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-14 text-center">
          <div className="text-5xl mb-4">🏋️</div>
          <p className="text-white font-bold text-lg mb-1">
            {isLeague ? `Aucun WOD pour la saison ${selectedSeason}` : 'Aucun WOD pour ce tournoi'}
          </p>
          <p className="text-gray-500 text-sm mb-6">Créez manuellement ou laissez l&apos;IA générer le programme.</p>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-white">
            <Plus size={15} /> Créer le premier WOD
          </button>
        </div>
      )}

      {/* WOD cards */}
      <div className="space-y-3">
        {filteredWods.map((wod, idx) => {
          const color = TYPE_COLORS[wod.type] ?? '#6B7280';
          return (
            <div key={wod.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/12 transition-colors">
              <div className="flex items-start gap-4">
                {/* WOD number */}
                <div className="shrink-0 w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-xs font-black text-gray-400">
                  {idx + 1}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${color}20`, color }}>
                      {wod.type}
                    </span>
                    <h3 className="text-white font-bold">{wod.title}</h3>
                    {isBracket && (
                      wod.bracket_stage !== null && wod.bracket_stage !== undefined ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 inline-flex items-center gap-1">
                          <Layers size={9} />
                          {stageMap[wod.bracket_stage] ?? `Étape ${wod.bracket_stage}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 inline-flex items-center gap-1">
                          <Globe size={9} />
                          Toutes étapes
                        </span>
                      )
                    )}
                    {isLeague && (
                      wod.division_id && divisionMap[wod.division_id] ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 inline-flex items-center gap-1">
                          <Layers size={9} />
                          {divisionMap[wod.division_id].name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 inline-flex items-center gap-1">
                          <Globe size={9} />
                          Général
                        </span>
                      )
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto ${
                      wod.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : wod.status === 'closed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-500/15 text-gray-400'
                    }`}>
                      {wod.status === 'active' ? '● Ouvert' : wod.status === 'closed' ? '● Fermé' : '● En attente'}
                    </span>
                  </div>

                  {/* Timer badge */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Timer size={11} className="text-[#C9A227]" />
                    <span className="text-xs font-semibold text-[#C9A227]">{timerLabel(wod)}</span>
                    {wod.scoring && (
                      <span className="text-xs text-gray-500 ml-2">· {wod.scoring}</span>
                    )}
                  </div>

                  {/* Movements preview */}
                  {wod.movements?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {wod.movements.slice(0, 4).map((m: string, i: number) => (
                        <span key={i} className="text-[11px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-lg">
                          {m}
                        </span>
                      ))}
                      {wod.movements.length > 4 && (
                        <span className="text-[11px] text-gray-600">+{wod.movements.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <button onClick={() => toggleStatus(wod)}
                    title={wod.status === 'active' ? 'Fermer le WOD' : 'Activer le WOD'}
                    className={`p-2 rounded-lg transition-colors ${
                      wod.status === 'active'
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}>
                    {wod.status === 'active' ? <CheckCircle size={15} /> : <Clock size={15} />}
                  </button>
                  <button onClick={() => openEdit(wod)}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteWOD(wod.id)} disabled={deleting === wod.id}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-white">
                {editWOD ? `Modifier — ${editWOD.title}` : 'Nouveau WOD'}
              </h2>
              <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <WODForm
                tournamentId={tournamentId}
                divisions={divisions}
                isLeague={isLeague}
                isBracket={isBracket}
                bracketStages={bracketStages}
                initial={editWOD}
                onSaved={onSaved}
                onCancel={onCancel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
