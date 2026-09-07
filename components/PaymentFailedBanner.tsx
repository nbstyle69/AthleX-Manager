'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';

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
      className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6"
    >
      <CreditCard size={18} className="text-red-400 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-400">Paiement en échec — mettre à jour la carte</p>
        <p className="text-xs text-gray-400">
          Le renouvellement de ton abonnement n&apos;a pas pu être prélevé. L&apos;accès est maintenu le temps de régulariser.
          {error ? ` · ${error}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
      >
        {loading ? 'Ouverture…' : 'Mettre à jour la carte'}
        <ExternalLink size={12} />
      </button>
    </div>
  );
}
