'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { readBoxConnectStatus } from '@/lib/boxPayments';
import { CreditCard, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Stripe Connect de la box : il conditionne la vente des formules ET des
 * programmes, d'où sa place dans Réglages plutôt que dans l'une des deux pages.
 */
export default function BoxPaymentsSection({ boxId }: { boxId: string | null }) {
  const supabase = createClient();
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!boxId) return;
    let annule = false;
    (async () => {
      const connect = await readBoxConnectStatus(supabase, boxId);
      if (annule) return;
      setStripeAccountId(connect.stripeAccountId);
      setOnboardingComplete(connect.onboardingComplete);

      const params = new URLSearchParams(window.location.search);
      if (params.get('connect') === 'return' || params.get('connect') === 'refresh') {
        await refreshConnect();
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  async function startOnboarding() {
    if (!boxId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch { /* noop */ }
    setLoading(false);
  }

  async function refreshConnect() {
    if (!boxId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/connect/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      setOnboardingComplete(Boolean(data.onboarding_complete));
    } catch { /* noop */ }
    setLoading(false);
  }

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={15} className="text-ax-success" />
          <h2 className="text-sm font-bold text-ax-text">Paiements</h2>
        </div>
        <p className="text-xs text-ax-text-muted">
          Encaisse tes formules d&apos;accès, tes codes promo et tes programmes athlètes via Stripe.
        </p>
      </div>

      {onboardingComplete ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-ax-control bg-ax-success-soft flex items-center justify-center">
            <Check size={18} className="text-ax-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ax-text">Paiements activés</p>
            <p className="text-xs text-ax-text-muted">Les paiements arrivent directement sur ton compte (commission AthleX 4 %).</p>
          </div>
          <button onClick={refreshConnect} disabled={loading} className="text-xs text-ax-text-muted hover:text-ax-text font-semibold transition-colors disabled:opacity-50">
            {loading ? '...' : 'Actualiser'}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-ax-control bg-ax-warning-soft flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-ax-warning" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ax-text">Active les paiements pour vendre tes offres</p>
            <p className="text-xs text-ax-text-muted mb-3">
              Connecte ton compte via Stripe (2 min). Les offres gratuites restent accessibles sans cette étape.
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={startOnboarding}
                disabled={loading}
                variant="ax-white"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                {stripeAccountId ? 'Continuer la configuration' : 'Activer les paiements'}
              </Button>
              {stripeAccountId && (
                <button onClick={refreshConnect} disabled={loading} className="text-xs text-ax-text-muted hover:text-ax-text font-semibold transition-colors disabled:opacity-50">
                  J&apos;ai terminé — actualiser
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
