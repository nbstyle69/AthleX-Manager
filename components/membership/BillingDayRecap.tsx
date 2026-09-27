'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parisDate } from '@/lib/datetime';
import { BILLING_DAY_MAX, BILLING_DAY_MIN } from '@/lib/membershipBilling';

/**
 * Lot 3 — choix du jour de prélèvement (1 à 10) et montants AVANT validation.
 * Les montants viennent de /api/membership-checkout-preview : même calcul que
 * le checkout. Le bouton ne s'active qu'une fois le jour choisi et l'aperçu reçu.
 */

type Preview =
  | {
      kind: 'now'; currency: string; today_cents: number; prorata_until: string | null;
      next_charge_date: string; recurring_cents: number; due_date_ignored: boolean;
    }
  | {
      kind: 'deferred'; currency: string; first_charge_date: string; first_charge_cents: number;
      merged_prorata_cents: number; prorata_until: string | null; recurring_cents: number; due_date: string;
    };

const DAYS = Array.from({ length: BILLING_DAY_MAX - BILLING_DAY_MIN + 1 }, (_, i) => BILLING_DAY_MIN + i);

const ordinalDay = (d: number) => (d === 1 ? '1er' : String(d));
const longDate = (ymd: string) => parisDate(ymd, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (ymd: string) => parisDate(ymd, { day: 'numeric', month: 'long' });

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="text-xs">
      <div className="flex justify-between gap-3">
        <span className="text-ax-text-muted">{label}</span>
        <span className="text-ax-text font-semibold text-right">{value}</span>
      </div>
      {hint && <p className="text-[11px] text-ax-text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export default function BillingDayRecap({
  request, onPay, paying, error, onRefusal,
}: {
  /** `{ plan_id }` (page publique) ou `{ invitation_token }` (invitation). */
  request: Record<string, string>;
  onPay: (billingDay: number) => void;
  paying: boolean;
  error: string | null;
  /** Refus de box fermée renvoyé par l'aperçu : affiché par le parent. */
  onRefusal?: (payload: unknown) => boolean;
}) {
  const [day, setDay] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const requestKey = JSON.stringify(request);
  const refusalRef = useRef(onRefusal);
  refusalRef.current = onRefusal;

  useEffect(() => {
    if (day === null) return;
    const ctrl = new AbortController();
    setLoading(true);
    setPreview(null);
    setPreviewError(null);
    fetch('/api/membership-checkout-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...JSON.parse(requestKey), billing_day: day }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (refusalRef.current?.(data)) return;
        if (!res.ok) throw new Error(data.error ?? 'Montants indisponibles.');
        setPreview(data as Preview);
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setPreviewError(e instanceof Error ? e.message : 'Montants indisponibles.');
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [day, requestKey]);

  const deferred = preview?.kind === 'deferred';

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-[11px] font-black text-ax-text uppercase tracking-wide mb-1">Jour de prélèvement</legend>
        <p className="text-[11px] text-ax-text-muted mb-2">Choisis le jour du mois où ton abonnement sera prélevé.</p>
        <div className="grid grid-cols-5 gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={day === d}
              aria-label={`Le ${ordinalDay(d)} du mois`}
              className={`min-h-10 rounded-ax-control border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus ${
                day === d
                  ? 'bg-ax-text text-ax-background border-ax-text'
                  : 'bg-ax-hover text-ax-text border-ax-border hover:border-ax-input-border'
              }`}
            >
              {ordinalDay(d)}
            </button>
          ))}
        </div>
      </fieldset>

      {day !== null && (
        <div className="bg-ax-hover border border-ax-border rounded-ax-control p-3 space-y-2" aria-live="polite">
          {loading && (
            <p className="text-xs text-ax-text-muted flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Calcul des montants…
            </p>
          )}
          {previewError && <p className="text-xs text-ax-danger">{previewError}</p>}

          {preview?.kind === 'now' && (
            <>
              {preview.due_date_ignored && (
                <p className="text-[11px] text-ax-text-muted">Ta prochaine échéance est passée : ton abonnement démarre aujourd’hui.</p>
              )}
              <Line
                label="Aujourd’hui"
                value={money(preview.today_cents, preview.currency)}
                hint={preview.prorata_until ? `Prorata jusqu’au ${shortDate(preview.prorata_until)}` : null}
              />
              <Line
                label="Ensuite"
                value={`${money(preview.recurring_cents, preview.currency)} le ${ordinalDay(day)} de chaque mois`}
                hint={`Prochain prélèvement le ${longDate(preview.next_charge_date)}`}
              />
              {preview.prorata_until && (
                <p className="text-[10px] text-ax-text-muted pt-1.5 border-t border-ax-border">
                  Le prorata est recalculé au moment du paiement : un écart d’un centime est possible, la page de paiement Stripe fait foi.
                </p>
              )}
            </>
          )}

          {preview?.kind === 'deferred' && (
            <>
              <p className="text-xs font-bold text-ax-text">Aucun prélèvement aujourd’hui</p>
              <Line
                label={`Premier prélèvement le ${longDate(preview.first_charge_date)}`}
                value={money(preview.first_charge_cents, preview.currency)}
                hint={
                  preview.merged_prorata_cents > 0
                    ? `Prorata depuis le ${shortDate(preview.due_date)} (${money(preview.merged_prorata_cents, preview.currency)}) + ton premier mois`
                    : preview.prorata_until
                      ? `Prorata jusqu’au ${shortDate(preview.prorata_until)}`
                      : null
                }
              />
              <Line
                label="Ensuite"
                value={`${money(preview.recurring_cents, preview.currency)} le ${ordinalDay(day)} de chaque mois`}
              />
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-ax-danger">{error}</p>}
      <Button
        type="button"
        onClick={() => day !== null && onPay(day)}
        disabled={paying || day === null || !preview}
        variant="ax-white"
        className="w-full"
      >
        {paying
          ? <><Loader2 size={16} className="animate-spin" /> Redirection…</>
          : deferred ? 'Enregistrer mon moyen de paiement' : 'Payer'}
      </Button>
      {deferred && (
        <p className="text-[10px] text-ax-text-muted text-center">Carte bancaire ou mandat de prélèvement SEPA.</p>
      )}
    </div>
  );
}
