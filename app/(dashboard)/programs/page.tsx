'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BookOpen, Plus, Pencil, Trash2, X, Globe, Eye, Copy, Check,
  Users, Calendar, Clock, Hash, ChevronLeft, ChevronRight, FileText,
  CreditCard, AlertTriangle, Loader2,
} from 'lucide-react';

interface Program {
  id: string;
  box_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  type: 'fixed' | 'ongoing';
  duration_weeks: number | null;
  days_per_week: number;
  invite_code: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

interface ProgramWOD {
  id: string;
  program_id: string;
  day_number: number | null;
  week_number: number | null;
  title: string;
  description: string;
  wod_type: string | null;
  time_cap_seconds: number | null;
  notes: string | null;
  sort_order: number;
}

const WOD_TYPES = [
  { value: 'for-time', label: 'For Time', color: '#EF4444' },
  { value: 'amrap', label: 'AMRAP', color: '#3B82F6' },
  { value: 'emom', label: 'EMOM', color: '#8B5CF6' },
  { value: 'strength', label: 'Force', color: '#16A34A' },
  { value: 'custom', label: 'Custom', color: '#6B7280' },
];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const EMPTY_FORM = {
  title: '',
  description: '',
  price: '' as string,
  type: 'fixed' as 'fixed' | 'ongoing',
  duration_weeks: '6',
  days_per_week: '5',
  is_active: true,
};

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const SITE_BASE_URL = 'https://the-hub-rho.vercel.app';

export default function BoxOwnerProgramsPage() {
  const supabase = createClient();
  const [boxId, setBoxId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [slugSaved, setSlugSaved] = useState<string>('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Stripe Connect (paiements)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [codeCopied, setCodeCopied] = useState<string | null>(null);

  // WOD Editor state
  const [editorProgram, setEditorProgram] = useState<Program | null>(null);
  const [wods, setWods] = useState<ProgramWOD[]>([]);
  const [wodsLoading, setWodsLoading] = useState(false);
  const [weekIdx, setWeekIdx] = useState(0);
  const [showWodForm, setShowWodForm] = useState(false);
  const [editWodId, setEditWodId] = useState<string | null>(null);
  const [wodForm, setWodForm] = useState({ title: '', description: '', wod_type: 'custom', time_cap: '', notes: '' });
  const [wodDayNumber, setWodDayNumber] = useState(1);
  const [wodSaving, setWodSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  // Retour d'onboarding Connect → rafraîchir le statut
  useEffect(() => {
    if (!boxId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'return' || params.get('connect') === 'refresh') {
      refreshConnect();
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: box } = await supabase
      .from('boxes')
      .select('id, slug, stripe_account_id, stripe_onboarding_complete')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (!box) { setLoading(false); return; }
    setBoxId(box.id);
    setSlug((box as any).slug ?? '');
    setSlugSaved((box as any).slug ?? '');
    setStripeAccountId((box as any).stripe_account_id ?? null);
    setOnboardingComplete(Boolean((box as any).stripe_onboarding_complete));

    const { data: progs } = await supabase
      .from('programs')
      .select('*, program_members(count)')
      .eq('box_id', box.id)
      .order('created_at', { ascending: false });

    const mapped = (progs ?? []).map((p: any) => ({
      ...p,
      member_count: p.program_members?.[0]?.count ?? 0,
    }));
    setPrograms(mapped as Program[]);
    setLoading(false);
  }

  async function startOnboarding() {
    if (!boxId) return;
    setConnectLoading(true);
    try {
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch { /* noop */ }
    setConnectLoading(false);
  }

  async function refreshConnect() {
    if (!boxId) return;
    setConnectLoading(true);
    try {
      const res = await fetch('/api/connect/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      setOnboardingComplete(Boolean(data.onboarding_complete));
    } catch { /* noop */ }
    setConnectLoading(false);
  }

  async function saveSlug() {
    if (!boxId || !slug.trim()) return;
    setSlugSaving(true);
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    const { error } = await supabase.from('boxes').update({ slug: clean }).eq('id', boxId);
    if (!error) { setSlug(clean); setSlugSaved(clean); setSlugEditing(false); }
    setSlugSaving(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${SITE_BASE_URL}/box/${slugSaved}`);
    setSlugCopied(true);
    setTimeout(() => setSlugCopied(false), 2000);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCodeCopied(code);
    setTimeout(() => setCodeCopied(null), 2000);
  }

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: Program) {
    setEditId(p.id);
    setForm({
      title: p.title,
      description: p.description ?? '',
      price: String(p.price_cents / 100),
      type: p.type,
      duration_weeks: p.duration_weeks ? String(p.duration_weeks) : '',
      days_per_week: String(p.days_per_week),
      is_active: p.is_active,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !boxId || !userId) return;
    setSaving(true);

    const cents = Math.round(parseFloat(form.price || '0') * 100);
    if (isNaN(cents) || cents < 0) { setSaving(false); return; }

    const payload: any = {
      box_id: boxId,
      owner_id: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price_cents: cents,
      type: form.type,
      duration_weeks: form.type === 'fixed' ? (parseInt(form.duration_weeks) || 6) : null,
      days_per_week: parseInt(form.days_per_week) || 5,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      await supabase.from('programs').update(payload).eq('id', editId);
    } else {
      payload.invite_code = genCode();
      await supabase.from('programs').insert(payload);
    }

    setSaving(false);
    setShowForm(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme et tous ses WODs ?')) return;
    await supabase.from('programs').delete().eq('id', id);
    loadAll();
  }

  async function toggleActive(p: Program) {
    await supabase.from('programs').update({ is_active: !p.is_active }).eq('id', p.id);
    loadAll();
  }

  // ── WOD Editor functions ──
  async function openEditor(p: Program) {
    setEditorProgram(p);
    setWeekIdx(0);
    await loadWods(p.id);
  }

  async function loadWods(programId: string) {
    setWodsLoading(true);
    const { data } = await supabase
      .from('program_wods')
      .select('*')
      .eq('program_id', programId)
      .order('day_number')
      .order('sort_order');
    setWods((data ?? []) as ProgramWOD[]);
    setWodsLoading(false);
  }

  function wodsForDay(dayNum: number) {
    return wods.filter(w => w.day_number === dayNum);
  }

  function openWodCreate(dayNumber: number) {
    setEditWodId(null);
    setWodForm({ title: '', description: '', wod_type: 'custom', time_cap: '', notes: '' });
    setWodDayNumber(dayNumber);
    setShowWodForm(true);
  }

  function openWodEdit(w: ProgramWOD) {
    setEditWodId(w.id);
    setWodForm({
      title: w.title,
      description: w.description,
      wod_type: w.wod_type ?? 'custom',
      time_cap: w.time_cap_seconds ? String(Math.floor(w.time_cap_seconds / 60)) : '',
      notes: w.notes ?? '',
    });
    setWodDayNumber(w.day_number ?? 1);
    setShowWodForm(true);
  }

  async function saveWod() {
    if (!wodForm.title.trim() || !wodForm.description.trim() || !editorProgram) return;
    setWodSaving(true);
    const payload: any = {
      program_id: editorProgram.id,
      day_number: wodDayNumber,
      week_number: Math.ceil(wodDayNumber / 7),
      title: wodForm.title.trim(),
      description: wodForm.description.trim(),
      wod_type: wodForm.wod_type,
      time_cap_seconds: wodForm.time_cap ? parseInt(wodForm.time_cap) * 60 : null,
      notes: wodForm.notes.trim() || null,
    };
    if (editWodId) {
      await supabase.from('program_wods').update(payload).eq('id', editWodId);
    } else {
      payload.sort_order = wodsForDay(wodDayNumber).length;
      await supabase.from('program_wods').insert(payload);
    }
    setShowWodForm(false);
    setWodSaving(false);
    loadWods(editorProgram.id);
  }

  async function deleteWod(id: string) {
    if (!confirm('Supprimer ce WOD ?') || !editorProgram) return;
    await supabase.from('program_wods').delete().eq('id', id);
    loadWods(editorProgram.id);
  }

  async function duplicateWeek() {
    if (!editorProgram) return;
    const weekStart = weekIdx * 7;
    const currentWods = wods.filter(w => (w.day_number ?? 0) > weekStart && (w.day_number ?? 0) <= weekStart + 7);
    if (currentWods.length === 0) { alert('Aucun WOD cette semaine.'); return; }
    const inserts = currentWods.map(w => ({
      program_id: editorProgram.id,
      day_number: (w.day_number ?? 1) + 7,
      week_number: (w.week_number ?? 1) + 1,
      title: w.title,
      description: w.description,
      wod_type: w.wod_type,
      time_cap_seconds: w.time_cap_seconds,
      notes: w.notes,
      sort_order: w.sort_order,
    }));
    await supabase.from('program_wods').insert(inserts);
    setWeekIdx(prev => prev + 1);
    loadWods(editorProgram.id);
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Gratuit';
    return `${(cents / 100).toFixed(2)} €`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">Programmation</h1>
        <p className="text-sm text-gray-500 mt-1">Créez et gérez vos programmes de coaching</p>
      </div>

      {/* Slug / Public page */}
      <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Page publique</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-1">
            <span className="text-xs text-gray-500 pl-3 pr-1 whitespace-nowrap">{SITE_BASE_URL}/box/</span>
            <input
              className={`flex-1 bg-transparent text-sm py-2.5 pr-3 outline-none font-semibold ${slugEditing ? 'text-white' : 'text-gray-400'}`}
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="mon-slug"
              readOnly={!slugEditing}
            />
          </div>
          {slugEditing ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { setSlug(slugSaved); setSlugEditing(false); }} className="px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap">Annuler</button>
              <button onClick={saveSlug} disabled={slugSaving || slug === slugSaved || !slug.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-sm font-bold transition-all whitespace-nowrap">{slugSaving ? '...' : 'Enregistrer'}</button>
            </div>
          ) : (
            <button onClick={() => setSlugEditing(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-bold transition-all whitespace-nowrap"><Pencil size={14} /> Modifier</button>
          )}
        </div>
        {slugSaved && (
          <div className="flex items-center gap-3 mt-3">
            <a href={`${SITE_BASE_URL}/box/${slugSaved}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"><Eye size={13} /> Voir ma page</a>
            <button onClick={copyUrl} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white font-semibold transition-colors">
              {slugCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {slugCopied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
        )}
      </div>

      {/* Paiements (Stripe Connect) */}
      <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Paiements</h2>
        </div>
        {onboardingComplete ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Check size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Paiements activés</p>
              <p className="text-xs text-gray-500">Tu peux vendre tes programmes. Les paiements arrivent directement sur ton compte (commission AthleX 4 %).</p>
            </div>
            <button onClick={refreshConnect} disabled={connectLoading} className="text-xs text-gray-500 hover:text-white font-semibold transition-colors disabled:opacity-50">
              {connectLoading ? '...' : 'Actualiser'}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Active les paiements pour vendre tes programmes</p>
              <p className="text-xs text-gray-500 mb-3">
                Connecte ton compte via Stripe (2 min). Les programmes gratuits restent accessibles sans cette étape.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={startOnboarding}
                  disabled={connectLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black text-sm font-bold transition-all disabled:opacity-60"
                >
                  {connectLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  {stripeAccountId ? 'Continuer la configuration' : 'Activer les paiements'}
                </button>
                {stripeAccountId && (
                  <button onClick={refreshConnect} disabled={connectLoading} className="text-xs text-gray-500 hover:text-white font-semibold transition-colors disabled:opacity-50">
                    J'ai terminé — actualiser
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Programs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Mes programmes</h2>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all">
            <Plus size={16} /> Créer un programme
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Chargement…</div>
        ) : programs.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">Aucun programme</p>
            <p className="text-gray-600 text-xs mt-1">Créez votre premier programme de coaching</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {programs.map(p => (
              <div key={p.id} className={`bg-[#111] border border-white/[0.06] rounded-2xl p-5 ${!p.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base truncate">{p.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${p.type === 'fixed' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                        {p.type === 'fixed' ? `${p.duration_weeks} sem.` : 'Ongoing'}
                      </span>
                      {!p.is_active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">Inactif</span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                      {formatPrice(p.price_cents)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users size={13} /> <span className="font-semibold">{p.member_count ?? 0} acheteurs</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar size={13} /> <span className="font-semibold">{p.days_per_week}j/sem</span>
                  </div>
                  <button onClick={() => copyCode(p.invite_code)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 transition-all">
                    {codeCopied === p.invite_code ? <Check size={12} /> : <Hash size={12} />}
                    {codeCopied === p.invite_code ? 'Copié !' : p.invite_code}
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                  <button onClick={() => openEditor(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-all">
                    <FileText size={13} /> Séances
                  </button>
                  <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                    <Pencil size={13} /> Modifier
                  </button>
                  <button onClick={() => toggleActive(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                    {p.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-semibold transition-all">
                    <Trash2 size={13} /> Supprimer
                  </button>
                  <div className="flex-1" />
                  <span className="text-[10px] text-gray-600">Commission plateforme : 4%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">
                {editId ? 'Modifier le programme' : 'Nouveau programme'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Titre *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Force 6 semaines"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Description</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[80px]"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Programme de force progressive…"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€) *</label>
                <input
                  type="number" step="0.01"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="49.00"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type de programme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setForm({ ...form, type: 'fixed' })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === 'fixed' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <span className="text-sm font-bold text-white block">Programme fixe</span>
                    <span className="text-xs text-gray-500">Durée définie (6, 8, 12 sem.)</span>
                  </button>
                  <button
                    onClick={() => setForm({ ...form, type: 'ongoing' })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === 'ongoing' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <span className="text-sm font-bold text-white block">Ongoing</span>
                    <span className="text-xs text-gray-500">Programme continu</span>
                  </button>
                </div>
              </div>

              {form.type === 'fixed' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Durée (semaines)</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: e.target.value })}
                      placeholder="6"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Jours / semaine</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={form.days_per_week} onChange={e => setForm({ ...form, days_per_week: e.target.value })}
                      placeholder="5"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-sm text-gray-300 font-semibold">Actif (visible pour les athlètes)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Annuler</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer le programme'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WOD Editor panel */}
      {editorProgram && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-y-auto">
          {/* Editor Header */}
          <div className="sticky top-0 z-10 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.06]">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
              <button onClick={() => setEditorProgram(null)} className="text-gray-400 hover:text-white">
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-black text-white">{editorProgram.title}</h2>
                <p className="text-xs text-gray-500">
                  {editorProgram.type === 'fixed' ? `${editorProgram.duration_weeks} semaines` : 'Ongoing'} · {editorProgram.days_per_week}j/sem · {wods.length} séance{wods.length > 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={duplicateWeek} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-all">
                <Copy size={13} /> Dupliquer sem. {weekIdx + 1} → {weekIdx + 2}
              </button>
            </div>

            {/* Week navigation */}
            <div className="max-w-5xl mx-auto px-6 pb-3 flex items-center gap-4">
              <button
                onClick={() => setWeekIdx(w => Math.max(0, w - 1))}
                disabled={weekIdx === 0}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={18} className="text-gray-400" />
              </button>
              <span className="text-sm font-bold text-white">
                Semaine {weekIdx + 1}{editorProgram.type === 'fixed' ? ` / ${editorProgram.duration_weeks}` : ''}
              </span>
              <button
                onClick={() => setWeekIdx(w => editorProgram.type === 'fixed' ? Math.min((editorProgram.duration_weeks ?? 12) - 1, w + 1) : w + 1)}
                disabled={editorProgram.type === 'fixed' && weekIdx >= (editorProgram.duration_weeks ?? 12) - 1}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Days grid */}
          <div className="max-w-5xl mx-auto px-6 py-6">
            {wodsLoading ? (
              <div className="text-center py-20 text-gray-500">Chargement…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 7 }, (_, i) => {
                  const dayNum = weekIdx * 7 + i + 1;
                  const dayWods = wodsForDay(dayNum);
                  const isRest = i >= editorProgram.days_per_week;
                  return (
                    <div key={dayNum} className={`rounded-2xl border p-4 ${isRest ? 'border-white/[0.03] bg-white/[0.01]' : 'border-white/[0.06] bg-[#111]'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold ${isRest ? 'text-gray-600' : 'text-gray-400'}`}>
                          {DAY_LABELS[i]} — J{dayNum}
                        </span>
                        {isRest && <span className="text-[10px] text-gray-600 font-bold">REPOS</span>}
                      </div>

                      {dayWods.map(w => {
                        const typeInfo = WOD_TYPES.find(t => t.value === w.wod_type);
                        return (
                          <div key={w.id} className="bg-white/[0.03] rounded-xl p-3 mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-white flex-1" title={w.title}>{w.title}</span>
                              {typeInfo && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}>
                                  {typeInfo.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 line-clamp-3 whitespace-pre-line mb-2">{w.description}</p>
                            {w.time_cap_seconds && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-2">
                                <Clock size={10} /> {Math.floor(w.time_cap_seconds / 60)} min
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <button onClick={() => openWodEdit(w)} className="text-[10px] font-semibold text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-all">
                                <Pencil size={10} />
                              </button>
                              <button onClick={() => deleteWod(w.id)} className="text-[10px] font-semibold text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-all">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {!isRest && (
                        <button
                          onClick={() => openWodCreate(dayNum)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-xs font-semibold text-gray-500 hover:text-emerald-400 transition-all"
                        >
                          <Plus size={14} /> Ajouter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WOD create/edit modal */}
      {showWodForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">
                {editWodId ? 'Modifier la séance' : `Nouvelle séance — J${wodDayNumber}`}
              </h2>
              <button onClick={() => setShowWodForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Titre *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={wodForm.title} onChange={e => setWodForm({ ...wodForm, title: e.target.value })}
                  placeholder="Back Squat 5x5 + MetCon"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Contenu de la séance *</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[140px] font-mono"
                  value={wodForm.description} onChange={e => setWodForm({ ...wodForm, description: e.target.value })}
                  placeholder={"A) Back Squat 5x5 @80%\nRest 2:00\n\nB) 3 Rounds For Time:\n12 Thrusters 42.5/30\n12 C2B Pull-ups\n400m Run"}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {WOD_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setWodForm({ ...wodForm, wod_type: t.value })}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${wodForm.wod_type === t.value ? 'ring-2 ring-offset-1 ring-offset-[#111]' : 'opacity-50 hover:opacity-80'}`}
                      style={{ backgroundColor: `${t.color}20`, color: t.color, ...(wodForm.wod_type === t.value ? { ringColor: t.color } : {}) }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Time Cap (min)</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={wodForm.time_cap} onChange={e => setWodForm({ ...wodForm, time_cap: e.target.value })}
                    placeholder="12"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Jour</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={wodDayNumber} onChange={e => setWodDayNumber(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Notes coach</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[60px]"
                  value={wodForm.notes} onChange={e => setWodForm({ ...wodForm, notes: e.target.value })}
                  placeholder="Scaling: 35/25kg, Pull-ups stricts…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowWodForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Annuler</button>
              <button
                onClick={saveWod}
                disabled={wodSaving || !wodForm.title.trim() || !wodForm.description.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {wodSaving ? 'Enregistrement…' : editWodId ? 'Modifier' : 'Ajouter la séance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
