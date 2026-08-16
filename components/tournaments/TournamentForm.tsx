'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Upload, ImageIcon, Trash2, Lock } from 'lucide-react';
import { toDateInput, fromDateInput } from '@/lib/datetime';

const LEVELS = ['scaled','inter','rx','rx+','gx','pro'];
// Must stay aligned with tournaments_status_check (open | active | completed).
const STATUSES = [
  { value: 'open',   label: 'Inscriptions ouvertes' },
  { value: 'active', label: 'En cours' },
];

// Ordre d'affichage : tous les formats existent toujours à l'écran, seuls les
// formats non inclus dans le plan sont désactivés.
const ALL_FORMATS = ['simple', 'bracket', 'swiss', 'league_div'];

const FORMAT_META: Record<string, { label: string; desc: string }> = {
  simple:     { label: 'Classique',           desc: 'Classement par points cumulés sur les WODs.' },
  bracket:    { label: 'Bracket (élimination simple)', desc: 'Tableau à élimination directe. Le perdant est éliminé.' },
  swiss:      { label: 'Swiss (double élimination)',   desc: 'Winner Bracket + Loser Bracket. Le champion WB choisit le WOD de la grande finale.' },
  league_div: { label: 'Ligue avec divisions',         desc: 'Plusieurs divisions avec promotion/relégation en fin de saison.' },
};

interface Props {
  boxId: string;
  initial?: any;
  allowedFormats?: string[];
}

export default function TournamentForm({ boxId, initial, allowedFormats = ['simple'] }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(initial?.banner_url ?? null);
  const [error, setError]   = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  function fail(message: string) {
    setError(message);
    setSaving(false);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
  const defaultFormat = (allowedFormats.includes(initial?.format) ? initial.format : allowedFormats[0]) ?? 'simple';
  const [form, setForm] = useState({
    name:                initial?.name                ?? '',
    description:         initial?.description         ?? '',
    level:               initial?.level               ?? 'rx',
    status:              initial?.status              ?? 'open',
    start_date:          toDateInput(initial?.start_date),
    end_date:            toDateInput(initial?.end_date),
    max_participants:    initial?.max_participants    ?? 32,
    prize:               initial?.prize               ?? '',
    format:              defaultFormat,
    require_video_proof: initial?.require_video_proof ?? false,
    rules:               initial?.rules               ?? `1. Les scores doivent être soumis dans les 24h suivant l'ouverture du WOD.\n2. Une vidéo YouTube publique est obligatoire pour chaque soumission.\n3. Tout score sans vidéo sera automatiquement rejeté.\n4. Les scores sont validés par l'organisateur sous 48h.\n5. Tout comportement antisportif entraîne la disqualification.`,
  });

  // Divisions config (only for league_div, only at create time)
  const [divisions, setDivisions] = useState<Array<{ name: string; max_members: number; promote_count: number; relegate_count: number }>>(
    initial ? [] : [
      { name: 'D1', max_members: 16, promote_count: 0, relegate_count: 3 },
      { name: 'D2', max_members: 16, promote_count: 3, relegate_count: 3 },
      { name: 'D3', max_members: 16, promote_count: 3, relegate_count: 0 },
    ]
  );

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // A closed tournament keeps its own option so the select isn't blank; it is
  // reopened via the lifecycle buttons, not here.
  const statusOptions = form.status === 'completed'
    ? [...STATUSES, { value: 'completed', label: 'Clôturé' }]
    : STATUSES;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 2 Mo.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${boxId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('tournament-banners')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      alert(`Erreur upload: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from('tournament-banners')
      .getPublicUrl(path);
    setBannerUrl(urlData.publicUrl + '?t=' + Date.now());
    setUploading(false);
  }

  function handleRemoveImage() {
    setBannerUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent, publish = false) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload  = {
      ...form,
      box_id:     boxId,
      status:     publish ? 'open' : form.status,
      banner_url: bannerUrl,
      // Empty date fields must be sent as null: '' is rejected by Postgres and
      // takes the whole UPDATE down with it (status included).
      start_date: fromDateInput(form.start_date),
      end_date:   form.end_date || null,
    };
    if (initial?.id) {
      const { error: err } = await supabase.from('tournaments').update(payload).eq('id', initial.id);
      setSaving(false);
      if (err) { fail(err.message); return; }
      router.push(`/tournaments/${initial.id}`);
    } else {
      const { data, error: err } = await supabase.from('tournaments').insert(payload).select('id').single();
      if (err) { fail(err.message); return; }
      // Bootstrap divisions for league_div
      if (form.format === 'league_div' && divisions.length > 0) {
        const rows = divisions.map((d, idx) => ({
          tournament_id:  data.id,
          name:           d.name,
          level:          idx + 1,
          max_members:    d.max_members,
          promote_count:  d.promote_count,
          relegate_count: d.relegate_count,
        }));
        const { error: dErr } = await supabase.from('tournament_divisions').insert(rows);
        if (dErr) { fail(`Tournoi créé mais divisions: ${dErr.message}`); return; }
      }
      setSaving(false);
      router.push(`/tournaments/${data.id}/wods`);
      return;
    }
    router.refresh();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div ref={errorRef}>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            <span className="font-bold">Enregistrement refusé — </span>{error}
          </div>
        )}
      </div>

      {/* Format */}
      {!initial && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Format du tournoi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ALL_FORMATS.map(fmt => {
              const meta = FORMAT_META[fmt] ?? { label: fmt, desc: '' };
              const locked = !allowedFormats.includes(fmt);
              const active = form.format === fmt;
              return (
                <button key={fmt} type="button" disabled={locked}
                  onClick={() => set('format', fmt)}
                  title={locked ? 'Contacte-nous pour l’activer' : undefined}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    locked  ? 'border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed'
                    : active ? 'border-white bg-white/10'
                             : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{meta.label}</span>
                    {locked && <Lock size={13} className="text-gray-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{meta.desc}</div>
                  {locked && (
                    <div className="text-[11px] font-semibold text-gray-500 mt-2">Contacte-nous pour l’activer</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
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
        {/* Image du tournoi */}
        <div>
          <label className={lbl}>Image du tournoi</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          {bannerUrl ? (
            <div className="relative group">
              <img src={bannerUrl} alt="Banner" className="w-full h-48 object-cover rounded-xl border border-white/10" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                  <Upload size={14} /> Changer
                </button>
                <button type="button" onClick={handleRemoveImage}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full h-36 border-2 border-dashed border-white/10 hover:border-white/40 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors">
              {uploading ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : (
                <>
                  <ImageIcon size={28} className="text-gray-600" />
                  <span className="text-xs text-gray-500 font-semibold">Cliquer pour ajouter une image</span>
                  <span className="text-[10px] text-gray-600">PNG, JPG, WEBP · Max 2 Mo</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Niveau requis</label>
            <select className={inp} value={form.level} onChange={e => set('level', e.target.value)}>
              {LEVELS.map(l => <option key={l} value={l} className="text-black">{l.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Statut</label>
            <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {statusOptions.map(s => <option key={s.value} value={s.value} className="text-black">{s.label}</option>)}
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
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.require_video_proof}
            onChange={e => set('require_video_proof', e.target.checked)}
            className="w-4 h-4 accent-white" />
          <span className="text-sm text-gray-300">Exiger une preuve vidéo pour valider les scores</span>
        </label>
      </div>

      {/* Divisions (league_div uniquement) */}
      {!initial && form.format === 'league_div' && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Divisions</h2>
            <button type="button"
              onClick={() => setDivisions(d => [...d, { name: `D${d.length + 1}`, max_members: 16, promote_count: 3, relegate_count: 3 }])}
              className="text-xs font-semibold text-white hover:text-[#e0b730]">+ Ajouter une division</button>
          </div>
          <p className="text-xs text-gray-500">La D1 est la division supérieure. Les promus montent (level - 1), les relégués descendent (level + 1).</p>
          <div className="space-y-2">
            {divisions.map((d, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <div className="col-span-1 text-xs font-bold text-gray-500">#{idx + 1}</div>
                <input className={`${inp} col-span-3`} value={d.name}
                  onChange={e => setDivisions(arr => arr.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                  placeholder="Nom" />
                <div className="col-span-2">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">Max</div>
                  <input type="number" min={2} className={inp} value={d.max_members}
                    onChange={e => setDivisions(arr => arr.map((x, i) => i === idx ? { ...x, max_members: parseInt(e.target.value) || 0 } : x))} />
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">Promus ↑</div>
                  <input type="number" min={0} className={inp} value={d.promote_count} disabled={idx === 0}
                    onChange={e => setDivisions(arr => arr.map((x, i) => i === idx ? { ...x, promote_count: parseInt(e.target.value) || 0 } : x))} />
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">Relégués ↓</div>
                  <input type="number" min={0} className={inp} value={d.relegate_count} disabled={idx === divisions.length - 1}
                    onChange={e => setDivisions(arr => arr.map((x, i) => i === idx ? { ...x, relegate_count: parseInt(e.target.value) || 0 } : x))} />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button type="button" disabled={divisions.length <= 1}
                    onClick={() => setDivisions(arr => arr.filter((_, i) => i !== idx))}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-white text-[#0A0A0A] disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Publier
        </button>
      </div>
    </form>
  );
}
