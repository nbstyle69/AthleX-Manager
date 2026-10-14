'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useModalEscape } from '@/lib/modalEscape';
import { euros } from '@/lib/monthlyPrice';
import { monthlyPrice } from '@/lib/monthlyPrice';
import { parisDate } from '@/lib/datetime';
import {
  COUNTER_DURATIONS, FREE_PLAN_NOTE, cashAmountCents, counterPeriod, daysFromToday, isPayablePlan,
  periodLabel, shortDate,
} from '@/lib/comptoir/counter';
import { recordCashPayment, type CashTarget } from '@/lib/comptoir/cashPayment';

export interface CashPaymentRequest {
  target: CashTarget;
  /** Pseudo du membre, ou nom / e-mail de l'invité. */
  who: string;
  planName: string | null;
  priceCents: number | null;
  /** Fin d'accès en cours (AAAA-MM-JJ), si connue. */
  currentUntil: string | null;
}

/**
 * Fenêtre « Encaissement reçu » (maquette 65:21994) : durée 1, 3 ou 12 mois,
 * montant et nouvelle période affichés avant l'envoi. Le calcul affiché est un
 * miroir de la base ; après l'appel, la fin d'accès affichée est celle de la RPC.
 */
export default function CashPaymentDialog({
  request, onClose, onDone, now,
}: {
  request: CashPaymentRequest | null;
  onClose: () => void;
  /** Encaissement enregistré : rechargement de la page appelante. */
  onDone: () => void;
  /** Bancs et tests seulement. */
  now?: Date;
}) {
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ accessUntil: string | null } | null>(null);

  useEffect(() => { setMonths(1); setBusy(false); setError(null); setDone(null); }, [request]);

  const close = () => {
    if (busy) return;
    if (done) onDone();
    onClose();
  };
  useModalEscape(!!request, close);

  if (!request) return null;

  const today = now ?? new Date();
  const payable = isPayablePlan(request.priceCents);
  const running = !!request.currentUntil && daysFromToday(request.currentUntil, today) >= 0;
  const period = counterPeriod(request.currentUntil, months, today);
  const head = [request.who, request.planName ?? 'Sans formule', payable ? monthlyPrice(request.priceCents!) : null]
    .filter(Boolean).join(' · ');

  async function submit() {
    if (!request) return;
    setBusy(true); setError(null);
    const res = await recordCashPayment(createClient(), request.target, months);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setDone({ accessUntil: res.accessUntil });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass px-4" onClick={close}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="encaissement-titre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-ax-surface border border-ax-border rounded-ax-panel shadow-ax-panel p-6"
        data-testid="fenetre-encaissement"
      >
        <h2 id="encaissement-titre" className="font-display text-xl font-medium tracking-wide text-ax-text">Encaissement reçu</h2>
        <p className="mt-3 text-sm text-ax-text-secondary break-words">
          {head}.{running ? ` Accès en cours jusqu’au ${shortDate(request.currentUntil!)}.` : ''}
        </p>

        {done ? (
          <p className="mt-4 rounded-ax-control border border-ax-border bg-ax-hover px-3 py-2.5 text-sm font-semibold text-ax-text" role="status">
            Encaissement enregistré{done.accessUntil ? ` : accès jusqu’au ${shortDate(done.accessUntil)}.` : '.'}
          </p>
        ) : payable ? (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-ax-text" id="encaissement-duree">Durée</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby="encaissement-duree">
              {COUNTER_DURATIONS.map((d) => (
                <button
                  key={d} type="button" role="radio" aria-checked={months === d} onClick={() => setMonths(d)}
                  className={`min-h-10 rounded-ax-control border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus ${
                    months === d ? 'bg-ax-text text-ax-background border-ax-text' : 'bg-ax-hover text-ax-text border-ax-border hover:border-ax-input-border'}`}
                >
                  {d} mois
                </button>
              ))}
            </div>
            <div className="space-y-2 rounded-ax-control border border-ax-border bg-ax-hover p-3 text-xs" data-testid="recapitulatif-encaissement">
              <div className="flex justify-between gap-3"><span className="text-ax-text-secondary">Montant encaissé</span><span className="font-semibold text-ax-text">{euros(cashAmountCents(request.priceCents!, months))}</span></div>
              <div className="flex justify-between gap-3"><span className="text-ax-text-secondary">Nouvelle période</span><span className="font-semibold text-ax-text text-right">{periodLabel(period.from, period.until)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-ax-text-secondary">Accès jusqu’au</span><span className="font-semibold text-ax-text">{shortDate(period.until)}</span></div>
              {running && (
                <p className="text-[11px] text-ax-text-secondary">
                  L’accès en cours se termine le {parisDate(request.currentUntil!, { day: 'numeric', month: 'short' })} : la nouvelle période commence le lendemain, aucun jour n’est perdu.
                </p>
              )}
            </div>
            <p className="text-[11px] text-ax-text-secondary">
              Montant = prix de la formule × durée, lu par la base. Il entre dans le journal des encaissements, non modifiable. Le membre est prévenu avant la fin de la nouvelle période.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ax-text-secondary">{FREE_PLAN_NOTE}</p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {done ? (
            <Button variant="ax-white" onClick={close}>Fermer</Button>
          ) : (
            <>
              <Button variant="ax-outline" onClick={close} disabled={busy}>Annuler</Button>
              <Button variant="ax-white" onClick={submit} disabled={busy}>
                {busy && <Loader2 size={15} className="animate-spin" />} Enregistrer l’encaissement
              </Button>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-ax-danger" role="alert">{error}</p>}
      </div>
    </div>
  );
}
