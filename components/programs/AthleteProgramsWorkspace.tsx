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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-ax-text">Programmes athlètes</h2>
            <p className="text-xs text-ax-text-muted mt-1">Offres vendues ou assignées à tes membres</p>
          </div>
          <Button variant="ax-mint" size="ax-compact" onClick={openNew} className="h-auto px-4 py-2 text-sm">
            <Plus size={16} /> Créer un programme
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-ax-text-muted">Chargement…</div>
        ) : programs.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-ax-text-muted mb-3" />
            <p className="text-ax-text-muted text-sm">Aucun programme</p>
            <p className="text-ax-text-muted text-xs mt-1">Créez votre premier programme de coaching</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {programs.map(p => (
              <Card key={p.id} className={`p-5 ${!p.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ax-text text-base min-w-0 break-words">{p.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-ax-badge font-bold ${p.type === 'fixed' ? 'bg-ax-info-soft text-ax-info' : 'text-ax-purple'}`}
                        style={p.type === 'fixed' ? undefined : { backgroundColor: 'color-mix(in srgb, var(--ax-purple) 12%, var(--ax-surface))' }}>
                        {p.type === 'fixed' ? `${p.duration_weeks} sem.` : 'Ongoing'}
                      </span>
                      {!p.is_active && (
                        <Badge variant="danger" className="text-[10px] px-2 py-0.5 font-semibold">Inactif</Badge>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-ax-text-muted mt-1 line-clamp-2 break-words">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0">
                    <span className="text-sm font-black text-ax-success bg-ax-success-soft px-3 py-1.5 rounded-ax-control">
                      {formatPrice(p.price_cents)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-x-4 gap-y-2 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-ax-text-muted">
                    <Users size={13} /> <span className="font-semibold">{p.member_count ?? 0} acheteurs</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ax-text-muted">
                    <Calendar size={13} /> <span className="font-semibold">{p.days_per_week}j/sem</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ax-text-muted">
                    <Dumbbell size={13} />
                    <span className={`font-semibold ${(p.wod_count ?? 0) === 0 ? 'text-ax-warning' : ''}`}>
                      {p.wod_count ?? 0} WOD{(p.wod_count ?? 0) > 1 ? 's' : ''} liés
                    </span>
                  </div>
                  <button onClick={() => copyCode(p.invite_code)} className="flex items-center gap-1.5 text-xs font-bold text-ax-success bg-ax-success-soft px-2.5 py-1 rounded-ax-control hover:bg-ax-hover transition-all">
                    {codeCopied === p.invite_code ? <Check size={12} /> : <Hash size={12} />}
                    {codeCopied === p.invite_code ? 'Copié !' : p.invite_code}
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ax-border flex-wrap">
                  <button onClick={() => openEditor(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-accent-soft text-ax-accent-text text-xs font-semibold transition-all">
                    <FileText size={13} /> Séances
                  </button>
                  <Link href="/wods" className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text text-xs font-semibold transition-all">
                    <Dumbbell size={13} /> Whiteboard
                  </Link>
                  <button onClick={() => openAccess(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-accent-soft text-ax-accent-text text-xs font-semibold transition-all">
                    <Users size={13} /> Accès
                  </button>
                  <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text text-xs font-semibold transition-all">
                    <Pencil size={13} /> Modifier
                  </button>
                  <button onClick={() => toggleActive(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text text-xs font-semibold transition-all">
                    {p.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-danger-soft text-ax-text-muted hover:text-ax-danger text-xs font-semibold transition-all">
                    <Trash2 size={13} /> Supprimer
                  </button>
                  <div className="flex-1 basis-full sm:basis-auto" />
                  <span className="text-[10px] text-ax-text-muted">Commission plateforme : 4%</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-4">
          <Card className="w-full max-w-lg rounded-ax-panel shadow-ax-panel p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-ax-text">
                {editId ? 'Modifier le programme' : 'Nouveau programme'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-ax-text-muted hover:text-ax-text"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Titre *</label>
                <Input
                  
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Force 6 semaines"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Description</label>
                <textarea
                  className="w-full min-h-[80px] rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface transition-colors"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Programme de force progressive…"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Prix (€) *</label>
                <Input
                  type="number" step="0.01"
                  value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="49.00"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-2 block">Type de programme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setForm({ ...form, type: 'fixed' })}
                    className={`p-3 rounded-ax-control border-2 text-left transition-all ${form.type === 'fixed' ? 'border-ax-accent bg-ax-accent-soft' : 'border-ax-border hover:border-ax-input-border'}`}
                  >
                    <span className="text-sm font-bold text-ax-text block">Programme fixe</span>
                    <span className="text-xs text-ax-text-muted">Durée définie (6, 8, 12 sem.)</span>
                  </button>
                  <button
                    onClick={() => setForm({ ...form, type: 'ongoing' })}
                    className={`p-3 rounded-ax-control border-2 text-left transition-all ${form.type === 'ongoing' ? 'border-ax-accent bg-ax-accent-soft' : 'border-ax-border hover:border-ax-input-border'}`}
                  >
                    <span className="text-sm font-bold text-ax-text block">Ongoing</span>
                    <span className="text-xs text-ax-text-muted">Programme continu</span>
                  </button>
                </div>
              </div>

              {form.type === 'fixed' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Durée (semaines)</label>
                    <Input
                      type="number"
                      value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: e.target.value })}
                      placeholder="6"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Jours / semaine</label>
                    <Input
                      type="number"
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
                    className="w-4 h-4 rounded accent-ax-accent"
                  />
                  <span className="text-sm text-ax-text-secondary font-semibold">Actif (visible pour les athlètes)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 flex-wrap">
              <Button variant="ax-outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button
                variant="ax-mint"
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
              >
                {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer le programme'}
              </Button>
            </div>
          </Card>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-4">
          <Card className="w-full max-w-lg rounded-ax-panel shadow-ax-panel p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-black text-ax-text">Accès au programme</h2>
              <button onClick={() => setAccessProgram(null)} className="text-ax-text-muted hover:text-ax-text"><X size={20} /></button>
            </div>
            <p className="text-xs text-ax-text-muted mb-5">{accessProgram.title}</p>

            {accessError && (
              <div className="mb-4 flex items-start gap-2 rounded-ax-control bg-ax-danger-soft border border-ax-danger px-3 py-2.5 text-xs text-ax-danger">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{accessError}</span>
              </div>
            )}

            <div className="mb-6">
              <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Donner l&apos;accès à un membre</label>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <select
                  className="flex-1 min-w-0 min-h-11 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base sm:text-sm text-ax-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface transition-colors"
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
                <Button
                  variant="ax-mint"
                  onClick={assignerAcces}
                  disabled={!accessPick || accessBusyId !== null}
                  className="h-11"
                >
                  {accessBusyId === accessPick ? 'Attribution…' : 'Assigner (offert)'}
                </Button>
              </div>
              <p className="text-[11px] text-ax-text-muted mt-2">
                L&apos;accès offert est gratuit et tracé comme tel : il ne remplace jamais un achat.
                Seul un gérant ou un co-gérant peut l&apos;attribuer.
              </p>

              {/* Encaissement au comptoir : un accès payé, dont le montant part
                  dans le journal de caisse — le même événement comptable qu'un
                  encaissement d'abonnement. Un programme sans prix ne s'encaisse
                  pas : il n'y a pas de référence à laquelle borner la remise. */}
              {accessProgram.price_cents > 0 && (
                <div className="mt-3 pt-3 border-t border-ax-border">
                  <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 min-w-[120px]">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={(accessProgram.price_cents / 100).toFixed(2)}
                        value={accessCashAmount}
                        onChange={e => setAccessCashAmount(e.target.value)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ax-text-muted">€</span>
                    </div>
                    <Button
                      variant="ax-outline"
                      onClick={encaisserAcces}
                      disabled={!accessPick || accessBusyId !== null}
                      className="h-11 whitespace-nowrap"
                    >
                      {accessBusyId === accessPick ? 'Encaissement…' : 'Assigner — payé au comptoir'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-ax-text-muted mt-2">
                    Pré-rempli au prix du programme ({formatPrice(accessProgram.price_cents)}) et modifiable
                    à la baisse. Le montant part dans le journal de caisse, qui est en ajout seul :
                    une fois enregistré, il ne se corrige plus.
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-ax-text-secondary mb-2">
                Ont accès ({accessRows.filter(r => r.status === 'active').length})
              </p>
              {accessLoading ? (
                <div className="flex items-center gap-2 text-sm text-ax-text-muted py-6">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              ) : accessRows.length === 0 ? (
                <p className="text-sm text-ax-text-muted py-6">Personne pour l&apos;instant.</p>
              ) : (
                <div className="space-y-2">
                  {accessRows.map(r => (
                    <div key={r.id} className="flex items-center gap-3 flex-wrap rounded-ax-control bg-ax-surface-secondary border border-ax-border px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ax-text break-words">
                          {r.profile?.username ?? r.user_id.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-ax-text-muted">
                          {LIBELLE_PROVENANCE[r.provenance ?? ''] ?? 'Origine inconnue'}
                          {r.provenance === 'stripe' && r.amount_cents != null && ` · ${formatPrice(r.amount_cents)}`}
                          {r.status !== 'active' && ' · accès retiré'}
                        </p>
                      </div>
                      {r.status === 'active' && r.provenance === 'stripe' && (
                        <span className="text-[11px] text-ax-text-muted whitespace-nowrap">
                          {MENTION_ACCES_STRIPE}
                        </span>
                      )}
                      {r.status === 'active' && r.provenance !== 'stripe' && (
                        <button
                          onClick={() => retirerAcces(r)}
                          disabled={accessBusyId !== null}
                          className="px-2.5 py-1.5 rounded-ax-control text-[11px] font-bold text-ax-text-muted hover:text-ax-danger hover:bg-ax-danger-soft disabled:opacity-50 transition-all"
                        >
                          {accessBusyId === r.id ? '…' : 'Retirer'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
