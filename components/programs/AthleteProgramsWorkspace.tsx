'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { writeFailure } from '@/lib/writeGuard';
import { RETRAIT_COMPTOIR_CONFIRMATION, MENTION_ACCES_STRIPE } from '@/lib/programAccessCopy';
import {
  BookOpen, Plus, Pencil, Trash2, X, Check,
  Users, Calendar, Hash, FileText,
  AlertTriangle, Loader2, Dumbbell,
} from 'lucide-react';
import ProgramSessionsEditor from '@/components/programs/ProgramSessionsEditor';

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
  /** WOD réellement rattachés au programme (`wod_program_access`). */
  wod_count?: number;
}

interface ProgramMemberRow {
  id: string;
  user_id: string;
  status: string;
  provenance: string | null;
  purchased_at: string | null;
  amount_cents: number | null;
}

interface ProgramAccessRow extends ProgramMemberRow {
  profile: { id: string; username: string | null } | null;
}

interface BoxMemberLite {
  id: string;
  username: string | null;
}

// La provenance est affichée telle qu'elle est stockée : un accès offert ne se
// déguise pas en achat, et un achat ne se retire pas d'un clic.
const LIBELLE_PROVENANCE: Record<string, string> = {
  stripe: 'Acheté (Stripe)',
  cash: 'Payé au comptoir',
  staff: 'Offert par la box',
  legacy_unverified: 'Inscription héritée (origine non vérifiée)',
};

// Le montant d'un encaissement comptoir vit dans le journal de caisse, jamais
// sur la ligne d'accès : deux colonnes portant la même somme finiraient par ne
// plus dire la même chose. Cette page n'en affiche donc pas le montant.

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

/** Onglet « Programmes athlètes » de Marketplace : les programmes vendus aux athlètes de la box. */
export default function AthleteProgramsWorkspace() {
  const supabase = createClient();
  const [boxId, setBoxId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [codeCopied, setCodeCopied] = useState<string | null>(null);

  const [editorProgram, setEditorProgram] = useState<Program | null>(null);

  // Accès au programme : qui l'a acheté, et à qui le gérant l'offre.
  const [accessProgram, setAccessProgram] = useState<Program | null>(null);
  const [accessRows, setAccessRows] = useState<ProgramAccessRow[]>([]);
  const [accessCandidates, setAccessCandidates] = useState<BoxMemberLite[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessBusyId, setAccessBusyId] = useState<string | null>(null);
  const [accessPick, setAccessPick] = useState('');
  // Montant encaissé au comptoir, en euros saisis : pré-rempli depuis le prix du
  // programme et modifiable à la baisse (remise comptoir).
  const [accessCashAmount, setAccessCashAmount] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const active = await getMyBox(supabase);
    if (!active) { setLoading(false); return; }

    setBoxId(active.id);

    const { data: progs } = await supabase
      .from('programs')
      .select('*, program_members(count), wod_program_access(count)')
      .eq('box_id', active.id)
      .order('created_at', { ascending: false });

    const mapped = (progs ?? []).map((p: any) => ({
      ...p,
      member_count: p.program_members?.[0]?.count ?? 0,
      wod_count: p.wod_program_access?.[0]?.count ?? 0,
    }));
    setPrograms(mapped as Program[]);

    setLoading(false);
  }

  async function openAccess(p: Program) {
    setAccessProgram(p);
    setAccessRows([]);
    setAccessCandidates([]);
    setAccessError(null);
    setAccessPick('');
    setAccessCashAmount((p.price_cents / 100).toFixed(2));
    setAccessLoading(true);

    // Pas d'embed `profiles` ici : `program_members.user_id` pointe
    // `auth.users`, pas `public.profiles` — PostgREST refuse la jointure
    // (« Could not find a relationship … in the schema cache »). Les pseudos
    // se lisent donc en une seconde requête.
    const [inscrits, membres] = await Promise.all([
      supabase
        .from('program_members')
        .select('id, user_id, status, provenance, purchased_at, amount_cents')
        .eq('program_id', p.id)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('box_members')
        .select('member_id, profile:profiles(id, username)')
        .eq('box_id', p.box_id)
        .eq('status', 'active'),
    ]);

    // Une lecture qui échoue n'est pas une liste vide : le gérant doit voir la
    // cause, sinon « personne n'a accès » et « je n'ai pas pu lire » se
    // ressemblent (règle 13).
    const echec = inscrits.error?.message ?? membres.error?.message ?? null;
    if (echec) { setAccessError(echec); setAccessLoading(false); return; }

    const lignes = (inscrits.data ?? []) as unknown as ProgramMemberRow[];
    const pseudos = new Map<string, string | null>();
    if (lignes.length > 0) {
      const { data: profils, error: erreurProfils } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', lignes.map(l => l.user_id));
      if (erreurProfils) { setAccessError(erreurProfils.message); setAccessLoading(false); return; }
      for (const pr of profils ?? []) pseudos.set(pr.id, pr.username ?? null);
    }

    setAccessRows(lignes.map(l => ({
      ...l,
      profile: { id: l.user_id, username: pseudos.get(l.user_id) ?? null },
    })));
    setAccessCandidates((membres.data ?? []).map(m => {
      const profil = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return { id: m.member_id, username: profil?.username ?? null };
    }));
    setAccessLoading(false);
  }

  async function assignerAcces() {
    if (!accessProgram || !accessPick) return;
    setAccessBusyId(accessPick);
    setAccessError(null);
    // `join_program` est la seule porte d'inscription : elle vérifie côté
    // serveur que l'appelant est gérant ou co-gérant de la box du programme —
    // un coach est refusé là, pas seulement dans cette page.
    const { error } = await supabase.rpc('join_program', {
      p_program_id: accessProgram.id,
      p_source: 'staff',
      p_user_id: accessPick,
    });
    setAccessBusyId(null);
    if (error) { setAccessError(error.message); return; }
    await openAccess(accessProgram);
    await loadAll();
  }

  // Encaissement comptoir : l'accès et la ligne du journal de caisse sont posés
  // par la même RPC, dans la même transaction. Un accès « payé » sans trace
  // comptable n'existe donc pas, et le montant y est borné côté serveur
  // (0 < montant <= prix) — la borne ci-dessous n'est que la politesse de l'UI.
  async function encaisserAcces() {
    if (!accessProgram || !accessPick) return;
    const cents = Math.round(Number(accessCashAmount.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setAccessError('Montant encaissé invalide : indique une somme positive.');
      return;
    }
    if (cents > accessProgram.price_cents) {
      setAccessError(
        `Montant encaissé supérieur au prix du programme (${formatPrice(accessProgram.price_cents)}) : `
        + 'une remise comptoir descend, elle ne monte pas.',
      );
      return;
    }
    setAccessBusyId(accessPick);
    setAccessError(null);
    const { error } = await supabase.rpc('assign_program_cash', {
      p_program_id: accessProgram.id,
      p_user_id: accessPick,
      p_amount_cents: cents,
    });
    setAccessBusyId(null);
    if (error) { setAccessError(error.message); return; }
    await openAccess(accessProgram);
    await loadAll();
  }

  async function retirerAcces(row: ProgramAccessRow) {
    if (!accessProgram) return;
    if (row.provenance === 'stripe') {
      setAccessError('Cet accès a été payé : il se retire par un remboursement Stripe, pas ici.');
      return;
    }
    // Un encaissement comptoir est déjà dans la caisse et dans le journal, qui
    // est en ajout seul : retirer l'accès ne rend pas l'argent, et l'app ne
    // peut pas le rendre. Le gérant doit le savoir avant, pas le découvrir après.
    if (row.provenance === 'cash' && !window.confirm(RETRAIT_COMPTOIR_CONFIRMATION)) return;
    setAccessBusyId(row.id);
    setAccessError(null);
    const { data, error } = await supabase
      .from('program_members')
      .update({ status: 'cancelled' })
      .eq('id', row.id)
      .select('id');
    setAccessBusyId(null);
    const fail = writeFailure(error, data);
    if (fail) { setAccessError(fail); return; }
    await openAccess(accessProgram);
    await loadAll();
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

    let res;
    if (editId) {
      res = await supabase.from('programs').update(payload).eq('id', editId).select('id');
    } else {
      payload.invite_code = genCode();
      res = await supabase.from('programs').insert(payload).select('id');
    }

    setSaving(false);
    const fail = writeFailure(res.error, res.data);
    if (fail) { alert(`Impossible d'enregistrer le programme : ${fail}`); return; }
    setShowForm(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme et tous ses WODs ?')) return;
    const { data, error } = await supabase.from('programs').delete().eq('id', id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Suppression impossible : ${fail}`); return; }
    loadAll();
  }

  async function toggleActive(p: Program) {
    const { data, error } = await supabase
      .from('programs').update({ is_active: !p.is_active }).eq('id', p.id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Impossible de changer l'état du programme : ${fail}`); return; }
    loadAll();
  }

  function openEditor(p: Program) {
    setEditorProgram(p);
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Gratuit';
    return `${(cents / 100).toFixed(2)} €`;
  };

  return (
    <div className="space-y-8">
      {/* Programs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-white">Programmes athlètes</h2>
            <p className="text-xs text-gray-500 mt-1">Offres vendues ou assignées à tes membres</p>
          </div>
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
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Dumbbell size={13} />
                    <span className={`font-semibold ${(p.wod_count ?? 0) === 0 ? 'text-amber-400' : ''}`}>
                      {p.wod_count ?? 0} WOD{(p.wod_count ?? 0) > 1 ? 's' : ''} liés
                    </span>
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
                  <Link href="/wods" className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                    <Dumbbell size={13} /> Whiteboard
                  </Link>
                  <button onClick={() => openAccess(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-all">
                    <Users size={13} /> Accès
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



      {editorProgram && (
        <ProgramSessionsEditor
          program={editorProgram}
          userId={userId}
          onClose={() => setEditorProgram(null)}
          onChanged={loadAll}
        />
      )}

      {/* Accès au programme : acheteurs + assignation par le gérant */}
      {accessProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-black text-white">Accès au programme</h2>
              <button onClick={() => setAccessProgram(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-5">{accessProgram.title}</p>

            {accessError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-300">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{accessError}</span>
              </div>
            )}

            <div className="mb-6">
              <label className="text-xs font-bold text-gray-400 mb-1 block">Donner l&apos;accès à un membre</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={accessPick}
                  onChange={e => setAccessPick(e.target.value)}
                >
                  <option value="">Choisir un membre actif…</option>
                  {accessCandidates
                    .filter(m => !accessRows.some(r => r.user_id === m.id && r.status === 'active'))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.username ?? m.id.slice(0, 8)}</option>
                    ))}
                </select>
                <button
                  onClick={assignerAcces}
                  disabled={!accessPick || accessBusyId !== null}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
                >
                  {accessBusyId === accessPick ? 'Attribution…' : 'Assigner (offert)'}
                </button>
              </div>
              <p className="text-[11px] text-gray-600 mt-2">
                L&apos;accès offert est gratuit et tracé comme tel : il ne remplace jamais un achat.
                Seul un gérant ou un co-gérant peut l&apos;attribuer.
              </p>

              {/* Encaissement au comptoir : un accès payé, dont le montant part
                  dans le journal de caisse — le même événement comptable qu'un
                  encaissement d'abonnement. Un programme sans prix ne s'encaisse
                  pas : il n'y a pas de référence à laquelle borner la remise. */}
              {accessProgram.price_cents > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={(accessProgram.price_cents / 100).toFixed(2)}
                        value={accessCashAmount}
                        onChange={e => setAccessCashAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-emerald-500/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
                    </div>
                    <button
                      onClick={encaisserAcces}
                      disabled={!accessPick || accessBusyId !== null}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-50 text-white text-sm font-bold transition-all whitespace-nowrap"
                    >
                      {accessBusyId === accessPick ? 'Encaissement…' : 'Assigner — payé au comptoir'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2">
                    Pré-rempli au prix du programme ({formatPrice(accessProgram.price_cents)}) et modifiable
                    à la baisse. Le montant part dans le journal de caisse, qui est en ajout seul :
                    une fois enregistré, il ne se corrige plus.
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 mb-2">
                Ont accès ({accessRows.filter(r => r.status === 'active').length})
              </p>
              {accessLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              ) : accessRows.length === 0 ? (
                <p className="text-sm text-gray-600 py-6">Personne pour l&apos;instant.</p>
              ) : (
                <div className="space-y-2">
                  {accessRows.map(r => (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.profile?.username ?? r.user_id.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {LIBELLE_PROVENANCE[r.provenance ?? ''] ?? 'Origine inconnue'}
                          {r.provenance === 'stripe' && r.amount_cents != null && ` · ${formatPrice(r.amount_cents)}`}
                          {r.status !== 'active' && ' · accès retiré'}
                        </p>
                      </div>
                      {r.status === 'active' && r.provenance === 'stripe' && (
                        <span className="text-[11px] text-gray-600 whitespace-nowrap">
                          {MENTION_ACCES_STRIPE}
                        </span>
                      )}
                      {r.status === 'active' && r.provenance !== 'stripe' && (
                        <button
                          onClick={() => retirerAcces(r)}
                          disabled={accessBusyId !== null}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                        >
                          {accessBusyId === r.id ? '…' : 'Retirer'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
