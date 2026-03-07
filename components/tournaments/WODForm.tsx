'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Loader2, X } from 'lucide-react';

const WOD_TYPES = ['AMRAP','For Time','EMOM','Tabata','Max Reps','Strength'];
const WOD_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'active',  label: 'Ouvert' },
  { value: 'closed',  label: 'Fermé' },
];

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
    duration_minutes: initial?.duration_minutes ?? 10,
    scoring:          initial?.scoring          ?? '',
    deadline_hours:   initial?.deadline_hours   ?? 24,
    status:           initial?.status           ?? 'pending',
    opens_at:         initial?.opens_at         ?? '',
    closes_at:        initial?.closes_at        ?? '',
  });
  const [movements, setMovements] = useState<string[]>(
    Array.isArray(initial?.movements) ? initial.movements : []
  );

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function addMovement() { setMovements(m => [...m, '']); }
  function removeMovement(i: number) { setMovements(m => m.filter((_, idx) => idx !== i)); }
  function setMovement(i: number, v: string) { setMovements(m => m.map((x, idx) => idx === i ? v : x)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      ...form,
      tournament_id: tournamentId,
      movements: movements.filter(Boolean),
      opens_at:  form.opens_at  || null,
      closes_at: form.closes_at || null,
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

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Titre *</label>
          <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Fire Breather" required />
        </div>
        <div>
          <label className={lbl}>Type</label>
          <select className={inp} value={form.type} onChange={e => set('type', e.target.value)}>
            {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Durée (min)</label>
          <input type="number" min={1} max={120} className={inp} value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value))} />
        </div>
      </div>

      <div>
        <label className={lbl}>Description</label>
        <textarea className={`${inp} min-h-[80px] resize-y`} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Instructions du WOD..." />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={lbl}>Mouvements</label>
          <button type="button" onClick={addMovement} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
            <Plus size={12} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {movements.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inp} flex-1`} value={m} onChange={e => setMovement(i, e.target.value)} placeholder="ex: 21 Thrusters 43kg" />
              <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {movements.length === 0 && <p className="text-xs text-gray-600 italic">Aucun mouvement ajouté.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Scoring</label>
          <input className={inp} value={form.scoring} onChange={e => set('scoring', e.target.value)} placeholder="Total rounds + reps" />
        </div>
        <div>
          <label className={lbl}>Délai soumission (h)</label>
          <input type="number" min={1} max={720} className={inp} value={form.deadline_hours} onChange={e => set('deadline_hours', parseInt(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Statut</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {WOD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Ouverture programmée</label>
          <input type="datetime-local" className={inp} value={form.opens_at} onChange={e => set('opens_at', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Fermeture programmée</label>
          <input type="datetime-local" className={inp} value={form.closes_at} onChange={e => set('closes_at', e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1.5">
          <X size={13} /> Annuler
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {initial?.id ? 'Mettre à jour' : 'Ajouter le WOD'}
        </button>
      </div>
    </form>
  );
}
