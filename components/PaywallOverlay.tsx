'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, CreditCard, RefreshCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { parisDate } from '@/lib/datetime';

interface Props {
  boxId: string;
  trialEndsAt: string | null;
}

export default function PaywallOverlay({ boxId, trialEndsAt }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const endedLabel = trialEndsAt
    ? parisDate(trialEndsAt, { day: 'numeric', month: 'long', year: 'numeric' })
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <Card className="rounded-ax-panel shadow-ax-panel p-8 max-w-md w-full max-h-full overflow-y-auto text-center">
        <div className="w-14 h-14 rounded-ax-card bg-ax-accent-soft border border-ax-border flex items-center justify-center mx-auto mb-5">
          <Lock size={24} className="text-ax-accent-text" />
        </div>
        <h2 id="paywall-title" className="font-display text-xl font-medium uppercase tracking-wide text-ax-text mb-2">
          Ton essai gratuit est terminé
        </h2>
        <p className="text-sm text-ax-text-secondary mb-1">
          {endedLabel
            ? `L'essai s'est terminé le ${endedLabel}.`
            : 'Ton essai gratuit est arrivé à échéance.'}
        </p>
        <p className="text-sm text-ax-text-secondary mb-6">
          Souscris au Plan Complet pour retrouver l&apos;accès à AthleX Manager. Tes données sont conservées.
        </p>

        <Link
          href={`/pricing?box_id=${boxId}`}
          className={cn(buttonVariants({ variant: 'ax-mint', className: 'w-full mb-3' }))}
        >
          <CreditCard size={16} />
          Souscrire maintenant
        </Link>

        <Button
          variant="ax-outline"
          onClick={handleRefresh}
          disabled={syncing}
          className="w-full text-xs"
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          J&apos;ai déjà payé — actualiser
        </Button>

        {notFound && (
          <p className="text-xs text-ax-danger mt-2">
            Aucun abonnement actif détecté. Si tu viens de payer, patiente quelques secondes puis réessaie.
          </p>
        )}
      </Card>
    </div>
  );
}
