'use client';

import Link from 'next/link';
import { CheckCircle2, Zap, Smartphone, ChevronRight } from 'lucide-react';

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-3xl bg-green-500/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-400" />
        </div>

        <h1 className="text-3xl font-black mb-3">Souscription réussie !</h1>
        <p className="text-gray-400 text-base mb-8">
          Ton abonnement AthleX est maintenant actif. Tu peux retourner sur l&apos;app pour accéder à tout ton back-office.
        </p>

        {/* Steps */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#C9A227]/15 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone size={16} className="text-[#C9A227]" />
            </div>
            <div>
              <p className="text-sm font-bold">Retourne sur l&apos;app AthleX</p>
              <p className="text-xs text-gray-500 mt-1">Ton abonnement sera automatiquement détecté</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Toutes les fonctionnalités sont débloquées</p>
              <p className="text-xs text-gray-500 mt-1">Membres, WODs, réservations, analytics, et plus</p>
            </div>
          </div>
        </div>

        {/* Deep link to app */}
        <a
          href="athlex://subscription-success"
          className="w-full flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-[#C9A227]/20 mb-4"
        >
          Ouvrir l&apos;app AthleX <ChevronRight size={16} />
        </a>

        <Link
          href="/landing"
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
