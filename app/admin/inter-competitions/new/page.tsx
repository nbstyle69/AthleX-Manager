'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Globe2, ChevronLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';

const FORMATS = [
  { value: 'league',  label: 'Ligue',               desc: 'Classement par points, tout le monde joue' },
  { value: 'bracket', label: 'Élimination directe',  desc: 'Bracket, perdant éliminé' },
  { value: 'pool',    label: 'Poules + Phases finales', desc: 'Groupes puis playoffs (V2)' },
  { value: 'swiss',   label: 'Ronde Suisse',          desc: 'Appariement progressif (V2)' },
];

export default function NewInterCompetitionPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  const [form, setForm] = useState({
    title: '',
    description: '',
    format: 'league',
    type: 'individual',
    team_size: 1,
    max_participants: '',
    starts_at: '',
    ends_at: '',
    registration_open_at: '',
    rules: '',
    banner_url: '',
  });

  useEffect(() => {
    if (!editId) return;
    supabase.from('inter_competitions').select('*').eq('id', editId).single().then(({ data }) => {
      if (data) {
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          format: data.format ?? 'league',
          type: data.type ?? 'individual',
          team_size: data.team_size ?? 1,
          max_participants: data.max_participants?.toString() ?? '',
          starts_at: data.starts_at ? data.starts_at.slice(0, 16) : '',
          ends_at: data.ends_at ? data.ends_at.slice(0, 16) : '',
          registration_open_at: data.registration_open_at ? data.registration_open_at.slice(0, 16) : '',
          rules: data.rules ?? '',
          banner_url: data.banner_url ?? '',
        });
      }
      setLoading(false);
    });
  }, [editId]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      format: form.format,
      type: form.type,
      team_size: form.type === 'individual' ? 1 : Number(form.team_size),
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      registration_open_at: form.registration_open_at || null,
      rules: form.rules || null,
      banner_url: form.banner_url || null,
    };

    if (editId) {
      await supabase.from('inter_competitions').update(payload).eq('id', editId);
      router.push(`/admin/inter-competitions/${editId}`);
    } else {
      const { data } = await supabase.from('inter_competitions').insert(payload).select('id').single();
      router.push(`/admin/inter-competitions/${data?.id ?? ''}`);
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="text-[#C9A227] animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/inter-competitions" className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl bg-[#C9A227]/20 flex items-center justify-center">
          <Globe2 size={20} className="text-[#C9A227]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">{editId ? 'Modifier la compétition' : 'Nouvelle compétition'}</h1>
          <p className="text-sm text-gray-400">Compétition inter-box visible par tous les athlètes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Titre */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Informations générales</h2>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Titre *</label>
            <input
              required
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ex : AthleX Spring Open 2026"
              className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Présentation de la compétition..."
              className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Règlement (optionnel)</label>
            <textarea
              value={form.rules}
              onChange={e => set('rules', e.target.value)}
              rows={4}
              placeholder="Règles de la compétition, critères de validation..."
              className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50 resize-none"
            />
          </div>
        </div>

        {/* Format */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Format</h2>
          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => set('format', f.value)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  form.format === f.value
                    ? 'border-[#C9A227]/50 bg-[#C9A227]/8'
                    : 'border-white/8 bg-[#0A0A0A] hover:border-white/15'
                }`}
              >
                <p className={`text-sm font-bold ${form.format === f.value ? 'text-[#C9A227]' : 'text-white'}`}>{f.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Type de participation</h2>
          <div className="flex gap-3">
            {[{v:'individual',l:'Individuel'},{v:'team',l:'Équipe'}].map(({v,l}) => (
              <button
                key={v}
                type="button"
                onClick={() => set('type', v)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.type === v
                    ? 'border-[#C9A227]/50 bg-[#C9A227]/8 text-[#C9A227]'
                    : 'border-white/8 bg-[#0A0A0A] text-gray-400 hover:border-white/15'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {form.type === 'team' && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Taille d&apos;équipe</label>
              <div className="flex gap-2 mt-1.5">
                {[2,3,4,5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('team_size', n)}
                    className={`w-12 h-10 rounded-xl border text-sm font-bold transition-all ${
                      form.team_size === n
                        ? 'border-[#C9A227]/50 bg-[#C9A227]/8 text-[#C9A227]'
                        : 'border-white/8 bg-[#0A0A0A] text-gray-400 hover:border-white/15'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dates & Capacité */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Dates & Capacité</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ouverture inscriptions</label>
              <input
                type="datetime-local"
                value={form.registration_open_at}
                onChange={e => set('registration_open_at', e.target.value)}
                className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Début compétition</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)}
                className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fin compétition</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={e => set('ends_at', e.target.value)}
                className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Participants max</label>
              <input
                type="number"
                min="2"
                value={form.max_participants}
                onChange={e => set('max_participants', e.target.value)}
                placeholder="Illimité"
                className="mt-1.5 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/inter-competitions"
            className="flex-1 py-3 rounded-xl border border-white/8 text-sm font-bold text-gray-400 hover:text-white hover:border-white/15 transition-all text-center"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] disabled:opacity-60 text-white text-sm font-bold py-3 rounded-xl transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editId ? 'Enregistrer les modifications' : 'Créer la compétition'}
          </button>
        </div>
      </form>
    </div>
  );
}
