'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, AlertTriangle, Crown, Clock, CreditCard, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  status: string;
  daysLeft: number;
  trialEndsAt: string | null;
  isEarlyAdopter: boolean;
  boxId: string;
}

export default function TrialBanner({ status: initialStatus, daysLeft, trialEndsAt, isEarlyAdopter, boxId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [syncing, setSyncing] = useState(false);

  // Keep local status in sync when the server re-renders with a fresh value
  // (e.g. after router.refresh() following a successful subscription sync).
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Auto-verify on mount if not active (webhook may have been missed)
  useEffect(() => {
    if (initialStatus === 'active') return;
    fetch('/api/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ box_id: boxId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.status && data.status !== initialStatus) {
          setStatus(data.status);
          if (data.updated) router.refresh();
        }
      })
      .catch(() => {});
  }, [boxId, initialStatus, router]);

  function handleSync(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSyncing(true);
    fetch('/api/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ box_id: boxId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.status) setStatus(data.status);
        if (data.updated) router.refresh();
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }

  if (status === 'none') {
    return (
      <Link
        href={`/pricing?box_id=${boxId}`}
        className="flex items-center gap-3 bg-ax-surface border border-ax-border rounded-ax-card px-4 py-3 mb-6 text-ax-text hover:bg-ax-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none"
      >
        <Zap size={18} className="text-ax-accent-text shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ax-text">Aucun abonnement</p>
          <p className="text-xs text-ax-text-secondary">Active ton essai gratuit de 14 jours ou souscris directement</p>
        </div>
        <span className={cn(buttonVariants({ variant: 'ax-mint', className: 'text-xs' }))}>Souscrire →</span>
      </Link>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex items-center gap-3 bg-ax-success-soft border border-ax-success rounded-ax-card px-4 py-3 mb-6">
        <Crown size={18} className="text-ax-success shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ax-success">Plan Complet actif</p>
          <p className="text-xs text-ax-text-secondary">Toutes les fonctionnalités sont débloquées</p>
        </div>
        <Link href={`/pricing/manage?box_id=${boxId}`} className={cn(buttonVariants({ variant: 'ax-outline', className: 'text-xs' }))}>
          Gérer →
        </Link>
      </div>
    );
  }

  if (status === 'past_due') {
    return (
      <Link
        href={`/pricing/manage?box_id=${boxId}`}
        className="flex items-center gap-3 bg-ax-danger-soft border border-ax-danger rounded-ax-card px-4 py-3 mb-6 hover:bg-ax-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none"
      >
        <CreditCard size={18} className="text-ax-danger shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ax-danger">Paiement échoué</p>
          <p className="text-xs text-ax-text-secondary">Mets à jour ton moyen de paiement pour continuer</p>
        </div>
        <span className={cn(buttonVariants({ variant: 'ax-outline', className: 'text-xs' }))}>Gérer →</span>
      </Link>
    );
  }

  if (status === 'canceled' || status === 'expired' || daysLeft <= 0) {
    return (
      <div className="flex items-center gap-3 bg-ax-danger-soft border border-ax-danger rounded-ax-card px-4 py-3 mb-6">
        <AlertTriangle size={18} className="text-ax-danger shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ax-danger">Essai terminé</p>
          <p className="text-xs text-ax-text-secondary">Souscris pour continuer à utiliser AthleX Manager</p>
        </div>
        <Button
          variant="ax-outline"
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0 px-3 text-xs"
          title="Vérifier le statut de l'abonnement"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        </Button>
        <Link href={`/pricing?box_id=${boxId}`} className={cn(buttonVariants({ variant: 'ax-white', className: 'text-xs' }))}>
          Souscrire →
        </Link>
      </div>
    );
  }

  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7;

  const textColor = isUrgent ? 'text-ax-danger' : isWarning ? 'text-ax-warning' : 'text-ax-text';
  const bgColor = isUrgent ? 'bg-ax-danger-soft' : isWarning ? 'bg-ax-warning-soft' : 'bg-ax-surface';
  const borderColor = isUrgent ? 'border-ax-danger' : isWarning ? 'border-ax-warning' : 'border-ax-border';
  const Icon = isUrgent ? AlertTriangle : isWarning ? Clock : Zap;

  const endsLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Link
      href={`/pricing?box_id=${boxId}`}
      className={`flex items-center gap-3 ${bgColor} border ${borderColor} rounded-ax-card px-4 py-3 mb-6 hover:bg-ax-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none`}
    >
      <Icon size={18} className={`${textColor} shrink-0`} />
      <div className="flex-1">
        <p className={`text-sm font-bold ${textColor}`}>
          {isEarlyAdopter ? '🏅 Fondateur · ' : ''}Essai gratuit · J-{daysLeft}
        </p>
        <p className="text-xs text-ax-text-secondary">
          {isUrgent
            ? 'Plus que quelques jours ! Souscris pour ne rien perdre.'
            : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`}
          {endsLabel ? ` — Expire le ${endsLabel}` : ''}
        </p>
      </div>
      <span className={cn(buttonVariants({ variant: 'ax-outline', className: 'text-xs' }))}>Voir →</span>
    </Link>
  );
}
