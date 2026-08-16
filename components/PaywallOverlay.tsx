'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, CreditCard, RefreshCw } from 'lucide-react';

interface Props {
  boxId: string;
  trialEndsAt: string | null;
}

export default function PaywallOverlay({ boxId, trialEndsAt }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const endedLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function handleRefresh() {
    setSyncing(true);
    setNotFound(false);
    try {
      const res = await fetch('/api/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      if (data.status === 'active' || data.status === 'trialing') {
        router.refresh();
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center mx-auto mb-5">
          <Lock size={24} className="text-white" />
        </div>
        <h2 id="paywall-title" className="text-xl font-bold text-white mb-2">
          Ton essai gratuit est terminé
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          {endedLabel
            ? `L'essai s'est terminé le ${endedLabel}.`
            : 'Ton essai gratuit est arrivé à échéance.'}
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Souscris au Plan Complet pour retrouver l&apos;accès à AthleX Manager. Tes données sont conservées.
        </p>

        <Link
          href={`/pricing?box_id=${boxId}`}
          className="w-full flex items-center justify-center gap-2 bg-white text-[#0A0A0A] font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors text-sm mb-3"
        >
          <CreditCard size={16} />
          Souscrire maintenant
        </Link>

        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-xs font-bold py-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          J&apos;ai déjà payé — actualiser
        </button>

        {notFound && (
          <p className="text-xs text-red-400 mt-2">
            Aucun abonnement actif détecté. Si tu viens de payer, patiente quelques secondes puis réessaie.
          </p>
        )}
      </div>
    </div>
  );
}
