'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, AlertTriangle, Crown, Clock, CreditCard, RefreshCw } from 'lucide-react';
import Link from 'next/link';

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
        className="flex items-center gap-3 bg-white/8 border border-white/20 rounded-xl px-4 py-3 mb-6 hover:opacity-90 transition-opacity"
      >
        <Zap size={18} className="text-white shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Aucun abonnement</p>
          <p className="text-xs text-gray-400">Active ton essai gratuit de 14 jours ou souscris directement</p>
        </div>
        <span className="text-xs font-bold text-white">Souscrire →</span>
      </Link>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-6">
        <Crown size={18} className="text-emerald-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-400">Plan Complet actif</p>
          <p className="text-xs text-gray-400">Toutes les fonctionnalités sont débloquées</p>
        </div>
        <Link href={`/pricing/manage?box_id=${boxId}`} className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
          Gérer →
        </Link>
      </div>
    );
  }

  if (status === 'past_due') {
    return (
      <Link
        href={`/pricing/manage?box_id=${boxId}`}
        className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 hover:bg-red-500/15 transition-colors"
      >
        <CreditCard size={18} className="text-red-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-red-400">Paiement échoué</p>
          <p className="text-xs text-gray-400">Mets à jour ton moyen de paiement pour continuer</p>
        </div>
        <span className="text-xs font-bold text-red-400">Gérer →</span>
      </Link>
    );
  }

  if (status === 'canceled' || status === 'expired' || daysLeft <= 0) {
    return (
      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6">
        <AlertTriangle size={18} className="text-red-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-red-400">Essai terminé</p>
          <p className="text-xs text-gray-400">Souscris pour continuer à utiliser le back-office</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs font-bold text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          title="Vérifier le statut de l'abonnement"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        </button>
        <Link href={`/pricing?box_id=${boxId}`} className="text-xs font-bold text-red-400 hover:text-red-300">
          Souscrire →
        </Link>
      </div>
    );
  }

  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7;

  const textColor = isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white';
  const bgColor = isUrgent ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : 'bg-white/8';
  const borderColor = isUrgent ? 'border-red-500/20' : isWarning ? 'border-amber-500/20' : 'border-white/20';
  const Icon = isUrgent ? AlertTriangle : isWarning ? Clock : Zap;

  const endsLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Link
      href={`/pricing?box_id=${boxId}`}
      className={`flex items-center gap-3 ${bgColor} border ${borderColor} rounded-xl px-4 py-3 mb-6 hover:opacity-90 transition-opacity`}
    >
      <Icon size={18} className={`${textColor} shrink-0`} />
      <div className="flex-1">
        <p className={`text-sm font-bold ${textColor}`}>
          {isEarlyAdopter ? '🏅 Fondateur · ' : ''}Essai gratuit · J-{daysLeft}
        </p>
        <p className="text-xs text-gray-400">
          {isUrgent
            ? 'Plus que quelques jours ! Souscris pour ne rien perdre.'
            : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`}
          {endsLabel ? ` — Expire le ${endsLabel}` : ''}
        </p>
      </div>
      <span className={`text-xs font-bold ${textColor}`}>Voir →</span>
    </Link>
  );
}
