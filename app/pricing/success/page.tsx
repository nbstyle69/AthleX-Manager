'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Zap, Smartphone, ChevronRight, Loader2 } from 'lucide-react';

function SubscriptionVerifier() {
  const searchParams = useSearchParams();
  const boxId = searchParams.get('box_id');

  useEffect(() => {
    if (!boxId) return;
    fetch('/api/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ box_id: boxId }),
    })
      .then(r => r.json())
      .then(data => console.log('Subscription verified:', data))
      .catch(() => {});
  }, [boxId]);

  return null;
}

export default function SubscriptionSuccessPage() {
  return (
    <>
      <Suspense fallback={null}>
        <SubscriptionVerifier />
      </Suspense>
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
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone size={16} className="text-white" />
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
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#B8911F] text-[#0A0A0A] font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-white/20 mb-4"
        >
          Ouvrir l&apos;app AthleX <ChevronRight size={16} />
        </a>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white font-bold py-3.5 rounded-xl text-sm hover:bg-white/10 transition-colors mb-4"
        >
          Retour au dashboard
        </Link>

        <Link
          href="/landing"
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
    </>
  );
}
