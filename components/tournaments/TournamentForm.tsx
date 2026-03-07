'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

const LEVELS = ['scaled','inter','rx','rx+','gx','pro'];
const STATUSES = [
  { value: 'draft',  label: 'Brouillon' },
  { value: 'open',   label: 'Inscriptions ouvertes' },
  { value: 'active', label: 'En cours' },
];

interface Props {
  boxId: string;
  initial?: any;
}

export default function TournamentForm({ boxId, initial }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [form, setForm] = useState({
    name:             initial?.name             ?? '',
    description:      initial?.description      ?? '',
    level:            initial?.level            ?? 'rx',
    status:           initial?.status           ?? 'draft',
    start_date:       initial?.start_date       ?? '',
    end_date:         initial?.end_date         ?? '',
    max_participants: initial?.max_participants ?? 32,
    prize:            initial?.prize            ?? '',
    rules:            initial?.rules            ?? `1. Les scores doivent être soumis dans les 24h suivant l'ouverture du WOD.\n2. Une vidéo YouTube publique est obligatoire pour chaque soumission.\n3. Tout score sans vidéo sera automatiquement rejeté.\n4. Les scores sont validés par l'organisateur sous 48h.\n5. Tout comportement antisportif entraîne la disqualification.`,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent, publish = false) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload  = { ...form, box_id: boxId, status: publish ? 'open' : form.status };
    if (initial?.id) {
      const { error: err } = await supabase.from('tournaments').update(payload).eq('id', initial.id);
      setSaving(false);
      if (err) { setError(err.message); return; }
      router.push(`/tournaments/${initial.id}`);
    } else {
      const { data, error: err } = await supabase.from('tournaments').insert(payload).select('id').single();
      setSaving(false);
      if (err) { setError(err.message); return; }
      router.push(`/tournaments/${data.id}/wods`);
    }
    router.refresh();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Section générale */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Informations générales</h2>
        <div>
          <label className={lbl}>Nom du tournoi *</label>
          <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Open Spring 2025" required />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea className={`${inp} min-h-[80px] resize-y`} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Présentation du tournoi..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Niveau requis</label>
            <select className={inp} value={form.level} onChange={e => set('level', e.target.value)}>
              {LEVELS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Statut</label>
            <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Date de début</label>
            <input type="date" className={inp} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Date de fin</label>
            <input type="date" className={inp} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Max participants</label>
            <input type="number" min={2} max={500} className={inp} value={form.max_participants} onChange={e => set('max_participants', parseInt(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Récompense (optionnel)</label>
            <input className={inp} value={form.prize} onChange={e => set('prize', e.target.value)} placeholder="🏆 Médaille + Badge Elite" />
          </div>
        </div>
      </div>

      {/* Règlement */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Règlement</h2>
        <textarea
          className={`${inp} min-h-[160px] font-mono text-xs resize-y`}
          value={form.rules} onChange={e => set('rules', e.target.value)}
          placeholder="Règlement du tournoi..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/15 text-white disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Enregistrer
        </button>
        <button type="button" disabled={saving} onClick={(e) => handleSubmit(e as any, true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] hover:bg-[#C9A227] text-white disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Publier
        </button>
      </div>
    </form>
  );
}
