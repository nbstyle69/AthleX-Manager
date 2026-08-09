'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap } from 'lucide-react';

export default function ManageSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ManageContent />
    </Suspense>
  );
}

function ManageContent() {
  const params = useSearchParams();
  const boxId = params.get('box_id');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boxId) {
      setError('Paramètre box_id manquant. Retourne sur l\'app et réessaie.');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/stripe-portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ box_id: boxId }),
        });
        if (res.status === 401) {
          // Page ouverte depuis l'app mobile : aucune session web. Connexion
          // puis retour direct sur le portail.
          window.location.href = `/login/box?next=${encodeURIComponent(`/pricing/manage?box_id=${boxId}`)}`;
          return;
        }
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error ?? 'Erreur lors de l\'ouverture du portail');
        }
      } catch {
        setError('Erreur réseau');
      }
    })();
  }, [boxId]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased flex items-center justify-center p-6">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-400 text-sm font-bold">{error}</p>
            <a href="athlex://subscription" className="text-white text-sm mt-4 inline-block">
              Retour à l&apos;app
            </a>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <Zap size={22} className="text-white" />
            </div>
            <p className="text-gray-400 text-sm">Redirection vers le portail de facturation...</p>
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
