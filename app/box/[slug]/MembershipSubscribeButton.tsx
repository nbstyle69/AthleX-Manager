'use client';

import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react';
import Link from 'next/link';
import { X, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { entryRefusalFrom, entryRefusalInfo } from '@/lib/entryRefusalView';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import BillingDayRecap, { CashUntilNotice } from '@/components/membership/BillingDayRecap';
import { perMonthSuffix } from '@/lib/monthlyPrice';

interface Props {
  planId: string;
  planName: string;
  /** Montant seul (« 49 € ») : « / mois » est ajouté ici pour un abonnement. */
  priceLabel: string;
  /** 'subscription' (mensuel) ou 'oneshot' (Drop-in / Carnet, paiement unique) */
  mode?: 'subscription' | 'oneshot';
  commitmentMonths?: number;
  description?: string | null;
  maxSessionsPerWeek?: number | null;
  terms?: string | null;
  termsPdfUrl?: string | null;
  /**
   * Comptoir P1 : déclencheur fourni par l'appelant (/compte) à la place du
   * bouton « S'abonner — prix ». La fenêtre propose alors « Choisir une autre
   * formule → » vers `otherPlansHref`.
   */
  trigger?: ReactElement<{ onClick?: MouseEventHandler }>;
  otherPlansHref?: string | null;
  /** Fin d'accès comptoir connue de l'appelant, affichée avant le premier aperçu. */
  cashUntil?: string | null;
}

export default function MembershipSubscribeButton({
  planId, planName, priceLabel, mode = 'subscription',
  commitmentMonths = 0, description = null, maxSessionsPerWeek = null, terms = null, termsPdfUrl = null,
  trigger, otherPlansHref = null, cashUntil: initialCashUntil = null,
}: Props) {
  const oneShot = mode === 'oneshot';
  const cta = oneShot ? 'Acheter' : 'S\'abonner';
  // Prix mensuel affiché une seule fois « 49 € / mois » (lib/monthlyPrice).
  const price = oneShot ? priceLabel : `${priceLabel}${perMonthSuffix()}`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // L'aperçu fait foi : il remplace la fin d'accès passée par l'appelant dès qu'il arrive.
  const [cashUntil, setCashUntil] = useState<string | null>(initialCashUntil);
  // Archivage (PR 3) : un refus de box fermée s'affiche dans une boîte d'information.
  const { dialog, inform } = useConfirmDialog();

  // Refus renvoyé dès l'aperçu des montants (box fermée entre-temps).
  function showRefusal(data: unknown): boolean {
    const refusal = entryRefusalFrom(data);
    if (!refusal) return false;
    setOpen(false); void inform(entryRefusalInfo(refusal));
    return true;
  }

  async function handleCheckout(billingDay?: number) {
    setLoading(true);
    setError(null);
    try {
      // L'e-mail n'est plus saisi ici : c'est celui du paiement Stripe (ou de la
      // session si l'acheteur est connecté) qui détermine le compte crédité.
      const res = await fetch('/api/create-membership-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, ...(billingDay ? { billing_day: billingDay } : {}) }),
      });
      const data = await res.json();
      const refusal = entryRefusalFrom(data);
      if (refusal) { setLoading(false); setOpen(false); void inform(entryRefusalInfo(refusal)); return; }
      if (!res.ok) throw new Error(data.error ?? 'Erreur de paiement');
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      {dialog}
      {trigger
        ? cloneElement(trigger, { onClick: () => setOpen(true) })
        : (
          <Button onClick={() => setOpen(true)} variant="ax-white" size="ax-compact" className="whitespace-nowrap">
            {cta} — {price}
          </Button>
        )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ax-overlay backdrop-blur-sm">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-ax-surface border border-ax-border rounded-ax-card p-6 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-ax-text-muted hover:text-ax-text transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black mb-1">{cta} — {planName}</h3>
            <p className="text-xs text-ax-text-muted mb-5">
              {oneShot
                ? `${priceLabel} — paiement unique. Utilise l'e-mail de ton compte AthleX au paiement : tes crédits de séances s'activent automatiquement. Pas encore de compte ? Ton achat sera rattaché à ton inscription.`
                : `${price} — abonnement mensuel. Utilise l'e-mail de ton compte AthleX au paiement : ton abonnement et l'accès aux cours s'activent automatiquement dans l'app. Pas encore de compte ? Ton abonnement sera rattaché à ton inscription.`}
            </p>

            {!oneShot && cashUntil && <CashUntilNotice until={cashUntil} />}

            {!oneShot && (
              <div className="bg-ax-hover border border-ax-border rounded-ax-control p-3 mb-4 space-y-1.5">
                <p className="text-[11px] font-black text-ax-text uppercase tracking-wide mb-1">Récapitulatif du contrat</p>
                <div className="flex justify-between text-xs">
                  <span className="text-ax-text-muted">Prix TTC</span>
                  <span className="text-ax-text font-semibold">{price}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ax-text-muted">Engagement</span>
                  <span className="text-ax-text font-semibold">
                    {commitmentMonths > 0 ? `${commitmentMonths} mois` : 'Sans engagement'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ax-text-muted">Séances</span>
                  <span className="text-ax-text font-semibold">
                    {maxSessionsPerWeek ? `${maxSessionsPerWeek} / semaine` : 'Illimitées'}
                  </span>
                </div>
                {description && (
                  <p className="text-[11px] text-ax-text-secondary pt-1.5 border-t border-ax-border whitespace-pre-wrap">{description}</p>
                )}
                {terms && (
                  <p className="text-[11px] text-ax-text-muted pt-1.5 border-t border-ax-border whitespace-pre-wrap">{terms}</p>
                )}
                <p className="text-[10px] text-ax-text-muted pt-1.5 border-t border-ax-border">
                  {commitmentMonths > 0
                    ? `Résiliation libre après ${commitmentMonths} mois. Avant l'échéance : uniquement pour motif légitime (déménagement, santé) sur justificatif. Gel possible en cas de blessure/absence.`
                    : `Résiliation à tout moment (effet à la fin de la période payée). Gel possible en cas de blessure/absence.`}
                </p>
                {termsPdfUrl && (
                  <a
                    href={termsPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-ax-text-secondary hover:text-ax-text pt-1.5 border-t border-ax-border"
                  >
                    <FileText size={12} /> Voir les conditions générales (PDF)
                  </a>
                )}
              </div>
            )}

            {oneShot ? (
              <>
                {error && <p className="text-xs text-ax-danger mb-3">{error}</p>}
                <Button onClick={() => handleCheckout()} disabled={loading} variant="ax-white" className="w-full">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Redirection…</> : 'Payer par carte'}
                </Button>
              </>
            ) : (
              <BillingDayRecap
                request={{ plan_id: planId }}
                onPay={handleCheckout}
                paying={loading}
                error={error}
                onRefusal={showRefusal}
                onPreview={(p) => setCashUntil(p.cash_until ?? null)}
              />
            )}
            {trigger && otherPlansHref && (
              <Link
                href={otherPlansHref}
                className="block mt-3 text-center text-xs font-bold text-ax-text hover:underline underline-offset-2"
              >
                Choisir une autre formule →
              </Link>
            )}
            <p className="text-[10px] text-ax-text-muted mt-3 text-center">
              Paiement sécurisé par Stripe. Aucune donnée bancaire n'est stockée par AthleX.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
