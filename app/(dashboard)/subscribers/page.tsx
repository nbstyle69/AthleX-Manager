'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Search, Users, BookOpen, Pause, Play, FileText, Check, X } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';

const supabase = createClient();

type Kind = 'membership' | 'program';

interface Row {
  key: string;
  kind: Kind;
  username: string;
  email: string;
  label: string;        // formule ou programme
  color: string;
  amountCents: number | null;
  status: string;       // active | past_due | cancelled | ...
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  boxMemberId: string | null;
  hasStripeSub: boolean;
  paused: boolean;
  pauseResumesAt: string | null;
  commitmentEndDate: string | null;
}

const REASON_LABEL: Record<string, string> = {
  moving: 'Déménagement',
  medical: 'Santé / blessure',
  other: 'Autre',
};

interface CancelRequest {
  id: string;
  reason_type: string;
  message: string | null;
  document_path: string | null;
  status: string;
  created_at: string;
  username: string;
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  active:    { label: 'Actif',    color: '#22C55E' },
  past_due:  { label: 'Impayé',   color: '#F59E0B' },
  cancelled: { label: 'Annulé',   color: '#EF4444' },
  refunded:  { label: 'Remboursé', color: '#EF4444' },
};

function fmtPrice(cents: number | null) {
  if (!cents) return '—';
  return `${(cents / 100).toFixed(2)} €`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SubscribersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const [cancelReqs, setCancelReqs] = useState<CancelRequest[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { router.push('/login'); return; }

    // Abonnements de salle (formules payantes)
    const { data: memberRows } = await supabase
      .from('box_members')
      .select('id, member_id, amount_cents, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, stripe_subscription_id, subscription_paused, pause_resumes_at, commitment_end_date, plan:membership_plans(name, color, price_cents), profile:profiles(username, email)')
      .eq('box_id', box.id)
      .not('subscription_status', 'is', null);

    // Demandes de résiliation en attente
    const { data: reqRows } = await supabase
      .from('membership_cancellation_requests')
      .select('id, reason_type, message, document_path, status, created_at, requester:profiles!membership_cancellation_requests_member_id_fkey(username)')
      .eq('box_id', box.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setCancelReqs((reqRows ?? []).map((r: any) => ({
      id: r.id, reason_type: r.reason_type, message: r.message,
      document_path: r.document_path, status: r.status, created_at: r.created_at,
      username: (Array.isArray(r.requester) ? r.requester[0] : r.requester)?.username ?? '?',
    })));

    // Achats de programmes
    const { data: programRows } = await supabase
      .from('program_members')
      .select('user_id, amount_cents, status, program:programs!inner(title, box_id), profile:profiles(username, email)')
      .eq('program.box_id', box.id);

    const memberships: Row[] = (memberRows ?? []).map((r: any, i: number) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      const plan = Array.isArray(r.plan) ? r.plan[0] : r.plan;
      return {
        key: `m-${r.member_id}-${i}`,
        kind: 'membership' as Kind,
        username: p?.username ?? '?',
        email: p?.email ?? '',
        label: plan?.name ?? 'Formule',
        color: plan?.color ?? '#FFFFFF',
        amountCents: r.amount_cents ?? plan?.price_cents ?? null,
        status: r.subscription_status ?? 'active',
        periodEnd: r.subscription_current_period_end ?? null,
        cancelAtPeriodEnd: !!r.subscription_cancel_at_period_end,
        boxMemberId: r.id ?? null,
        hasStripeSub: !!r.stripe_subscription_id,
        paused: !!r.subscription_paused,
        pauseResumesAt: r.pause_resumes_at ?? null,
        commitmentEndDate: r.commitment_end_date ?? null,
      };
    });

    const programs: Row[] = (programRows ?? []).map((r: any, i: number) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      const prog = Array.isArray(r.program) ? r.program[0] : r.program;
      return {
        key: `p-${r.user_id}-${i}`,
        kind: 'program' as Kind,
        username: p?.username ?? '?',
        email: p?.email ?? '',
        label: prog?.title ?? 'Programme',
        color: '#8B5CF6',
        amountCents: r.amount_cents ?? null,
        status: r.status ?? 'active',
        periodEnd: null,
        cancelAtPeriodEnd: false,
        boxMemberId: null,
        hasStripeSub: false,
        paused: false,
        pauseResumesAt: null,
        commitmentEndDate: null,
      };
    });

    setRows([...memberships, ...programs]);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function togglePause(r: Row) {
    if (!r.boxMemberId) return;
    setActionBusy(r.key); setActionError(null);
    try {
      const res = await fetch('/api/pause-membership', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_member_id: r.boxMemberId, action: r.paused ? 'resume' : 'pause' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionBusy(null);
    }
  }

  async function reviewRequest(id: string, action: 'approve' | 'reject') {
    let note: string | undefined;
    if (action === 'reject') {
      note = window.prompt('Motif du refus (optionnel) :') ?? undefined;
    }
    setActionBusy(`req-${id}`); setActionError(null);
    try {
      const res = await fetch('/api/cancellation-request/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionBusy(null);
    }
  }

  async function viewDoc(id: string) {
    try {
      const res = await fetch(`/api/cancellation-doc?request_id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      window.open(data.url, '_blank', 'noopener');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.kind !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.username.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.label.toLowerCase().includes(q);
  });

  const activeCount = rows.filter(r => r.status === 'active').length;
  const mrrCents = rows
    .filter(r => r.kind === 'membership' && r.status === 'active')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Abonnés</h1>
          <p className="text-sm text-gray-400 mt-1">Tous les membres qui paient (abonnements salle + programmes)</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Abonnements actifs</p>
          <p className="text-2xl font-black text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Revenu mensuel (salle)</p>
          <p className="text-2xl font-black text-white mt-1">{fmtPrice(mrrCents)}</p>
        </div>
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total lignes</p>
          <p className="text-2xl font-black text-white mt-1">{rows.length}</p>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm text-red-400">{actionError}</div>
      )}

      {/* Demandes de résiliation anticipée (motif légitime + justificatif) */}
      {cancelReqs.length > 0 && (
        <div className="bg-amber-500/[0.06] border border-amber-500/25 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-black text-amber-300">Demandes de résiliation ({cancelReqs.length})</p>
          {cancelReqs.map(req => (
            <div key={req.id} className="flex items-start justify-between gap-4 bg-black/20 border border-white/[0.06] rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">
                  {req.username}
                  <span className="ml-2 text-xs font-semibold text-amber-400">{REASON_LABEL[req.reason_type] ?? req.reason_type}</span>
                </p>
                {req.message && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{req.message}</p>}
                <p className="text-[10px] text-gray-600 mt-1">{fmtDate(req.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {req.document_path && (
                  <button onClick={() => viewDoc(req.id)}
                    className="flex items-center gap-1 text-xs font-bold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5">
                    <FileText size={13} /> Justificatif
                  </button>
                )}
                <button onClick={() => reviewRequest(req.id, 'approve')} disabled={actionBusy === `req-${req.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-2.5 py-1.5">
                  {actionBusy === `req-${req.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approuver
                </button>
                <button onClick={() => reviewRequest(req.id, 'reject')} disabled={actionBusy === `req-${req.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 rounded-lg px-2.5 py-1.5">
                  <X size={13} /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre, une formule…"
            className="w-full bg-[#111111] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30" />
        </div>
        {(['all', 'membership', 'program'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filter === f ? 'bg-white text-black' : 'bg-[#111111] border border-white/10 text-gray-400 hover:text-white'}`}>
            {f === 'all' ? 'Tout' : f === 'membership' ? 'Salle' : 'Programmes'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left">
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Membre</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Formule / Programme</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Prochaine échéance</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const st = STATUS_STYLE[r.status] ?? { label: r.status, color: '#9CA3AF' };
              return (
                <tr key={r.key} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{r.username}</p>
                    <p className="text-xs text-gray-500">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                      {r.kind === 'membership' ? <Users size={13} /> : <BookOpen size={13} />}
                      {r.kind === 'membership' ? 'Salle' : 'Programme'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-white font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-white">
                    {fmtPrice(r.amountCents)}{r.kind === 'membership' && <span className="text-[10px] text-gray-500 font-semibold">/mois</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ color: st.color, backgroundColor: `${st.color}18` }}>
                      {st.label}
                    </span>
                    {r.paused && (
                      <span className="block mt-1 text-[10px] font-semibold text-sky-400">En pause</span>
                    )}
                    {r.cancelAtPeriodEnd && (
                      <span className="block mt-1 text-[10px] font-semibold text-amber-400">Résiliation prévue</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {fmtDate(r.periodEnd)}
                    {r.cancelAtPeriodEnd && r.periodEnd && (
                      <span className="block text-[10px] text-amber-400/80">fin d'abonnement</span>
                    )}
                    {!r.cancelAtPeriodEnd && r.commitmentEndDate && new Date(r.commitmentEndDate) > new Date() && (
                      <span className="block text-[10px] text-amber-400/80">engagé jusqu'au {fmtDate(r.commitmentEndDate)}</span>
                    )}
                    {r.paused && r.pauseResumesAt && (
                      <span className="block text-[10px] text-sky-400/80">reprise le {fmtDate(r.pauseResumesAt)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.kind === 'membership' && r.hasStripeSub && r.status !== 'cancelled' && (
                      <button onClick={() => togglePause(r)} disabled={actionBusy === r.key}
                        className={`inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 disabled:opacity-50 ${r.paused ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-sky-400 bg-sky-500/10 hover:bg-sky-500/20'}`}>
                        {actionBusy === r.key ? <Loader2 size={13} className="animate-spin" /> : r.paused ? <Play size={13} /> : <Pause size={13} />}
                        {r.paused ? 'Reprendre' : 'Geler'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-600">
                <CreditCard size={22} className="mx-auto mb-2 text-gray-700" />
                Aucun abonné pour l'instant.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
