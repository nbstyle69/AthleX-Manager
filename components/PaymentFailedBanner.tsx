'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  boxId: string;
}

/**
 * Bandeau past_due du gérant : le paiement du renouvellement a échoué, l'accès
 * est maintenu, on l'envoie sur le portail Stripe pour mettre à jour la carte.
 */
export default function PaymentFailedBanner({ boxId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Portail indisponible');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-testid="payment-failed-banner"
      className="flex flex-wrap items-center gap-3 bg-ax-danger-soft border border-ax-danger rounded-ax-card px-4 py-3 mb-6"
    >
      <CreditCard size={18} className="text-ax-danger shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-ax-danger">Paiement en échec — mettre à jour la carte</p>
        <p className="text-xs text-ax-text-secondary">
          Le renouvellement de ton abonnement n&apos;a pas pu être prélevé. L&apos;accès est maintenu le temps de régulariser.
          {error ? ` · ${error}` : ''}
        </p>
      </div>
      <Button
        variant="ax-white"
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="gap-1.5 text-xs"
      >
        {loading ? 'Ouverture…' : 'Mettre à jour la carte'}
        <ExternalLink size={12} />
      </Button>
    </div>
  );
}
