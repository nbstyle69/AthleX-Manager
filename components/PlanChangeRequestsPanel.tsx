'use client';

import { Check, Loader2, X } from 'lucide-react';
import { parisDate } from '@/lib/datetime';

export interface PlanChangeRequest {
  id: string;
  username: string;
  fromPlan: string | null;
  toPlan: string;
  createdAt: string;
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';

/**
 * Abonnés : demandes de changement de formule des membres au comptoir
 * (maquette 36:12917), entre les demandes de résiliation et les filtres.
 * Rien quand la liste est vide. Sous 640 px, le détail et les actions
 * s'empilent ; les actions restent visibles, sans survol.
 */
export default function PlanChangeRequestsPanel({
  requests, busyId, onDecide,
}: {
  requests: PlanChangeRequest[];
  busyId: string | null;
  onDecide: (req: PlanChangeRequest, accept: boolean) => void;
}) {
  if (requests.length === 0) return null;
  return (
    <section className="bg-ax-warning-soft border border-ax-warning rounded-ax-card p-4 space-y-3" data-testid="demandes-changement-formule">
      <h2 className="text-sm font-black text-ax-warning">Demandes de changement de formule ({requests.length})</h2>
      {requests.map(req => {
        const busy = busyId === req.id;
        return (
          <div key={req.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between bg-ax-surface border border-ax-border rounded-ax-control p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ax-text break-words">
                {req.username}<span className="ml-2">{req.fromPlan ?? 'Sans formule'} → {req.toPlan}</span>
              </p>
              <p className="text-xs text-ax-text-secondary mt-1">Paie au comptoir · prise d’effet dès que tu acceptes</p>
              <p className="text-[10px] text-ax-text-muted mt-1">{parisDate(req.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <button onClick={() => onDecide(req, true)} disabled={busy}
                className={`flex items-center gap-1 text-xs font-bold text-ax-accent-foreground bg-ax-accent border border-ax-accent hover:brightness-110 disabled:opacity-50 rounded-ax-control px-2.5 py-1.5 ${FOCUS}`}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accepter
              </button>
              <button onClick={() => onDecide(req, false)} disabled={busy}
                className={`flex items-center gap-1 text-xs font-bold text-ax-danger bg-ax-danger-soft hover:brightness-110 disabled:opacity-50 rounded-ax-control px-2.5 py-1.5 ${FOCUS}`}>
                <X size={13} /> Refuser
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
