'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Settings2, XCircle, FileUp, PauseCircle, FileText, CreditCard, CalendarClock,
  AlertTriangle, Clock, Send, ExternalLink,
} from 'lucide-react';
import { entryRefusalFrom, entryRefusalInfo } from '@/lib/entryRefusalView';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';
import { parisDate } from '@/lib/datetime';
import { planChangeDoneMessage } from '@/lib/membership/planChange';
import {
  COUNTER_NOTE, COUNTER_REQUEST_NOTICE, PAST_DUE_CHANGE_NOTE, cancelPlanChange, compteActions,
  effectiveDateNotice, euros, pastDueNotice, paymentPortalUrl, pendingRequestNotice, scheduledChangeNotice,
  type MembershipOverview,
} from '@/lib/membership/screens';

interface Props {
  /** « Mon abonnement » : la lecture serveur de /api/membership/overview. */
  overview: MembershipOverview;
  /** Début de l'impayé (get_my_membership_billing), pour l'encart. */
  pastDueSince?: string | null;
  boxId: string;
  commitmentEndDate: string | null;
  cancelAtPeriodEnd?: boolean;
  periodEnd?: string | null;
  paused: boolean;
  pauseResumesAt: string | null;
  termsPdfUrl?: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return parisDate(iso, { day: '2-digit', month: 'long', year: 'numeric' });
}

const REASONS = [
  { value: 'moving', label: 'Déménagement' },
  { value: 'medical', label: 'Santé / blessure grave' },
  { value: 'other', label: 'Autre motif' },
] as const;

const BTN = 'flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition-all';
const BTN_GREY = `${BTN} text-gray-300 bg-white/5 hover:bg-white/10`;
const BTN_WHITE = `${BTN} text-[#0A0A0A] bg-white hover:bg-gray-100`;
const BTN_RED = `${BTN} text-red-400 bg-red-500/10 hover:bg-red-500/20`;
const BTN_GREEN = 'flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all';
const BTN_GHOST = 'px-3 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all';

/**
 * Choix de la formule (maquettes « Changer de formule » et « Demander un
 * changement ») : formules proposables, encart de date d'effet, actions.
 */
export function PlanChoice({
  overview, planId, onPick, onConfirm, onCancel, loading, error,
}: {
  overview: MembershipOverview;
  planId: string;
  onPick: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const online = overview.mode === 'online';
  const choisie = overview.available_plans.find(p => p.id === planId) ?? null;
  return (
    <div className="space-y-3" data-testid="choix-formule">
      <p className="text-xs text-gray-400 font-semibold">
        {online ? 'Nouvelle formule — à partir de ta prochaine échéance' : 'Formule demandée à ta box'}
      </p>
      <div className="grid gap-2" role="radiogroup">
        {overview.available_plans.map(p => (
          <label key={p.id} className={`flex items-center justify-between gap-3 border rounded-xl px-3 py-2.5 cursor-pointer transition-all ${planId === p.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}>
            <span className="flex items-center gap-2 min-w-0">
              <input type="radio" name="plan" checked={planId === p.id} onChange={() => onPick(p.id)} className="accent-emerald-500" />
              <span className="text-sm text-white font-semibold break-words">{p.name}</span>
            </span>
            <span className="text-sm font-black text-white whitespace-nowrap">{euros(p.price_cents)}<span className="text-[10px] font-normal text-gray-500"> /mois</span></span>
          </label>
        ))}
      </div>
      <p className="rounded-xl bg-white/5 px-3 py-2.5 text-xs text-gray-400" data-testid="encart-date-effet">
        {online
          ? (choisie ? effectiveDateNotice(overview, choisie) : 'Aucun prorata, rien n’est facturé aujourd’hui.')
          : COUNTER_REQUEST_NOTICE}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={onConfirm} disabled={loading || !choisie} className={BTN_GREEN}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : !online && <Send size={13} />}
          {online ? 'Confirmer le changement' : 'Envoyer ma demande'}
        </button>
        <button onClick={onCancel} className={BTN_GHOST}>Annuler</button>
      </div>
    </div>
  );
}

export default function ManageSubscription({
  overview, pastDueSince = null, boxId, commitmentEndDate, cancelAtPeriodEnd = false, periodEnd = null,
  paused, pauseResumesAt, termsPdfUrl = null,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'change' | 'cancel' | 'request'>(null);
  const [planId, setPlanId] = useState(overview.available_plans[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Refus de box fermée (archivage) et confirmations : la boîte de l'application.
  const { dialog, ask, inform } = useConfirmDialog();

  // Demande de résiliation anticipée
  const [reasonType, setReasonType] = useState<string>('moving');
  const [reqMessage, setReqMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const online = overview.mode === 'online';
  const actions = compteActions(overview);
  const engaged = !!commitmentEndDate && new Date(commitmentEndDate) > new Date();
  const pastDue = overview.block_reason === 'past_due';

  async function handleChange() {
    if (!planId) { setError('Choisis une formule.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/change-membership-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_plan_id: planId }),
      });
      const data = await res.json();
      const refusal = entryRefusalFrom(data);
      if (refusal) { setLoading(false); void inform(entryRefusalInfo(refusal)); return; }
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setMessage(planChangeDoneMessage(data));
      setMode(null);
      setLoading(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  }

  // Annuler le changement programmé (en ligne) ou la demande en attente (comptoir) :
  // une seule route, confirmée par la boîte.
  function askCancelPlanChange() {
    const ligne = overview.scheduled_change ?? overview.pending_request;
    ask(online
      ? {
          title: 'Annuler le changement de formule ?',
          element: ligne?.plan.name,
          body: `Tu gardes ${overview.plan?.name ?? 'ta formule actuelle'} : ton abonnement continue sans changement.`,
          confirmLabel: 'Annuler ce changement',
          cancelLabel: 'Retour',
          run: runCancelPlanChange,
        }
      : {
          title: 'Annuler ta demande ?',
          element: ligne?.plan.name,
          body: 'Ta box ne la traitera pas. Tu pourras en envoyer une autre.',
          confirmLabel: 'Annuler ma demande',
          cancelLabel: 'Retour',
          run: runCancelPlanChange,
        });
  }

  async function runCancelPlanChange() {
    try {
      await cancelPlanChange();
      setMessage(online ? 'Changement annulé : tu gardes ta formule.' : 'Demande annulée.');
      router.refresh();
    } catch (e) {
      void inform({ kind: 'error', title: ERROR_TITLE, body: e instanceof Error ? e.message : 'Erreur' });
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    try {
      window.location.href = await paymentPortalUrl();
    } catch (e) {
      setPortalBusy(false);
      void inform({ kind: 'error', title: ERROR_TITLE, body: e instanceof Error ? e.message : 'Erreur' });
    }
  }

  async function handleCancel() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/cancel-membership', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // Engagement encore actif → bascule vers la demande sur justificatif.
        if (data.error === 'ENGAGEMENT_ACTIVE') {
          setMode('request');
          setLoading(false);
          return;
        }
        throw new Error(data.error ?? 'Erreur');
      }
      setMessage('Ton abonnement sera résilié à la fin de la période en cours. La page se recharge…');
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  }

  async function handleRequest() {
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('box_id', boxId);
      fd.append('reason_type', reasonType);
      if (reqMessage.trim()) fd.append('message', reqMessage.trim());
      if (file) fd.append('document', file);
      const res = await fetch('/api/cancellation-request', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setMessage('Ta demande de résiliation a été envoyée à ta box. Tu seras notifié·e de la décision.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  }

  const paymentButton = actions.payment && (
    <button onClick={openPortal} disabled={portalBusy} className={actions.payment === 'update' ? BTN_WHITE : BTN_GREY}>
      {portalBusy ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
      {actions.payment === 'update' ? 'Mettre à jour mon paiement' : 'Gérer mon paiement'}
    </button>
  );
  const changeButton = actions.change && (
    <button
      onClick={() => setMode('change')}
      disabled={actions.change === 'disabled'}
      aria-describedby={actions.change === 'disabled' ? 'changement-indisponible' : undefined}
      className={`${BTN_GREY} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5`}
    >
      <Settings2 size={13} /> Changer de formule
    </button>
  );
  const resilierButton = online && !cancelAtPeriodEnd && (
    <button onClick={() => setMode(engaged ? 'request' : 'cancel')} className={BTN_RED}>
      <XCircle size={13} /> {engaged ? 'Demander une résiliation' : 'Résilier'}
    </button>
  );

  return (
    <div className="pt-3 border-t border-white/[0.06] space-y-3" data-testid="gestion-abonnement">
      {dialog}
      {online && paused && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
          <PauseCircle size={13} /> Abonnement en pause{pauseResumesAt ? ` — reprise le ${fmtDate(pauseResumesAt)}` : ''}. Contacte ta box pour le réactiver.
        </div>
      )}
      {online && engaged && (
        <p className="text-[11px] text-amber-400/90 font-semibold">
          Engagement jusqu&apos;au {fmtDate(commitmentEndDate)}.
        </p>
      )}
      {online && termsPdfUrl && (
        <a
          href={termsPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <FileText size={12} /> Conditions générales de ma box (PDF)
        </a>
      )}

      {online && cancelAtPeriodEnd && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400" data-testid="resiliation-programmee">
          <XCircle size={13} /> Résiliation programmée{periodEnd ? ` le ${fmtDate(periodEnd)}` : ''}. Tu gardes l'accès jusque-là ; aucun prélèvement ensuite.
        </p>
      )}

      {message && <p className="text-xs text-emerald-400 font-semibold" role="status">{message}</p>}

      {mode === null ? (
        <>
          {online && overview.scheduled_change && (
            <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-400" data-testid="changement-programme">
              <CalendarClock size={14} className="mt-px shrink-0" /> {scheduledChangeNotice(overview)}
            </p>
          )}
          {online && pastDue && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400" data-testid="encart-impaye">
              <AlertTriangle size={14} className="mt-px shrink-0" /> {pastDueNotice(pastDueSince)}
            </p>
          )}
          {!online && overview.pending_request && (
            <p className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-gray-300" data-testid="demande-envoyee">
              <Clock size={14} className="mt-px shrink-0" /> {pendingRequestNotice(overview)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {actions.cancelScheduled && (
              <button onClick={askCancelPlanChange} className={BTN_GREY}>Annuler ce changement</button>
            )}
            {pastDue ? <>{paymentButton}{changeButton}</> : <>{changeButton}{paymentButton}</>}
            {actions.request && (
              <button onClick={() => setMode('change')} className={BTN_GREY}>
                <Settings2 size={13} /> Demander un changement de formule
              </button>
            )}
            {actions.cancelRequest && (
              <button onClick={askCancelPlanChange} className={BTN_GREY}>Annuler ma demande</button>
            )}
            {resilierButton}
          </div>

          {actions.payInvoice && overview.unpaid_invoice_url && (
            <a
              href={overview.unpaid_invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300"
            >
              <ExternalLink size={12} /> Régler la facture en attente
            </a>
          )}
          {actions.change === 'disabled' && (
            <p id="changement-indisponible" className="text-[11px] text-gray-500">{PAST_DUE_CHANGE_NOTE}</p>
          )}
          {actions.request && <p className="text-[11px] text-gray-500">{COUNTER_NOTE}</p>}
        </>
      ) : mode === 'change' ? (
        <PlanChoice
          overview={overview}
          planId={planId}
          onPick={setPlanId}
          onConfirm={handleChange}
          onCancel={() => { setMode(null); setError(null); }}
          loading={loading}
          error={error}
        />
      ) : mode === 'cancel' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Ton abonnement restera actif jusqu&apos;à la fin de la période déjà payée, puis sera résilié. Tu ne seras plus prélevé.</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCancel} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all">
              {loading && <Loader2 size={13} className="animate-spin" />} Confirmer la résiliation
            </button>
            <button onClick={() => { setMode(null); setError(null); }} className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all">Retour</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            {engaged
              ? `Ton abonnement est engagé jusqu'au ${fmtDate(commitmentEndDate)}. Une résiliation anticipée n'est possible que pour un motif légitime (déménagement, problème de santé grave), sur justificatif. Ta box étudiera la demande.`
              : 'Décris le motif de ta demande de résiliation. Tu peux joindre un justificatif.'}
          </p>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">Motif</label>
            <select value={reasonType} onChange={e => setReasonType(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">Message (optionnel)</label>
            <textarea value={reqMessage} onChange={e => setReqMessage(e.target.value)} rows={3}
              placeholder="Explique brièvement ta situation…"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">Justificatif (PDF ou image, max 10 Mo)</label>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 cursor-pointer transition-all w-fit">
              <FileUp size={14} /> {file ? file.name : 'Choisir un fichier'}
              <input type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleRequest} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all">
              {loading && <Loader2 size={13} className="animate-spin" />} Envoyer la demande
            </button>
            <button onClick={() => { setMode(null); setError(null); }} className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all">Retour</button>
          </div>
        </div>
      )}
    </div>
  );
}
