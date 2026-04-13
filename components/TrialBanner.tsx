'use client';

import { Zap, AlertTriangle, Crown, Clock, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface Props {
  status: string;
  daysLeft: number;
  trialEndsAt: string | null;
  isEarlyAdopter: boolean;
  boxId: string;
}

export default function TrialBanner({ status, daysLeft, trialEndsAt, isEarlyAdopter, boxId }: Props) {
  if (status === 'active') {
    return (
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-6">
        <Crown size={18} className="text-emerald-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-400">Plan Complet actif</p>
          <p className="text-xs text-gray-400">Toutes les fonctionnalités sont débloquées</p>
        </div>
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
      <Link
        href={`/pricing?box_id=${boxId}`}
        className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 hover:bg-red-500/15 transition-colors"
      >
        <AlertTriangle size={18} className="text-red-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-red-400">Essai terminé</p>
          <p className="text-xs text-gray-400">Souscris pour continuer à utiliser le back-office</p>
        </div>
        <span className="text-xs font-bold text-red-400">Souscrire →</span>
      </Link>
    );
  }

  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7;

  const textColor = isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[#C9A227]';
  const bgColor = isUrgent ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : 'bg-[#C9A227]/8';
  const borderColor = isUrgent ? 'border-red-500/20' : isWarning ? 'border-amber-500/20' : 'border-[#C9A227]/20';
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
