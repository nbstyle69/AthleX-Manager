'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Loader2, X, Sparkles, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import { boGenerateFunctional, boGenerateHybrid } from '@/lib/wod/boAdapter';
import { MOVEMENT_CATALOG, isWeightedMovement, serializeMovement, parseMovementRow, repsPerRoundFromMovements, isRepsScoredType } from '@/lib/movements';
import { toDatetimeLocal, fromDatetimeLocal, isScheduledAhead } from '@/lib/datetime';

const WOD_TYPES = ['AMRAP', 'For Time', 'EMOM', 'Tabata', 'Max Reps', 'Strength'];
const LEVELS    = ['scaled', 'inter', 'rx', 'rx+', 'gx', 'pro'];
const EQUIPMENT_FF = ['Barbell', 'Haltères', 'Kettlebell', 'Box', 'Corde à sauter', 'Barre de traction', 'Anneaux', 'Erg', 'Med Ball', 'GHD', 'Worm', 'Benchmark', 'Sans matériel'];
const DURATIONS = [5, 8, 10, 12, 15, 20, 25, 30];

// Hybrid
const HYBRID_LEVELS    = ['Open', 'Pro', 'Elite'];
const HYBRID_FORMATS   = ['Solo', 'Doubles', 'Relais', 'Mixed Relais'];
const HYBRID_TYPES     = ['Race Simulation', 'Station Training', 'Cardio Force', 'Running Intervals'];
const HYBRID_DURATIONS = [20, 30, 45, 60];
const EQUIPMENT_HY = ['SkiErg', 'Sled Push', 'Sled Pull', 'RowErg', 'Burpee BJ', 'Farmers Carry', 'Sandbag Lunge', 'Wall Balls', 'Tapis course', 'Haltères'];

const WOD_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'active',  label: 'Ouvert' },
  { value: 'closed',  label: 'Fermé' },
];

function timerInfoForType(type: string, form: any) {
  switch (type) {
    case 'For Time':  return `⏱ Countdown ${form.time_cap ?? 20} min → 0 (score = temps)`;
    case 'AMRAP':     return `⏱ Stopwatch 0 → ${form.duration_minutes} min (score = rounds+reps)`;
    case 'EMOM':      return `⏱ EMOM ${form.rounds ?? form.duration_minutes} rounds × 1 min`;
    case 'Tabata':    return `⚡ ${form.work_seconds ?? 20}s travail / ${form.rest_seconds ?? 10}s repos × ${form.rounds ?? 8} rounds`;
    case 'Max Reps':  return `⏱ Countdown ${form.time_cap ?? 10} min (score = reps totaux)`;
    case 'Strength':  return `💪 Pas de timer — score = charge max`;
    default: return '';
  }
}

// ── WOD Generation (moteurs déterministes — lib/wod) ────────────────────
function localGenerateHybrid(type: string, level: string, format: string, duration: number, eqKeys: string[]) {
  return boGenerateHybrid(type, level, format, duration, eqKeys);
}

function localGenerate(type: string, level: string, duration: number, eqList: string[]) {
  return boGenerateFunctional(type, level, duration, eqList);
}

// ─────────────────────────────────────────────────────────────────────────

interface Division { id: string; name: string; level: number; }

interface BracketStage { value: number; label: string; }

interface Props {
  tournamentId: string;
  divisions?: Division[];
  isLeague?: boolean;
  isBracket?: boolean;
  bracketStages?: BracketStage[];
  initial?: any;
  onSaved: () => void;
  onCancel: () => void;
}

export default function WODForm({ tournamentId, divisions = [], isLeague = false, isBracket = false, bracketStages = [], initial, onSaved, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    title:            initial?.title            ?? '',
    description:      initial?.description      ?? '',
    type:             initial?.type             ?? 'AMRAP',
    duration_minutes: initial?.duration_minutes ?? 12,
    scoring:          initial?.scoring          ?? '',
    deadline_hours:   initial?.deadline_hours   ?? 24,
    status:           initial?.status           ?? 'pending',
    opens_at:         toDatetimeLocal(initial?.opens_at),
    closes_at:        toDatetimeLocal(initial?.closes_at),
    timer_type:       initial?.timer_type       ?? 'stopwatch',
    time_cap:         initial?.time_cap_seconds ? Math.floor(initial.time_cap_seconds / 60) : 20,
    rounds:           initial?.rounds           ?? 8,
    work_seconds:     initial?.work_seconds     ?? 20,
    rest_seconds:     initial?.rest_seconds     ?? 10,
    division_id:      initial?.division_id      ?? '',
    bracket_stage:    (initial?.bracket_stage === null || initial?.bracket_stage === undefined) ? '' : String(initial.bracket_stage),
    reps_per_round:   (initial?.reps_per_round === null || initial?.reps_per_round === undefined) ? '' : String(initial.reps_per_round),
  });

  const [movements, setMovements] = useState<string[]>(
    Array.isArray(initial?.movements) ? initial.movements : []
  );

  // AI Generator state
  const [showGen,      setShowGen]      = useState(false);
  const [genLoading,   setGenLoading]   = useState(false);
  const [genSport,     setGenSport]     = useState<'functional'|'hybrid'>('functional');
  const [genLevel,     setGenLevel]     = useState('rx');
  const [genType,      setGenType]      = useState('AMRAP');
  const [genDuration,  setGenDuration]  = useState(12);
  const [genEquipment, setGenEquipment] = useState<string[]>(['Barbell', 'Barre de traction', 'Haltères']);
  const [genError,     setGenError]     = useState<string | null>(null);
  // Hybrid-specific
  const [genHybridLevel,  setGenHybridLevel]  = useState('Open');
  const [genHybridFormat, setGenHybridFormat] = useState('Solo');
  const [genHybridType,   setGenHybridType]   = useState('Race Simulation');
  const [genHybridDur,    setGenHybridDur]    = useState(30);
  const [genHybridEq,     setGenHybridEq]     = useState<string[]>(['SkiErg', 'Sled Push', 'RowErg', 'Wall Balls']);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function onTypeChange(type: string) {
    const timerMap: Record<string, string> = {
      'AMRAP':    'stopwatch',
      'For Time': 'countdown',
      'EMOM':     'emom',
      'Tabata':   'tabata',
      'Max Reps': 'countdown',
      'Strength': 'none',
    };
    setForm(f => ({ ...f, type, timer_type: timerMap[type] ?? 'stopwatch' }));
  }

  function toggleEquipment(eq: string) {
    setGenEquipment(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]);
  }
  function toggleHybridEq(eq: string) {
    setGenHybridEq(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]);
  }

  function addMovement()                 { setMovements(m => [...m, '']); }
  function removeMovement(i: number)     { setMovements(m => m.filter((_, idx) => idx !== i)); }
  function setMovement(i: number, v: string) { setMovements(m => m.map((x, idx) => idx === i ? v : x)); }

  function generateWOD() {
    setGenLoading(true);
    setGenError(null);
    try {
      const data = genSport === 'hybrid'
        ? localGenerateHybrid(genHybridType, genHybridLevel, genHybridFormat, genHybridDur, genHybridEq)
        : localGenerate(genType, genLevel, genDuration, genEquipment);
      if (!data) { setGenError('Pas assez de mouvements disponibles pour cet équipement.'); return; }

      const timerMap: Record<string, string> = {
        'AMRAP': 'stopwatch', 'For Time': 'countdown', 'EMOM': 'emom',
        'Tabata': 'tabata', 'Max Reps': 'countdown', 'Strength': 'none',
      };

      const usedType = genSport === 'hybrid' ? 'For Time' : genType;

      setForm(f => ({
        ...f,
        title:           data.title,
        description:     data.description,
        scoring:         data.scoring,
        type:            usedType,
        timer_type:      data.timer_type ?? timerMap[usedType] ?? 'stopwatch',
        duration_minutes: data.duration_minutes ?? (genSport === 'hybrid' ? genHybridDur : genDuration),
        time_cap:        data.time_cap_seconds ? Math.floor(data.time_cap_seconds / 60) : (genSport === 'hybrid' ? genHybridDur : genDuration),
        rounds:          data.rounds ?? f.rounds,
        work_seconds:    data.work_seconds ?? f.work_seconds,
        rest_seconds:    data.rest_seconds ?? f.rest_seconds,
      }));
      setMovements(data.movements);
      setShowGen(false);
    } catch (e: any) {
      setGenError(e.message ?? 'Erreur inconnue');
    } finally {
      setGenLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const timeCap = (form.type === 'For Time' || form.type === 'AMRAP' || form.type === 'EMOM' || form.type === 'Max Reps')
      ? (form.type === 'AMRAP' ? form.duration_minutes * 60 : form.time_cap * 60)
      : null;

    const payload = {
      tournament_id:    tournamentId,
      title:            form.title,
      description:      form.description,
      type:             form.type,
      duration_minutes: form.type === 'AMRAP' || form.type === 'EMOM' ? form.duration_minutes : form.time_cap,
      scoring:          form.scoring,
      deadline_hours:   form.deadline_hours,
      status:           form.status,
      opens_at:         fromDatetimeLocal(form.opens_at),
      closes_at:        fromDatetimeLocal(form.closes_at),
      movements:        movements.filter(Boolean),
      timer_type:       form.timer_type,
      time_cap_seconds: timeCap,
      rounds:           ['EMOM', 'Tabata'].includes(form.type) ? form.rounds : null,
      work_seconds:     form.type === 'Tabata' ? form.work_seconds : null,
      rest_seconds:     form.type === 'Tabata' ? form.rest_seconds : null,
      division_id:      isLeague ? (form.division_id || null) : null,
      bracket_stage:    isBracket ? (form.bracket_stage === '' ? null : Number(form.bracket_stage)) : null,
      reps_per_round:   isRepsScoredType(form.type)
        ? (form.reps_per_round === '' ? (repsPerRoundFromMovements(movements.filter(Boolean)) || null) : Number(form.reps_per_round))
        : null,
    };

    let err;
    if (initial?.id) {
      ({ error: err } = await supabase.from('tournament_wods').update(payload).eq('id', initial.id));
    } else {
      ({ error: err } = await supabase.from('tournament_wods').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* ── AI Generator panel ── */}
      <div className="border border-white/30 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowGen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 transition-colors text-left">
          <Sparkles size={15} className="text-white" />
          <span className="text-sm font-bold text-white">Générer avec l&apos;IA</span>
          <span className="ml-auto text-gray-500">{showGen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </button>

        {showGen && (
          <div className="p-4 space-y-4 bg-[#0A0A0A]/50">
            {/* Sport selector */}
            <div>
              <label className={lbl}>Sport</label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setGenSport('functional')}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border font-bold text-center transition-colors ${
                    genSport === 'functional'
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}>🏋️ Functional Fitness</button>
                <button type="button" onClick={() => setGenSport('hybrid')}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border font-bold text-center transition-colors ${
                    genSport === 'hybrid'
                      ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}>⚡ Hybrid</button>
              </div>
            </div>

            {genSport === 'functional' ? (
              <>
                {/* FF: Type + Level */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Type de WOD</label>
                    <select className={inp} value={genType} onChange={e => setGenType(e.target.value)}>
                      {WOD_TYPES.map(t => <option key={t} value={t} className="text-black">{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Niveau athlètes</label>
                    <select className={inp} value={genLevel} onChange={e => setGenLevel(e.target.value)}>
                      {LEVELS.map(l => <option key={l} value={l} className="text-black">{l.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
                {/* FF: Duration */}
                {genType !== 'Strength' && (
                  <div>
                    <label className={lbl}>
                      {genType === 'For Time' || genType === 'Max Reps' ? 'Time Cap (minutes)' : genType === 'EMOM' ? 'Durée totale (minutes)' : 'Durée (minutes)'}
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {DURATIONS.map(d => (
                        <button key={d} type="button" onClick={() => setGenDuration(d)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                            genDuration === d
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                          }`}>{d} min</button>
                      ))}
                    </div>
                  </div>
                )}
                {/* FF: Equipment */}
                <div>
                  <label className={lbl}>Équipement disponible</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {EQUIPMENT_FF.map(eq => (
                      <button key={eq} type="button" onClick={() => toggleEquipment(eq)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                          genEquipment.includes(eq)
                            ? 'bg-white/20 border-white/40 text-white'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                        }`}>{eq}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hybrid: Level + Format */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Catégorie</label>
                    <select className={inp} value={genHybridLevel} onChange={e => setGenHybridLevel(e.target.value)}>
                      {HYBRID_LEVELS.map(l => <option key={l} value={l} className="text-black">{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Format</label>
                    <select className={inp} value={genHybridFormat} onChange={e => setGenHybridFormat(e.target.value)}>
                      {HYBRID_FORMATS.map(f => <option key={f} value={f} className="text-black">{f}</option>)}
                    </select>
                  </div>
                </div>
                {/* Hybrid: Type */}
                <div>
                  <label className={lbl}>Type d&apos;entraînement</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {HYBRID_TYPES.map(t => (
                      <button key={t} type="button" onClick={() => setGenHybridType(t)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-colors ${
                          genHybridType === t
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
                {/* Hybrid: Duration */}
                <div>
                  <label className={lbl}>Durée</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {HYBRID_DURATIONS.map(d => (
                      <button key={d} type="button" onClick={() => setGenHybridDur(d)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                          genHybridDur === d
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                        }`}>{d} min</button>
                    ))}
                  </div>
                </div>
                {/* Hybrid: Equipment */}
                <div>
                  <label className={lbl}>Équipement</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {EQUIPMENT_HY.map(eq => (
                      <button key={eq} type="button" onClick={() => toggleHybridEq(eq)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                          genHybridEq.includes(eq)
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                        }`}>{eq}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {genError && <p className="text-xs text-red-400">{genError}</p>}

            <button type="button" onClick={generateWOD} disabled={genLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-colors ${
                genSport === 'hybrid' ? 'bg-orange-500' : 'bg-white'
              }`}>
              {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {genLoading ? 'Génération en cours...' : 'Générer le WOD'}
            </button>
          </div>
        )}
      </div>

      {/* ── Identity ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Titre *</label>
          <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Fire Breather" required />
        </div>
        <div>
          <label className={lbl}>Type de WOD</label>
          <select className={inp} value={form.type} onChange={e => onTypeChange(e.target.value)}>
            {WOD_TYPES.map(t => <option key={t} value={t} className="text-black">{t}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Statut</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {WOD_STATUSES.map(s => <option key={s.value} value={s.value} className="text-black">{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Étape du bracket (bracket / swiss only) ── */}
      {isBracket && bracketStages.length > 0 && (
        <div>
          <label className={lbl}>Étape du tournoi</label>
          <select className={inp} value={form.bracket_stage} onChange={e => set('bracket_stage', e.target.value)}>
            <option value="" className="text-black">🌐 Toutes les étapes (non assigné)</option>
            {bracketStages.map(s => (
              <option key={s.value} value={String(s.value)} className="text-black">{s.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1.5">
            Assigne ce WOD à une étape précise (ex : 8e de finale). Tous les matchs de cette étape utilisent ce WOD. « Non assigné » = disponible pour toutes les étapes.
          </p>
        </div>
      )}

      {/* ── Division (league only) ── */}
      {isLeague && (
        <div>
          <label className={lbl}>Assigner à</label>
          <select className={inp} value={form.division_id} onChange={e => set('division_id', e.target.value)}>
            <option value="" className="text-black">🌐 Général (toutes les divisions)</option>
            {divisions.map(d => (
              <option key={d.id} value={d.id} className="text-black">
                Division {d.level} — {d.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1.5">
            Un WOD général est visible par tous les participants. Un WOD assigné à une division ne sera visible que par les athlètes de cette division.
          </p>
        </div>
      )}

      {/* ── Timer config (adapts to type) ── */}
      <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <Timer size={14} className="text-white" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Configuration Timer</span>
        </div>
        <p className="text-xs text-gray-500 italic">{timerInfoForType(form.type, form)}</p>

        {(form.type === 'AMRAP' || form.type === 'EMOM') && (
          <div>
            <label className={lbl}>{form.type === 'EMOM' ? 'Nombre de rounds (1 round = 1 min)' : 'Durée (minutes)'}</label>
            <input type="number" min={1} max={120} className={inp}
              value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value))} />
          </div>
        )}
        {(form.type === 'For Time' || form.type === 'Max Reps') && (
          <div>
            <label className={lbl}>Time Cap (minutes)</label>
            <input type="number" min={1} max={120} className={inp}
              value={form.time_cap} onChange={e => set('time_cap', parseInt(e.target.value))} />
          </div>
        )}
        {form.type === 'Tabata' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Travail (sec)</label>
              <input type="number" min={5} max={60} className={inp}
                value={form.work_seconds} onChange={e => set('work_seconds', parseInt(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Repos (sec)</label>
              <input type="number" min={5} max={60} className={inp}
                value={form.rest_seconds} onChange={e => set('rest_seconds', parseInt(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Rounds</label>
              <input type="number" min={1} max={32} className={inp}
                value={form.rounds} onChange={e => set('rounds', parseInt(e.target.value))} />
            </div>
          </div>
        )}
      </div>

      {/* ── Description ── */}
      <div>
        <label className={lbl}>Description</label>
        <textarea className={`${inp} min-h-[70px] resize-y`} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Instructions du WOD..." />
      </div>

      {/* ── Movements ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={lbl}>Programme / Mouvements</label>
          <button type="button" onClick={addMovement} className="text-xs text-white font-semibold flex items-center gap-1 hover:opacity-80">
            <Plus size={12} /> Ajouter
          </button>
        </div>
        <datalist id="movement-catalog">
          {MOVEMENT_CATALOG.map(mv => <option key={mv.name} value={mv.name} />)}
        </datalist>
        <div className="space-y-2">
          {movements.map((line, i) => {
            const parsed = parseMovementRow(line);
            const showWeight = parsed.weightKg != null || parsed.weightKgWomen != null || isWeightedMovement(parsed.name);
            const update = (reps: number | null, name: string, weightKg: number | null, weightKgWomen: number | null) => {
              const w  = showWeight ? weightKg : null;
              const wW = showWeight ? weightKgWomen : null;
              if (reps == null) {
                setMovement(i, serializeMovement(0, name, w, wW).replace(/^0\s*/, '').trim());
              } else {
                setMovement(i, serializeMovement(reps, name, w, wW));
              }
            };
            return (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="number" min={0} inputMode="numeric"
                  className={`${inp} !w-16 shrink-0 text-center px-2`}
                  value={parsed.reps ?? ''}
                  onChange={e => update(e.target.value === '' ? null : parseInt(e.target.value, 10), parsed.name, parsed.weightKg, parsed.weightKgWomen)}
                  placeholder="Reps" aria-label="Répétitions" />
                <input
                  list="movement-catalog"
                  className={`${inp} flex-1 min-w-0`}
                  value={parsed.name}
                  onChange={e => update(parsed.reps, e.target.value, parsed.weightKg, parsed.weightKgWomen)}
                  placeholder="Exercice (rechercher…)" aria-label="Exercice" />
                {showWeight && (
                  <>
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♂</span>
                      <input
                        type="number" min={0} step={0.5} inputMode="decimal"
                        className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                        value={parsed.weightKg ?? ''}
                        onChange={e => update(parsed.reps, parsed.name, e.target.value === '' ? null : parseFloat(e.target.value), parsed.weightKgWomen)}
                        placeholder="H" aria-label="Charge hommes en kilos" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">kg</span>
                    </div>
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♀</span>
                      <input
                        type="number" min={0} step={0.5} inputMode="decimal"
                        className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                        value={parsed.weightKgWomen ?? ''}
                        onChange={e => update(parsed.reps, parsed.name, parsed.weightKg, e.target.value === '' ? null : parseFloat(e.target.value))}
                        placeholder="F" aria-label="Charge femmes en kilos" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">kg</span>
                    </div>
                  </>
                )}
                <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {movements.length === 0 && (
            <button type="button" onClick={addMovement}
              className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-white/30 hover:text-white/60 transition-colors">
              + Ajouter un mouvement
            </button>
          )}
          <p className="text-[11px] text-gray-600 pt-1">
            Reps + exercice (liste officielle) + charges ♂ hommes / ♀ femmes : garantit le comptage des badges de mouvement des athlètes.
          </p>
        </div>
      </div>

      {/* ── Scoring + scheduling ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Scoring</label>
          <input className={inp} value={form.scoring} onChange={e => set('scoring', e.target.value)} placeholder="ex: Score = temps total (cap 20 min)" />
        </div>
        {isRepsScoredType(form.type) && (
          <div className="col-span-2">
            <label className={lbl}>Reps par tour</label>
            <input
              type="number"
              min={1}
              className={inp}
              value={form.reps_per_round}
              onChange={e => set('reps_per_round', e.target.value)}
              placeholder={`auto : ${repsPerRoundFromMovements(movements.filter(Boolean)) || '—'} (somme des mouvements)`}
            />
            <p className="text-[11px] text-gray-600 pt-1">
              Sert à convertir « tours + reps » ⇄ « reps totaux » à la saisie du score athlète (classement cohérent). Laisse vide pour utiliser la somme auto des mouvements ; corrige-la si un tour mélange reps et cardio (cal / m).
            </p>
          </div>
        )}
        <div>
          <label className={lbl}>Ouverture programmée</label>
          <input type="datetime-local" className={inp} value={form.opens_at} onChange={e => set('opens_at', e.target.value)} />
          {isScheduledAhead(fromDatetimeLocal(form.opens_at)) && (
            <p className="text-[11px] text-amber-400/90 pt-1">
              Invisible pour les participants jusqu&apos;à cette date, même si le WOD est « Ouvert ». Laisse vide pour le rendre visible immédiatement.
            </p>
          )}
        </div>
        <div>
          <label className={lbl}>Fermeture programmée</label>
          <input type="datetime-local" className={inp} value={form.closes_at} onChange={e => set('closes_at', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Délai soumission (h)</label>
          <input type="number" min={1} max={720} className={inp} value={form.deadline_hours} onChange={e => set('deadline_hours', parseInt(e.target.value))} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1.5">
          <X size={13} /> Annuler
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#0A0A0A] disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {initial?.id ? 'Mettre à jour' : 'Ajouter le WOD'}
        </button>
      </div>
    </form>
  );
}
