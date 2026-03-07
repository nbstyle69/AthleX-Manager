'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Loader2, X, Sparkles, ChevronDown, ChevronUp, Timer } from 'lucide-react';

const WOD_TYPES = ['AMRAP', 'For Time', 'EMOM', 'Tabata', 'Max Reps', 'Strength'];
const LEVELS    = ['scaled', 'inter', 'rx', 'rx+', 'gx', 'pro'];
const EQUIPMENT = ['Barre olympique', 'Haltères', 'Kettlebell', 'Barre de traction', 'Anneaux', 'Rameur', 'Vélo assault', 'Corde à sauter', 'Box', 'Sac de sable', 'Médecine ball', 'GHD'];

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

interface Props {
  tournamentId: string;
  initial?: any;
  onSaved: () => void;
  onCancel: () => void;
}

export default function WODForm({ tournamentId, initial, onSaved, onCancel }: Props) {
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
    opens_at:         initial?.opens_at         ?? '',
    closes_at:        initial?.closes_at        ?? '',
    timer_type:       initial?.timer_type       ?? 'stopwatch',
    time_cap:         initial?.time_cap_seconds ? Math.floor(initial.time_cap_seconds / 60) : 20,
    rounds:           initial?.rounds           ?? 8,
    work_seconds:     initial?.work_seconds     ?? 20,
    rest_seconds:     initial?.rest_seconds     ?? 10,
  });

  const [movements, setMovements] = useState<string[]>(
    Array.isArray(initial?.movements) ? initial.movements : []
  );

  // AI Generator state
  const [showGen,      setShowGen]      = useState(false);
  const [genLoading,   setGenLoading]   = useState(false);
  const [genLevel,     setGenLevel]     = useState('rx');
  const [genEquipment, setGenEquipment] = useState<string[]>(['Barre olympique', 'Barre de traction', 'Haltères']);
  const [genError,     setGenError]     = useState<string | null>(null);

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

  function addMovement()                 { setMovements(m => [...m, '']); }
  function removeMovement(i: number)     { setMovements(m => m.filter((_, idx) => idx !== i)); }
  function setMovement(i: number, v: string) { setMovements(m => m.map((x, idx) => idx === i ? v : x)); }

  async function generateWOD() {
    setGenLoading(true);
    setGenError(null);
    try {
      const res = await fetch('/api/generate-wod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          level: genLevel,
          duration_minutes: form.type === 'For Time' || form.type === 'Max Reps' ? form.time_cap : form.duration_minutes,
          equipment: genEquipment,
        }),
      });
      if (!res.ok) throw new Error('Erreur génération');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setForm(f => ({
        ...f,
        title:       data.title       ?? f.title,
        description: data.description ?? f.description,
        scoring:     data.scoring     ?? f.scoring,
        timer_type:  data.timer_type  ?? f.timer_type,
        rounds:      data.rounds      ?? f.rounds,
        work_seconds: data.work_seconds ?? f.work_seconds,
        rest_seconds: data.rest_seconds ?? f.rest_seconds,
      }));
      if (data.time_cap_seconds) set('time_cap', Math.floor(data.time_cap_seconds / 60));
      if (Array.isArray(data.movements)) setMovements(data.movements);
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
      opens_at:         form.opens_at  || null,
      closes_at:        form.closes_at || null,
      movements:        movements.filter(Boolean),
      timer_type:       form.timer_type,
      time_cap_seconds: timeCap,
      rounds:           ['EMOM', 'Tabata'].includes(form.type) ? form.rounds : null,
      work_seconds:     form.type === 'Tabata' ? form.work_seconds : null,
      rest_seconds:     form.type === 'Tabata' ? form.rest_seconds : null,
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

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* ── AI Generator panel ── */}
      <div className="border border-[#C9A227]/30 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowGen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-[#C9A227]/10 hover:bg-[#C9A227]/15 transition-colors text-left">
          <Sparkles size={15} className="text-[#C9A227]" />
          <span className="text-sm font-bold text-[#C9A227]">Générer avec l&apos;IA</span>
          <span className="ml-auto text-gray-500">{showGen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </button>

        {showGen && (
          <div className="p-4 space-y-4 bg-[#0A0A0A]/50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Niveau athlètes</label>
                <select className={inp} value={genLevel} onChange={e => setGenLevel(e.target.value)}>
                  {LEVELS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={lbl}>Équipement disponible</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EQUIPMENT.map(eq => (
                  <button key={eq} type="button" onClick={() => toggleEquipment(eq)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                      genEquipment.includes(eq)
                        ? 'bg-[#C9A227]/20 border-[#C9A227]/40 text-[#C9A227]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}>{eq}</button>
                ))}
              </div>
            </div>

            {genError && <p className="text-xs text-red-400">{genError}</p>}

            <button type="button" onClick={generateWOD} disabled={genLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-white disabled:opacity-60 transition-colors">
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
            {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Statut</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {WOD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Timer config (adapts to type) ── */}
      <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <Timer size={14} className="text-[#C9A227]" />
          <span className="text-xs font-bold text-[#C9A227] uppercase tracking-wider">Configuration Timer</span>
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
          <button type="button" onClick={addMovement} className="text-xs text-[#C9A227] font-semibold flex items-center gap-1 hover:opacity-80">
            <Plus size={12} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {movements.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inp} flex-1`} value={m} onChange={e => setMovement(i, e.target.value)}
                placeholder="ex: 21 Thrusters 43kg (Rx) / 30kg (Scaled)" />
              <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {movements.length === 0 && (
            <button type="button" onClick={addMovement}
              className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-[#C9A227]/30 hover:text-[#C9A227]/60 transition-colors">
              + Ajouter un mouvement
            </button>
          )}
        </div>
      </div>

      {/* ── Scoring + scheduling ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Scoring</label>
          <input className={inp} value={form.scoring} onChange={e => set('scoring', e.target.value)} placeholder="ex: Score = temps total (cap 20 min)" />
        </div>
        <div>
          <label className={lbl}>Ouverture programmée</label>
          <input type="datetime-local" className={inp} value={form.opens_at} onChange={e => set('opens_at', e.target.value)} />
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
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-white disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {initial?.id ? 'Mettre à jour' : 'Ajouter le WOD'}
        </button>
      </div>
    </form>
  );
}
