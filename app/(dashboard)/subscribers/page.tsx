'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import HelpButton from '@/components/help/HelpButton';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Search, Users, BookOpen, Pause, Play, FileText, Check, X, ChevronDown, ChevronRight, ExternalLink, Banknote } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { getMemberEmails } from '@/lib/memberEmails';
import UnpaidPanel from '@/components/UnpaidPanel';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

const INPUT_CLS = 'w-full min-h-11 px-3 py-2.5 rounded-ax-control bg-ax-surface border border-ax-input-border text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface transition-colors';

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
  memberId: string | null;
  boxMemberId: string | null;
  hasStripeSub: boolean;
  paused: boolean;
  pauseResumesAt: string | null;
  commitmentEndDate: string | null;
  joinedAt: string | null;
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

// Même sens qu'avant (actif vert, impayé orange, annulé/remboursé rouge, autre
// statut gris), en jetons lisibles dans les deux thèmes ; le libellé porte le sens.
type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';
const STATUS_STYLE: Record<string, { label: string; variant: StatusVariant }> = {
  active:    { label: 'Actif',    variant: 'success' },
  past_due:  { label: 'Impayé',   variant: 'warning' },
  cancelled: { label: 'Annulé',   variant: 'danger' },
  refunded:  { label: 'Remboursé', variant: 'danger' },
};

function fmtPrice(cents: number | null) {
  if (!cents) return '—';
  return `${(cents / 100).toFixed(2)} €`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Une ligne de `get_box_billing` : l'abonnement nominatif, servi au gérant. */
interface BillingRow {
  id: string | null;
  member_id: string | null;
  role: string | null;
  status: string | null;
  joined_at: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
  subscription_paused: boolean | null;
  pause_resumes_at: string | null;
  commitment_end_date: string | null;
  amount_cents: number | null;
  has_stripe_sub: boolean | null;
}

/** Une ligne du journal comptoir : montant réellement encaissé en espèces. */
interface CashPaymentRow {
  id: string;
  member_id: string | null;
  amount_cents: number;
  collected_at: string;
  plan_name: string | null;
  source: string;
}

interface InvoiceRow {
  id: string;
  number: string | null;
  month: string;
  created: string;
  amount_paid_cents: number;
  amount_due_cents: number;
  status: string | null;
  url: string | null;
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: 'Payée',
  open: 'En attente',
  void: 'Annulée',
  uncollectible: 'Irrécouvrable',
  draft: 'Brouillon',
};

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fmtMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function SubscribersPage() {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const [cancelReqs, setCancelReqs] = useState<CancelRequest[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);
  // Factures Stripe par box_member : montant réellement prélevé (prorata inclus).
  const [invoices, setInvoices] = useState<Record<string, InvoiceRow[]>>({});
  // Journal comptoir par membre : l'équivalent des factures pour les espèces.
  const [cashPayments, setCashPayments] = useState<Record<string, CashPaymentRow[]>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const load = useCallback(async ({ silent }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase);
    if (!box) { router.push('/login'); return; }
    setBoxId(box.id);

    // Abonnements de salle (formules payantes). Les colonnes nominatives
    // d'abonnement ne sont plus lisibles directement (lot 6) : `get_box_billing`
    // les sert au gérant et au co-gérant, et refuse les autres en le disant.
    const { data: billingRaw, error: billingError } = await supabase.rpc('get_box_billing', { p_box_id: box.id });
    if (billingError) setActionError(`Abonnements indisponibles : ${billingError.message}`);
    const memberRows = ((billingRaw ?? []) as BillingRow[]).filter((b) => b.subscription_status != null);

    const planIds = Array.from(new Set(memberRows.map((b) => b.plan_id).filter((id): id is string => !!id)));
    const planById: Record<string, { name: string | null; color: string | null; price_cents: number | null }> = {};
    if (planIds.length > 0) {
      const { data: planRows } = await supabase
        .from('membership_plans').select('id, name, color, price_cents').in('id', planIds);
      for (const p of planRows ?? []) planById[p.id] = { name: p.name, color: p.color, price_cents: p.price_cents };
    }

    const subscriberIds = Array.from(new Set(memberRows.map((b) => b.member_id).filter((id): id is string => !!id)));
    const usernameById: Record<string, string | null> = {};
    if (subscriberIds.length > 0) {
      const { data: subProfiles } = await supabase
        .from('profiles').select('id, username').in('id', subscriberIds);
      for (const p of subProfiles ?? []) usernameById[p.id] = p.username;
    }

    // `profiles.email` n'est plus lisible par `authenticated` (Phase 3) : les
    // e-mails des adhérents viennent de la RPC réservée aux admins de la box.
    const memberEmails = await getMemberEmails(supabase, box.id);

    const { data: cashRows, error: cashError } = await supabase
      .from('box_cash_payments')
      .select('id, member_id, amount_cents, collected_at, plan_name, source')
      .eq('box_id', box.id)
      .order('collected_at', { ascending: false });
    if (cashError) setActionError(`Encaissements comptoir indisponibles : ${cashError.message}`);
    const cashByMember: Record<string, CashPaymentRow[]> = {};
    for (const c of (cashRows ?? []) as CashPaymentRow[]) {
      if (!c.member_id) continue;
      (cashByMember[c.member_id] ??= []).push(c);
    }
    setCashPayments(cashByMember);

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

    // Achats de programmes. `program_members.user_id` référence auth.users et non
    // profiles : PostgREST refuse l'embed, donc les acheteurs sont résolus par une
    // seconde requête sur profiles.
    const { data: programRows, error: programError } = await supabase
      .from('program_members')
      .select('user_id, purchased_at, amount_cents, status, program:programs!inner(title, box_id)')
      .eq('program.box_id', box.id);
    if (programError) setActionError(`Achats de programmes indisponibles : ${programError.message}`);

    const buyerIds = Array.from(new Set((programRows ?? []).map((r) => (r as { user_id: string }).user_id)));
    const buyerById: Record<string, { username: string | null; email: string | null }> = {};
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase
        .from('profiles').select('id, username').in('id', buyerIds);
      for (const b of (buyers ?? []) as { id: string; username: string | null }[]) {
        buyerById[b.id] = { username: b.username, email: memberEmails.get(b.id) ?? null };
      }
    }

    const memberships: Row[] = memberRows.map((r, i) => {
      const plan = r.plan_id ? planById[r.plan_id] : null;
      return {
        key: `m-${r.member_id}-${i}`,
        kind: 'membership' as Kind,
        username: (r.member_id ? usernameById[r.member_id] : null) ?? '?',
        email: (r.member_id ? memberEmails.get(r.member_id) : null) ?? '',
        label: plan?.name ?? 'Formule',
        color: plan?.color ?? '#FFFFFF',
        amountCents: r.amount_cents ?? plan?.price_cents ?? null,
        status: r.subscription_status ?? 'active',
        periodEnd: r.subscription_current_period_end ?? null,
        cancelAtPeriodEnd: !!r.subscription_cancel_at_period_end,
        memberId: r.member_id ?? null,
        boxMemberId: r.id ?? null,
        hasStripeSub: !!r.has_stripe_sub,
        paused: !!r.subscription_paused,
        pauseResumesAt: r.pause_resumes_at ?? null,
        commitmentEndDate: r.commitment_end_date ?? null,
        joinedAt: r.joined_at ?? null,
      };
    });

    const programs: Row[] = (programRows ?? []).map((r: any, i: number) => {
      const p = buyerById[r.user_id];
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
        memberId: r.user_id ?? null,
        boxMemberId: null,
        hasStripeSub: false,
        paused: false,
        pauseResumesAt: null,
        commitmentEndDate: null,
        joinedAt: r.purchased_at ?? null,
      };
    });

    setRows([...memberships, ...programs]);
    setLoading(false);

    // Facturation réelle : lecture Stripe côté serveur, en arrière-plan pour
    // ne pas retarder l'affichage du tableau.
    fetch(`/api/subscriber-invoices?box_id=${box.id}`)
      .then(res => res.ok ? res.json() : { invoices: {} })
      .then(data => setInvoices(data.invoices ?? {}))
      .catch(() => {});
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

  // Échéance comptoir : le montant n'est pas envoyé, la RPC le lit sur la
  // formule du membre et écrit une ligne au journal (en ajout seul).
  function askCashPayment(r: Row) {
    if (!r.boxMemberId) return;
    ask({
      title: 'Enregistrer un paiement au comptoir ?',
      element: `${r.username} · ${r.label}`,
      body: `Le paiement, au prix de la formule, s’ajoute au journal des encaissements et ne pourra plus être modifié ni supprimé. L’adhésion de ${r.username} repasse en « actif ».`,
      confirmLabel: 'Enregistrer le paiement',
      run: () => recordCashPayment(r),
    });
  }

  async function recordCashPayment(r: Row) {
    if (!r.boxMemberId) return;
    setActionBusy(r.key); setActionError(null);
    const { error } = await supabase.rpc('record_member_cash_payment', { p_box_member_id: r.boxMemberId });
    if (error) setActionError(error.message);
    else await load({ silent: true });
    setActionBusy(null);
  }

  // Refus avec motif facultatif, approbation confirmée : « Annuler » n'envoie
  // jamais rien (le `prompt` natif envoyait le refus même annulé).
  function askReview(req: CancelRequest, action: 'approve' | 'reject') {
    ask(action === 'approve'
      ? {
          title: 'Approuver la résiliation ?',
          element: `${req.username} · demande du ${fmtDate(req.created_at)}`,
          body: 'L’abonnement Stripe s’arrêtera à la fin de la période en cours et l’engagement sera effacé. Tu ne pourras pas revenir en arrière depuis l’application.',
          confirmLabel: 'Approuver la résiliation',
          danger: true,
          run: () => reviewRequest(req.id, 'approve'),
        }
      : {
          title: 'Refuser la demande de résiliation ?',
          element: `${req.username} · ${REASON_LABEL[req.reason_type] ?? req.reason_type} · envoyée le ${fmtDate(req.created_at)}`,
          body: 'Son abonnement et son engagement restent inchangés.',
          field: { label: 'Motif du refus (facultatif)' },
          confirmLabel: 'Refuser la demande',
          run: note => reviewRequest(req.id, 'reject', note),
        });
  }

  async function reviewRequest(id: string, action: 'approve' | 'reject', note?: string) {
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

  // Anciens membres : abonnement résilié / remboursé → tableau séparé pour ne
  // pas polluer la liste des abonnés en cours.
  const isFormer = (r: Row) => r.status === 'cancelled' || r.status === 'refunded';
  const current = filtered.filter(r => !isFormer(r));
  const former = filtered.filter(isFormer);

  const memberInvoices = (r: Row) => (r.boxMemberId ? invoices[r.boxMemberId] ?? [] : []);
  const memberCash = (r: Row) => (r.memberId ? cashPayments[r.memberId] ?? [] : []);

  const activeCount = rows.filter(r => r.status === 'active').length;
  const mrrCents = rows
    .filter(r => r.kind === 'membership' && r.status === 'active')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-ax-text-muted" />{dialog}</div>;
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Abonnés</h1>
            <HelpButton />
          </div>
          <p className="text-sm text-ax-text-secondary mt-1">Tous les membres qui paient (abonnements salle + programmes)</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-4">
          <p className="text-xs text-ax-text-muted font-bold uppercase tracking-wider">Abonnements actifs</p>
          <p className="text-2xl font-black text-ax-text mt-1">{activeCount}</p>
        </div>
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-4">
          <p className="text-xs text-ax-text-muted font-bold uppercase tracking-wider">Revenu mensuel (salle)</p>
          <p className="text-2xl font-black text-ax-text mt-1">{fmtPrice(mrrCents)}</p>
        </div>
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-4">
          <p className="text-xs text-ax-text-muted font-bold uppercase tracking-wider">Total lignes</p>
          <p className="text-2xl font-black text-ax-text mt-1">{rows.length}</p>
        </div>
      </div>

      {actionError && (
        <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-2.5 text-sm text-ax-danger">{actionError}</div>
      )}

      {/* Impayés : relance, encaissement, suspension des droits */}
      {boxId && <UnpaidPanel boxId={boxId} onChange={() => load({ silent: true })} />}

      {/* Demandes de résiliation anticipée (motif légitime + justificatif) */}
      {cancelReqs.length > 0 && (
        <div className="bg-ax-warning-soft border border-ax-warning rounded-ax-card p-4 space-y-3">
          <p className="text-sm font-black text-ax-warning">Demandes de résiliation ({cancelReqs.length})</p>
          {cancelReqs.map(req => (
            <div key={req.id} className="flex flex-wrap items-start justify-between gap-4 bg-ax-surface border border-ax-border rounded-ax-control p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ax-text break-words">
                  {req.username}
                  <span className="ml-2 text-xs font-semibold text-ax-warning">{REASON_LABEL[req.reason_type] ?? req.reason_type}</span>
                </p>
                {req.message && <p className="text-xs text-ax-text-secondary mt-1 whitespace-pre-wrap break-words">{req.message}</p>}
                <p className="text-[10px] text-ax-text-muted mt-1">{fmtDate(req.created_at)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {req.document_path && (
                  <button onClick={() => viewDoc(req.id)}
                    className="flex items-center gap-1 text-xs font-bold text-ax-text-secondary bg-ax-surface-secondary hover:bg-ax-hover rounded-ax-control px-2.5 py-1.5">
                    <FileText size={13} /> Justificatif
                  </button>
                )}
                <button onClick={() => askReview(req, 'approve')} disabled={actionBusy === `req-${req.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-ax-accent-foreground bg-ax-accent border border-ax-accent hover:brightness-110 disabled:opacity-50 rounded-ax-control px-2.5 py-1.5">
                  {actionBusy === `req-${req.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approuver
                </button>
                <button onClick={() => askReview(req, 'reject')} disabled={actionBusy === `req-${req.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-ax-danger bg-ax-danger-soft hover:brightness-110 disabled:opacity-50 rounded-ax-control px-2.5 py-1.5">
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
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre, une formule…"
            className={`${INPUT_CLS} pl-9`} />
        </div>
        {(['all', 'membership', 'program'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`px-3 py-2 rounded-ax-control text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${filter === f ? 'bg-ax-text text-ax-background' : 'bg-ax-surface border border-ax-border text-ax-text-secondary hover:text-ax-text'}`}>
            {f === 'all' ? 'Tout' : f === 'membership' ? 'Salle' : 'Programmes'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-ax-surface border border-ax-border rounded-ax-card overflow-x-auto" data-testid="tableau-abonnes">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-ax-border text-left">
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Membre</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Formule / Programme</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Inscrit le</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Montant</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Prochaine échéance</th>
              <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {current.map(r => {
              const st = STATUS_STYLE[r.status] ?? { label: r.status, variant: 'neutral' as StatusVariant };
              const history = memberInvoices(r);
              const cash = memberCash(r);
              const historyOpen = openHistory === r.key;
              const isCashMember = r.kind === 'membership' && !r.hasStripeSub;
              return (
                <Fragment key={r.key}>
                <tr className="border-b border-ax-border hover:bg-ax-hover">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ax-text break-words min-w-[10rem]">{r.username}</p>
                    <p className="text-xs text-ax-text-muted [overflow-wrap:anywhere]">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ax-text-secondary">
                      {r.kind === 'membership' ? <Users size={13} /> : <BookOpen size={13} />}
                      {r.kind === 'membership' ? 'Salle' : 'Programme'}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[11rem]">
                    <span className="inline-flex items-center gap-2 text-ax-text font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-ax-border" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ax-text-secondary whitespace-nowrap">{fmtDate(r.joinedAt)}</td>
                  <td className="px-4 py-3 font-bold text-ax-text whitespace-nowrap">
                    {fmtPrice(r.amountCents)}{r.kind === 'membership' && <span className="text-[10px] text-ax-text-muted font-semibold">/mois</span>}
                    {(() => {
                      const thisMonth = memberInvoices(r).find(i => i.month === currentMonthKey());
                      return !thisMonth ? null : (
                        <span className="block text-[10px] font-semibold text-ax-info">
                          facturé ce mois : {fmtPrice(thisMonth.amount_due_cents)}
                          {thisMonth.status !== 'paid' && ` (${INVOICE_STATUS_LABEL[thisMonth.status ?? ''] ?? thisMonth.status})`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={st.variant} className="font-bold">
                      {st.label}
                    </Badge>
                    {r.paused && (
                      <span className="block mt-1 text-[10px] font-semibold text-ax-info">En pause</span>
                    )}
                    {r.cancelAtPeriodEnd && (
                      <span className="block mt-1 text-[10px] font-semibold text-ax-warning">Résiliation prévue</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ax-text-secondary min-w-[8rem]">
                    {fmtDate(r.periodEnd)}
                    {r.cancelAtPeriodEnd && r.periodEnd && (
                      <span className="block text-[10px] text-ax-warning">fin d'abonnement</span>
                    )}
                    {!r.cancelAtPeriodEnd && r.commitmentEndDate && new Date(r.commitmentEndDate) > new Date() && (
                      <span className="block text-[10px] text-ax-warning">engagé jusqu'au {fmtDate(r.commitmentEndDate)}</span>
                    )}
                    {r.paused && r.pauseResumesAt && (
                      <span className="block text-[10px] text-ax-info">reprise le {fmtDate(r.pauseResumesAt)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-[10rem]">
                    <div className="flex flex-wrap justify-end gap-2">
                    {(history.length > 0 || cash.length > 0) && (
                      <button onClick={() => setOpenHistory(historyOpen ? null : r.key)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-ax-text-secondary bg-ax-surface-secondary hover:bg-ax-hover rounded-ax-control px-2.5 py-1.5">
                        {historyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {history.length > 0 ? 'Factures' : 'Encaissements'}
                      </button>
                    )}
                    {isCashMember && r.status !== 'cancelled' && (
                      <button onClick={() => askCashPayment(r)} disabled={actionBusy === r.key}
                        className="inline-flex items-center gap-1 text-xs font-bold text-ax-warning bg-ax-warning-soft hover:brightness-110 rounded-ax-control px-2.5 py-1.5 disabled:opacity-50">
                        {actionBusy === r.key ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />}
                        Encaissement reçu
                      </button>
                    )}
                    {r.kind === 'membership' && r.hasStripeSub && r.status !== 'cancelled' && (
                      <button onClick={() => togglePause(r)} disabled={actionBusy === r.key}
                        className={`inline-flex items-center gap-1 text-xs font-bold rounded-ax-control px-2.5 py-1.5 disabled:opacity-50 ${r.paused ? 'text-ax-success bg-ax-success-soft hover:brightness-110' : 'text-ax-info bg-ax-info-soft hover:brightness-110'}`}>
                        {actionBusy === r.key ? <Loader2 size={13} className="animate-spin" /> : r.paused ? <Play size={13} /> : <Pause size={13} />}
                        {r.paused ? 'Reprendre' : 'Geler'}
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
                {historyOpen && (
                  <tr className="border-b border-ax-border bg-ax-surface-secondary">
                    <td colSpan={8} className="px-4 py-3">
                      <p className="text-xs font-bold text-ax-text-secondary mb-2">
                        {history.length > 0
                          ? 'Historique de facturation (montants réellement prélevés)'
                          : 'Encaissements au comptoir (journal, non modifiable)'}
                      </p>
                      <div className="space-y-1">
                        {cash.map(c => (
                          <div key={c.id} className="flex items-center gap-3 text-xs">
                            <span className="w-32 text-ax-text-secondary capitalize">{fmtMonth(c.collected_at.slice(0, 7))}</span>
                            <span className="w-24 font-bold text-ax-text">{fmtPrice(c.amount_cents)}</span>
                            <span className="text-ax-warning">
                              {c.source === 'invitation' ? 'Comptoir · 1re échéance' : 'Comptoir'}
                            </span>
                            <span className="text-ax-text-muted">{fmtDate(c.collected_at)}</span>
                            {c.plan_name && <span className="text-ax-text-muted">{c.plan_name}</span>}
                          </div>
                        ))}
                        {history.map(inv => (
                          <div key={inv.id} className="flex items-center gap-3 text-xs">
                            <span className="w-32 text-ax-text-secondary capitalize">{fmtMonth(inv.month)}</span>
                            <span className="w-24 font-bold text-ax-text">{fmtPrice(inv.amount_due_cents)}</span>
                            <span className={inv.status === 'paid' ? 'text-ax-success' : 'text-ax-warning'}>
                              {INVOICE_STATUS_LABEL[inv.status ?? ''] ?? inv.status}
                            </span>
                            <span className="text-ax-text-muted">{fmtDate(inv.created)}</span>
                            {inv.url && (
                              <a href={inv.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-ax-text-secondary hover:text-ax-text">
                                <ExternalLink size={12} /> {inv.number ?? 'Facture'}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {current.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-ax-text-muted">
                <CreditCard size={22} className="mx-auto mb-2 text-ax-text-muted" />
                Aucun abonné pour l'instant.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Anciens membres : abonnements résiliés ou remboursés */}
      {former.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-black text-ax-text-secondary">Anciens membres ({former.length})</p>
          <div className="bg-ax-surface border border-ax-border rounded-ax-card overflow-x-auto" data-testid="tableau-anciens">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-ax-border text-left">
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Membre</th>
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Formule / Programme</th>
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Inscrit le</th>
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Montant</th>
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-xs font-bold text-ax-text-muted uppercase tracking-wider">Fin d'abonnement</th>
                </tr>
              </thead>
              <tbody>
                {former.map(r => {
                  const st = STATUS_STYLE[r.status] ?? { label: r.status, variant: 'neutral' as StatusVariant };
                  return (
                    <tr key={r.key} className="border-b border-ax-border hover:bg-ax-hover">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ax-text-secondary break-words min-w-[10rem]">{r.username}</p>
                        <p className="text-xs text-ax-text-muted [overflow-wrap:anywhere]">{r.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ax-text-muted">
                          {r.kind === 'membership' ? <Users size={13} /> : <BookOpen size={13} />}
                          {r.kind === 'membership' ? 'Salle' : 'Programme'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-ax-text-secondary font-semibold">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-ax-border" style={{ backgroundColor: r.color }} />
                          {r.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ax-text-muted">{fmtDate(r.joinedAt)}</td>
                      <td className="px-4 py-3 font-bold text-ax-text-secondary">{fmtPrice(r.amountCents)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant} className="font-bold">
                          {st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-ax-text-muted">{fmtDate(r.periodEnd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
